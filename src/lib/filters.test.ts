import { describe, expect, it } from "vitest";
import { filterPharmacies, NO_FILTER } from "./filters";
import type { PharmacyView } from "./views";

const p = (id: string, over: Partial<PharmacyView>): PharmacyView => ({
  id,
  name: id,
  address: "",
  phone: null,
  lat: null,
  lon: null,
  distanceKm: null,
  openState: "closed",
  closesAt: null,
  todayHours: null,
  weeklyHours: null,
  night: false,
  holiday: false,
  ...over,
});

const items = [
  p("open-night", { openState: "open", night: true }),
  p("open-holiday", { openState: "open", holiday: true }),
  p("closed-night-holiday", { night: true, holiday: true }),
  p("unknown", { openState: "unknown" }),
];

const ids = (xs: PharmacyView[]) => xs.map((x) => x.id);

describe("filterPharmacies", () => {
  it("조건이 없으면 그대로", () => {
    expect(ids(filterPharmacies(items, NO_FILTER))).toHaveLength(4);
  });

  it("지금 영업 중 — 확인 불가는 빠진다", () => {
    expect(ids(filterPharmacies(items, { ...NO_FILTER, openNow: true }))).toEqual([
      "open-night",
      "open-holiday",
    ]);
  });

  it("조건은 모두 만족해야 한다", () => {
    expect(ids(filterPharmacies(items, { openNow: false, night: true, holiday: true }))).toEqual([
      "closed-night-holiday",
    ]);
    expect(ids(filterPharmacies(items, { openNow: true, night: true, holiday: false }))).toEqual([
      "open-night",
    ]);
  });
});
