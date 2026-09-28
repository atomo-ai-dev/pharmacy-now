/**
 * 한국 표준시(KST, UTC+9) 계산. 한국은 일광절약시간이 없으므로 고정 오프셋으로 충분하다.
 * 서버가 어느 시간대에서 돌든 결과가 같도록 Date 의 로컬 getter 를 쓰지 않는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstDate {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** 0 = 일요일 … 6 = 토요일 */
  weekday: number;
  /** 자정부터 지난 분 (0–1439) */
  minutes: number;
}

export function toKst(instant: Date): KstDate {
  const shifted = new Date(instant.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** KST 기준 하루 전 날짜. 자정을 넘긴 영업시간을 판정할 때 쓴다. */
export function previousKstDay(instant: Date): KstDate {
  return toKst(new Date(instant.getTime() - 24 * 60 * 60 * 1000));
}

/** "2026-09-28" 형식 */
export function isoDate(d: Pick<KstDate, "year" | "month" | "day">): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** KST 벽시계 시각으로 Date 를 만든다. */
export function kstDateTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - KST_OFFSET_MS);
}

/** 분 단위 시각을 "HH:MM" 으로. 24시 이후(다음날 새벽)도 0–23시로 접는다. */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
