import { describe, expect, it, vi } from "vitest";
import { readFixture } from "@/test/fixtures";
import { DataGoKrClient, ENDPOINTS, type FetchLike } from "./client";
import { ApiError } from "./xml";

function fakeFetch(body: string, status = 200) {
  return vi.fn<FetchLike>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  }));
}

const KEY = "test-key/with+special=chars";

describe("DataGoKrClient", () => {
  it("약국 지역 조회: Q0/Q1 과 인증키를 붙여 부른다", async () => {
    const fetch = fakeFetch(readFixture("docs/pharmacy-list.xml"));
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });

    const items = await client.pharmaciesByRegion({ sido: "서울특별시", sigungu: "종로구" });

    expect(items[0]?.hpid).toBe("A0030236");
    const url = new URL(fetch.mock.calls[0]?.[0] ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(ENDPOINTS.pharmacyList);
    expect(url.searchParams.get("ServiceKey")).toBe(KEY); // 한 번만 인코딩된다
    expect(url.searchParams.get("Q0")).toBe("서울특별시");
    expect(url.searchParams.get("Q1")).toBe("종로구");
  });

  it("위치 조회: WGS84_LON / WGS84_LAT", async () => {
    const fetch = fakeFetch(readFixture("docs/pharmacy-location.xml"));
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });

    await client.pharmaciesNear({ lat: 37.4881, lon: 127.0851 });

    const url = new URL(fetch.mock.calls[0]?.[0] ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(ENDPOINTS.pharmacyLocation);
    expect(url.searchParams.get("WGS84_LAT")).toBe("37.4881");
    expect(url.searchParams.get("WGS84_LON")).toBe("127.0851");
  });

  it("실시간 병상: STAGE1 / STAGE2", async () => {
    const fetch = fakeFetch(readFixture("docs/emergency-beds.xml"));
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });

    await client.emergencyBeds({ sido: "서울특별시", sigungu: "중구" });

    const url = new URL(fetch.mock.calls[0]?.[0] ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(ENDPOINTS.emergencyBeds);
    expect(url.searchParams.get("STAGE1")).toBe("서울특별시");
    expect(url.searchParams.get("STAGE2")).toBe("중구");
  });

  it("시군구가 비어 있으면(세종) 파라미터를 보내지 않는다", () => {
    const client = new DataGoKrClient({ serviceKey: KEY, fetch: fakeFetch("") });
    const url = new URL(client.buildUrl(ENDPOINTS.pharmacyList, { Q0: "세종특별자치시", Q1: "" }));
    expect(url.searchParams.has("Q1")).toBe(false);
  });

  it("약국 지역 조회: 옛 지역 이름도 함께 불러 hpid 로 합치고, 옛 구가 나뉜 경우 주소로 거른다", async () => {
    const fetch = vi.fn<FetchLike>(async (url) => {
      const u = new URL(url);
      const q0 = u.searchParams.get("Q0");
      const q1 = u.searchParams.get("Q1");
      const body =
        q0 === "인천광역시" && q1 === "중구"
          ? readFixture("synthetic/pharmacy-list-incheon-jung-old.xml")
          : readFixture("errors/empty-items.xml");
      return { ok: true, status: 200, text: async () => body };
    });
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });

    const items = await client.pharmaciesByRegion({ sido: "인천광역시", sigungu: "영종구" });

    // 새 이름(영종구) 직접 조회는 비어 있고, 옛 이름(중구) 조회 결과 중 영종 주소만 남는다.
    expect(items.map((i) => i.hpid)).toEqual(["SYN-IC-0001"]);
    const calls = fetch.mock.calls.map(([url]) => {
      const u = new URL(url);
      return `${u.searchParams.get("Q0")}/${u.searchParams.get("Q1")}`;
    });
    expect(calls.sort()).toEqual(["인천광역시/영종구", "인천광역시/중구"]);
  });

  it("약국 지역 조회: 영향 없는 지역은 추가 조회를 하지 않는다", async () => {
    const fetch = fakeFetch(readFixture("docs/pharmacy-list.xml"));
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });

    await client.pharmaciesByRegion({ sido: "서울특별시", sigungu: "종로구" });

    expect(fetch.mock.calls).toHaveLength(1);
  });

  it("HTTP 오류는 ApiError", async () => {
    const client = new DataGoKrClient({ serviceKey: KEY, fetch: fakeFetch("", 500) });
    await expect(
      client.emergencyRoomsByRegion({ sido: "서울특별시", sigungu: "중구" }),
    ).rejects.toThrow(ApiError);
  });

  it("네트워크 오류는 ApiError", async () => {
    const fetch = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed");
    });
    const client = new DataGoKrClient({ serviceKey: KEY, fetch });
    await expect(client.emergencyRoomsNear({ lat: 37.5, lon: 127 })).rejects.toThrow(
      "공공데이터포털에 연결하지 못했습니다.",
    );
  });

  it("인증 오류 응답도 ApiError", async () => {
    const client = new DataGoKrClient({
      serviceKey: KEY,
      fetch: fakeFetch(readFixture("errors/gateway-key-not-registered.xml")),
    });
    await expect(client.pharmaciesNear({ lat: 37.5, lon: 127 })).rejects.toMatchObject({
      name: "ApiError",
      code: "30",
    });
  });
});
