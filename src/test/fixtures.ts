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

/** 특정 fixture 디렉토리에서 데이터 소스를 생성한다. */
export function fixtureSource(dir: string, clock: (() => number) | null = null): FixtureSource {
  return new FixtureSource((file) => readFixture(`${dir}/${file}`), clock);
}

/** 구 지역명 fixture를 위한 데이터 소스. */
export function legacyPharmaciesSource(): FixtureSource {
  return new FixtureSource((file) => {
    if (file === "pharmacies.xml") {
      return readFixture("legacy/pharmacies-incheon-old-names.xml");
    }
    if (file === "emergency-list.xml") {
      return readFixture("demo/emergency-list.xml");
    }
    if (file === "emergency-beds.xml") {
      return readFixture("demo/emergency-beds.xml");
    }
    throw new Error(`Unknown file: ${file}`);
  });
}

/** 광주 구 지역명 fixture를 위한 데이터 소스. */
export function gwangjuLegacyPharmaciesSource(): FixtureSource {
  return new FixtureSource((file) => {
    if (file === "pharmacies.xml") {
      return readFixture("legacy/pharmacies-gwangju-old-names.xml");
    }
    if (file === "emergency-list.xml") {
      return readFixture("demo/emergency-list.xml");
    }
    if (file === "emergency-beds.xml") {
      return readFixture("demo/emergency-beds.xml");
    }
    throw new Error(`Unknown file: ${file}`);
  });
}
