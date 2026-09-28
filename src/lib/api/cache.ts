import type { LatLon } from "../geo/distance";
import type { Region } from "../regions";
import type { MedicalDataSource } from "./source";
import type { RawItem } from "./xml";

/**
 * 서버 메모리 캐시. 약국·기관 정보는 하루 한 번 갱신되고(가이드 "데이터 갱신주기: 일 1회"),
 * 개발계정은 하루 1,000 건으로 호출량이 빠듯하다. 실시간 병상만 짧게 둔다.
 */
export interface CacheTtl {
  directory: number;
  beds: number;
}

export const DEFAULT_TTL: CacheTtl = {
  directory: 60 * 60 * 1000,
  beds: 60 * 1000,
};

/** 좌표를 소수 셋째 자리(약 100m)로 맞춰 가까운 사용자끼리 캐시를 나눠 쓴다. */
export function roundPoint(p: LatLon): LatLon {
  return { lat: Math.round(p.lat * 1000) / 1000, lon: Math.round(p.lon * 1000) / 1000 };
}

interface Entry {
  expires: number;
  value: Promise<RawItem[]>;
}

export class CachedSource implements MedicalDataSource {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly inner: MedicalDataSource,
    private readonly clock: () => number,
    private readonly ttl: CacheTtl = DEFAULT_TTL,
    private readonly maxEntries = 500,
  ) {}

  pharmaciesByRegion(r: Region) {
    return this.cached(`ph:r:${r.sido}:${r.sigungu}`, this.ttl.directory, () =>
      this.inner.pharmaciesByRegion(r),
    );
  }

  pharmaciesNear(p: LatLon) {
    const q = roundPoint(p);
    return this.cached(`ph:p:${q.lat}:${q.lon}`, this.ttl.directory, () =>
      this.inner.pharmaciesNear(q),
    );
  }

  emergencyRoomsByRegion(r: Region) {
    return this.cached(`er:r:${r.sido}:${r.sigungu}`, this.ttl.directory, () =>
      this.inner.emergencyRoomsByRegion(r),
    );
  }

  emergencyRoomsNear(p: LatLon) {
    const q = roundPoint(p);
    return this.cached(`er:p:${q.lat}:${q.lon}`, this.ttl.directory, () =>
      this.inner.emergencyRoomsNear(q),
    );
  }

  emergencyBeds(r: Region) {
    return this.cached(`bed:${r.sido}:${r.sigungu}`, this.ttl.beds, () =>
      this.inner.emergencyBeds(r),
    );
  }

  get size(): number {
    return this.entries.size;
  }

  private cached(key: string, ttl: number, load: () => Promise<RawItem[]>): Promise<RawItem[]> {
    const now = this.clock();
    const hit = this.entries.get(key);
    if (hit && hit.expires > now) return hit.value;

    // 진행 중인 요청도 캐시에 넣어 동시에 들어온 같은 요청이 API 를 두 번 부르지 않게 한다.
    const value = load();
    this.entries.set(key, { expires: now + ttl, value });
    value.catch(() => {
      // 실패는 캐시하지 않는다.
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
    });
    this.evict(now);
    return value;
  }

  private evict(now: number): void {
    if (this.entries.size <= this.maxEntries) return;
    for (const [k, e] of this.entries) {
      if (e.expires <= now) this.entries.delete(k);
    }
    // 그래도 넘치면 오래 넣은 것부터 버린다 (Map 은 삽입 순서를 지킨다).
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
