import type { MedicalDataSource } from "../api/source";
import type { RawItem } from "../api/xml";
import {
  type Pharmacy,
  pharmacyFromListItem,
  pharmacyFromLocationItem,
  toPharmacyView,
} from "../model/pharmacy";
import type { LocationQuery } from "../query";
import { legacyPharmacyRegions, type Region, regionFromAddress } from "../regions";
import type { PharmacyView } from "../views";
import { nearbyRegions, settledItems } from "./regionsNear";

export const MAX_RESULTS = 60;

const OPEN_RANK = { open: 0, unknown: 1, closed: 2 } as const;

export function sortPharmacies(items: PharmacyView[]): PharmacyView[] {
  return [...items].sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    const rank = OPEN_RANK[a.openState] - OPEN_RANK[b.openState];
    return rank !== 0 ? rank : a.name.localeCompare(b.name, "ko");
  });
}

function compact<T>(xs: (T | null)[]): T[] {
  return xs.filter((x): x is T => x !== null);
}

/**
 * 약국 목록 조회. 약국 서비스는 2026-07 개편 뒤에도 대부분 옛 지역 이름을 쓰므로 옛 이름으로도
 * 조회해 hpid 로 합친다. 옛 구 하나가 새 구 여럿으로 나뉜 경우(인천 중구 → 제물포구·영종구 등)
 * 옛 이름 결과는 주소로 걸러 선택한 구만 남긴다.
 */
export async function pharmaciesInRegion(
  source: MedicalDataSource,
  region: Region,
): Promise<RawItem[]> {
  const legacy = legacyPharmacyRegions(region);
  if (legacy.length === 0) return source.pharmaciesByRegion(region);

  const results = await Promise.allSettled(
    [region, ...legacy].map((r) => source.pharmaciesByRegion(r)),
  );
  const failed = results.find((r) => r.status === "rejected");
  if (failed && results.every((r) => r.status === "rejected")) throw failed.reason;

  const seen = new Set<string>();
  const out: RawItem[] = [];
  results.forEach((res, idx) => {
    if (res.status !== "fulfilled") return;
    for (const item of res.value) {
      if (idx > 0) {
        const found = item.dutyaddr ? regionFromAddress(item.dutyaddr) : null;
        if (found && (found.sido !== region.sido || found.sigungu !== region.sigungu)) continue;
      }
      const id = item.hpid?.trim();
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      out.push(item);
    }
  });
  return out;
}

export async function findPharmacies(
  source: MedicalDataSource,
  query: LocationQuery,
  now: Date,
): Promise<PharmacyView[]> {
  if (query.kind === "region") {
    const list = compact(
      (await pharmaciesInRegion(source, query.region)).map(pharmacyFromListItem),
    );
    return sortPharmacies(list.map((p) => toPharmacyView(p, now, query.origin))).slice(
      0,
      MAX_RESULTS,
    );
  }

  // 위치 조회는 가까운 약국과 "오늘" 운영시간만 준다. 공휴일·심야 판정에 필요한 요일별
  // 운영시간은 같은 시군구 목록 조회로 채운다.
  const near = compact((await source.pharmaciesNear(query.point)).map(pharmacyFromLocationItem));
  const regions = nearbyRegions(near.map((p) => p.address));
  const listed = compact(
    (await settledItems(regions.map((r) => pharmaciesInRegion(source, r)))).map(
      pharmacyFromListItem,
    ),
  );
  const byId = new Map(listed.map((p) => [p.id, p]));

  const merged = near.map((p): Pharmacy => {
    const full = byId.get(p.id);
    return full
      ? {
          ...p,
          schedule: full.schedule,
          location: p.location ?? full.location,
          phone: p.phone ?? full.phone,
        }
      : p;
  });
  return sortPharmacies(merged.map((p) => toPharmacyView(p, now, query.point))).slice(
    0,
    MAX_RESULTS,
  );
}
