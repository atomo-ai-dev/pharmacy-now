"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { filterPharmacies, NO_FILTER, type PharmacyFilter } from "@/lib/filters";
import type { EmergencyResponse, ErrorResponse, ListMeta, PharmacyResponse } from "@/lib/views";
import { EmergencyCard } from "./EmergencyCard";
import { LocationPicker, type PickedLocation } from "./LocationPicker";
import { PharmacyCard } from "./PharmacyCard";
import { PharmacyFilters } from "./PharmacyFilters";

type Tab = "pharmacy" | "emergency";

type Load<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: T };

export function queryString(loc: PickedLocation): string {
  const qs =
    loc.kind === "point"
      ? new URLSearchParams({ lat: loc.lat.toFixed(5), lon: loc.lon.toFixed(5) })
      : new URLSearchParams({ sido: loc.sido, sigungu: loc.sigungu });
  return qs.toString();
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = (await res.json().catch(() => null)) as T | ErrorResponse | null;
  if (!res.ok || body === null) {
    const message =
      body && typeof body === "object" && "error" in body
        ? body.error
        : "정보를 불러오지 못했습니다.";
    throw new Error(message);
  }
  return body as T;
}

function useList<T>(endpoint: string, loc: PickedLocation | null, enabled: boolean): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "idle" });
  useEffect(() => {
    if (!loc || !enabled) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    getJson<T>(`${endpoint}?${queryString(loc)}`, ctrl.signal)
      .then((data) => setState({ status: "done", data }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "정보를 불러오지 못했습니다.",
        });
      });
    return () => ctrl.abort();
  }, [endpoint, loc, enabled]);
  return state;
}

function locationLabel(loc: PickedLocation): string {
  return loc.kind === "point" ? "내 위치 주변" : `${loc.sido} ${loc.sigungu}`.trim();
}

function HolidayNote({ meta }: { meta: ListMeta }) {
  if (meta.holidayName) {
    return (
      <p className="notice notice-info">
        오늘은 공휴일({meta.holidayName})입니다. 약국은 공휴일 운영시간을 기준으로 표시합니다.
      </p>
    );
  }
  if (!meta.holidayCovered) {
    return (
      <p className="notice notice-warn">
        올해 공휴일 정보가 아직 등록되지 않아 공휴일 영업 여부가 틀릴 수 있습니다.
      </p>
    );
  }
  return null;
}

const TABS: readonly Tab[] = ["pharmacy", "emergency"];
const TAB_IDS: Record<Tab, string> = {
  pharmacy: "tab-pharmacy",
  emergency: "tab-emergency",
};

export function Finder() {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [tab, setTab] = useState<Tab>("pharmacy");
  const [filter, setFilter] = useState<PharmacyFilter>(NO_FILTER);

  const pharmacies = useList<PharmacyResponse>("/api/pharmacies", loc, tab === "pharmacy");
  const emergency = useList<EmergencyResponse>("/api/emergency", loc, tab === "emergency");

  const shownPharmacies = useMemo(
    () => (pharmacies.status === "done" ? filterPharmacies(pharmacies.data.items, filter) : []),
    [pharmacies, filter],
  );

  const pick = useCallback((next: PickedLocation) => setLoc(next), []);

  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TABS.indexOf(tab);
      let nextIndex = currentIndex;
      let handled = false;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % TABS.length;
        handled = true;
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        handled = true;
      } else if (e.key === "Home") {
        nextIndex = 0;
        handled = true;
      } else if (e.key === "End") {
        nextIndex = TABS.length - 1;
        handled = true;
      }

      if (handled) {
        e.preventDefault();
        const nextTab = TABS[nextIndex];
        if (nextTab !== undefined) {
          setTab(nextTab);
          // Move focus to the newly selected tab
          const nextTabId = TAB_IDS[nextTab];
          const nextTabElement = document.getElementById(nextTabId) as HTMLButtonElement | null;
          if (nextTabElement) {
            nextTabElement.focus();
          }
        }
      }
    },
    [tab],
  );

  return (
    <>
      <LocationPicker onPick={pick} />

      <div className="tabs" role="tablist" aria-label="찾을 기관">
        <button
          type="button"
          role="tab"
          id="tab-pharmacy"
          aria-selected={tab === "pharmacy"}
          aria-controls="panel-pharmacy"
          tabIndex={tab === "pharmacy" ? 0 : -1}
          onClick={() => setTab("pharmacy")}
          onKeyDown={handleTabKeyDown}
        >
          약국
        </button>
        <button
          type="button"
          role="tab"
          id="tab-emergency"
          aria-selected={tab === "emergency"}
          aria-controls="panel-emergency"
          tabIndex={tab === "emergency" ? 0 : -1}
          onClick={() => setTab("emergency")}
          onKeyDown={handleTabKeyDown}
        >
          응급실
        </button>
      </div>

      <section
        id="panel-pharmacy"
        role="tabpanel"
        aria-labelledby="tab-pharmacy"
        hidden={tab !== "pharmacy"}
      >
        <PharmacyFilters value={filter} onChange={setFilter} />
        <Results
          loc={loc}
          load={pharmacies}
          count={shownPharmacies.length}
          total={pharmacies.status === "done" ? pharmacies.data.items.length : 0}
          noun="약국"
        >
          {pharmacies.status === "done" && <HolidayNote meta={pharmacies.data} />}
          <ul className="card-list">
            {shownPharmacies.map((p) => (
              <li key={p.id}>
                <PharmacyCard p={p} />
              </li>
            ))}
          </ul>
        </Results>
      </section>

      <section
        id="panel-emergency"
        role="tabpanel"
        aria-labelledby="tab-emergency"
        hidden={tab !== "emergency"}
      >
        <Results
          loc={loc}
          load={emergency}
          count={emergency.status === "done" ? emergency.data.items.length : 0}
          total={emergency.status === "done" ? emergency.data.items.length : 0}
          noun="응급실"
        >
          <p className="muted small">
            가용 병상은 각 병원이 입력한 값입니다. 음수는 정원을 넘겨 환자를 받고 있다는 뜻입니다.
          </p>
          {emergency.status === "done" && (
            <ul className="card-list">
              {emergency.data.items.map((er) => (
                <li key={er.id}>
                  <EmergencyCard er={er} reference={new Date(emergency.data.generatedAt)} />
                </li>
              ))}
            </ul>
          )}
        </Results>
      </section>
    </>
  );
}

function Results<T>({
  loc,
  load,
  count,
  total,
  noun,
  children,
}: {
  loc: PickedLocation | null;
  load: Load<T>;
  count: number;
  total: number;
  noun: string;
  children: ReactNode;
}) {
  if (!loc) {
    return <p className="empty">위치를 확인하거나 지역을 선택하면 {noun} 목록이 나타납니다.</p>;
  }
  return (
    <div aria-busy={load.status === "loading"}>
      <p className="result-summary" role="status" aria-live="polite">
        {load.status === "loading" && `${locationLabel(loc)} ${noun}을 찾는 중…`}
        {load.status === "done" &&
          (total === 0
            ? `${locationLabel(loc)}에서 ${noun} 정보를 찾지 못했습니다.`
            : count === total
              ? `${locationLabel(loc)} ${noun} ${total}곳`
              : `${locationLabel(loc)} ${noun} ${total}곳 중 조건에 맞는 ${count}곳`)}
      </p>
      {load.status === "error" && (
        <p className="notice notice-error" role="alert">
          {load.message}
        </p>
      )}
      {load.status === "done" && children}
    </div>
  );
}
