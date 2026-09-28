import { describe, expect, it } from "vitest";
import { parseLocationQuery } from "./query";

const q = (s: string) => parseLocationQuery(new URLSearchParams(s));

describe("parseLocationQuery", () => {
  it("좌표", () => {
    expect(q("lat=37.57&lon=126.99")).toEqual({
      ok: true,
      query: { kind: "point", point: { lat: 37.57, lon: 126.99 } },
    });
  });

  it("지역 + 좌표면 좌표는 거리 계산용", () => {
    expect(q("sido=서울특별시&sigungu=종로구&lat=37.57&lon=126.99")).toEqual({
      ok: true,
      query: {
        kind: "region",
        region: { sido: "서울특별시", sigungu: "종로구" },
        origin: { lat: 37.57, lon: 126.99 },
      },
    });
  });

  it("세종은 시군구 없이", () => {
    const r = q("sido=세종특별자치시");
    expect(r.ok && r.query.kind === "region" && r.query.region.sigungu).toBe("");
  });

  it.each([
    [""],
    ["lat=37.57"],
    ["lat=0&lon=0"],
    ["lat=abc&lon=127"],
    ["sido=서울특별시&sigungu=없는구"],
    ["sido=서울특별시"],
  ])("%j 는 거절", (s) => {
    expect(q(s).ok).toBe(false);
  });
});
