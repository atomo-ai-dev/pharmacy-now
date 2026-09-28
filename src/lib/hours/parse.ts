/**
 * 국립중앙의료원 API 의 운영시간 필드(dutyTime{N}s / dutyTime{N}c)는 "0830" 같은 HHMM 문자열이다.
 * 공식 가이드 예시에도 "830"(앞자리 0 누락)이 섞여 있고, 실제 데이터에는 빈 값·"2400"·
 * 다음날 새벽을 뜻하는 "2600" 같은 값도 나온다.
 */

/** 새벽 영업을 24시 이후 표기로 적는 경우를 허용하는 상한 (36:00 = 다음날 12시). */
const MAX_HOURS = 36;

/**
 * HHMM 문자열을 자정 기준 분으로 바꾼다. 해석할 수 없으면 null.
 * "2400" → 1440, "2600" → 1560 (다음날 02:00).
 */
export function parseHhmm(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) {
    return parseHhmm(String(raw));
  }
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(cleaned)) return null;
  const padded = cleaned.padStart(4, "0");
  const hours = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2));
  if (minutes > 59 || hours > MAX_HOURS) return null;
  return hours * 60 + minutes;
}
