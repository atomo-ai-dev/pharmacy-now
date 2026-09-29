import { describe, expect, it } from "vitest";
import { isValidPhoneNumber, phoneToTelUri } from "./phone";

describe("phoneToTelUri", () => {
  it("converts standard Korean phone numbers", () => {
    expect(phoneToTelUri("02-1588-5700")).toBe("0215885700");
    expect(phoneToTelUri("0507-1303-1226")).toBe("050713031226");
  });

  it("handles phone numbers with ranges (~ indicator)", () => {
    expect(phoneToTelUri("031-574-9118~9")).toBe("0315749118");
  });

  it("handles phone numbers with additional numbers (/ indicator)", () => {
    expect(phoneToTelUri("050-71372-3330")).toBe("050713723330");
  });

  it("handles phone numbers without separators", () => {
    expect(phoneToTelUri("0559443251")).toBe("0559443251");
  });

  it("handles phone numbers with bracket separators", () => {
    expect(phoneToTelUri("032)765-7070")).toBe("0327657070");
  });

  it("handles phone numbers with mixed separators", () => {
    expect(phoneToTelUri("061797-7000")).toBe("0617977000");
  });

  it("handles emergency numbers", () => {
    expect(phoneToTelUri("02-119")).toBe("02119");
  });

  it("handles very short phone numbers (< 5 digits) by returning null", () => {
    expect(phoneToTelUri("119")).toBeNull();
  });

  it("returns null for null or undefined input", () => {
    expect(phoneToTelUri(null)).toBeNull();
    expect(phoneToTelUri(undefined)).toBeNull();
    expect(phoneToTelUri("")).toBeNull();
  });

  it("handles phone numbers with + prefix", () => {
    expect(phoneToTelUri("+82-2-1234-5678")).toBe("+82212345678");
  });
});

describe("isValidPhoneNumber", () => {
  it("returns true for valid phone numbers", () => {
    expect(isValidPhoneNumber("031-574-9118~9")).toBe(true);
    expect(isValidPhoneNumber("02-1588-5700")).toBe(true);
    expect(isValidPhoneNumber("02-119")).toBe(true);
  });

  it("returns false for invalid phone numbers", () => {
    expect(isValidPhoneNumber("119")).toBe(false);
    expect(isValidPhoneNumber(null)).toBe(false);
    expect(isValidPhoneNumber(undefined)).toBe(false);
    expect(isValidPhoneNumber("")).toBe(false);
  });
});
