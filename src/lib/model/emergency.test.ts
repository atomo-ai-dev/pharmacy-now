import { describe, expect, it } from "vitest";
import { kstDateTime } from "@/lib/time/kst";
import { fixtureItems } from "@/test/fixtures";
import {
  bedStatusFromItem,
  emergencyRoomFromListItem,
  emergencyRoomFromLocationItem,
  parseBedCount,
  parseHvidate,
  toBedView,
  toEmergencyRoomView,
} from "./emergency";

describe("parseBedCount", () => {
  it.each([
    ["14", 14],
    ["0", 0],
    ["-3", -3],
    [" 7 ", 7],
  ])("%j → %i", (raw, n) => {
    expect(parseBedCount(raw)).toBe(n);
  });

  it.each([[""], ["NULL"], ["Y"], ["N1"], ["1.5"], [undefined]])("%j → null", (raw) => {
    expect(parseBedCount(raw)).toBeNull();
  });
});

describe("parseHvidate", () => {
  it("YYYYMMDDHHmmss (KST)", () => {
    expect(parseHvidate("20230414092700")?.toISOString()).toBe("2023-04-14T00:27:00.000Z");
  });

  it("초 없는 YYYYMMDDHHmm", () => {
    expect(parseHvidate("202304140927")?.toISOString()).toBe("2023-04-14T00:27:00.000Z");
  });

  it("명세표 예시 형식 '2013-10-01 오후1:14:12'", () => {
    expect(parseHvidate("2013-10-01 오후1:14:12")?.toISOString()).toBe("2013-10-01T04:14:12.000Z");
    expect(parseHvidate("2013-10-01 오전12:05:00")?.toISOString()).toBe("2013-09-30T15:05:00.000Z");
  });

  it.each([[""], ["2023"], ["20230231120000"], ["20231301120000"], ["abc"], [undefined]])(
    "%j → null",
    (raw) => {
      expect(parseHvidate(raw)).toBeNull();
    },
  );
});

describe("toBedView", () => {
  it("상태 구분", () => {
    expect(toBedView({ available: 5, capacity: 30 }).state).toBe("available");
    expect(toBedView({ available: 0, capacity: 30 }).state).toBe("full");
    expect(toBedView({ available: -3, capacity: 20 }).state).toBe("over");
    expect(toBedView({ available: null, capacity: 20 }).state).toBe("unknown");
  });
});

describe("bedStatusFromItem", () => {
  it("가이드 예제: 일반 14/28, 소아 3/3, 입력 시각", () => {
    const [item] = fixtureItems("docs/emergency-beds.xml");
    const b = bedStatusFromItem(item ?? {});
    expect(b?.id).toBe("A2800001");
    expect(b?.status.general).toEqual({ available: 14, capacity: 28 });
    expect(b?.status.pediatric).toEqual({ available: 3, capacity: 3 });
    expect(b?.status.name).toBe("경상국립대학교병원");
    expect(b?.status.updatedAt?.toISOString()).toBe("2023-04-14T00:27:00.000Z");
  });

  it("기준 병상이 0 이면 정원 없음으로", () => {
    const b = bedStatusFromItem({ hpid: "X", hvec: "2", hvs01: "0" });
    expect(b?.status.general).toEqual({ available: 2, capacity: null });
  });

  it("기관ID 가 없으면 버린다", () => {
    expect(bedStatusFromItem({ hvec: "1" })).toBeNull();
  });
});

describe("응급의료기관", () => {
  it("목록 조회 item", () => {
    const [item] = fixtureItems("docs/emergency-list.xml");
    expect(emergencyRoomFromListItem(item ?? {})).toMatchObject({
      id: "A0000191",
      name: "서울적십자병원",
      erPhone: "02-2002-0000",
      mainPhone: "02-2002-8000",
    });
  });

  it("위치 조회 item", () => {
    const [item] = fixtureItems("docs/emergency-location.xml");
    const er = emergencyRoomFromLocationItem(item ?? {});
    expect(er?.id).toBe("A0000028");
    expect(er?.location?.lat).toBeCloseTo(37.4881, 4);
  });

  it("뷰: 응급실 전화 우선, 오래된 입력은 stale", () => {
    const er = emergencyRoomFromListItem({
      hpid: "E1",
      dutyname: "병원",
      dutytel1: "02-1",
      dutytel3: "02-119",
      wgs84lat: "37.57",
      wgs84lon: "126.99",
    });
    if (!er) throw new Error("fixture");
    const beds =
      bedStatusFromItem({ hpid: "E1", hvec: "-2", hvs01: "10", hvidate: "20260928100000" })
        ?.status ?? null;

    const fresh = toEmergencyRoomView(er, beds, kstDateTime(2026, 9, 28, 10, 30), {
      lat: 37.57,
      lon: 126.99,
    });
    expect(fresh).toMatchObject({ phone: "02-119", stale: false, distanceKm: 0 });
    expect(fresh.general).toEqual({ available: -2, capacity: 10, state: "over" });

    const old = toEmergencyRoomView(er, beds, kstDateTime(2026, 9, 28, 11, 1), null);
    expect(old.stale).toBe(true);
  });

  it("병상 정보가 없으면 정보 없음", () => {
    const er = emergencyRoomFromListItem({ hpid: "E1", dutyname: "병원" });
    if (!er) throw new Error("fixture");
    const v = toEmergencyRoomView(er, null, new Date(0), null);
    expect(v.general.state).toBe("unknown");
    expect(v.updatedAt).toBeNull();
    expect(v.stale).toBe(false);
  });
});
