import type { MedicalDataSource } from "../api/source";
import type { RawItem } from "../api/xml";
import {
  type Pharmacy,
  pharmacyFromListItem,
  pharmacyFromLocationItem,
  toPharmacyView,
} from "../model/pharmacy";
import type { LocationQuery } from "../query";
import type { Region } from "../regions";
import type { PharmacyView } from "../views";
import { nearbyRegions, settledItems } from "./regionsNear";

export const MAX_RESULTS = 60;

const OPEN_RANK = { open: 0, unknown: 1, closed: 2 } as const;

/**
 * 새 지역에 대응하는 옛 지역들을 찾는다. (역방향 매핑)
 * 약국은 옛 이름을 쓸 수 있으므로 새 지역으로 조회할 때 옛 지역도 함께 조회한다.
 */
function getOldRegionsForNewRegion(newRegion: Region): Region[] {
  if (newRegion.sido === "전남광주통합특별시") {
    const gwangjuGus = ["광산구", "남구", "동구", "북구", "서구"];
    if (gwangjuGus.includes(newRegion.sigungu)) {
      return [{ sido: "광주광역시", sigungu: "" }];
    }
    return [{ sido: "전라남도", sigungu: newRegion.sigungu }];
  }

  if (newRegion.sido === "인천광역시") {
    if (newRegion.sigungu === "제물포구") {
      return [
        { sido: "인천광역시", sigungu: "중구" },
        { sido: "인천광역시", sigungu: "동구" },
      ];
    }
    if (newRegion.sigungu === "영종구") {
      return [{ sido: "인천광역시", sigungu: "중구" }];
    }
    if (newRegion.sigungu === "서해구" || newRegion.sigungu === "검단구") {
      return [{ sido: "인천광역시", sigungu: "서구" }];
    }
  }

  return [];
}

/**
 * 약국 목록에서 주소 기반으로 필터한다.
 * 한 옛 구가 여러 새 구로 나뉘었을 때 (중구→제물포구/영종구) 주소로 선택한다.
 */
function filterByAddress(items: Pharmacy[], targetRegion: Region): Pharmacy[] {
  if (targetRegion.sido !== "인천광역시" || targetRegion.sigungu !== "영종구") {
    return items;
  }
  return items.filter((p) => p.address.includes("영종"));
}

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

export async function findPharmacies(
  source: MedicalDataSource,
  query: LocationQuery,
  now: Date,
): Promise<PharmacyView[]> {
  if (query.kind === "region") {
    const newResults = await source.pharmaciesByRegion(query.region);
    const oldRegions = getOldRegionsForNewRegion(query.region);
    const oldResults = compact(
      await settledItems(oldRegions.map((r) => source.pharmaciesByRegion(r))),
    );

    const allResults = [...newResults, ...oldResults];
    const byId = new Map<string, (typeof allResults)[0]>();
    for (const item of allResults) {
      if (item.hpid && !byId.has(item.hpid)) {
        byId.set(item.hpid, item);
      }
    }

    const deduped = Array.from(byId.values());
    const list = compact(deduped.map(pharmacyFromListItem));
    const filtered = filterByAddress(list, query.region);
    return sortPharmacies(filtered.map((p) => toPharmacyView(p, now, query.origin))).slice(
      0,
      MAX_RESULTS,
    );
  }

  // 위치 조회는 가까운 약국과 "오늘" 운영시간만 준다. 공휴일·심야 판정에 필요한 요일별
  // 운영시간은 같은 시군구 목록 조회로 채운다.
  const near = compact((await source.pharmaciesNear(query.point)).map(pharmacyFromLocationItem));
  const regions = nearbyRegions(near.map((p) => p.address));

  const listRequests: Promise<RawItem[]>[] = [];
  for (const r of regions) {
    listRequests.push(source.pharmaciesByRegion(r));
    const oldRegions = getOldRegionsForNewRegion(r);
    for (const oldR of oldRegions) {
      listRequests.push(source.pharmaciesByRegion(oldR));
    }
  }

  const allResults: RawItem[] = compact(await settledItems(listRequests));
  const byId = new Map<string, RawItem>();
  for (const item of allResults) {
    if (item.hpid && !byId.has(item.hpid)) {
      byId.set(item.hpid, item);
    }
  }

  const listed = compact(Array.from(byId.values()).map(pharmacyFromListItem));
  const listedById = new Map(listed.map((p) => [p.id, p]));

  const merged = near.map((p): Pharmacy => {
    const full = listedById.get(p.id);
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
