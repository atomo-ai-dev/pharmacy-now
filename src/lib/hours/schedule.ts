import { parseHhmm } from "./parse";

/** API 요일 번호: 1=월 … 7=일, 8=공휴일 */
export type DayKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const DAY_KEYS: readonly DayKey[] = [1, 2, 3, 4, 5, 6, 7, 8];
export const HOLIDAY_KEY: DayKey = 8;

export const DAY_LABELS: Readonly<Record<DayKey, string>> = {
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
  7: "일",
  8: "공휴일",
};

export type DayHours =
  /** open/close 는 그날 자정 기준 분. close 가 1440 을 넘으면 다음날 새벽까지 영업. */
  | { kind: "open"; open: number; close: number }
  /** 해당 요일 값이 비어 있음 — 쉬는 날로 본다. */
  | { kind: "closed" }
  /** 한쪽만 있거나 해석할 수 없는 값 — 판정 불가. */
  | { kind: "invalid" };

export type WeeklySchedule = Readonly<Record<DayKey, DayHours>>;

function isBlank(raw: unknown): boolean {
  return raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
}

export function toDayHours(rawOpen: unknown, rawClose: unknown): DayHours {
  if (isBlank(rawOpen) && isBlank(rawClose)) return { kind: "closed" };
  const open = parseHhmm(rawOpen);
  const close = parseHhmm(rawClose);
  if (open === null || close === null) return { kind: "invalid" };
  if (open >= 1440) return { kind: "invalid" };
  // 시작과 종료가 같으면 "24시간"인지 "0분 영업"인지 알 수 없다. 잘못 "영업 중"이라고
  // 안내하는 쪽이 더 위험하므로 판정 불가로 둔다. 24시간 약국은 보통 0000–2400 으로 온다.
  if (open === close) return { kind: "invalid" };
  // 종료가 시작보다 이르면 자정을 넘기는 영업 (예: 2200–0200).
  const effectiveClose = close < open ? close + 1440 : close;
  if (effectiveClose - open > 1440) return { kind: "invalid" };
  return { kind: "open", open, close: effectiveClose };
}

/** 응답 item 에서 dutyTime1s … dutyTime8c 를 읽어 주간 운영표를 만든다. */
export function scheduleFromDutyTimes(item: Readonly<Record<string, unknown>>): WeeklySchedule {
  const entries = DAY_KEYS.map(
    (d) => [d, toDayHours(item[`dutytime${d}s`], item[`dutytime${d}c`])] as const,
  );
  return Object.fromEntries(entries) as Record<DayKey, DayHours>;
}

/** 밤 10시 이후까지 영업하는 날이 하루라도 있는가. */
export const NIGHT_THRESHOLD = 22 * 60;

export function isNightPharmacy(schedule: WeeklySchedule): boolean {
  return DAY_KEYS.some((d) => {
    const h = schedule[d];
    return h.kind === "open" && h.close > NIGHT_THRESHOLD;
  });
}

export function opensOnHolidays(schedule: WeeklySchedule): boolean {
  return schedule[8].kind === "open";
}
