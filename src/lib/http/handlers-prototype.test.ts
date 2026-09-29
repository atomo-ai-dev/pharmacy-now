import { describe, expect, it } from "vitest";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource } from "@/test/fixtures";
import { handleEmergency, handlePharmacies } from "./handlers";

const url = (path: string) => new URL(path, "http://localhost");
const deps = (now = kstDateTime(2026, 9, 28, 12)) => ({
  source: demoSource(),
  now,
  mode: "demo" as const,
});

describe("Object.prototype 키 방어", () => {
  describe("GET /api/pharmacies", () => {
    it("?sido=constructor 는 400을 돌려준다", async () => {
      const res = await handlePharmacies(url("/api/pharmacies?sido=constructor"), deps());
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toBe("알 수 없는 지역입니다.");
    });

    it.each(["?sido=toString", "?sido=valueOf", "?sido=__proto__", "?sido=hasOwnProperty"])(
      "%s 는 400을 돌려준다",
      async (query) => {
        const res = await handlePharmacies(url(`/api/pharmacies${query}`), deps());
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error?: string };
        expect(body.error).toBe("알 수 없는 지역입니다.");
      },
    );
  });

  describe("GET /api/emergency", () => {
    it("?sido=constructor 는 400을 돌려준다", async () => {
      const res = await handleEmergency(url("/api/emergency?sido=constructor"), deps());
      expect(res.status).toBe(400);
    });

    it.each(["?sido=toString", "?sido=valueOf", "?sido=__proto__", "?sido=hasOwnProperty"])(
      "%s 는 400을 돌려준다",
      async (query) => {
        const res = await handleEmergency(url(`/api/emergency${query}`), deps());
        expect(res.status).toBe(400);
      },
    );
  });
});
