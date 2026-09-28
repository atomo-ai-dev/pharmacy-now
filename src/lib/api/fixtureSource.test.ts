import { describe, expect, it } from "vitest";
import { parseHvidate } from "@/lib/model/emergency";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource } from "@/test/fixtures";

describe("FixtureSource (데모 데이터)", () => {
  it("지역으로 거른다", async () => {
    const src = demoSource();
    const jongno = await src.pharmaciesByRegion({ sido: "서울특별시", sigungu: "종로구" });
    const junggu = await src.pharmaciesByRegion({ sido: "서울특별시", sigungu: "중구" });
    expect(jongno.length).toBeGreaterThan(0);
    expect(junggu.length).toBeGreaterThan(0);
    expect(jongno.every((i) => i.dutyaddr?.startsWith("서울특별시 종로구"))).toBe(true);
    expect(await src.pharmaciesByRegion({ sido: "부산광역시", sigungu: "중구" })).toEqual([]);
  });

  it("위치 조회는 가까운 순이고, 실제 API 처럼 요일별 운영시간이 없다", async () => {
    const items = await demoSource().pharmaciesNear({ lat: 37.5702, lon: 126.9918 });
    const distances = items.map((i) => Number(i.distance));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(items[0]?.hpid).toBe("DEMO0001");
    expect(items[0]?.latitude).toBe("37.5702");
    expect(Object.keys(items[0] ?? {}).some((k) => k.startsWith("dutytime"))).toBe(false);
  });

  it("병상 정보는 그 지역 기관 것만", async () => {
    const beds = await demoSource().emergencyBeds({ sido: "서울특별시", sigungu: "종로구" });
    expect(beds.map((b) => b.hpid).sort()).toEqual(["DEMOE001", "DEMOE002"]);
  });

  it("시계를 주면 가장 최근 입력 시각이 5분 전이 되도록 옮긴다", async () => {
    const now = kstDateTime(2027, 1, 2, 12, 0);
    const beds = await demoSource(() => now.getTime()).emergencyBeds({
      sido: "서울특별시",
      sigungu: "종로구",
    });
    const times = beds.map((b) => parseHvidate(b.hvidate)?.getTime() ?? 0);
    expect(Math.max(...times)).toBe(now.getTime() - 5 * 60 * 1000);
  });
});
