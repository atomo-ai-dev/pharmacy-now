import type { MedicalDataSource } from "../api/source";
import {
  type Pharmacy,
  pharmacyFromListItem,
  pharmacyFromLocationItem,
  toPharmacyView,
} from "../model/pharmacy";
import type { LocationQuery } from "../query";
import { type Region, regionFromAddress } from "../regions";
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
 * 주소가 선택한 지역과 일치하는지 확인한다.
 * 세종특별자치시처럼 sigungu가 없는 경우나, 주소에서 sigungu를 추출할 수 없는 경우는 true를 반환한다.
 */
function addressMatchesRegion(address: string, region: Region): boolean {
  // sigungu가 없는 지역(세종)이면 sido만 확인
  if (region.sigungu === "") {
    const parsed = regionFromAddress(address);
    return parsed !== null && parsed.sido === region.sido;
  }

  // sigungu가 있는 경우는 sido와 sigungu 모두 확인
  const parsed = regionFromAddress(address);
  return parsed !== null && parsed.sido === region.sido && parsed.sigungu === region.sigungu;
}

export async function findPharmacies(
  source: MedicalDataSource,
  query: LocationQuery,
  now: Date,
): Promise<PharmacyView[]> {
  if (query.kind === "region") {
    const items = (await source.pharmaciesByRegion(query.region))
      .map(pharmacyFromListItem)
      .filter((p): p is Pharmacy => p !== null)
      // 주소로 다시 필터링: 선택한 지역만 남긴다
      .filter((p) => addressMatchesRegion(p.address, query.region));

    return sortPharmacies(items.map((p) => toPharmacyView(p, now, query.origin))).slice(
      0,
      MAX_RESULTS,
    );
  }

  // 위치 조회는 가까운 약국과 "오늘" 운영시간만 준다. 공휴일·심야 판정에 필요한 요일별
  // 운영시간은 같은 시군구 목록 조회로 채운다.
  const near = compact((await source.pharmaciesNear(query.point)).map(pharmacyFromLocationItem));
  const regions = nearbyRegions(near.map((p) => p.address));
  const listed = compact(
    (await settledItems(regions.map((r) => source.pharmaciesByRegion(r)))).map(
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
