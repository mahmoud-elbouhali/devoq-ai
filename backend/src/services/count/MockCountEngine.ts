import { CountEngineError } from "./CountEngine.js";
import type { CountEngine, CountRequest, CountResult, DetectionBox } from "./types.js";

interface MockEngineConfig {
  minDelayMs: number;
  maxDelayMs: number;
  errorRate: number;
  timeoutRate: number;
  lowConfidenceRate: number;
}

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
}

function parseDelay(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function createBoxes(quantity: number, confidence: number): DetectionBox[] {
  const capped = Math.max(0, Math.min(quantity, 24));
  return Array.from({ length: capped }, (_, index) => ({
    x: 20 + (index % 6) * 42,
    y: 24 + Math.floor(index / 6) * 38,
    w: 28,
    h: 28,
    conf: Number(Math.max(0.35, confidence - (index % 4) * 0.03).toFixed(2)),
  }));
}

function estimateQuantity(input: CountRequest): number {
  const seed = `${input.item_code ?? ""}:${input.product_id ?? ""}:${input.image_base64.length}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 24) + 1;
}

export class MockCountEngine implements CountEngine {
  readonly info = {
    mode: "mock" as const,
    model_version: "mock-v1",
    capabilities: [
      "single_capture",
      "live_preview",
      "forced_test_controls",
      "latency_simulation",
      "low_confidence_simulation",
    ],
  };

  private readonly config: MockEngineConfig;

  constructor(config?: Partial<MockEngineConfig>) {
    this.config = {
      minDelayMs: config?.minDelayMs ?? parseDelay(process.env.COUNT_MOCK_MIN_DELAY_MS, 50),
      maxDelayMs: config?.maxDelayMs ?? parseDelay(process.env.COUNT_MOCK_MAX_DELAY_MS, 200),
      errorRate: config?.errorRate ?? parseRate(process.env.COUNT_MOCK_ERROR_RATE, 0.05),
      timeoutRate: config?.timeoutRate ?? parseRate(process.env.COUNT_MOCK_TIMEOUT_RATE, 0.01),
      lowConfidenceRate: config?.lowConfidenceRate ?? parseRate(process.env.COUNT_MOCK_LOW_CONFIDENCE_RATE, 0.15),
    };
  }

  async count(input: CountRequest): Promise<CountResult> {
    const forcedLatency = input.test_controls?.force_latency_ms;
    const latency = forcedLatency ?? this.randomDelay();
    await new Promise((resolve) => setTimeout(resolve, latency));

    if (input.test_controls?.force_timeout) {
      throw new CountEngineError("Mock timeout while counting", "COUNT_TIMEOUT", 504);
    }

    if (input.test_controls?.force_error || Math.random() < this.config.errorRate) {
      throw new CountEngineError("Mock engine failed to process the frame", "COUNT_FAILED", 502);
    }

    const quantity = input.test_controls?.force_quantity ?? estimateQuantity(input);
    const lowConfidence = Math.random() < this.config.lowConfidenceRate;
    const confidence = input.test_controls?.force_confidence
      ?? Number((lowConfidence ? 0.52 + Math.random() * 0.16 : 0.83 + Math.random() * 0.14).toFixed(2));

    if (Math.random() < this.config.timeoutRate) {
      throw new CountEngineError("Mock upstream timeout", "COUNT_TIMEOUT", 504);
    }

    const warnings = confidence < 0.7
      ? ["Low confidence result: operator confirmation recommended."]
      : [];

    return {
      request_id: input.request_id,
      success: true,
      quantity,
      confidence,
      detections: createBoxes(quantity, confidence),
      inference_ms: latency,
      model_version: this.info.model_version,
      mode: this.info.mode,
      warnings,
    };
  }

  private randomDelay(): number {
    const min = Math.min(this.config.minDelayMs, this.config.maxDelayMs);
    const max = Math.max(this.config.minDelayMs, this.config.maxDelayMs);
    return Math.round(min + Math.random() * (max - min));
  }
}
