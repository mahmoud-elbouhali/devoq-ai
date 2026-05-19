import { MockCountEngine } from "./MockCountEngine.js";
import { RealCountEngine } from "./RealCountEngine.js";
import type { CountEngine } from "./types.js";

export function createCountEngine(): CountEngine {
  const mode = (process.env.COUNT_ENGINE_MODE ?? "real").trim().toLowerCase();

  switch (mode) {
    case "mock":
      return new MockCountEngine();
    case "real":
      return new RealCountEngine();
    default:
      throw new Error(`Unsupported COUNT_ENGINE_MODE: ${mode}`);
  }
}
