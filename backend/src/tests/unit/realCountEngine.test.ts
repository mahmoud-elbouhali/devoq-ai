import { afterEach, describe, expect, it, vi } from "vitest";
import { RealCountEngine } from "../../services/count/RealCountEngine.js";

describe("RealCountEngine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards successful counts from the AI service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        request_id: "req-real-1",
        success: true,
        quantity: 4,
        confidence: 0.88,
        detections: [{ x: 10, y: 20, w: 30, h: 40, conf: 0.88 }],
        inference_ms: 48,
        model_version: "simple-vision-v1",
        mode: "real",
        warnings: [],
      }),
    }));

    const engine = new RealCountEngine({
      baseUrl: "http://ai-service:8000",
      timeoutMs: 50,
    });

    const result = await engine.count({
      request_id: "req-real-1",
      image_base64: "data:image/jpeg;base64,ZmFrZQ==",
    });

    expect(result.quantity).toBe(4);
    expect(result.mode).toBe("real");
  });

  it("maps upstream service errors to CountEngineError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        error: "COUNT_FAILED",
        message: "Forced AI service error",
      }),
    }));

    const engine = new RealCountEngine({
      baseUrl: "http://ai-service:8000",
      timeoutMs: 50,
    });

    await expect(engine.count({
      request_id: "req-real-2",
      image_base64: "data:image/jpeg;base64,ZmFrZQ==",
    })).rejects.toMatchObject({
      code: "COUNT_FAILED",
      status: 502,
    });
  });
});
