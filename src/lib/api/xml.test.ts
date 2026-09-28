import { describe, expect, it } from "vitest";
import { readFixture } from "@/test/fixtures";
import { ApiError, parseApiResponse } from "./xml";

describe("parseApiResponse — 공식 가이드 응답 예제", () => {
  it("약국 목록정보: 값은 문자열로, 태그는 소문자로", () => {
    const { items, totalCount } = parseApiResponse(readFixture("docs/pharmacy-list.xml"));
    expect(totalCount).toBe(171);
    expect(items).toHaveLength(1);
    const [item] = items;
    expect(item?.hpid).toBe("A0030236");
    expect(item?.dutyname).toBe("임자약국");
    expect(item?.dutytime1s).toBe("0830"); // 앞자리 0 유지
    expect(item?.dutytel1).toBe("02-742-1145");
    expect(item?.wgs84lat).toBe("37.573708333333336");
  });

  it("약국 위치정보: latitude/longitude/startTime/endTime", () => {
    const [item] = parseApiResponse(readFixture("docs/pharmacy-location.xml")).items;
    expect(item).toMatchObject({
      hpid: "A0031802",
      latitude: "37.485832502919145",
      longitude: "127.08359590176863",
      starttime: "0830",
      endtime: "1930",
      distance: "0.29",
    });
  });

  it("응급실 실시간 병상: dutyName·dutyTel3 대소문자와 무관하게 읽힌다", () => {
    const [item] = parseApiResponse(readFixture("docs/emergency-beds.xml")).items;
    expect(item).toMatchObject({
      hpid: "A2800001",
      dutyname: "경상국립대학교병원",
      dutytel3: "055-750-0000",
      hvec: "14",
      hvs01: "28",
      hv28: "3",
      hvidate: "20230414092700",
    });
  });

  it("여러 item", () => {
    expect(parseApiResponse(readFixture("docs/emergency-list.xml")).items).toHaveLength(4);
  });

  it("결과 없음", () => {
    expect(parseApiResponse(readFixture("errors/empty-items.xml"))).toEqual({
      items: [],
      totalCount: 0,
    });
  });
});

describe("parseApiResponse — 오류", () => {
  it("게이트웨이 인증 오류", () => {
    const run = () => parseApiResponse(readFixture("errors/gateway-key-not-registered.xml"));
    expect(run).toThrow(ApiError);
    expect(run).toThrow(/SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
    try {
      run();
    } catch (e) {
      expect((e as ApiError).code).toBe("30");
    }
  });

  it("resultCode 가 00 이 아니면 오류", () => {
    expect(() => parseApiResponse(readFixture("errors/result-error.xml"))).toThrow(
      /INVALID_REQUEST_PARAMETER_ERROR/,
    );
  });

  it("XML 이 아닌 응답", () => {
    expect(() => parseApiResponse("Unauthorized")).toThrow(ApiError);
    expect(() => parseApiResponse("")).toThrow(ApiError);
  });

  it("item 안의 중첩 구조는 버린다", () => {
    const xml =
      "<response><header><resultCode>00</resultCode></header><body><items><item><hpid>X1</hpid><nested><a>1</a></nested></item></items></body></response>";
    expect(parseApiResponse(xml).items).toEqual([{ hpid: "X1" }]);
  });
});
