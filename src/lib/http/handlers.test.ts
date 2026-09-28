import { afterEach, describe, expect, it, vi } from "vitest";
import type { MedicalDataSource } from "@/lib/api/source";
import { ApiError } from "@/lib/api/xml";
import { kstDateTime } from "@/lib/time/kst";
import type { EmergencyResponse, PharmacyResponse } from "@/lib/views";
import { demoSource } from "@/test/fixtures";
import { handleEmergency, handlePharmacies } from "./handlers";

const url = (path: string) => new URL(path, "http://localhost");
const deps = (now = kstDateTime(2026, 9, 28, 12)) => ({
  source: demoSource(),
  now,
  mode: "demo" as const,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/pharmacies", () => {
  it("좌표로 조회하면 메타와 목록을 돌려준다", async () => {
    const res = await handlePharmacies(url("/api/pharmacies?lat=37.5704&lon=126.9921"), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
    const body = (await res.json()) as PharmacyResponse;
    expect(body.mode).toBe("demo");
    expect(body.holidayName).toBeNull();
    expect(body.holidayCovered).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("공휴일이면 이름을 알려 준다", async () => {
    const res = await handlePharmacies(
      url("/api/pharmacies?sido=서울특별시&sigungu=종로구"),
      deps(kstDateTime(2026, 9, 25, 12)),
    );
    expect(((await res.json()) as PharmacyResponse).holidayName).toBe("추석");
  });

  it("공휴일 표가 없는 해에는 경고 플래그", async () => {
    const res = await handlePharmacies(
      url("/api/pharmacies?sido=서울특별시&sigungu=종로구"),
      deps(kstDateTime(2028, 3, 2, 12)),
    );
    expect(((await res.json()) as PharmacyResponse).holidayCovered).toBe(false);
  });

  it("잘못된 요청은 400", async () => {
    const res = await handlePharmacies(url("/api/pharmacies?lat=1&lon=1"), deps());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "위치가 대한민국 범위를 벗어났습니다." });
  });

  it("공공데이터 API 오류는 502, 내부 사유는 응답에 싣지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: MedicalDataSource = {
      ...demoSource(),
      pharmaciesByRegion: async () => {
        throw new ApiError("공공데이터포털 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR", "30");
      },
      pharmaciesNear: async () => [],
      emergencyRoomsByRegion: async () => [],
      emergencyRoomsNear: async () => [],
      emergencyBeds: async () => [],
    };
    const res = await handlePharmacies(url("/api/pharmacies?sido=서울특별시&sigungu=종로구"), {
      ...deps(),
      source: failing,
    });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("SERVICE_KEY");
  });

  it("예상하지 못한 오류는 삼키지 않는다", async () => {
    const broken = {
      ...demoSource(),
      pharmaciesByRegion: async () => Promise.reject(new TypeError("bug")),
    };
    await expect(
      handlePharmacies(url("/api/pharmacies?sido=서울특별시&sigungu=종로구"), {
        ...deps(),
        source: broken as unknown as MedicalDataSource,
      }),
    ).rejects.toThrow("bug");
  });
});

describe("GET /api/emergency", () => {
  it("지역으로 조회", async () => {
    const res = await handleEmergency(url("/api/emergency?sido=서울특별시&sigungu=종로구"), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=30");
    const body = (await res.json()) as EmergencyResponse;
    expect(body.items.map((e) => e.id)).toEqual(["DEMOE001", "DEMOE002"]);
  });

  it("위치 없이 부르면 400", async () => {
    expect((await handleEmergency(url("/api/emergency"), deps())).status).toBe(400);
  });
});
