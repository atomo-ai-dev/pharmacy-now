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

  describe("2026-07-01 개편 전 옛 이름 주소 (약국 데이터가 아직 옛 이름을 쓴다)", () => {
    it.each([
      ["광주광역시 서구 상무중앙로 95 (치평동)", "전남광주통합특별시", "서구"],
      ["전라남도 순천시 조례동 1", "전남광주통합특별시", "순천시"],
    ])("%s", (addr, sido, sigungu) => {
      expect(regionFromAddress(addr)).toEqual({ sido, sigungu });
    });

    it("인천 옛 중구는 영종 주소만 영종구, 나머지는 제물포구", () => {
      expect(regionFromAddress("인천광역시 중구 영종해안남로 123 (운서동)")).toEqual({
        sido: "인천광역시",
        sigungu: "영종구",
      });
      expect(regionFromAddress("인천광역시 중구 신포로 15 (해안동1가)")).toEqual({
        sido: "인천광역시",
        sigungu: "제물포구",
      });
    });

    it("인천 옛 동구는 제물포구로 옮긴다", () => {
      expect(regionFromAddress("인천광역시 동구 창영동 60 (우각로)")).toEqual({
        sido: "인천광역시",
        sigungu: "제물포구",
      });
    });

    it("인천 옛 서구는 검단 주소만 검단구, 나머지는 서해구", () => {
      expect(regionFromAddress("인천광역시 서구 검단로 1 (대곡동)")).toEqual({
        sido: "인천광역시",
        sigungu: "검단구",
      });
      expect(regionFromAddress("인천광역시 서구 서곶로 1 (가정동)")).toEqual({
        sido: "인천광역시",
        sigungu: "서해구",
      });
    });
  });
});
