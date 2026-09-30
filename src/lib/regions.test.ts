import { describe, expect, it } from "vitest";
import { isKnownRegion, REGIONS, regionFromAddress, SIDO_LIST } from "./regions";

describe("REGIONS", () => {
  it("16개 시도 (2026-07 전남광주통합특별시 출범 반영)", () => {
    expect(SIDO_LIST).toHaveLength(16);
    expect(SIDO_LIST).toContain("전남광주통합특별시");
    expect(SIDO_LIST).not.toContain("광주광역시");
    expect(SIDO_LIST).not.toContain("전라남도");
  });

  it("시도 안에 중복된 시군구가 없다", () => {
    for (const [sido, list] of Object.entries(REGIONS)) {
      expect(new Set(list).size, sido).toBe(list.length);
    }
  });

  it("인천 행정체제 개편을 반영한다", () => {
    const incheon = REGIONS.인천광역시 ?? [];
    expect(incheon).toEqual(expect.arrayContaining(["제물포구", "영종구", "서해구", "검단구"]));
    expect(incheon).not.toContain("중구");
    expect(incheon).not.toContain("서구");
  });
});

describe("isKnownRegion", () => {
  it("목록에 있는 조합만 받는다", () => {
    expect(isKnownRegion({ sido: "서울특별시", sigungu: "강남구" })).toBe(true);
    expect(isKnownRegion({ sido: "서울특별시", sigungu: "해운대구" })).toBe(false);
    expect(isKnownRegion({ sido: "서울특별시", sigungu: "" })).toBe(false);
    expect(isKnownRegion({ sido: "없는도", sigungu: "" })).toBe(false);
  });

  it("세종은 시군구 없이", () => {
    expect(isKnownRegion({ sido: "세종특별자치시", sigungu: "" })).toBe(true);
    expect(isKnownRegion({ sido: "세종특별자치시", sigungu: "조치원읍" })).toBe(false);
  });
});

describe("regionFromAddress", () => {
  it.each([
    ["서울특별시 강남구 일원동 50 (일원로 81)", "서울특별시", "강남구"],
    ["  서울특별시   종로구 효제동 126-2", "서울특별시", "종로구"],
    ["경기도 수원시 장안구 정자동 1", "경기도", "수원시"],
    ["세종특별자치시 한누리대로 1", "세종특별자치시", ""],
  ])("%s", (addr, sido, sigungu) => {
    expect(regionFromAddress(addr)).toEqual({ sido, sigungu });
  });

  it("시도가 없거나 모르는 주소는 null", () => {
    expect(regionFromAddress("평내동 107-1(경춘로 1308번길 8-8)")).toBeNull();
    expect(regionFromAddress("서울특별시 없는구 1")).toBeNull();
    expect(regionFromAddress("")).toBeNull();
  });
});

describe("regionFromAddress — 구 지역명 (2026-07-01 이전)", () => {
  it("광주광역시 서구 주소 → 전남광주통합특별시 서구", () => {
    expect(regionFromAddress("광주광역시 서구 상무중앙로 95 (치평동)")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "서구",
    });
  });

  it("광주광역시 동구 → 전남광주통합특별시 동구", () => {
    expect(regionFromAddress("광주광역시 동구 계림로 100")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "동구",
    });
  });

  it("전라남도 순천시 주소 → 전남광주통합특별시 순천시", () => {
    expect(regionFromAddress("전라남도 순천시 중앙동 50")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "순천시",
    });
  });

  it("전라남도 목포시 → 전남광주통합특별시 목포시", () => {
    expect(regionFromAddress("전라남도 목포시 해양로 200")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "목포시",
    });
  });

  it("인천광역시 중구 주소 → 인천광역시 제물포구 (기본값, 주소로 필터링 필요)", () => {
    expect(regionFromAddress("인천광역시 중구 인수로 100")).toEqual({
      sido: "인천광역시",
      sigungu: "제물포구",
    });
  });

  it("인천광역시 동구 주소 → 인천광역시 영종구", () => {
    expect(regionFromAddress("인천광역시 동구 신흥로 50")).toEqual({
      sido: "인천광역시",
      sigungu: "영종구",
    });
  });

  it("인천광역시 서구 주소 → 인천광역시 서해구 (기본값, 주소로 필터링 필요)", () => {
    expect(regionFromAddress("인천광역시 서구 경서로 300")).toEqual({
      sido: "인천광역시",
      sigungu: "서해구",
    });
  });
});
