// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { kstDateTime } from "@/lib/time/kst";
import type { EmergencyRoomView, PharmacyView } from "@/lib/views";
import { EmergencyCard, updatedLabel } from "./EmergencyCard";
import { PharmacyCard } from "./PharmacyCard";

const pharmacy = (over: Partial<PharmacyView> = {}): PharmacyView => ({
  id: "P1",
  name: "튼튼약국",
  address: "서울특별시 종로구 종로 1",
  phone: "02-123-4567",
  lat: 37.57,
  lon: 126.99,
  distanceKm: 0.35,
  openState: "open",
  closesAt: "22:00",
  todayHours: "09:00–22:00",
  weeklyHours: [
    ["월", "09:00–22:00"],
    ["공휴일", null],
  ],
  night: false,
  holiday: true,
  ...over,
});

describe("PharmacyCard", () => {
  it("영업 중 배지, 거리, 전화 링크", () => {
    render(<PharmacyCard p={pharmacy()} />);
    expect(screen.getByRole("heading", { name: "튼튼약국" })).toBeInTheDocument();
    expect(screen.getByText("영업 중 · 22:00까지")).toBeInTheDocument();
    expect(screen.getByText("350m")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /전화/ })).toHaveAttribute("href", "tel:021234567");
    expect(screen.getByText("공휴일 영업")).toBeInTheDocument();
    expect(screen.queryByText("밤 10시 이후 영업")).not.toBeInTheDocument();
  });

  it("24시간 영업", () => {
    render(<PharmacyCard p={pharmacy({ closesAt: null, todayHours: "24시간" })} />);
    expect(screen.getByText("영업 중 · 24시간")).toBeInTheDocument();
  });

  it("영업 종료와 확인 불가", () => {
    const { rerender } = render(
      <PharmacyCard p={pharmacy({ openState: "closed", closesAt: null })} />,
    );
    expect(screen.getByText("영업 종료")).toBeInTheDocument();
    rerender(
      <PharmacyCard p={pharmacy({ openState: "unknown", todayHours: null, phone: null })} />,
    );
    expect(screen.getByText("운영시간 확인 필요")).toBeInTheDocument();
    expect(screen.getByText("정보 없음")).toBeInTheDocument();
    expect(screen.getByText("전화번호 없음")).toBeInTheDocument();
  });

  it("요일별 운영시간의 빈 값은 '확인 필요'", () => {
    render(<PharmacyCard p={pharmacy()} />);
    expect(screen.getByText("확인 필요")).toBeInTheDocument();
  });

  it("좌표가 없으면 지도 링크를 숨긴다", () => {
    render(<PharmacyCard p={pharmacy({ lat: null, lon: null })} />);
    expect(screen.queryByRole("link", { name: /지도/ })).not.toBeInTheDocument();
  });
});

const REF = kstDateTime(2026, 9, 28, 10, 40);

const er = (over: Partial<EmergencyRoomView> = {}): EmergencyRoomView => ({
  id: "E1",
  name: "중앙병원",
  address: "서울특별시 중구 1",
  phone: "02-119",
  category: "권역응급의료센터",
  lat: 37.56,
  lon: 126.99,
  distanceKm: 1.23,
  general: { available: 5, capacity: 30, state: "available" },
  pediatric: { available: null, capacity: null, state: "unknown" },
  updatedAt: kstDateTime(2026, 9, 28, 10, 35).toISOString(),
  stale: false,
  ...over,
});

describe("EmergencyCard", () => {
  it("가용 병상과 입력 시각", () => {
    render(<EmergencyCard er={er()} reference={REF} />);
    expect(screen.getByText("5 / 30")).toBeInTheDocument();
    expect(screen.getByText("정보 없음")).toBeInTheDocument();
    expect(screen.getByText("10:35 기준 · 5분 전")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /응급실 전화/ })).toHaveAttribute("href", "tel:02119");
  });

  it("정원 초과(음수)와 만실", () => {
    const { rerender } = render(
      <EmergencyCard
        er={er({ general: { available: -3, capacity: 20, state: "over" } })}
        reference={REF}
      />,
    );
    expect(screen.getByText("포화 (정원 초과 3명)")).toBeInTheDocument();
    rerender(
      <EmergencyCard
        er={er({ general: { available: 0, capacity: 20, state: "full" } })}
        reference={REF}
      />,
    );
    expect(screen.getByText("여유 병상 없음")).toBeInTheDocument();
  });

  it("오래된 정보 경고, 입력 시각 없음", () => {
    const { rerender } = render(<EmergencyCard er={er({ stale: true })} reference={REF} />);
    expect(screen.getByText(/오래된 정보일 수 있습니다/)).toBeInTheDocument();
    rerender(<EmergencyCard er={er({ updatedAt: null })} reference={REF} />);
    expect(screen.getByText("병상 정보 입력 시각 없음")).toBeInTheDocument();
  });
});

describe("updatedLabel", () => {
  it("분·시간·일 단위, 다른 날이면 날짜를 붙인다", () => {
    expect(updatedLabel(kstDateTime(2026, 9, 28, 10, 40).toISOString(), REF)).toBe(
      "10:40 기준 · 방금",
    );
    expect(updatedLabel(kstDateTime(2026, 9, 28, 7, 0).toISOString(), REF)).toBe(
      "07:00 기준 · 3시간 전",
    );
    expect(updatedLabel(kstDateTime(2026, 9, 25, 9, 0).toISOString(), REF)).toBe(
      "9/25 09:00 기준 · 3일 전",
    );
  });

  it("미래 시각이면 상대 시간을 붙이지 않는다", () => {
    expect(updatedLabel(kstDateTime(2026, 9, 28, 11, 0).toISOString(), REF)).toBe("11:00 기준");
  });
});
