import type { LatLon } from "../geo/distance";
import type { Region } from "../regions";
import type { MedicalDataSource } from "./source";
import { ApiError, parseApiResponse, type RawItem } from "./xml";

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

  pharmaciesByRegion(region: Region): Promise<RawItem[]> {
    return this.get(ENDPOINTS.pharmacyList, {
      Q0: region.sido,
      Q1: region.sigungu,
      ORD: "NAME",
      numOfRows: REGION_ROWS,
    });
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
