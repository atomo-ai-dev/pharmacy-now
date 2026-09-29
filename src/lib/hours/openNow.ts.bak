import { isHoliday } from "../holidays";
import { formatMinutes, type KstDate, previousKstDay, toKst } from "../time/kst";
import { type DayHours, type DayKey, HOLIDAY_KEY, type WeeklySchedule } from "./schedule";

export type OpenStatus =
  /** closesAt 이 null 이면 오늘 하루 종일(24시간) 영업 */
  { state: "open"; closesAt: string | null } | { state: "closed" } | { state: "unknown" };

/** 그 날짜에 적용할 운영시간 요일. 공휴일이면 요일과 무관하게 8(공휴일). */
export function dayKeyFor(date: KstDate): DayKey {
  if (isHoliday(date)) return HOLIDAY_KEY;
  return (date.weekday === 0 ? 7 : date.weekday) as DayKey;
}

/**
 * 지금 영업 중인가.
 * - 요일별 운영시간, 공휴일(8) 운영시간을 따른다.
 * - 전날 밤에 시작해 자정을 넘긴 영업(예: 2200–0200)은 다음날 새벽에도 "영업 중"이다.
 * - 운영시간 값이 잘못돼 있으면 "확인 불가"로 둔다.
 */
export function openStatus(schedule: WeeklySchedule, now: Date): OpenStatus {
  const today = toKst(now);
  const yesterday = previousKstDay(now);

  const carried = schedule[dayKeyFor(yesterday)];
  if (carried.kind === "open" && carried.close > 1440 && today.minutes < carried.close - 1440) {
    return { state: "open", closesAt: closingLabel(carried.close) };
  }

  return statusWithin(schedule[dayKeyFor(today)], today.minutes);
}

function statusWithin(hours: DayHours, minutes: number): OpenStatus {
  switch (hours.kind) {
    case "invalid":
      return { state: "unknown" };
    case "closed":
      return { state: "closed" };
    case "open":
      if (minutes < hours.open || minutes >= hours.close) return { state: "closed" };
      return { state: "open", closesAt: isAllDay(hours) ? null : closingLabel(hours.close) };
  }
}

/** 오늘 운영시간 표기. "09:00–22:00", "휴무", 또는 null(확인 불가). */
export function todayHoursLabel(schedule: WeeklySchedule, now: Date): string | null {
  return hoursLabel(schedule[dayKeyFor(toKst(now))]);
}

export function hoursLabel(hours: DayHours): string | null {
  switch (hours.kind) {
    case "invalid":
      return null;
    case "closed":
      return "휴무";
    case "open": {
      if (isAllDay(hours)) return "24시간";
      const nextDay = hours.close > 1440 ? "다음날 " : "";
      return `${formatMinutes(hours.open)}–${nextDay}${closingLabel(hours.close)}`;
    }
  }
}

function isAllDay(hours: { open: number; close: number }): boolean {
  return hours.open === 0 && hours.close === 1440;
}

/** 닫는 시각. 자정 마감은 "00:00" 보다 "24:00" 이 덜 헷갈린다. */
export function closingLabel(close: number): string {
  return close === 1440 ? "24:00" : formatMinutes(close);
}
