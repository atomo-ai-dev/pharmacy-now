import { describe, expect, it } from "vitest";
import { formatDistance, haversineKm, isPlausibleKoreanCoord, parseCoord } from "./distance";

const CITY_HALL = { lat: 37.566535, lon: 126.977969 };
const GANGNAM_STN = { lat: 37.497952, lon: 127.027619 };
const BUSAN_STN = { lat: 35.115225, lon: 129.042243 };

describe("haversineKm", () => {
  it("같은 점은 0", () => {
    expect(haversineKm(CITY_HALL, CITY_HALL)).toBe(0);
  });

  it("서울시청–강남역 약 8.8km", () => {
    expect(haversineKm(CITY_HALL, GANGNAM_STN)).toBeCloseTo(8.8, 1);
  });

  it("서울시청–부산역 약 325km", () => {
    const d = haversineKm(CITY_HALL, BUSAN_STN);
    expect(d).toBeGreaterThan(320);
    expect(d).toBeLessThan(330);
  });

  it("대칭이다", () => {
    expect(haversineKm(CITY_HALL, GANGNAM_STN)).toBeCloseTo(
      haversineKm(GANGNAM_STN, CITY_HALL),
      10,
    );
  });
});

describe("formatDistance", () => {
  it.each([
    [0, "10m"],
    [0.0349, "30m"],
    [0.354, "350m"],
    [0.999, "1.0km"],
    [1.23, "1.2km"],
    [12.6, "13km"],
  ])("%f km → %s", (km, s) => {
    expect(formatDistance(km)).toBe(s);
  });
});

describe("좌표 검증", () => {
  it("대한민국 범위의 좌표만 받는다", () => {
    expect(isPlausibleKoreanCoord(CITY_HALL)).toBe(true);
    expect(isPlausibleKoreanCoord({ lat: 0, lon: 0 })).toBe(false);
    expect(isPlausibleKoreanCoord({ lat: 37.5 })).toBe(false);
    expect(isPlausibleKoreanCoord({ lat: Number.NaN, lon: 127 })).toBe(false);
  });

  it("문자열 좌표를 숫자로", () => {
    expect(parseCoord("37.573708333333336")).toBeCloseTo(37.5737, 4);
    expect(parseCoord("")).toBeNull();
    expect(parseCoord("abc")).toBeNull();
    expect(parseCoord(undefined)).toBeNull();
  });
});
