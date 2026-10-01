import type { LatLon } from "../geo/distance";
import { type Region, regionFromAddress } from "../regions";
import type { MedicalDataSource } from "./source";
import { ApiError, parseApiResponse, type RawItem } from "./xml";

/**
 * 2026-07-01 개편 후에도 약국 목록 데이터는 대부분 옛 지역 이름을 쓴다(응급의료기관은 새 이름으로
 * 완전히 바뀌었다). 새 이름 조회에 더해 옛 이름도 조회해 hpid 로 합친다. 옛 구가 여러 새 구로
 * 나뉜 경우(인천 중구→제물포구/영종구, 서구→서해구/검단구)는 주소로 걸러 선택한 구만 남긴다.
 */
const GWANGJU_GU = new Set(["동구", "서구", "남구", "북구", "광산구"]);

const INCHEON_OLD_PHARMACY_SOURCES: Readonly<Record<string, readonly Region[]>> = {
  제물포구: [
    { sido: "인천광역시", sigungu: "중구" },
    { sido: "인천광역시", sigungu: "동구" },
  ],
  영종구: [{ sido: "인천광역시", sigungu: "중구" }],
  서해구: [{ sido: "인천광역시", sigungu: "서구" }],
  검단구: [{ sido: "인천광역시", sigungu: "서구" }],
};

function oldPharmacyRegions(region: Region): readonly Region[] {
  if (region.sido === "전남광주통합특별시") {
    const oldSido = GWANGJU_GU.has(region.sigungu) ? "광주광역시" : "전라남도";
    return [{ sido: oldSido, sigungu: region.sigungu }];
  }
  if (region.sido === "인천광역시") {
    return INCHEON_OLD_PHARMACY_SOURCES[region.sigungu] ?? [];
  }
  return [];
}

/** docs/api.md 에 출처와 함께 정리한 엔드포인트 */
export const ENDPOINTS = {
  pharmacyList:
    "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire",
  pharmacyLocation:
    "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire",
  emergencyList: "https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire",
  emergencyLocation: "https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytLcinfoInqire",
  emergencyBeds:
    "https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire",
} as const;

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface ClientOptions {
  serviceKey: string;
  fetch: FetchLike;
  timeoutMs?: number;
}

/** 시군구 전체 약국을 한 번에 받는다. 약국이 가장 많은 구도 수백 곳 수준이다. */
const REGION_ROWS = 1000;
const NEAR_ROWS = 50;

export class DataGoKrClient implements MedicalDataSource {
  private readonly serviceKey: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(opts: ClientOptions) {
    this.serviceKey = opts.serviceKey;
    this.fetchFn = opts.fetch;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async pharmaciesByRegion(region: Region): Promise<RawItem[]> {
    const queries = [region, ...oldPharmacyRegions(region)];
    const batches = await Promise.all(
      queries.map((q) =>
        this.get(ENDPOINTS.pharmacyList, {
          Q0: q.sido,
          Q1: q.sigungu,
          ORD: "NAME",
          numOfRows: REGION_ROWS,
        }),
      ),
    );

    const seen = new Set<string>();
    const out: RawItem[] = [];
    batches.forEach((items, i) => {
      const isOldQuery = i > 0;
      for (const item of items) {
        if (isOldQuery) {
          const resolved = item.dutyaddr ? regionFromAddress(item.dutyaddr) : null;
          if (!resolved || resolved.sido !== region.sido || resolved.sigungu !== region.sigungu) {
            continue;
          }
        }
        if (item.hpid) {
          if (seen.has(item.hpid)) continue;
          seen.add(item.hpid);
        }
        out.push(item);
      }
    });
    return out;
  }

  pharmaciesNear(point: LatLon): Promise<RawItem[]> {
    return this.get(ENDPOINTS.pharmacyLocation, {
      WGS84_LON: point.lon,
      WGS84_LAT: point.lat,
      numOfRows: NEAR_ROWS,
    });
  }

  emergencyRoomsByRegion(region: Region): Promise<RawItem[]> {
    return this.get(ENDPOINTS.emergencyList, {
      Q0: region.sido,
      Q1: region.sigungu,
      numOfRows: REGION_ROWS,
    });
  }

  emergencyRoomsNear(point: LatLon): Promise<RawItem[]> {
    return this.get(ENDPOINTS.emergencyLocation, {
      WGS84_LON: point.lon,
      WGS84_LAT: point.lat,
      numOfRows: NEAR_ROWS,
    });
  }

  emergencyBeds(region: Region): Promise<RawItem[]> {
    return this.get(ENDPOINTS.emergencyBeds, {
      STAGE1: region.sido,
      STAGE2: region.sigungu,
      numOfRows: REGION_ROWS,
    });
  }

  /** 테스트에서 요청 URL 을 확인할 수 있게 공개한다. 키는 로그에 남기지 않는다. */
  buildUrl(endpoint: string, params: Record<string, string | number>): string {
    const qs = new URLSearchParams({ ServiceKey: this.serviceKey, pageNo: "1" });
    for (const [k, v] of Object.entries(params)) {
      if (v !== "") qs.set(k, String(v));
    }
    return `${endpoint}?${qs.toString()}`;
  }

  private async get(endpoint: string, params: Record<string, string | number>): Promise<RawItem[]> {
    const url = this.buildUrl(endpoint, params);
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch {
      throw new ApiError("공공데이터포털에 연결하지 못했습니다.");
    }
    if (!res.ok) throw new ApiError(`공공데이터포털 응답 오류 (HTTP ${res.status})`);
    return parseApiResponse(await res.text()).items;
  }
}
