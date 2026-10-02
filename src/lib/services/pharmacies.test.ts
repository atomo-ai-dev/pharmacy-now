import { describe, expect, it, vi } from "vitest";
import type { MedicalDataSource } from "@/lib/api/source";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource } from "@/test/fixtures";
import { fixtureItems } from "../../test/fixtures";
import { findPharmacies } from "./pharmacies";

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

/**
 * 약국 서비스가 옛 지역 이름을 섞어 돌려주는 모양을 흉내 낸다 (fixtures/synthetic, 합성 데이터).
 * 목록 조회는 실서비스처럼 주소 앞머리가 Q0/Q1 과 같은 약국만 돌려준다.
 */
function legacyNamedSource() {
  const list = fixtureItems("synthetic/pharmacy-list-legacy-regions.xml");
  const near = fixtureItems("synthetic/pharmacy-location-legacy-regions.xml");
  const pharmaciesByRegion = vi.fn(async (r: { sido: string; sigungu: string }) =>
    list.filter((i) => (i.dutyaddr ?? "").startsWith(`${r.sido} ${r.sigungu} `)),
  );
  const emergency = vi.fn(async () => []);
  const source: MedicalDataSource = {
    pharmaciesByRegion,
    pharmaciesNear: async () => near,
    emergencyRoomsByRegion: emergency,
    emergencyRoomsNear: emergency,
    emergencyBeds: emergency,
  };
  return { source, pharmaciesByRegion };
}

describe("findPharmacies — 2026-07 개편 지역 (약국 서비스는 옛 이름)", () => {
  const at = kstDateTime(2026, 9, 28, 12);

  it("영종구를 고르면 옛 이름 중구 응답 가운데 영종 주소 약국만, hpid 로 중복 없이", async () => {
    const { source, pharmaciesByRegion } = legacyNamedSource();
    const items = await findPharmacies(
      source,
      { kind: "region", region: { sido: "인천광역시", sigungu: "영종구" }, origin: null },
      at,
    );
    expect(items.map((p) => p.name).sort()).toEqual(["(합성) 영종하늘약국", "(합성) 운서역약국"]);
    expect(pharmaciesByRegion.mock.calls.map(([r]) => r.sigungu).sort()).toEqual([
      "영종구",
      "중구",
    ]);
  });

  it("제물포구는 옛 중구(영종 제외)와 동구를 합친다", async () => {
    const { source } = legacyNamedSource();
    const items = await findPharmacies(
      source,
      { kind: "region", region: { sido: "인천광역시", sigungu: "제물포구" }, origin: null },
      at,
    );
    expect(items.map((p) => p.name).sort()).toEqual(["(합성) 송림약국", "(합성) 신포약국"]);
  });

  it("검단구·서해구는 옛 서구 응답을 주소로 나눈다", async () => {
    const { source } = legacyNamedSource();
    const names = async (sigungu: string) =>
      (
        await findPharmacies(
          source,
          { kind: "region", region: { sido: "인천광역시", sigungu }, origin: null },
          at,
        )
      ).map((p) => p.name);
    expect(await names("검단구")).toEqual(["(합성) 검단신도시약국"]);
    expect(await names("서해구")).toEqual(["(합성) 청라약국"]);
  });

  it("전남광주통합특별시 서구는 광주광역시 서구 약국도 보여 준다", async () => {
    const { source } = legacyNamedSource();
    const items = await findPharmacies(
      source,
      { kind: "region", region: { sido: "전남광주통합특별시", sigungu: "서구" }, origin: null },
      at,
    );
    expect(items.map((p) => p.name).sort()).toEqual([
      "(합성) 상무햇살약국",
      "(합성) 쌍촌약국",
      "(합성) 치평온누리약국",
    ]);
  });

  it("광주 좌표 조회에서 옛 이름 주소로도 요일별 운영시간을 채운다", async () => {
    const { source, pharmaciesByRegion } = legacyNamedSource();
    const items = await findPharmacies(
      source,
      { kind: "point", point: { lat: 35.1595, lon: 126.8526 } },
      at,
    );
    expect(items).toHaveLength(3);
    expect(items.every((p) => p.weeklyHours !== null)).toBe(true);
    expect(items.find((p) => p.name === "(합성) 상무햇살약국")?.holiday).toBe(true);
    expect(pharmaciesByRegion.mock.calls.map(([r]) => `${r.sido} ${r.sigungu}`).sort()).toEqual([
      "광주광역시 서구",
      "전남광주통합특별시 서구",
    ]);
  });

  it("옛 이름 조회만 실패해도 새 이름 결과는 보여 준다", async () => {
    const { source, pharmaciesByRegion } = legacyNamedSource();
    const base = pharmaciesByRegion.getMockImplementation();
    pharmaciesByRegion.mockImplementation(async (r) => {
      if (r.sido === "광주광역시") throw new Error("down");
      return base ? base(r) : [];
    });
    const items = await findPharmacies(
      source,
      { kind: "region", region: { sido: "전남광주통합특별시", sigungu: "서구" }, origin: null },
      at,
    );
    expect(items.map((p) => p.name)).toEqual(["(합성) 쌍촌약국"]);
  });
});
