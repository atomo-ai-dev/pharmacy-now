import type { RawItem } from "../api/xml";
import { haversineKm, isPlausibleKoreanCoord, type LatLon, parseCoord } from "../geo/distance";
import { kstDateTime } from "../time/kst";
import type { BedView, EmergencyRoomView } from "../views";

/** 병상 입력 시각이 이보다 오래되면 화면에 "오래된 정보"로 표시한다. */
export const STALE_AFTER_MS = 60 * 60 * 1000;

export interface EmergencyRoom {
  id: string;
  name: string;
  address: string | null;
  erPhone: string | null;
  mainPhone: string | null;
  category: string | null;
  location: LatLon | null;
}

export interface BedStatus {
  general: { available: number | null; capacity: number | null };
  pediatric: { available: number | null; capacity: number | null };
  updatedAt: Date | null;
  /** 병상 응답에만 있는 기관명 — 목록 조회에 없는 기관을 보여줄 때 쓴다 */
  name: string | null;
  phone: string | null;
}

function text(item: RawItem, key: string): string | null {
  const v = item[key]?.trim();
  return v ? v : null;
}

/**
 * 병상 수. 음수는 정원을 넘겨 환자를 받고 있다는 뜻이라 그대로 둔다.
 * 빈 값, "NULL", 숫자가 아닌 값은 null(정보 없음).
 */
export function parseBedCount(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!/^-?\d+$/.test(t)) return null;
  return Number(t);
}

/** 기준 병상 수. 0 이하는 의미가 없으므로 null. */
function parseCapacity(raw: unknown): number | null {
  const n = parseBedCount(raw);
  return n !== null && n > 0 ? n : null;
}

/**
 * 입력일시(hvidate). 응답 예시는 "20230414092700"(YYYYMMDDHHmmss, KST)이고,
 * 명세표 예시는 "2013-10-01 오후1:14:12" 이다. 둘 다 받는다.
 */
export function parseHvidate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();

  const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?$/.exec(t);
  if (compact) {
    const [, y, mo, d, h, mi, s] = compact;
    return validDate(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s ?? 0));
  }

  const korean =
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s*(오전|오후)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  if (korean) {
    const [, y, mo, d, ampm, h, mi, s] = korean;
    let hour = Number(h) % 12;
    if (ampm === "오후") hour += 12;
    return validDate(Number(y), Number(mo), Number(d), hour, Number(mi), Number(s ?? 0));
  }
  return null;
}

function validDate(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const date = kstDateTime(y, mo, d, h, mi, s);
  // 2월 30일 같은 값은 Date 가 다음 달로 넘겨 버리므로 되돌려 확인한다.
  const check = new Date(date.getTime() + 9 * 3600 * 1000);
  return check.getUTCDate() === d ? date : null;
}

/** 응급의료기관 목록정보 조회 item */
export function emergencyRoomFromListItem(item: RawItem): EmergencyRoom | null {
  const id = text(item, "hpid");
  const name = text(item, "dutyname");
  if (!id || !name) return null;
  const p = {
    lat: parseCoord(item.wgs84lat) ?? undefined,
    lon: parseCoord(item.wgs84lon) ?? undefined,
  };
  return {
    id,
    name,
    address: text(item, "dutyaddr"),
    erPhone: text(item, "dutytel3"),
    mainPhone: text(item, "dutytel1"),
    category: text(item, "dutyemclsname"),
    location: isPlausibleKoreanCoord(p) ? p : null,
  };
}

/** 응급의료기관 위치정보 조회 item */
export function emergencyRoomFromLocationItem(item: RawItem): EmergencyRoom | null {
  const id = text(item, "hpid");
  const name = text(item, "dutyname");
  if (!id || !name) return null;
  const p = {
    lat: parseCoord(item.latitude) ?? undefined,
    lon: parseCoord(item.longitude) ?? undefined,
  };
  return {
    id,
    name,
    address: text(item, "dutyaddr"),
    erPhone: null,
    mainPhone: text(item, "dutytel1"),
    category: text(item, "dutydivname"),
    location: isPlausibleKoreanCoord(p) ? p : null,
  };
}

/** 응급실 실시간 가용병상정보 item. hvec=응급실 일반, hv28=소아, hvs01·hvs02=각 기준 병상. */
export function bedStatusFromItem(item: RawItem): { id: string; status: BedStatus } | null {
  const id = text(item, "hpid");
  if (!id) return null;
  return {
    id,
    status: {
      general: { available: parseBedCount(item.hvec), capacity: parseCapacity(item.hvs01) },
      pediatric: { available: parseBedCount(item.hv28), capacity: parseCapacity(item.hvs02) },
      updatedAt: parseHvidate(item.hvidate),
      name: text(item, "dutyname"),
      phone: text(item, "dutytel3"),
    },
  };
}

export function toBedView(b: { available: number | null; capacity: number | null }): BedView {
  const state =
    b.available === null
      ? "unknown"
      : b.available < 0
        ? "over"
        : b.available === 0
          ? "full"
          : "available";
  return { available: b.available, capacity: b.capacity, state };
}

const NO_BEDS: BedView = { available: null, capacity: null, state: "unknown" };

export function toEmergencyRoomView(
  er: EmergencyRoom,
  beds: BedStatus | null,
  now: Date,
  origin: LatLon | null,
): EmergencyRoomView {
  const updatedAt = beds?.updatedAt ?? null;
  return {
    id: er.id,
    name: er.name,
    address: er.address,
    phone: er.erPhone ?? beds?.phone ?? er.mainPhone,
    category: er.category,
    lat: er.location?.lat ?? null,
    lon: er.location?.lon ?? null,
    distanceKm: origin && er.location ? haversineKm(origin, er.location) : null,
    general: beds ? toBedView(beds.general) : NO_BEDS,
    pediatric: beds ? toBedView(beds.pediatric) : NO_BEDS,
    updatedAt: updatedAt ? updatedAt.toISOString() : null,
    stale: updatedAt ? now.getTime() - updatedAt.getTime() > STALE_AFTER_MS : false,
  };
}
