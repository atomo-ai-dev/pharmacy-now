import { haversineKm, type LatLon, parseCoord } from "../geo/distance";
import { parseHvidate } from "../model/emergency";
import { isOldPharmacyRegionName, type Region, regionFromAddress } from "../regions";
import type { MedicalDataSource } from "./source";
import { parseApiResponse, type RawItem } from "./xml";

/** 데모 데이터 파일 이름 (fixtures/demo/*.xml) */
export const DEMO_FILES = {
  pharmacies: "pharmacies.xml",
  emergencyRooms: "emergency-list.xml",
  emergencyBeds: "emergency-beds.xml",
} as const;

export type FixtureReader = (file: string) => string;

function sameRegion(address: string | undefined, r: Region): boolean {
  if (!address) return false;
  const parts = address.trim().split(/\s+/);
  const [addressSido, addressSigungu] = parts;

  if (!addressSido) return false;

  if (isOldPharmacyRegionName(addressSido)) {
    return addressSido === r.sido && (r.sigungu === "" || addressSigungu === r.sigungu);
  }

  const found = regionFromAddress(address);
  return (
    found !== null && found.sido === r.sido && (r.sigungu === "" || found.sigungu === r.sigungu)
  );
}

function withDistance(items: RawItem[], p: LatLon): Array<RawItem & { distance: string }> {
  return items
    .map((item) => {
      const lat = parseCoord(item.wgs84lat);
      const lon = parseCoord(item.wgs84lon);
      const d =
        lat !== null && lon !== null ? haversineKm(p, { lat, lon }) : Number.POSITIVE_INFINITY;
      // 위치정보 조회 응답과 같은 필드 이름으로 바꾼다.
      return {
        ...item,
        latitude: item.wgs84lat ?? "",
        longitude: item.wgs84lon ?? "",
        distance: d.toFixed(2),
      };
    })
    .sort((a, b) => Number(a.distance) - Number(b.distance));
}

function formatCompact(d: Date): string {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}${p(k.getUTCMonth() + 1)}${p(k.getUTCDate())}${p(k.getUTCHours())}${p(k.getUTCMinutes())}${p(k.getUTCSeconds())}`;
}

/**
 * 저장소에 있는 XML 로 API 를 흉내 낸다. 서비스 키가 없을 때의 데모 화면과 테스트가 쓴다.
 * 응답은 실제 API 와 같은 파서(parseApiResponse)를 거친다.
 */
export class FixtureSource implements MedicalDataSource {
  constructor(
    private readonly read: FixtureReader,
    /** 데모 병상 입력 시각을 "지금" 기준으로 옮기기 위한 시계. 없으면 파일 값을 그대로 쓴다. */
    private readonly clock: (() => number) | null = null,
  ) {}

  private items(file: string): RawItem[] {
    return parseApiResponse(this.read(file)).items;
  }

  async pharmaciesByRegion(r: Region): Promise<RawItem[]> {
    return this.items(DEMO_FILES.pharmacies).filter((i) => sameRegion(i.dutyaddr, r));
  }

  async pharmaciesNear(p: LatLon): Promise<RawItem[]> {
    // 위치정보 조회는 오늘 운영시간(startTime/endTime)만 준다. 데모에서는 요일별 시간을 빼고
    // 돌려줘서, 실서비스처럼 지역 목록 조회로 운영시간을 채우는 경로를 타게 한다.
    return withDistance(this.items(DEMO_FILES.pharmacies), p).map((item) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(item)) if (!k.startsWith("dutytime")) out[k] = v;
      return out;
    });
  }

  async emergencyRoomsByRegion(r: Region): Promise<RawItem[]> {
    return this.items(DEMO_FILES.emergencyRooms).filter((i) => sameRegion(i.dutyaddr, r));
  }

  async emergencyRoomsNear(p: LatLon): Promise<RawItem[]> {
    return withDistance(this.items(DEMO_FILES.emergencyRooms), p);
  }

  async emergencyBeds(r: Region): Promise<RawItem[]> {
    const inRegion = new Set((await this.emergencyRoomsByRegion(r)).map((i) => i.hpid));
    const beds = this.items(DEMO_FILES.emergencyBeds).filter((i) => inRegion.has(i.hpid));
    return this.clock ? this.rebase(beds, this.clock()) : beds;
  }

  /** 가장 최근 입력 시각이 "5분 전"이 되도록 모든 입력 시각을 같은 만큼 옮긴다. */
  private rebase(items: RawItem[], now: number): RawItem[] {
    const times = items.map((i) => parseHvidate(i.hvidate)?.getTime() ?? null);
    const latest = Math.max(...times.filter((t): t is number => t !== null));
    if (!Number.isFinite(latest)) return items;
    const shift = now - 5 * 60 * 1000 - latest;
    return items.map((item, idx) => {
      const t = times[idx];
      return t === null || t === undefined
        ? item
        : { ...item, hvidate: formatCompact(new Date(t + shift)) };
    });
  }
}
