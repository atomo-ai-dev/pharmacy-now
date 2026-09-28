import type { MedicalDataSource } from "../api/source";
import { ApiError } from "../api/xml";
import { holidayName, isHolidayCovered } from "../holidays";
import { parseLocationQuery } from "../query";
import { findEmergencyRooms } from "../services/emergency";
import { findPharmacies } from "../services/pharmacies";
import { toKst } from "../time/kst";
import type { ErrorResponse, ListMeta } from "../views";

export interface HandlerDeps {
  source: MedicalDataSource;
  now: Date;
  mode: "live" | "demo";
}

function json(body: unknown, status: number, cacheControl?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" };
  if (cacheControl) headers["cache-control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}

function meta(deps: HandlerDeps): ListMeta {
  const today = toKst(deps.now);
  return {
    mode: deps.mode,
    generatedAt: deps.now.toISOString(),
    holidayName: holidayName(today),
    holidayCovered: isHolidayCovered(today.year),
  };
}

function failure(err: unknown): Response {
  if (err instanceof ApiError) {
    // 원인 코드는 서버 로그에만 남긴다. 사용자에게는 다시 시도하라는 안내면 충분하다.
    console.error(`[data.go.kr] ${err.message} (code=${err.code ?? "-"})`);
    return json(
      {
        error: "공공데이터 서버에서 정보를 받아오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } satisfies ErrorResponse,
      502,
    );
  }
  throw err;
}

// 약국 정보는 하루 한 번 바뀌지만 "지금 영업 중" 판정은 분 단위로 달라지므로 짧게 캐시한다.
const PHARMACY_CACHE = "public, s-maxage=60, stale-while-revalidate=120";
const EMERGENCY_CACHE = "public, s-maxage=30, stale-while-revalidate=30";

export async function handlePharmacies(url: URL, deps: HandlerDeps): Promise<Response> {
  const parsed = parseLocationQuery(url.searchParams);
  if (!parsed.ok) return json({ error: parsed.error } satisfies ErrorResponse, 400);
  try {
    const items = await findPharmacies(deps.source, parsed.query, deps.now);
    return json({ ...meta(deps), items }, 200, PHARMACY_CACHE);
  } catch (err) {
    return failure(err);
  }
}

export async function handleEmergency(url: URL, deps: HandlerDeps): Promise<Response> {
  const parsed = parseLocationQuery(url.searchParams);
  if (!parsed.ok) return json({ error: parsed.error } satisfies ErrorResponse, 400);
  try {
    const items = await findEmergencyRooms(deps.source, parsed.query, deps.now);
    return json({ ...meta(deps), items }, 200, EMERGENCY_CACHE);
  } catch (err) {
    return failure(err);
  }
}
