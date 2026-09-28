import { readFileSync } from "node:fs";
import path from "node:path";
import { FixtureSource } from "@/lib/api/fixtureSource";
import { parseApiResponse, type RawItem } from "@/lib/api/xml";

const ROOT = path.resolve(__dirname, "../../fixtures");

/** fixtures/ 아래 파일을 읽는다. 예: readFixture("docs/pharmacy-list.xml") */
export function readFixture(rel: string): string {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

export function fixtureItems(rel: string): RawItem[] {
  return parseApiResponse(readFixture(rel)).items;
}

/** 데모 XML 로 동작하는 데이터 소스. clock 을 넘기면 병상 입력 시각을 그 기준으로 옮긴다. */
export function demoSource(clock: (() => number) | null = null): FixtureSource {
  return new FixtureSource((file) => readFixture(`demo/${file}`), clock);
}
