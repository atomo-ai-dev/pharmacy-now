import { describe, expect, it } from "vitest";
import { parseHhmm } from "./parse";

describe("parseHhmm", () => {
  it.each([
    ["0830", 510],
    ["830", 510], // 공식 가이드 예시에도 나오는 앞자리 0 누락
    ["0000", 0],
    ["2359", 1439],
    ["2400", 1440],
    ["2600", 1560], // 다음날 02:00 을 24시 이후로 적은 값
    [" 1930 ", 1170],
    ["19:30", 1170],
  ])("%j → %i", (raw, minutes) => {
    expect(parseHhmm(raw)).toBe(minutes);
  });

  it.each([
    [""],
    ["   "],
    ["abcd"],
    ["09:3O"],
    ["1260"], // 60분
    ["3700"], // 37시
    ["12345"],
    ["12"],
    [undefined],
    [null],
    [{}],
  ])("%j 는 해석할 수 없다", (raw) => {
    expect(parseHhmm(raw)).toBeNull();
  });

  it("정수도 받는다", () => {
    expect(parseHhmm(930)).toBe(570);
    expect(parseHhmm(9.5)).toBeNull();
  });
});
