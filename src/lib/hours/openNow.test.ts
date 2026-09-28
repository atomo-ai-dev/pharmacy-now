import { describe, expect, it } from "vitest";
import { kstDateTime } from "../time/kst";
import { closingLabel, hoursLabel, openStatus, todayHoursLabel } from "./openNow";
import { scheduleFromDutyTimes } from "./schedule";

type Times = Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, [string, string]>>;

function schedule(times: Times) {
  const item: Record<string, string> = {};
  for (const [day, [s, c]] of Object.entries(times)) {
    item[`dutytime${day}s`] = s;
    item[`dutytime${day}c`] = c;
  }
  return scheduleFromDutyTimes(item);
}

// 2026-09-28 월요일 (평일)
const MON = (h: number, m = 0) => kstDateTime(2026, 9, 28, h, m);

describe("openStatus — 요일별 운영시간", () => {
  const weekday = schedule({ 1: ["0900", "1800"], 2: ["0900", "1800"] });

  it("영업시간 안이면 영업 중, 닫는 시각을 알려 준다", () => {
    expect(openStatus(weekday, MON(10))).toEqual({ state: "open", closesAt: "18:00" });
  });

  it("여는 시각 정각은 영업 중, 닫는 시각 정각은 종료", () => {
    expect(openStatus(weekday, MON(9)).state).toBe("open");
    expect(openStatus(weekday, MON(18)).state).toBe("closed");
  });

  it("여는 시각 전은 종료", () => {
    expect(openStatus(weekday, MON(8, 59)).state).toBe("closed");
  });

  it("그 요일 값이 없으면 쉬는 날", () => {
    // 2026-09-27 일요일
    expect(openStatus(weekday, kstDateTime(2026, 9, 27, 12)).state).toBe("closed");
  });

  it("일요일은 7번 운영시간을 쓴다", () => {
    const sunday = schedule({ 7: ["1000", "1400"] });
    expect(openStatus(sunday, kstDateTime(2026, 9, 27, 12)).state).toBe("open");
  });
});

describe("openStatus — 자정을 넘기는 영업", () => {
  const late = schedule({ 1: ["2200", "0200"], 2: ["2200", "0200"] });

  it("시작 당일 밤에 영업 중", () => {
    expect(openStatus(late, MON(23, 30))).toEqual({ state: "open", closesAt: "02:00" });
  });

  it("다음날 새벽에도 전날 영업이 이어진다", () => {
    // 화요일 01:00 — 월요일 22:00 에 시작한 영업
    expect(openStatus(late, kstDateTime(2026, 9, 29, 1))).toEqual({
      state: "open",
      closesAt: "02:00",
    });
  });

  it("새벽 마감 시각 이후는 종료", () => {
    expect(openStatus(late, kstDateTime(2026, 9, 29, 2)).state).toBe("closed");
  });

  it("전날이 쉬는 날이면 새벽 영업도 없다", () => {
    // 월요일 01:00 — 일요일에는 영업하지 않았다
    expect(openStatus(late, MON(1)).state).toBe("closed");
  });

  it("24시 이후 표기(1800–2600)도 새벽까지 이어진다", () => {
    const s = schedule({ 1: ["1800", "2600"] });
    expect(openStatus(s, kstDateTime(2026, 9, 29, 1, 59)).state).toBe("open");
  });
});

describe("openStatus — 24시간", () => {
  const allDay = schedule({ 1: ["0000", "2400"], 2: ["0000", "2400"] });

  it("하루 종일 영업 중이고 닫는 시각은 없다", () => {
    expect(openStatus(allDay, MON(0))).toEqual({ state: "open", closesAt: null });
    expect(openStatus(allDay, MON(23, 59))).toEqual({ state: "open", closesAt: null });
  });
});

describe("openStatus — 공휴일", () => {
  // 2026-09-25 금요일 추석
  const CHUSEOK = (h: number) => kstDateTime(2026, 9, 25, h);

  it("공휴일에는 요일이 아니라 8번(공휴일) 운영시간을 쓴다", () => {
    const s = schedule({ 5: ["0900", "1800"], 8: ["1000", "1400"] });
    expect(openStatus(s, CHUSEOK(9)).state).toBe("closed");
    expect(openStatus(s, CHUSEOK(11))).toEqual({ state: "open", closesAt: "14:00" });
  });

  it("공휴일 운영시간이 없으면 평일이라도 쉰다", () => {
    const s = schedule({ 5: ["0900", "1800"] });
    expect(openStatus(s, CHUSEOK(11)).state).toBe("closed");
  });

  it("대체공휴일도 공휴일이다 (2026-10-05 월)", () => {
    const s = schedule({ 1: ["0900", "1800"] });
    expect(openStatus(s, kstDateTime(2026, 10, 5, 11)).state).toBe("closed");
  });

  it("공휴일 밤에 시작한 심야 영업은 다음날 새벽까지 이어진다", () => {
    // 추석(금) 22:00–02:00, 다음날(토, 추석 연휴도 공휴일) 새벽 1시
    const s = schedule({ 8: ["2200", "0200"] });
    expect(openStatus(s, kstDateTime(2026, 9, 26, 1)).state).toBe("open");
  });

  it("공휴일 다음날 새벽에는 평일 전날 시간표가 아니라 공휴일 시간표를 이어 쓴다", () => {
    // 2026-10-05(월, 대체공휴일) 의 전날은 일요일. 10-06(화) 새벽은 10-05 의 8번 시간표를 이어받는다.
    const s = schedule({ 1: ["0900", "1800"], 8: ["2000", "0300"] });
    expect(openStatus(s, kstDateTime(2026, 10, 6, 2)).state).toBe("open");
  });
});

describe("openStatus — 값이 이상할 때", () => {
  it("오늘 값이 깨져 있으면 확인 불가", () => {
    const s = schedule({ 1: ["09:3O", "1800"] });
    expect(openStatus(s, MON(12))).toEqual({ state: "unknown" });
  });

  it("한쪽만 있으면 확인 불가", () => {
    const s = scheduleFromDutyTimes({ dutytime1s: "0900" });
    expect(openStatus(s, MON(12))).toEqual({ state: "unknown" });
  });

  it("다른 요일 값이 깨져 있어도 오늘 판정에는 영향이 없다", () => {
    const s = schedule({ 1: ["0900", "1800"], 2: ["xx", "yy"] });
    expect(openStatus(s, MON(12)).state).toBe("open");
  });
});

describe("운영시간 표기", () => {
  it("오늘 운영시간", () => {
    const s = schedule({ 1: ["0830", "2230"] });
    expect(todayHoursLabel(s, MON(12))).toBe("08:30–22:30");
    expect(todayHoursLabel(s, kstDateTime(2026, 9, 27, 12))).toBe("휴무");
  });

  it("자정 넘김·24시·24시간·판정 불가", () => {
    expect(hoursLabel({ kind: "open", open: 1320, close: 1560 })).toBe("22:00–다음날 02:00");
    expect(hoursLabel({ kind: "open", open: 420, close: 1440 })).toBe("07:00–24:00");
    expect(hoursLabel({ kind: "open", open: 0, close: 1440 })).toBe("24시간");
    expect(hoursLabel({ kind: "invalid" })).toBeNull();
  });

  it("자정 마감은 24:00 으로 적는다", () => {
    expect(closingLabel(1440)).toBe("24:00");
    expect(closingLabel(1560)).toBe("02:00");
  });
});
