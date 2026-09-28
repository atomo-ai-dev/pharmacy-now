import { describe, expect, it } from "vitest";
import { KOREAN_HOLIDAYS } from "./data";
import { holidayName, isHoliday, isHolidayCovered } from "./index";

const d = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number) as [number, number, number];
  return { year, month, day };
};

describe("공휴일 표", () => {
  it.each([
    ["2026-01-01", "신정"],
    ["2026-02-17", "설날"],
    ["2026-03-02", "대체공휴일(삼일절)"],
    ["2026-05-01", "노동절"],
    ["2026-06-03", "전국동시지방선거"],
    ["2026-07-17", "제헌절"],
    ["2026-09-25", "추석"],
    ["2026-10-05", "대체공휴일(개천절)"],
    ["2027-02-09", "대체공휴일(설날)"],
    ["2027-05-03", "대체공휴일(노동절)"],
    ["2027-12-27", "대체공휴일(성탄절)"],
  ])("%s 는 %s", (iso, name) => {
    expect(holidayName(d(iso))).toBe(name);
  });

  it.each(["2026-09-28", "2026-06-07", "2027-09-17", "2026-05-02"])(
    "%s 는 공휴일이 아니다",
    (iso) => {
      expect(isHoliday(d(iso))).toBe(false);
    },
  );

  it("현충일은 토·일과 겹쳐도 대체공휴일이 없다", () => {
    expect(isHoliday(d("2026-06-08"))).toBe(false);
    expect(isHoliday(d("2027-06-07"))).toBe(false);
  });

  it("설·추석 연휴는 일요일과 겹칠 때만 대체된다 (2026 추석 토요일은 대체 없음)", () => {
    expect(isHoliday(d("2026-09-26"))).toBe(true);
    expect(isHoliday(d("2026-09-28"))).toBe(false);
  });

  it("모든 키가 실제 존재하는 날짜다", () => {
    for (const iso of Object.keys(KOREAN_HOLIDAYS)) {
      const parsed = new Date(`${iso}T00:00:00Z`);
      expect(parsed.toISOString().slice(0, 10)).toBe(iso);
    }
  });

  it("대체공휴일은 월~금에만 있다", () => {
    for (const [iso, name] of Object.entries(KOREAN_HOLIDAYS)) {
      if (!name.startsWith("대체공휴일")) continue;
      const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
      expect(day, iso).toBeGreaterThanOrEqual(1);
      expect(day, iso).toBeLessThanOrEqual(5);
    }
  });

  it("표에 있는 연도만 판정 가능으로 본다", () => {
    expect(isHolidayCovered(2026)).toBe(true);
    expect(isHolidayCovered(2027)).toBe(true);
    expect(isHolidayCovered(2028)).toBe(false);
  });
});
