import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { FixtureSource } from "@/lib/api/fixtureSource";
import type { MedicalDataSource } from "@/lib/api/source";
import { kstDateTime } from "@/lib/time/kst";
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

describe("findPharmacies — 옛 지역명 처리 (2026-07-01 개편)", () => {
  function oldNamesSource(): FixtureSource {
    const ROOT = path.join(process.cwd(), "fixtures");
    return new FixtureSource((file) => {
      if (file === "pharmacies.xml") {
        return readFileSync(path.join(ROOT, "demo/pharmacies-old-names.xml"), "utf8");
      }
      return readFileSync(path.join(ROOT, `demo/${file}`), "utf8");
    });
  }

  it("영종구 선택 시 옛 이름 동구 주소의 약국도 나온다", async () => {
    const items = await findPharmacies(
      oldNamesSource(),
      { kind: "region", region: { sido: "인천광역시", sigungu: "영종구" }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );
    const names = items.map((p) => p.name);
    expect(names).toContain("영종약국");
    expect(items.some((p) => p.name === "영종약국" && p.address.includes("영종대로"))).toBe(true);
  });

  it("제물포구 선택 시 옛 이름 중구 주소의 약국들도 나온다", async () => {
    const items = await findPharmacies(
      oldNamesSource(),
      { kind: "region", region: { sido: "인천광역시", sigungu: "제물포구" }, origin: null },
      kstDateTime(2026, 9, 28, 12),
    );
    const names = items.map((p) => p.name);
    expect(names).toContain("중구약국");
    expect(names).toContain("차이나타운약국");
  });

  it("전남광주통합특별시 서구 선택 시 옛 이름 광주광역시 서구 약국이 나온다", async () => {
    const items = await findPharmacies(
      oldNamesSource(),
      {
        kind: "region",
        region: { sido: "전남광주통합특별시", sigungu: "서구" },
        origin: null,
      },
      kstDateTime(2026, 9, 28, 12),
    );
    const names = items.map((p) => p.name);
    expect(names).toContain("햇살약국");
  });

  it("위치 조회에서 옛 지역명 주소로부터 목록 보강이 일어난다", async () => {
    const GWANGJU = { lat: 35.16, lon: 126.85 };
    const items = await findPharmacies(
      oldNamesSource(),
      { kind: "point", point: GWANGJU },
      kstDateTime(2026, 9, 28, 12),
    );

    const names = items.map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);

    const gwangjuItems = items.filter((p) => p.address.includes("광주"));
    expect(gwangjuItems.length).toBeGreaterThan(0);
    expect(gwangjuItems.some((p) => p.address.includes("서구") || p.address.includes("동구"))).toBe(
      true,
    );
  });
});
