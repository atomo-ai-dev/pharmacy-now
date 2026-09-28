import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CachedSource } from "./cache";
import { DataGoKrClient } from "./client";
import { FixtureSource } from "./fixtureSource";
import type { MedicalDataSource } from "./source";

export type DataMode = "live" | "demo";

/** 서비스 키가 있을 때만 실제 API 를 부른다. */
export function dataMode(env: NodeJS.ProcessEnv = process.env): DataMode {
  return env.DATA_GO_KR_SERVICE_KEY?.trim() ? "live" : "demo";
}

const DEMO_DIR = path.join(process.cwd(), "fixtures", "demo");

let live: MedicalDataSource | null = null;
let demo: MedicalDataSource | null = null;

export function getDataSource(): MedicalDataSource {
  const key = process.env.DATA_GO_KR_SERVICE_KEY?.trim();
  if (key) {
    live ??= new CachedSource(new DataGoKrClient({ serviceKey: key, fetch }), Date.now);
    return live;
  }
  demo ??= new FixtureSource((file) => readFileSync(path.join(DEMO_DIR, file), "utf8"), Date.now);
  return demo;
}
