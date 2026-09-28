import type { RawItem } from "../api/xml";
import { haversineKm, isPlausibleKoreanCoord, type LatLon, parseCoord } from "../geo/distance";
import { closingLabel, hoursLabel, openStatus, todayHoursLabel } from "../hours/openNow";
import {
  DAY_KEYS,
  DAY_LABELS,
  type DayHours,
  isNightPharmacy,
  opensOnHolidays,
  scheduleFromDutyTimes,
  toDayHours,
  type WeeklySchedule,
} from "../hours/schedule";
import { toKst } from "../time/kst";
import type { PharmacyView } from "../views";

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  location: LatLon | null;
  /** 목록·기본정보 조회에서 온 요일별 운영시간 */
  schedule: WeeklySchedule | null;
  /** 위치정보 조회에서 온 오늘 하루 운영시간 (startTime/endTime) */
  todayOnly: DayHours | null;
}

function text(item: RawItem, key: string): string | null {
  const v = item[key]?.trim();
  return v ? v : null;
}

function coords(lat: unknown, lon: unknown): LatLon | null {
  const p = { lat: parseCoord(lat) ?? undefined, lon: parseCoord(lon) ?? undefined };
  return isPlausibleKoreanCoord(p) ? p : null;
}

/** 약국 목록정보·기본정보 조회 item */
export function pharmacyFromListItem(item: RawItem): Pharmacy | null {
  const id = text(item, "hpid");
  const name = text(item, "dutyname");
  if (!id || !name) return null;
  return {
    id,
    name,
    address: text(item, "dutyaddr") ?? "",
    phone: text(item, "dutytel1"),
    location: coords(item.wgs84lat, item.wgs84lon),
    schedule: scheduleFromDutyTimes(item),
    todayOnly: null,
  };
}

/** 약국 위치정보 조회 item — 좌표 필드 이름이 latitude/longitude 로 다르다. */
export function pharmacyFromLocationItem(item: RawItem): Pharmacy | null {
  const id = text(item, "hpid");
  const name = text(item, "dutyname");
  if (!id || !name) return null;
  const start = text(item, "starttime");
  const end = text(item, "endtime");
  return {
    id,
    name,
    address: text(item, "dutyaddr") ?? "",
    phone: text(item, "dutytel1"),
    location: coords(item.latitude, item.longitude),
    schedule: null,
    todayOnly: start || end ? toDayHours(start, end) : null,
  };
}

function hasAnyHours(schedule: WeeklySchedule): boolean {
  return DAY_KEYS.some((d) => schedule[d].kind !== "closed");
}

export function toPharmacyView(p: Pharmacy, now: Date, origin: LatLon | null): PharmacyView {
  const base = {
    id: p.id,
    name: p.name,
    address: p.address,
    phone: p.phone,
    lat: p.location?.lat ?? null,
    lon: p.location?.lon ?? null,
    distanceKm: origin && p.location ? haversineKm(origin, p.location) : null,
  };

  // 운영시간이 한 칸도 없으면 "매일 휴무"가 아니라 정보가 없는 것이다.
  if (p.schedule && hasAnyHours(p.schedule)) {
    const status = openStatus(p.schedule, now);
    const schedule = p.schedule;
    return {
      ...base,
      openState: status.state,
      closesAt: status.state === "open" ? status.closesAt : null,
      todayHours: todayHoursLabel(schedule, now),
      weeklyHours: DAY_KEYS.map((d) => [DAY_LABELS[d], hoursLabel(schedule[d])]),
      night: isNightPharmacy(schedule),
      holiday: opensOnHolidays(schedule),
    };
  }

  if (p.todayOnly) {
    // 위치 조회 결과만 있을 때: 오늘 시간표만으로 판정한다. 공휴일·전날 심야영업은 알 수 없다.
    const minutes = toKst(now).minutes;
    const h = p.todayOnly;
    const open = h.kind === "open" && minutes >= h.open && minutes < h.close;
    return {
      ...base,
      openState: h.kind === "invalid" ? "unknown" : open ? "open" : "closed",
      closesAt: open && h.kind === "open" ? closingLabel(h.close) : null,
      todayHours: hoursLabel(h),
      weeklyHours: null,
      night: h.kind === "open" && h.close > 22 * 60,
      holiday: false,
    };
  }

  return {
    ...base,
    openState: "unknown",
    closesAt: null,
    todayHours: null,
    weeklyHours: null,
    night: false,
    holiday: false,
  };
}
