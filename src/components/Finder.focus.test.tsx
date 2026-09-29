// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleEmergency, handlePharmacies } from "@/lib/http/handlers";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource } from "@/test/fixtures";
import { Finder } from "./Finder";

const NOW = kstDateTime(2026, 9, 28, 23, 30); // 월요일 밤

function routeFetch() {
  const deps = { source: demoSource(() => NOW.getTime()), now: NOW, mode: "demo" as const };
  return vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/pharmacies") return handlePharmacies(url, deps);
    if (url.pathname === "/api/emergency") return handleEmergency(url, deps);
    return new Response("{}", { status: 404 });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function pickRegion(sido: string, sigungu: string) {
  fireEvent.change(screen.getByLabelText("시·도"), { target: { value: sido } });
  fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: sigungu } });
  fireEvent.click(screen.getByRole("button", { name: "이 지역 보기" }));
}

describe("Focus movement with keyboard navigation (a11y)", () => {
  it("ArrowRight로 이동할 때 포커스도 새로 선택된 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "ArrowRight" });

    expect(document.activeElement).toBe(emergencyTab);
  });

  it("ArrowLeft로 이동할 때 포커스도 새로 선택된 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(pharmacyTab);
  });

  it("Home으로 이동할 때 포커스도 새로 선택된 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "Home" });

    expect(document.activeElement).toBe(pharmacyTab);
  });

  it("End로 이동할 때 포커스도 새로 선택된 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "End" });

    expect(document.activeElement).toBe(emergencyTab);
  });
});
