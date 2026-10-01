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
 * 약국 목록을 새 지역 이름과 옛 이름(2026-07-01 개편 이전)으로 함께 조회한다. 약국 서비스는
 * 대부분 옛 이름으로 응답한다. 같은 약국(hpid)은 한 번만 남기고, 옛 구가 여러 새 구로 나뉜
 * 경우는 주소로 선택한 구에 속하는 곳만 남긴다.
 */
async function pharmacyItemsByRegion(source: MedicalDataSource, r: Region): Promise<RawItem[]> {
  const legacy = legacyPharmacyRegions(r);
  if (legacy.length === 0) return source.pharmaciesByRegion(r);
  const [current, ...old] = await Promise.all([
    source.pharmaciesByRegion(r),
    ...legacy.map((l) => source.pharmaciesByRegion(l.region)),
  ]);
  const inRegion = (item: RawItem) => {
    const found = item.dutyaddr ? regionFromAddress(item.dutyaddr) : null;
    return found !== null && found.sido === r.sido && found.sigungu === r.sigungu;
  };
  const seen = new Set<string>();
  const out: RawItem[] = [];
  const add = (item: RawItem) => {
    const id = item.hpid?.trim();
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    }
    out.push(item);
  };
  (current ?? []).forEach(add);
  old.forEach((items, i) => {
    const split = legacy[i]?.split ?? false;
    for (const item of items) if (!split || inRegion(item)) add(item);
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
      (await pharmacyItemsByRegion(source, query.region)).map(pharmacyFromListItem),
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
    (await settledItems(regions.map((r) => pharmacyItemsByRegion(source, r)))).map(
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
