import { describe, expect, it } from "vitest";
import { parseLocationQuery } from "./query";
import { isKnownRegion, regionFromAddress } from "./regions";

describe("Object.prototype 키 방어", () => {
  describe("isKnownRegion", () => {
    it.each([
      { sido: "toString", sigungu: "" },
      { sido: "valueOf", sigungu: "" },
      { sido: "constructor", sigungu: "" },
      { sido: "__proto__", sigungu: "" },
      { sido: "hasOwnProperty", sigungu: "" },
    ])("$sido는 거부된다", (region) => {
      expect(isKnownRegion(region)).toBe(false);
    });
  });

  describe("regionFromAddress", () => {
    it.each([
      "toString 어딘가",
      "valueOf 어딘가",
      "constructor 어딘가",
      "__proto__ 어딘가",
      "hasOwnProperty 어딘가",
    ])("$address는 null을 반환한다", (addr) => {
      expect(regionFromAddress(addr)).toBeNull();
    });
  });

  describe("parseLocationQuery", () => {
    it.each([
      "sido=toString",
      "sido=valueOf",
      "sido=constructor",
      "sido=__proto__",
      "sido=hasOwnProperty",
    ])("$query는 거절된다", (query) => {
      const result = parseLocationQuery(new URLSearchParams(query));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("알 수 없는 지역입니다.");
      }
    });
  });
});
