import { describe, expect, it } from "vitest";
import { formatMinutes, isoDate, kstDateTime, previousKstDay, toKst } from "./kst";

describe("toKst", () => {
  it("UTC 15:00 은 KST 다음날 00:00 이다", () => {
    const k = toKst(new Date("2026-09-27T15:00:00Z"));
    expect(isoDate(k)).toBe("2026-09-28");
    expect(k.minutes).toBe(0);
    expect(k.weekday).toBe(1); // 월요일
  });

  it("UTC 14:59 는 KST 같은 날 23:59 이다", () => {
    const k = toKst(new Date("2026-09-27T14:59:00Z"));
    expect(isoDate(k)).toBe("2026-09-27");
    expect(k.minutes).toBe(23 * 60 + 59);
    expect(k.weekday).toBe(0); // 일요일
  });

  it("연말 경계를 넘는다", () => {
    const k = toKst(new Date("2026-12-31T15:30:00Z"));
    expect(isoDate(k)).toBe("2027-01-01");
    expect(k.minutes).toBe(30);
  });
});

describe("kstDateTime", () => {
  it("KST 벽시계 시각을 올바른 순간으로 만든다", () => {
    expect(kstDateTime(2026, 9, 28, 9, 0).toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });

  it("toKst 와 왕복한다", () => {
    const k = toKst(kstDateTime(2027, 2, 7, 13, 45));
    expect([k.year, k.month, k.day, k.minutes]).toEqual([2027, 2, 7, 13 * 60 + 45]);
  });
});

describe("previousKstDay", () => {
  it("KST 기준 전날을 돌려준다", () => {
    expect(isoDate(previousKstDay(kstDateTime(2026, 3, 1, 0, 30)))).toBe("2026-02-28");
  });
});

describe("formatMinutes", () => {
  it.each([
    [0, "00:00"],
    [510, "08:30"],
    [1439, "23:59"],
    [1440, "00:00"],
    [1560, "02:00"],
  ])("%i → %s", (m, s) => {
    expect(formatMinutes(m)).toBe(s);
  });
});
