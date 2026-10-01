import { describe, expect, it } from "vitest";
import * as regions from "./regions";
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

describe("regionFromAddress — 옛 이름 주소 (2026-07 개편 이전)", () => {
  it.each([
    ["광주광역시 서구 상무중앙로 95 (치평동)", "전남광주통합특별시", "서구"],
    ["광주광역시 광산구 수완로 1", "전남광주통합특별시", "광산구"],
    ["전라남도 순천시 중앙로 1 (장천동)", "전남광주통합특별시", "순천시"],
    ["인천광역시 중구 신포로 1 (신포동)", "인천광역시", "제물포구"],
    ["인천광역시 중구 영종대로 1 (운서동)", "인천광역시", "영종구"],
    ["인천광역시 중구 공항로 272 (운서동)", "인천광역시", "영종구"],
    ["인천광역시 동구 송림로 1 (송림동)", "인천광역시", "제물포구"],
    ["인천광역시 서구 완정로 1 (마전동)", "인천광역시", "검단구"],
    ["인천광역시 서구 청라대로 1 (청라동)", "인천광역시", "서해구"],
  ])("%s", (addr, sido, sigungu) => {
    expect(regionFromAddress(addr)).toEqual({ sido, sigungu });
  });

  it("옛 시도라도 모르는 시군구는 null", () => {
    expect(regionFromAddress("광주광역시 순천시 1")).toBeNull();
    expect(regionFromAddress("전라남도 서구 1")).toBeNull();
  });
});

describe("legacyPharmacyRegions", () => {
  const { legacyPharmacyRegions } = regions;
  const olds = (sido: string, sigungu: string) =>
    legacyPharmacyRegions({ sido, sigungu }).map((l) => `${l.region.sido} ${l.region.sigungu}`);

  it("새 지역 → 약국 조회에 함께 보낼 옛 이름", () => {
    expect(olds("전남광주통합특별시", "서구")).toEqual(["광주광역시 서구"]);
    expect(olds("전남광주통합특별시", "여수시")).toEqual(["전라남도 여수시"]);
    expect(olds("인천광역시", "제물포구")).toEqual(["인천광역시 중구", "인천광역시 동구"]);
    expect(olds("인천광역시", "영종구")).toEqual(["인천광역시 중구"]);
    expect(olds("인천광역시", "서해구")).toEqual(["인천광역시 서구"]);
    expect(olds("인천광역시", "검단구")).toEqual(["인천광역시 서구"]);
  });

  it("개편과 무관한 지역은 옛 이름이 없다", () => {
    expect(olds("서울특별시", "중구")).toEqual([]);
    expect(olds("인천광역시", "부평구")).toEqual([]);
  });
});
