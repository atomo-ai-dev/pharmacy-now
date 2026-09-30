import type { MedicalDataSource } from "../api/source";
import type { RawItem } from "../api/xml";
import type { LatLon } from "../geo/distance";
import {
  type BedStatus,
  bedStatusFromItem,
  type EmergencyRoom,
  emergencyRoomFromListItem,
  emergencyRoomFromLocationItem,
  toEmergencyRoomView,
} from "../model/emergency";
import type { LocationQuery } from "../query";
import { type Region, regionFromAddress } from "../regions";
import type { EmergencyRoomView } from "../views";
import { nearbyRegions, settledItems } from "./regionsNear";

export const MAX_EMERGENCY_RESULTS = 30;

function bedMap(items: RawItem[]): Map<string, BedStatus> {
  const map = new Map<string, BedStatus>();
  for (const item of items) {
    const b = bedStatusFromItem(item);
    if (b) map.set(b.id, b.status);
  }
  return map;
}

/**
 * 주소가 선택한 지역과 일치하는지 확인한다.
 * 세종특별자치시처럼 sigungu가 없는 경우나, 주소에서 sigungu를 추출할 수 없는 경우는 true를 반환한다.
 */
function addressMatchesRegion(address: string | null, region: Region): boolean {
  if (!address) return true; // 주소가 없으면 필터링하지 않음 (병상 응답)

  // sigungu가 없는 지역(세종)이면 sido만 확인
  if (region.sigungu === "") {
    const parsed = regionFromAddress(address);
    return parsed !== null && parsed.sido === region.sido;
  }

  // sigungu가 있는 경우는 sido와 sigungu 모두 확인
  const parsed = regionFromAddress(address);
  return parsed !== null && parsed.sido === region.sido && parsed.sigungu === region.sigungu;
}

/** 가까운 순. 거리를 모르면 가용 병상이 많은 순, 병상 정보가 없는 곳은 뒤로. */
export function sortEmergencyRooms(items: EmergencyRoomView[]): EmergencyRoomView[] {
  return [...items].sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    const x = a.general.available;
    const y = b.general.available;
    if (x !== y) {
      if (x === null) return 1;
      if (y === null) return -1;
      return y - x;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

function merge(
  rooms: EmergencyRoom[],
  beds: Map<string, BedStatus>,
  now: Date,
  origin: LatLon | null,
): EmergencyRoomView[] {
  const seen = new Set<string>();
  const views: EmergencyRoomView[] = [];
  for (const er of rooms) {
    if (seen.has(er.id)) continue;
    seen.add(er.id);
    views.push(toEmergencyRoomView(er, beds.get(er.id) ?? null, now, origin));
  }
  return views;
}

async function bedsFor(
  source: MedicalDataSource,
  regions: Region[],
): Promise<Map<string, BedStatus>> {
  return bedMap(await settledItems(regions.map((r) => source.emergencyBeds(r))));
}

export async function findEmergencyRooms(
  source: MedicalDataSource,
  query: LocationQuery,
  now: Date,
): Promise<EmergencyRoomView[]> {
  if (query.kind === "region") {
    const [listItems, beds] = await Promise.all([
      source.emergencyRoomsByRegion(query.region),
      bedsFor(source, [query.region]),
    ]);

    // 목록에서 파싱된 모든 기관의 ID를 추적
    const allRooms = listItems
      .map(emergencyRoomFromListItem)
      .filter((r): r is EmergencyRoom => r !== null);

    // 필터링되지 않은 (주소가 일치하는) 기관만 유지
    const rooms = allRooms.filter((r) => addressMatchesRegion(r.address, query.region));

    // 필터링된 (주소가 일치하지 않는) 기관의 ID 추적
    const filteredOutIds = new Set(
      allRooms.filter((r) => !addressMatchesRegion(r.address, query.region)).map((r) => r.id),
    );

    // 목록에 없고 병상 응답에만 있는 기관 추가 (단, 필터링된 목록의 ID는 제외)
    for (const [id, b] of beds) {
      if (!rooms.some((r) => r.id === id) && !filteredOutIds.has(id) && b.name) {
        // 병상 응답에만 있고 목록에서 필터링되지 않은 기관만 추가
        rooms.push({
          id,
          name: b.name,
          address: null,
          erPhone: b.phone,
          mainPhone: null,
          category: null,
          location: null,
        });
      }
    }

    return sortEmergencyRooms(merge(rooms, beds, now, query.origin)).slice(
      0,
      MAX_EMERGENCY_RESULTS,
    );
  }

  const rooms = (await source.emergencyRoomsNear(query.point))
    .map(emergencyRoomFromLocationItem)
    .filter((r) => r !== null);
  const beds = await bedsFor(source, nearbyRegions(rooms.map((r) => r.address)));
  return sortEmergencyRooms(merge(rooms, beds, now, query.point)).slice(0, MAX_EMERGENCY_RESULTS);
}
