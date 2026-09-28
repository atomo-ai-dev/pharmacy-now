import { describe, expect, it } from "vitest";
import type { MedicalDataSource } from "@/lib/api/source";
import { kstDateTime } from "@/lib/time/kst";
import type { EmergencyRoomView } from "@/lib/views";
import { demoSource } from "@/test/fixtures";
import { findEmergencyRooms, sortEmergencyRooms } from "./emergency";

const NOW = kstDateTime(2026, 9, 28, 10, 40);

describe("findEmergencyRooms — 지역", () => {
  it("목록과 실시간 병상을 기관ID 로 합친다", async () => {
    const items = await findEmergencyRooms(
      demoSource(),
      { kind: "region", region: { sido: "서울특별시", sigungu: "중구" }, origin: null },
      NOW,
    );
    const byId = new Map(items.map((e) => [e.id, e]));
    expect(byId.get("DEMOE003")?.general).toEqual({ available: 0, capacity: 10, state: "full" });
    expect(byId.get("DEMOE003")?.phone).toBe("02-0000-3000"); // 응급실 전화가 없으면 대표전화
    expect(byId.get("DEMOE004")?.general.state).toBe("unknown"); // hvec 빈 값
    expect(byId.get("DEMOE004")?.stale).toBe(true); // 07:00 입력
    expect(byId.get("DEMOE005")?.updatedAt).toBeNull(); // 병상 응답 없음
  });

  it("거리를 모르면 가용 병상 많은 순, 정보 없는 곳은 뒤로", async () => {
    const items = await findEmergencyRooms(
      demoSource(),
      { kind: "region", region: { sido: "서울특별시", sigungu: "종로구" }, origin: null },
      NOW,
    );
    expect(items.map((e) => e.id)).toEqual(["DEMOE001", "DEMOE002"]); // 5 > -3
  });

  it("목록에 없고 병상 응답에만 있는 기관도 보여 준다", async () => {
    const base = demoSource();
    const source: MedicalDataSource = {
      pharmaciesByRegion: (r) => base.pharmaciesByRegion(r),
      pharmaciesNear: (p) => base.pharmaciesNear(p),
      emergencyRoomsNear: (p) => base.emergencyRoomsNear(p),
      emergencyRoomsByRegion: async () => [],
      emergencyBeds: async () => [
        { hpid: "Z1", dutyname: "병상만 있는 병원", hvec: "3", dutytel3: "02-9" },
      ],
    };
    const items = await findEmergencyRooms(
      source,
      { kind: "region", region: { sido: "서울특별시", sigungu: "중구" }, origin: null },
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "병상만 있는 병원", phone: "02-9", address: null });
  });
});

describe("findEmergencyRooms — 내 위치", () => {
  it("가까운 순이고 주변 지역의 병상을 붙인다", async () => {
    const items = await findEmergencyRooms(
      demoSource(),
      { kind: "point", point: { lat: 37.5795, lon: 126.999 } },
      NOW,
    );
    expect(items[0]?.id).toBe("DEMOE001");
    expect(items[0]?.distanceKm).toBeCloseTo(0, 2);
    expect(items[0]?.general.available).toBe(5);
    const d = items.map((e) => e.distanceKm ?? 0);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
});

describe("sortEmergencyRooms", () => {
  const v = (
    id: string,
    available: number | null,
    distanceKm: number | null = null,
  ): EmergencyRoomView => ({
    id,
    name: id,
    address: null,
    phone: null,
    category: null,
    lat: null,
    lon: null,
    distanceKm,
    general: { available, capacity: null, state: "unknown" },
    pediatric: { available: null, capacity: null, state: "unknown" },
    updatedAt: null,
    stale: false,
  });

  it("거리 있는 곳이 먼저, 그다음 병상 많은 순, 정보 없음은 끝", () => {
    const sorted = sortEmergencyRooms([v("a", null), v("b", -1), v("c", 4), v("d", 0, 2.5)]);
    expect(sorted.map((x) => x.id)).toEqual(["d", "c", "b", "a"]);
  });
});
