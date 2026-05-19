import { CountEngineError } from "./CountEngine.js";
import type { CountEngine, CountRequest, CountResult } from "./types.js";

interface RealCountEngineConfig {
  baseUrl?: string;
  timeoutMs?: number;
}

interface AiServiceErrorPayload {
  error?: string;
  message?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function parseErrorPayload(response: Response): Promise<AiServiceErrorPayload | null> {
  try {
    return await response.json() as AiServiceErrorPayload;
  } catch {
    return null;
  }
}

export class RealCountEngine implements CountEngine {
  readonly info = {
    mode: "real" as const,
    model_version: process.env.COUNT_REAL_MODEL_VERSION
      ?? process.env.AI_MODEL_VERSION
      ?? "vision-baseline-v1",
    capabilities: [
      "single_capture",
      "live_preview",
      "http_delegate",
      "stable_surface_counting",
      `detector:${process.env.AI_DETECTOR_MODE ?? "baseline"}`,
    ],
  };

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: RealCountEngineConfig) {
    this.baseUrl = trimTrailingSlash(
      config?.baseUrl
      ?? process.env.AI_SERVICE_URL
      ?? "http://ai-service:8000",
    );

    const timeout = Number(config?.timeoutMs ?? process.env.COUNT_REAL_TIMEOUT_MS ?? 5000);
    this.timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 5000;
  }

  async count(input: CountRequest): Promise<CountResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/count`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await parseErrorPayload(response);
        throw new CountEngineError(
          payload?.message || `AI service responded with HTTP ${response.status}`,
          payload?.error || "COUNT_UPSTREAM_ERROR",
          response.status >= 400 && response.status < 600 ? response.status : 502,
        );
      }

      return await response.json() as CountResult;
    } catch (error) {
      if (error instanceof CountEngineError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        throw new CountEngineError(
          `AI service timeout after ${this.timeoutMs}ms`,
          "COUNT_TIMEOUT",
          504,
        );
      }

      const message = error instanceof Error ? error.message : "AI service request failed";
      throw new CountEngineError(message, "COUNT_UPSTREAM_ERROR", 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
