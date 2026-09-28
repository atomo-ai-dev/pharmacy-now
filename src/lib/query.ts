import { isPlausibleKoreanCoord, type LatLon, parseCoord } from "./geo/distance";
import { isKnownRegion, type Region } from "./regions";

export type LocationQuery =
  | { kind: "point"; point: LatLon }
  /** 지역 선택. 위치 권한도 있으면 origin 으로 거리를 계산한다. */
  | { kind: "region"; region: Region; origin: LatLon | null };

export type ParseResult = { ok: true; query: LocationQuery } | { ok: false; error: string };

export function parseLocationQuery(params: URLSearchParams): ParseResult {
  const lat = parseCoord(params.get("lat"));
  const lon = parseCoord(params.get("lon"));
  const hasPoint = lat !== null || lon !== null;
  const point = { lat: lat ?? undefined, lon: lon ?? undefined };
  if (hasPoint && !isPlausibleKoreanCoord(point)) {
    return { ok: false, error: "위치가 대한민국 범위를 벗어났습니다." };
  }
  const origin = hasPoint && isPlausibleKoreanCoord(point) ? point : null;

  const sido = params.get("sido")?.trim();
  if (sido) {
    const region = { sido, sigungu: params.get("sigungu")?.trim() ?? "" };
    if (!isKnownRegion(region)) return { ok: false, error: "알 수 없는 지역입니다." };
    return { ok: true, query: { kind: "region", region, origin } };
  }

  if (origin) return { ok: true, query: { kind: "point", point: origin } };
  return { ok: false, error: "위치(lat, lon) 또는 지역(sido, sigungu)을 지정하세요." };
}
