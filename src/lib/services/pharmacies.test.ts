import { describe, expect, it, vi } from "vitest";
import type { MedicalDataSource } from "@/lib/api/source";
import { kstDateTime } from "@/lib/time/kst";
import * as testFixtures from "@/test/fixtures";
import { demoSource } from "@/test/fixtures";
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

describe("findPharmacies — 2026-07 개편 지역 (약국 데이터는 옛 이름)", () => {
  // 합성 픽스처. 실 API 처럼 Q0/Q1 을 주소 앞머리와 글자 그대로 맞춰 거른다.
  function legacyNamesSource() {
    const list = testFixtures.fixtureItems("synthetic/pharmacy-list-legacy-names.xml");
    const near = testFixtures.fixtureItems("synthetic/pharmacy-location-legacy-names.xml");
    const byRegion = vi.fn(async (r: { sido: string; sigungu: string }) =>
      list.filter((i) => (i.dutyaddr ?? "").startsWith(`${r.sido} ${r.sigungu} `)),
    );
    const base = demoSource();
    const source: MedicalDataSource = {
      pharmaciesNear: async () => near,
      pharmaciesByRegion: byRegion,
      emergencyRoomsByRegion: (r) => base.emergencyRoomsByRegion(r),
      emergencyRoomsNear: (p) => base.emergencyRoomsNear(p),
      emergencyBeds: (r) => base.emergencyBeds(r),
    };
    return { source, byRegion };
  }

  async function names(sido: string, sigungu: string) {
    const { source } = legacyNamesSource();
    const items = await findPharmacies(
      source,
      { kind: "region", region: { sido, sigungu }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );
    return items.map((p) => p.name).sort();
  }

  it("영종구는 옛 이름 중구 응답 가운데 영종 주소 약국만", async () => {
    expect(await names("인천광역시", "영종구")).toEqual(["(합성) 공항약국", "(합성) 영종하늘약국"]);
  });

  it("제물포구는 새 이름 + 옛 중구(영종 제외) + 옛 동구", async () => {
    expect(await names("인천광역시", "제물포구")).toEqual([
      "(합성) 송림약국",
      "(합성) 신포약국",
      "(합성) 제물포새이름약국",
    ]);
  });

  it("옛 서구는 검단구·서해구로 나눈다", async () => {
    expect(await names("인천광역시", "검단구")).toEqual(["(합성) 검단마전약국"]);
    expect(await names("인천광역시", "서해구")).toEqual(["(합성) 청라약국"]);
  });

  it("전남광주통합특별시 서구는 광주광역시 서구도 조회하고 hpid 로 중복을 없앤다", async () => {
    expect(await names("전남광주통합특별시", "서구")).toEqual([
      "(합성) 상무온누리약국",
      "(합성) 새이름약국",
      "(합성) 햇빛약국",
    ]);
    expect(await names("전남광주통합특별시", "순천시")).toEqual(["(합성) 순천중앙약국"]);
  });

  it("응급의료기관과 달리 약국 조회만 옛 이름도 보낸다", async () => {
    const { source, byRegion } = legacyNamesSource();
    await findPharmacies(
      source,
      { kind: "region", region: { sido: "인천광역시", sigungu: "제물포구" }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );
    expect(byRegion.mock.calls.map(([r]) => `${r.sido} ${r.sigungu}`).sort()).toEqual([
      "인천광역시 동구",
      "인천광역시 제물포구",
      "인천광역시 중구",
    ]);
  });

  it("광주 좌표 조회에서 옛 이름 주소로도 목록 보강이 일어난다", async () => {
    const { source, byRegion } = legacyNamesSource();
    const items = await findPharmacies(
      source,
      { kind: "point", point: { lat: 35.1595, lon: 126.8526 } },
      kstDateTime(2026, 9, 28, 12),
    );
    expect(byRegion).toHaveBeenCalledWith({ sido: "전남광주통합특별시", sigungu: "서구" });
    expect(byRegion).toHaveBeenCalledWith({ sido: "광주광역시", sigungu: "서구" });
    expect(items.length).toBe(4);
    expect(items.every((p) => p.weeklyHours !== null)).toBe(true);
  });
});
