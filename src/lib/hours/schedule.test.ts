import { describe, expect, it } from "vitest";
import {
  isNightPharmacy,
  opensOnHolidays,
  scheduleFromDutyTimes,
  toDayHours,
  type WeeklySchedule,
} from "./schedule";

describe("toDayHours", () => {
  it("일반 영업", () => {
    expect(toDayHours("0900", "1800")).toEqual({ kind: "open", open: 540, close: 1080 });
  });

  it("자정을 넘기는 영업은 종료를 다음날로 민다", () => {
    expect(toDayHours("2200", "0200")).toEqual({ kind: "open", open: 1320, close: 1560 });
  });

  it("24시간 영업 (0000–2400)", () => {
    expect(toDayHours("0000", "2400")).toEqual({ kind: "open", open: 0, close: 1440 });
  });

  it("24시 이후 표기 (1800–2600)", () => {
    expect(toDayHours("1800", "2600")).toEqual({ kind: "open", open: 1080, close: 1560 });
  });

  it("양쪽 다 비어 있으면 쉬는 날", () => {
    expect(toDayHours(undefined, undefined)).toEqual({ kind: "closed" });
    expect(toDayHours("", " ")).toEqual({ kind: "closed" });
  });

  it.each([
    ["0900", undefined],
    [undefined, "1800"],
    ["09:3O", "1800"],
    ["0900", "0900"], // 시작=종료는 24시간인지 0분인지 알 수 없다
    ["2500", "0300"], // 시작이 24시 이후
  ])("%j–%j 는 판정 불가", (s, c) => {
    expect(toDayHours(s, c)).toEqual({ kind: "invalid" });
  });
});

describe("scheduleFromDutyTimes", () => {
  it("dutytime1s…8c 를 요일별로 읽는다 (태그는 소문자로 정규화돼 있다)", () => {
    const s = scheduleFromDutyTimes({
      dutytime1s: "0900",
      dutytime1c: "1800",
      dutytime8s: "1000",
      dutytime8c: "1500",
    });
    expect(s[1]).toEqual({ kind: "open", open: 540, close: 1080 });
    expect(s[2]).toEqual({ kind: "closed" });
    expect(s[8]).toEqual({ kind: "open", open: 600, close: 900 });
  });
});

const closedWeek = (): Record<number, { kind: "closed" }> =>
  Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((d) => [d, { kind: "closed" }]));

describe("isNightPharmacy", () => {
  it("밤 10시를 넘겨 여는 날이 있으면 심야 약국", () => {
    const s = { ...closedWeek(), 3: { kind: "open", open: 540, close: 1350 } } as WeeklySchedule;
    expect(isNightPharmacy(s)).toBe(true);
  });

  it("정확히 22:00 에 닫으면 심야가 아니다", () => {
    const s = { ...closedWeek(), 3: { kind: "open", open: 540, close: 1320 } } as WeeklySchedule;
    expect(isNightPharmacy(s)).toBe(false);
  });

  it("자정을 넘기는 영업은 심야다", () => {
    const s = { ...closedWeek(), 5: { kind: "open", open: 1080, close: 1560 } } as WeeklySchedule;
    expect(isNightPharmacy(s)).toBe(true);
  });
});

describe("opensOnHolidays", () => {
  it("공휴일(8) 운영시간이 있어야 공휴일 약국", () => {
    const base = closedWeek() as WeeklySchedule;
    expect(opensOnHolidays(base)).toBe(false);
    expect(opensOnHolidays({ ...base, 8: { kind: "open", open: 600, close: 1080 } })).toBe(true);
    expect(opensOnHolidays({ ...base, 8: { kind: "invalid" } })).toBe(false);
  });
});
