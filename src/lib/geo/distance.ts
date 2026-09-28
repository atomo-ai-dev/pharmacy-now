export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 두 좌표 사이의 대원 거리(km). 도시 안 거리에서는 오차가 수 미터 수준이다. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 350m, 1.2km, 12km */
export function formatDistance(km: number): string {
  const meters = Math.round((km * 1000) / 10) * 10;
  if (meters < 1000) return `${Math.max(10, meters)}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}

/** 대한민국 영역 안의 그럴듯한 좌표인가. 0,0 같은 빈 좌표를 걸러낸다. */
export function isPlausibleKoreanCoord(p: Partial<LatLon>): p is LatLon {
  return (
    typeof p.lat === "number" &&
    typeof p.lon === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lon) &&
    p.lat >= 32 &&
    p.lat <= 39.5 &&
    p.lon >= 123.5 &&
    p.lon <= 132.5
  );
}

export function parseCoord(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
