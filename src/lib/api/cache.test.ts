import { describe, expect, it, vi } from "vitest";
import { CachedSource, roundPoint } from "./cache";
import type { MedicalDataSource } from "./source";

function fakeSource() {
  const calls = { list: 0, near: 0, beds: 0 };
  let fail = false;
  const source: MedicalDataSource = {
    pharmaciesByRegion: vi.fn(async () => {
      calls.list++;
      if (fail) throw new Error("boom");
      return [{ hpid: `P${calls.list}` }];
    }),
    pharmaciesNear: vi.fn(async () => {
      calls.near++;
      return [];
    }),
    emergencyRoomsByRegion: vi.fn(async () => []),
    emergencyRoomsNear: vi.fn(async () => []),
    emergencyBeds: vi.fn(async () => {
      calls.beds++;
      return [{ hpid: `B${calls.beds}` }];
    }),
  };
  return { source, calls, setFail: (v: boolean) => (fail = v) };
}

const JONGNO = { sido: "서울특별시", sigungu: "종로구" };

describe("CachedSource", () => {
  it("TTL 안에서는 다시 부르지 않는다", async () => {
    let now = 0;
    const { source, calls } = fakeSource();
    const cached = new CachedSource(source, () => now, { directory: 1000, beds: 100 });

    await cached.pharmaciesByRegion(JONGNO);
    now = 999;
    expect(await cached.pharmaciesByRegion(JONGNO)).toEqual([{ hpid: "P1" }]);
    expect(calls.list).toBe(1);

    now = 1000;
    expect(await cached.pharmaciesByRegion(JONGNO)).toEqual([{ hpid: "P2" }]);
    expect(calls.list).toBe(2);
  });

  it("병상 정보는 짧게 캐시한다", async () => {
    let now = 0;
    const { source, calls } = fakeSource();
    const cached = new CachedSource(source, () => now, { directory: 1000, beds: 100 });

    await cached.emergencyBeds(JONGNO);
    now = 150;
    await cached.emergencyBeds(JONGNO);
    expect(calls.beds).toBe(2);
  });

  it("동시에 들어온 같은 요청은 한 번만 부른다", async () => {
    const { source, calls } = fakeSource();
    const cached = new CachedSource(source, () => 0);
    await Promise.all([cached.pharmaciesByRegion(JONGNO), cached.pharmaciesByRegion(JONGNO)]);
    expect(calls.list).toBe(1);
  });

  it("실패는 캐시하지 않는다", async () => {
    const { source, calls, setFail } = fakeSource();
    const cached = new CachedSource(source, () => 0);

    setFail(true);
    await expect(cached.pharmaciesByRegion(JONGNO)).rejects.toThrow("boom");
    setFail(false);
    await expect(cached.pharmaciesByRegion(JONGNO)).resolves.toEqual([{ hpid: "P2" }]);
    expect(calls.list).toBe(2);
  });

  it("가까운 좌표는 같은 캐시를 쓰고, 반올림한 좌표로 조회한다", async () => {
    const { source, calls } = fakeSource();
    const cached = new CachedSource(source, () => 0);

    await cached.pharmaciesNear({ lat: 37.57041, lon: 126.99212 });
    await cached.pharmaciesNear({ lat: 37.57049, lon: 126.99208 });
    expect(calls.near).toBe(1);
    expect(source.pharmaciesNear).toHaveBeenCalledWith({ lat: 37.57, lon: 126.992 });
  });

  it("항목 수 상한을 넘으면 오래된 것부터 버린다", async () => {
    const { source } = fakeSource();
    const cached = new CachedSource(source, () => 0, undefined, 2);
    await cached.emergencyBeds({ sido: "A", sigungu: "1" });
    await cached.emergencyBeds({ sido: "A", sigungu: "2" });
    await cached.emergencyBeds({ sido: "A", sigungu: "3" });
    expect(cached.size).toBe(2);
  });
});

describe("roundPoint", () => {
  it("소수 셋째 자리", () => {
    expect(roundPoint({ lat: 37.123456, lon: 127.98765 })).toEqual({ lat: 37.123, lon: 127.988 });
  });
});
