import { describe, expect, it } from "vitest";
import { MockCountEngine } from "../../services/count/MockCountEngine.js";

describe("MockCountEngine", () => {
  it("returns forced values when provided", async () => {
    const engine = new MockCountEngine({
      minDelayMs: 0,
      maxDelayMs: 0,
      errorRate: 0,
      timeoutRate: 0,
      lowConfidenceRate: 0,
    });

    const result = await engine.count({
      request_id: "req-forced-1",
      image_base64: "data:image/png;base64,ZmFrZQ==",
      test_controls: {
        force_quantity: 11,
        force_confidence: 0.66,
      },
    });

    expect(result.quantity).toBe(11);
    expect(result.confidence).toBe(0.66);
    expect(result.mode).toBe("mock");
  });

  it("throws a timeout when forced", async () => {
    const engine = new MockCountEngine({
      minDelayMs: 0,
      maxDelayMs: 0,
      errorRate: 0,
      timeoutRate: 0,
      lowConfidenceRate: 0,
    });

    await expect(engine.count({
      request_id: "req-timeout-1",
      image_base64: "data:image/png;base64,ZmFrZQ==",
      test_controls: { force_timeout: true },
    })).rejects.toMatchObject({
      code: "COUNT_TIMEOUT",
      status: 504,
    });
  });
});
