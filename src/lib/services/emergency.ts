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
import type { Region } from "../regions";
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
    const rooms = listItems.map(emergencyRoomFromListItem).filter((r) => r !== null);
    // 목록에는 없고 병상 응답에만 있는 기관도 빠뜨리지 않는다.
    for (const [id, b] of beds) {
      if (!rooms.some((r) => r.id === id) && b.name) {
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
