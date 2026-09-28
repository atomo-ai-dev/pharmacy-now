"use client";

import { useId, useState } from "react";
import { REGIONS, SIDO_LIST } from "@/lib/regions";

export type PickedLocation =
  | { kind: "point"; lat: number; lon: number }
  | { kind: "region"; sido: string; sigungu: string };

interface Props {
  onPick: (loc: PickedLocation) => void;
  /** 테스트에서 주입. 기본은 브라우저 geolocation */
  geolocation?: Pick<Geolocation, "getCurrentPosition"> | null;
}

function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "위치 권한이 거부되었습니다. 아래에서 지역을 직접 선택해 주세요.";
    case err.TIMEOUT:
      return "위치를 확인하는 데 시간이 너무 오래 걸립니다. 다시 시도하거나 지역을 선택해 주세요.";
    default:
      return "현재 위치를 확인할 수 없습니다. 지역을 직접 선택해 주세요.";
  }
}

export function LocationPicker({ onPick, geolocation }: Props) {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const sidoId = useId();
  const sigunguId = useId();

  const geo =
    geolocation === undefined
      ? typeof navigator !== "undefined" && "geolocation" in navigator
        ? navigator.geolocation
        : null
      : geolocation;

  const sigunguList = sido ? (REGIONS[sido] ?? []) : [];
  const needsSigungu = sigunguList.length > 0;
  const canSubmit = sido !== "" && (!needsSigungu || sigungu !== "");

  function locate() {
    if (!geo) {
      setGeoMessage("이 브라우저는 위치 확인을 지원하지 않습니다. 지역을 직접 선택해 주세요.");
      return;
    }
    setLocating(true);
    setGeoMessage("현재 위치를 확인하는 중…");
    geo.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setGeoMessage(null);
        onPick({ kind: "point", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setGeoMessage(geoErrorMessage(err));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section className="picker" aria-labelledby="picker-title">
      <h2 id="picker-title" className="visually-hidden">
        위치 선택
      </h2>
      <button type="button" className="btn btn-primary" onClick={locate} disabled={locating}>
        {locating ? "위치 확인 중…" : "내 위치로 찾기"}
      </button>
      <p className="picker-status" role="status">
        {geoMessage}
      </p>

      <form
        className="region-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onPick({ kind: "region", sido, sigungu: needsSigungu ? sigungu : "" });
        }}
      >
        <div className="field">
          <label htmlFor={sidoId}>시·도</label>
          <select
            id={sidoId}
            value={sido}
            onChange={(e) => {
              setSido(e.target.value);
              setSigungu("");
            }}
          >
            <option value="">선택</option>
            {SIDO_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={sigunguId}>시·군·구</label>
          <select
            id={sigunguId}
            value={sigungu}
            onChange={(e) => setSigungu(e.target.value)}
            disabled={!needsSigungu}
          >
            <option value="">{sido && !needsSigungu ? "전체" : "선택"}</option>
            {sigunguList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn" disabled={!canSubmit}>
          이 지역 보기
        </button>
      </form>
    </section>
  );
}
