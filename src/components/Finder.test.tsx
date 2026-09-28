// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleEmergency, handlePharmacies } from "@/lib/http/handlers";
import { kstDateTime } from "@/lib/time/kst";
import { demoSource } from "@/test/fixtures";
import { Finder, queryString } from "./Finder";
import { LocationPicker } from "./LocationPicker";
import { PharmacyFilters } from "./PharmacyFilters";

const NOW = kstDateTime(2026, 9, 28, 23, 30); // 월요일 밤

/** 브라우저 fetch 를 실제 라우트 핸들러(데모 데이터)로 연결한다. 네트워크는 쓰지 않는다. */
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

describe("Finder", () => {
  it("지역을 고르면 약국 목록을 불러와 필터링한다", async () => {
    const fetch = routeFetch();
    vi.stubGlobal("fetch", fetch);
    render(<Finder />);

    expect(screen.getByText(/지역을 선택하면 약국 목록이 나타납니다/)).toBeInTheDocument();
    pickRegion("서울특별시", "종로구");

    expect(await screen.findByText("서울특별시 종로구 약국 7곳")).toBeInTheDocument();
    expect(fetch.mock.calls[0]?.[0]).toBe(
      `/api/pharmacies?${queryString({ kind: "region", sido: "서울특별시", sigungu: "종로구" })}`,
    );

    fireEvent.click(screen.getByLabelText("지금 영업 중"));
    const list = screen.getAllByRole("listitem").filter((li) => li.querySelector("article"));
    const names = list.map((li) => within(li).getByRole("heading").textContent);
    expect(names).toEqual(
      expect.arrayContaining(["(예시) 종로이십사시약국", "(예시) 새벽별약국", "(예시) 동대문약국"]),
    );
    expect(names).not.toContain("(예시) 인사동약국");
    expect(screen.getByText(/7곳 중 조건에 맞는 3곳/)).toBeInTheDocument();
  });

  it("응급실 탭으로 바꾸면 병상 정보를 불러온다", async () => {
    vi.stubGlobal("fetch", routeFetch());
    render(<Finder />);
    pickRegion("서울특별시", "종로구");
    await screen.findByText(/약국 7곳/);

    fireEvent.click(screen.getByRole("tab", { name: "응급실" }));
    expect(screen.getByRole("tab", { name: "응급실" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("서울특별시 종로구 응급실 2곳")).toBeInTheDocument();
    expect(screen.getByText("포화 (정원 초과 3명)")).toBeInTheDocument();
  });

  it("서버 오류를 알린다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "공공데이터 서버에서 정보를 받아오지 못했습니다." },
          { status: 502 },
        ),
      ),
    );
    render(<Finder />);
    pickRegion("서울특별시", "중구");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "공공데이터 서버에서 정보를 받아오지 못했습니다.",
    );
  });
});

describe("LocationPicker", () => {
  it("시군구를 고르기 전에는 조회할 수 없다", () => {
    const onPick = vi.fn();
    render(<LocationPicker onPick={onPick} geolocation={null} />);
    const submit = screen.getByRole("button", { name: "이 지역 보기" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("시·도"), { target: { value: "부산광역시" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: "해운대구" } });
    fireEvent.click(submit);
    expect(onPick).toHaveBeenCalledWith({
      kind: "region",
      sido: "부산광역시",
      sigungu: "해운대구",
    });
  });

  it("세종은 시군구 없이 조회한다", () => {
    const onPick = vi.fn();
    render(<LocationPicker onPick={onPick} geolocation={null} />);
    fireEvent.change(screen.getByLabelText("시·도"), { target: { value: "세종특별자치시" } });
    expect(screen.getByLabelText("시·군·구")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "이 지역 보기" }));
    expect(onPick).toHaveBeenCalledWith({ kind: "region", sido: "세종특별자치시", sigungu: "" });
  });

  it("위치 권한을 받으면 좌표로 조회한다", () => {
    const onPick = vi.fn();
    const geolocation = {
      getCurrentPosition: vi.fn((ok: PositionCallback) =>
        ok({ coords: { latitude: 37.57, longitude: 126.99 } } as GeolocationPosition),
      ),
    };
    render(<LocationPicker onPick={onPick} geolocation={geolocation} />);
    fireEvent.click(screen.getByRole("button", { name: "내 위치로 찾기" }));
    expect(onPick).toHaveBeenCalledWith({ kind: "point", lat: 37.57, lon: 126.99 });
  });

  it("위치 권한이 거부되면 지역 선택을 안내한다", () => {
    const geolocation = {
      getCurrentPosition: vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback | null) =>
        fail?.({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError),
      ),
    };
    render(<LocationPicker onPick={vi.fn()} geolocation={geolocation} />);
    fireEvent.click(screen.getByRole("button", { name: "내 위치로 찾기" }));
    expect(screen.getByRole("status")).toHaveTextContent("위치 권한이 거부되었습니다");
  });

  it("geolocation 이 없는 브라우저", () => {
    render(<LocationPicker onPick={vi.fn()} geolocation={null} />);
    fireEvent.click(screen.getByRole("button", { name: "내 위치로 찾기" }));
    expect(screen.getByRole("status")).toHaveTextContent("위치 확인을 지원하지 않습니다");
  });
});

describe("PharmacyFilters", () => {
  it("체크하면 해당 조건만 바꾼다", () => {
    const onChange = vi.fn();
    render(
      <PharmacyFilters
        value={{ openNow: false, night: false, holiday: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("밤 10시 이후 영업"));
    expect(onChange).toHaveBeenCalledWith({ openNow: false, night: true, holiday: true });
  });
});

it("좌표 쿼리는 소수 다섯째 자리로 줄인다", () => {
  expect(queryString({ kind: "point", lat: 37.123456789, lon: 127.1 })).toBe(
    "lat=37.12346&lon=127.10000",
  );
});
