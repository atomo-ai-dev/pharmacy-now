import { describe, expect, it, vi } from "vitest";
import { DataGoKrClient, type FetchLike } from "@/lib/api/client";
import type { MedicalDataSource } from "@/lib/api/source";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource, readFixture } from "@/test/fixtures";
import { findPharmacies } from "./pharmacies";

/** Q0/Q1 또는 좌표로 응답 XML 을 고르는 가짜 fetch. 옛 지역 이름 보정 테스트에 쓴다. */
function fixtureRouterFetch(byQuery: Record<string, string>, fallback: string): FetchLike {
  return vi.fn(async (url) => {
    const u = new URL(url);
    const key =
      u.searchParams.has("WGS84_LAT") && u.pathname.includes("Lcinfo")
        ? "near"
        : `${u.searchParams.get("Q0")}/${u.searchParams.get("Q1")}`;
    return { ok: true, status: 200, text: async () => readFixture(byQuery[key] ?? fallback) };
  });
}

// 2026-09-28 월요일
const JONGNO3GA = { lat: 37.5704, lon: 126.9921 };

describe("findPharmacies — 지역", () => {
  it("선택한 시군구 약국만, 영업 중인 곳 먼저", async () => {
    const items = await findPharmacies(
      demoSource(),
      { kind: "region", region: { sido: "서울특별시", sigungu: "중구" }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.address.startsWith("서울특별시 중구"))).toBe(true);
    const states = items.map((p) => p.openState);
    const firstNotOpen = states.findIndex((s) => s !== "open");
    expect(states.slice(firstNotOpen).includes("open")).toBe(false);
  });

  it("위치 권한도 있으면 거리순", async () => {
    const items = await findPharmacies(
      demoSource(),
      { kind: "region", region: { sido: "서울특별시", sigungu: "종로구" }, origin: JONGNO3GA },
      kstDateTime(2026, 9, 28, 12),
    );
    const d = items.map((p) => p.distanceKm ?? Number.POSITIVE_INFINITY);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
});

describe("findPharmacies — 내 위치", () => {
  it("가까운 순으로, 요일별 운영시간을 지역 목록에서 채운다", async () => {
    const items = await findPharmacies(
      demoSource(),
      { kind: "point", point: JONGNO3GA },
      kstDateTime(2026, 9, 28, 23, 30),
    );
    const d = items.map((p) => p.distanceKm ?? 0);
    expect(d).toEqual([...d].sort((a, b) => a - b));

    const byName = new Map(items.map((p) => [p.name, p]));
    // 위치 조회에는 운영시간이 없지만 목록 조회로 채워져 판정된다.
    expect(byName.get("(예시) 종로이십사시약국")).toMatchObject({
      openState: "open",
      closesAt: null,
    });
    expect(byName.get("(예시) 새벽별약국")).toMatchObject({
      openState: "open",
      closesAt: "02:00",
      night: true,
    });
    expect(byName.get("(예시) 인사동약국")?.openState).toBe("closed");
    expect(byName.get("(예시) 남대문약국")?.openState).toBe("unknown");
    expect(byName.get("(예시) 삼청약국")?.openState).toBe("unknown");
  });

  it("추석 당일에는 공휴일 운영시간으로 판정한다", async () => {
    const items = await findPharmacies(
      demoSource(),
      { kind: "point", point: JONGNO3GA },
      kstDateTime(2026, 9, 25, 12),
    );
    const open = items.filter((p) => p.openState === "open").map((p) => p.name);
    expect(open).toContain("(예시) 광화문온약국"); // 공휴일 10–18
    expect(open).toContain("(예시) 혜화약국"); // 공휴일 10–16
    expect(open).not.toContain("(예시) 인사동약국"); // 공휴일 운영 없음
    expect(open).not.toContain("(예시) 명동약국"); // 매일 열지만 공휴일 값 없음
  });

  it("지역 목록 조회가 실패해도 위치 조회 결과는 보여 준다", async () => {
    const base = demoSource();
    const source: MedicalDataSource = {
      ...base,
      pharmaciesNear: (p) => base.pharmaciesNear(p),
      pharmaciesByRegion: vi.fn(async () => {
        throw new Error("down");
      }),
      emergencyRoomsByRegion: (r) => base.emergencyRoomsByRegion(r),
      emergencyRoomsNear: (p) => base.emergencyRoomsNear(p),
      emergencyBeds: (r) => base.emergencyBeds(r),
    };
    const items = await findPharmacies(
      source,
      { kind: "point", point: JONGNO3GA },
      kstDateTime(2026, 9, 28, 12),
    );
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.openState === "unknown")).toBe(true);
  });

  it("위치 조회 결과 주소로 이웃 지역을 최대 두 곳만 조회한다", async () => {
    const base = demoSource();
    const byRegion = vi.fn((r: { sido: string; sigungu: string }) => base.pharmaciesByRegion(r));
    const source: MedicalDataSource = {
      pharmaciesNear: (p) => base.pharmaciesNear(p),
      pharmaciesByRegion: byRegion,
      emergencyRoomsByRegion: (r) => base.emergencyRoomsByRegion(r),
      emergencyRoomsNear: (p) => base.emergencyRoomsNear(p),
      emergencyBeds: (r) => base.emergencyBeds(r),
    };
    await findPharmacies(source, { kind: "point", point: JONGNO3GA }, kstDateTime(2026, 9, 28, 12));
    expect(byRegion.mock.calls.map(([r]) => r.sigungu).sort()).toEqual(["종로구", "중구"]);
  });
});

describe("findPharmacies — 2026-07-01 개편 전 옛 지역 이름 (약국 데이터)", () => {
  it("영종구 선택 시 옛 이름 중구 응답에서 영종 주소 약국만 나온다", async () => {
    const fetch = fixtureRouterFetch(
      { "인천광역시/중구": "synthetic/pharmacy-list-incheon-jung-old.xml" },
      "errors/empty-items.xml",
    );
    const client = new DataGoKrClient({ serviceKey: "test-key", fetch });

    const items = await findPharmacies(
      client,
      { kind: "region", region: { sido: "인천광역시", sigungu: "영종구" }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );

    expect(items.map((p) => p.name)).toEqual(["(합성) 영종공항약국"]);
  });

  it("광주 좌표 조회는 옛 이름 응답으로도 목록 보강(요일별 운영시간)이 일어난다", async () => {
    const fetch = fixtureRouterFetch(
      {
        near: "synthetic/pharmacy-location-gwangju.xml",
        "광주광역시/서구": "synthetic/pharmacy-list-gwangju-seogu-old.xml",
      },
      "errors/empty-items.xml",
    );
    const client = new DataGoKrClient({ serviceKey: "test-key", fetch });

    const items = await findPharmacies(
      client,
      { kind: "point", point: { lat: 35.1595, lon: 126.8526 } },
      kstDateTime(2026, 9, 28, 12),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "(합성) 햇살약국" });
    expect(items[0]?.weeklyHours).not.toBeNull();
  });
});
