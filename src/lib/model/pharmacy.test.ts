import { describe, expect, it } from "vitest";
import { kstDateTime } from "@/lib/time/kst";
import { fixtureItems } from "@/test/fixtures";
import { pharmacyFromListItem, pharmacyFromLocationItem, toPharmacyView } from "./pharmacy";

// 2026-09-28 월요일 12:00
const NOON_MON = kstDateTime(2026, 9, 28, 12);

describe("pharmacyFromListItem", () => {
  it("가이드 예제 응답을 읽는다", () => {
    const [item] = fixtureItems("docs/pharmacy-list.xml");
    const p = pharmacyFromListItem(item ?? {});
    expect(p).toMatchObject({
      id: "A0030236",
      name: "임자약국",
      address: "서울특별시 종로구 효제동 126-2",
      phone: "02-742-1145",
    });
    expect(p?.location?.lat).toBeCloseTo(37.5737, 4);
    expect(p?.schedule?.[1]).toEqual({ kind: "open", open: 510, close: 1170 });
    expect(p?.schedule?.[7]).toEqual({ kind: "closed" });
  });

  it("기관ID·이름이 없으면 버린다", () => {
    expect(pharmacyFromListItem({ dutyname: "약국" })).toBeNull();
    expect(pharmacyFromListItem({ hpid: "X" })).toBeNull();
  });

  it("좌표가 비었거나 엉뚱하면 위치 없음", () => {
    expect(
      pharmacyFromListItem({ hpid: "X", dutyname: "약국", wgs84lat: "0", wgs84lon: "0" })?.location,
    ).toBeNull();
  });
});

describe("pharmacyFromLocationItem", () => {
  it("위치 조회 응답은 오늘 운영시간만 가진다", () => {
    const [item] = fixtureItems("docs/pharmacy-location.xml");
    const p = pharmacyFromLocationItem(item ?? {});
    expect(p?.schedule).toBeNull();
    expect(p?.todayOnly).toEqual({ kind: "open", open: 510, close: 1170 });
    expect(p?.location?.lon).toBeCloseTo(127.0836, 4);
  });
});

describe("toPharmacyView", () => {
  it("요일별 운영시간으로 판정하고 거리를 계산한다", () => {
    const [item] = fixtureItems("docs/pharmacy-list.xml");
    const p = pharmacyFromListItem(item ?? {});
    if (!p) throw new Error("fixture");
    const v = toPharmacyView(p, NOON_MON, { lat: 37.5704, lon: 126.9921 });
    expect(v.openState).toBe("open");
    expect(v.closesAt).toBe("19:30");
    expect(v.todayHours).toBe("08:30–19:30");
    expect(v.distanceKm).toBeGreaterThan(0.9);
    expect(v.distanceKm).toBeLessThan(1.2);
    expect(v.night).toBe(false);
    expect(v.holiday).toBe(false);
    expect(v.weeklyHours?.[7]).toEqual(["공휴일", "휴무"]);
  });

  it("출발점이 없으면 거리 없음", () => {
    const p = pharmacyFromListItem({ hpid: "X", dutyname: "약국" });
    if (!p) throw new Error("fixture");
    expect(toPharmacyView(p, NOON_MON, null).distanceKm).toBeNull();
  });

  it("운영시간이 한 칸도 없으면 '매일 휴무'가 아니라 확인 불가", () => {
    const p = pharmacyFromListItem({ hpid: "X", dutyname: "약국" });
    if (!p) throw new Error("fixture");
    const v = toPharmacyView(p, NOON_MON, null);
    expect(v.openState).toBe("unknown");
    expect(v.todayHours).toBeNull();
  });

  it("오늘 운영시간만 있으면 그것으로 판정한다", () => {
    const p = pharmacyFromLocationItem({
      hpid: "X",
      dutyname: "약국",
      starttime: "1800",
      endtime: "2330",
    });
    if (!p) throw new Error("fixture");
    const evening = toPharmacyView(p, kstDateTime(2026, 9, 28, 20), null);
    expect(evening).toMatchObject({
      openState: "open",
      closesAt: "23:30",
      night: true,
      weeklyHours: null,
    });
    expect(toPharmacyView(p, NOON_MON, null).openState).toBe("closed");
  });

  it("오늘 운영시간 값이 깨져 있으면 확인 불가", () => {
    const p = pharmacyFromLocationItem({
      hpid: "X",
      dutyname: "약국",
      starttime: "9",
      endtime: "",
    });
    if (!p) throw new Error("fixture");
    expect(toPharmacyView(p, NOON_MON, null).openState).toBe("unknown");
  });
});
