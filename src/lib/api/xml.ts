import { XMLParser } from "fast-xml-parser";

/** 응답 item 하나. 태그 이름은 소문자로 맞춘다 — 가이드 예시(dutyName)와 명세(dutyname)의 대소문자가 다르다. */
export type RawItem = Readonly<Record<string, string>>;

export interface ParsedResponse {
  items: RawItem[];
  totalCount: number | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const parser = new XMLParser({
  ignoreAttributes: true,
  // "0830" 의 앞자리 0, 전화번호의 하이픈 등을 지키기 위해 값은 모두 문자열로 둔다.
  parseTagValue: false,
  trimValues: true,
  transformTagName: (name) => name.toLowerCase(),
  isArray: (_name, jpath) => jpath === "response.body.items.item",
});

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function toRawItem(v: unknown): RawItem | null {
  const rec = asRecord(v);
  if (!rec) return null;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(rec)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

/**
 * 공공데이터포털 XML 응답을 item 배열로 바꾼다.
 * - 정상: <response><header><resultCode>00 …
 * - 게이트웨이 오류: <OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>30 …
 */
export function parseApiResponse(xml: string): ParsedResponse {
  let doc: Record<string, unknown> | null;
  try {
    doc = asRecord(parser.parse(xml));
  } catch {
    throw new ApiError("응답을 해석할 수 없습니다.");
  }
  if (!doc) throw new ApiError("응답이 비어 있습니다.");

  const gateway = asRecord(asRecord(doc.openapi_serviceresponse)?.cmmmsgheader);
  if (gateway) {
    const code = typeof gateway.returnreasoncode === "string" ? gateway.returnreasoncode : null;
    const msg = typeof gateway.errmsg === "string" ? gateway.errmsg : "SERVICE ERROR";
    throw new ApiError(`공공데이터포털 오류: ${msg}`, code);
  }

  const response = asRecord(doc.response);
  if (!response) throw new ApiError("알 수 없는 응답 형식입니다.");

  const header = asRecord(response.header);
  const resultCode = typeof header?.resultcode === "string" ? header.resultcode : null;
  if (resultCode !== "00") {
    const msg = typeof header?.resultmsg === "string" ? header.resultmsg : "알 수 없는 오류";
    throw new ApiError(`API 오류: ${msg}`, resultCode);
  }

  const body = asRecord(response.body);
  const rawItems = asRecord(body?.items)?.item;
  const items = Array.isArray(rawItems)
    ? rawItems.map(toRawItem).filter((i): i is RawItem => i !== null)
    : [];
  const total = Number(body?.totalcount);
  return { items, totalCount: Number.isFinite(total) ? total : null };
}
