import type { MedicalDataSource } from "../api/source";
import {
  type Pharmacy,
  pharmacyFromListItem,
  pharmacyFromLocationItem,
  toPharmacyView,
} from "../model/pharmacy";
import type { LocationQuery } from "../query";
import { LEGACY_PHARMACY_REGIONS, type Region, regionFromAddress } from "../regions";
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
 * 약국 API가 여전히 구 지역명을 사용하므로 (2026-07-01 개편 이후),
 * 새 지역명으로 조회할 때 구 지역명도 함께 조회한다.
 */
function getLegacyRegionsForPharmacyQuery(region: Region): Region[] {
  const key = region.sigungu ? `${region.sido}-${region.sigungu}` : region.sido;
  return LEGACY_PHARMACY_REGIONS[key] ?? [];
}

/**
 * 한 옛 구가 여러 새 구로 나뉜 경우 주소로 필터링한다.
 * 예: 인천광역시 중구 → 제물포구 또는 영종구 (주소로 판별)
 */
function filterPharmaciesByTargetRegion(
  pharmacies: Pharmacy[],
  targetRegion: Region,
): Pharmacy[] {
  // 인천광역시 제물포구/영종구는 옛 이름 중구에서 매핑되므로,
  // 주소의 실제 지역명으로 필터링한다.
  const shouldFilter =
    targetRegion.sido === "인천광역시" &&
    (targetRegion.sigungu === "제물포구" || targetRegion.sigungu === "영종구");

  if (!shouldFilter) {
    return pharmacies;
  }

  return pharmacies.filter((p) => {
    const addressRegion = regionFromAddress(p.address);
    if (!addressRegion) return false;
    return (
      addressRegion.sido === targetRegion.sido && addressRegion.sigungu === targetRegion.sigungu
    );
  });
}

export async function findPharmacies(
  source: MedicalDataSource,
  query: LocationQuery,
  now: Date,
): Promise<PharmacyView[]> {
  if (query.kind === "region") {
    // 새 지역명과 구 지역명 모두로 조회한다.
    const legacyRegions = getLegacyRegionsForPharmacyQuery(query.region);
    const allRegions = [query.region, ...legacyRegions];

    const allResults = await Promise.all(allRegions.map((r) => source.pharmaciesByRegion(r)));

    // hpid로 중복을 제거한다.
    const byId = new Map<string, Pharmacy>();
    for (const rawItems of allResults) {
      for (const pharmacy of compact(rawItems.map(pharmacyFromListItem))) {
        if (!byId.has(pharmacy.id)) {
          byId.set(pharmacy.id, pharmacy);
        }
      }
    }

    let list = Array.from(byId.values());
    // 한 옛 구가 여러 새 구로 나뉜 경우 주소로 필터링한다.
    list = filterPharmaciesByTargetRegion(list, query.region);

    return sortPharmacies(list.map((p) => toPharmacyView(p, now, query.origin))).slice(
      0,
      MAX_RESULTS,
    );
  }

  // 위치 조회는 가까운 약국과 "오늘" 운영시간만 준다. 공휴일·심야 판정에 필요한 요일별
  // 운영시간은 같은 시군구 목록 조회로 채운다.
  const near = compact((await source.pharmaciesNear(query.point)).map(pharmacyFromLocationItem));
  const regions = nearbyRegions(near.map((p) => p.address));

  // 각 지역마다 새 지역명과 구 지역명을 모두 조회한다.
  const regionQueriesWithLegacy: Region[] = [];
  for (const r of regions) {
    regionQueriesWithLegacy.push(r);
    const legacy = getLegacyRegionsForPharmacyQuery(r);
    regionQueriesWithLegacy.push(...legacy);
  }

  const listed = compact(
    (await settledItems(regionQueriesWithLegacy.map((r) => source.pharmaciesByRegion(r)))).map(
      pharmacyFromListItem,
    ),
  );

  // hpid로 중복을 제거한다.
  const byId = new Map<string, Pharmacy>();
  for (const pharmacy of listed) {
    if (!byId.has(pharmacy.id)) {
      byId.set(pharmacy.id, pharmacy);
    }
  }

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
