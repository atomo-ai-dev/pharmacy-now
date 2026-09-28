import { type Region, regionFromAddress } from "../regions";

/**
 * 위치 조회 결과의 주소에서 이웃 시군구를 뽑는다. 요일별 운영시간·실시간 병상은
 * 지역 단위로만 조회되기 때문이다. 가까운 순 상위 결과만 보고, 호출량을 아끼려 개수를 제한한다.
 */
export function nearbyRegions(
  addresses: readonly (string | null)[],
  { lookAhead = 20, max = 2 } = {},
): Region[] {
  const out: Region[] = [];
  for (const addr of addresses.slice(0, lookAhead)) {
    if (!addr) continue;
    const r = regionFromAddress(addr);
    if (!r) continue;
    if (out.some((o) => o.sido === r.sido && o.sigungu === r.sigungu)) continue;
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}

/** 일부 지역 조회가 실패해도 나머지로 화면을 채운다. */
export async function settledItems<T>(tasks: Promise<T[]>[]): Promise<T[]> {
  const results = await Promise.allSettled(tasks);
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
