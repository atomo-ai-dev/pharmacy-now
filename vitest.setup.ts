import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// 실수로 실제 네트워크를 부르는 테스트가 생기면 바로 실패하게 한다.
vi.stubGlobal("fetch", () => {
  throw new Error("테스트에서 실제 fetch 를 호출했습니다. FakeFetch 를 주입하세요.");
});
