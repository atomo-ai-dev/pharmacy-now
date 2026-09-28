import { isoDate, type KstDate } from "../time/kst";
import { HOLIDAY_YEARS, KOREAN_HOLIDAYS } from "./data";

type DateParts = Pick<KstDate, "year" | "month" | "day">;

/** 공휴일이면 이름을, 아니면 null. 일요일은 공휴일이지만 요일 운영시간(7)을 따르므로 여기서 다루지 않는다. */
export function holidayName(date: DateParts): string | null {
  return KOREAN_HOLIDAYS[isoDate(date)] ?? null;
}

export function isHoliday(date: DateParts): boolean {
  return holidayName(date) !== null;
}

/** 해당 연도의 공휴일 표를 가지고 있는가. 없으면 공휴일 판정을 믿을 수 없다. */
export function isHolidayCovered(year: number): boolean {
  return HOLIDAY_YEARS.includes(year);
}
