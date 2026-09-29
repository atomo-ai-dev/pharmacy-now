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

describe("Tab keyboard navigation (a11y)", () => {
  it("ArrowRight로 다음 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "ArrowRight" });

    expect(emergencyTab).toHaveAttribute("aria-selected", "true");
    expect(pharmacyTab).toHaveAttribute("aria-selected", "false");
    expect(await screen.findByText("서울특별시 종로구 응급실 2곳")).toBeInTheDocument();
  });

  it("ArrowLeft로 이전 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    expect(emergencyTab).toHaveAttribute("aria-selected", "true");

    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "ArrowLeft" });

    expect(pharmacyTab).toHaveAttribute("aria-selected", "true");
    expect(emergencyTab).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowRight는 마지막 탭에서 첫 탭으로 순환한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    expect(emergencyTab).toHaveAttribute("aria-selected", "true");

    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "ArrowRight" });

    expect(pharmacyTab).toHaveAttribute("aria-selected", "true");
    expect(emergencyTab).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowLeft는 첫 탭에서 마지막 탭으로 순환한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "ArrowLeft" });

    expect(emergencyTab).toHaveAttribute("aria-selected", "true");
    expect(pharmacyTab).toHaveAttribute("aria-selected", "false");
  });

  it("Home으로 첫 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    expect(emergencyTab).toHaveAttribute("aria-selected", "true");

    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "Home" });

    expect(pharmacyTab).toHaveAttribute("aria-selected", "true");
    expect(emergencyTab).toHaveAttribute("aria-selected", "false");
  });

  it("End로 마지막 탭으로 이동한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "End" });

    expect(emergencyTab).toHaveAttribute("aria-selected", "true");
    expect(pharmacyTab).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowDown은 ArrowRight와 같이 동작한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    pharmacyTab.focus();
    fireEvent.keyDown(pharmacyTab, { key: "ArrowDown" });

    expect(emergencyTab).toHaveAttribute("aria-selected", "true");
  });

  it("ArrowUp은 ArrowLeft와 같이 동작한다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);
    expect(emergencyTab).toHaveAttribute("aria-selected", "true");

    emergencyTab.focus();
    fireEvent.keyDown(emergencyTab, { key: "ArrowUp" });

    expect(pharmacyTab).toHaveAttribute("aria-selected", "true");
  });
});

describe("Roving tabindex (a11y)", () => {
  it("선택된 탭만 tabindex=0을 가진다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    expect(pharmacyTab).toHaveAttribute("tabindex", "0");
    expect(emergencyTab).toHaveAttribute("tabindex", "-1");
  });

  it("탭을 전환하면 tabindex도 함께 바뀐다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });

    fireEvent.click(emergencyTab);

    expect(pharmacyTab).toHaveAttribute("tabindex", "-1");
    expect(emergencyTab).toHaveAttribute("tabindex", "0");
  });
});

describe("aria-controls target existence (a11y)", () => {
  it("aria-controls가 항상 문서에 있는 요소를 가리킨다", () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);

    const pharmacyTab = screen.getByRole("tab", { name: "약국" });
    const emergencyTab = screen.getByRole("tab", { name: "응급실" });
    const pharmacyPanel = document.getElementById(pharmacyTab.getAttribute("aria-controls") || "");
    const emergencyPanel = document.getElementById(
      emergencyTab.getAttribute("aria-controls") || "",
    );

    expect(pharmacyPanel).toBeInTheDocument();
    expect(emergencyPanel).toBeInTheDocument();
    expect(pharmacyPanel).toHaveAttribute("id", "panel-pharmacy");
    expect(emergencyPanel).toHaveAttribute("id", "panel-emergency");
  });

  it("비활성 패널은 hidden 속성으로 숨겨진다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    const pharmacyPanel = document.getElementById("panel-pharmacy");
    const emergencyPanel = document.getElementById("panel-emergency");

    expect(pharmacyPanel).not.toHaveAttribute("hidden");
    expect(emergencyPanel).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("tab", { name: "응급실" }));

    expect(pharmacyPanel).toHaveAttribute("hidden");
    expect(emergencyPanel).not.toHaveAttribute("hidden");
  });
});
