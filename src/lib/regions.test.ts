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

  it("옛 지역명(2026-07-01 개편 이전) 주소를 새 지역명으로 변환한다", () => {
    // 광주 옛 이름 → 새 이름
    expect(regionFromAddress("광주광역시 서구 상무중앙로 95")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "서구",
    });
    expect(regionFromAddress("광주광역시 동구 동명로 100")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "동구",
    });
    expect(regionFromAddress("광주광역시 남구 남부순환로 200")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "남구",
    });

    // 전라남도 → 전남광주통합특별시
    expect(regionFromAddress("전라남도 순천시 매곡동 100")).toEqual({
      sido: "전남광주통합특별시",
      sigungu: "",
    });

    // 인천 옛 이름 → 새 이름
    expect(regionFromAddress("인천광역시 중구 차이나타운로 200")).toEqual({
      sido: "인천광역시",
      sigungu: "제물포구",
    });
    expect(regionFromAddress("인천광역시 동구 영종대로 300")).toEqual({
      sido: "인천광역시",
      sigungu: "영종구",
    });
    expect(regionFromAddress("인천광역시 서구 서해대로 400")).toEqual({
      sido: "인천광역시",
      sigungu: "서해구",
    });
  });
});
