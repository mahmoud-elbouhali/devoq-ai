import type { CountEngine, CountRequest, CountResult } from "./types.js";

export type { CountEngine, CountRequest, CountResult };

export class CountEngineError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "COUNT_ENGINE_ERROR", status = 500) {
    super(message);
    this.name = "CountEngineError";
    this.code = code;
    this.status = status;
  }
}
