import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  process.env.COUNT_ENGINE_MODE = "mock";
  const { default: app } = await import("../../app.js");
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve test server address");
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  server = null;
});

describe("count routes", () => {
  it("returns engine info", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/info`);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.mode).toBe("mock");
    expect(Array.isArray(json.capabilities)).toBe(true);
  });

  it("counts with forced values", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/count`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request_id: "req-integration-1",
        image_base64: "data:image/jpeg;base64,ZmFrZQ==",
        test_controls: {
          force_quantity: 9,
          force_confidence: 0.91,
          force_latency_ms: 0,
        },
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.quantity).toBe(9);
    expect(json.confidence).toBe(0.91);
  });

  it("returns structured validation errors", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/count`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request_id: "bad",
        image_base64: "bad",
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("INVALID_COUNT_REQUEST");
    expect(Array.isArray(json.details)).toBe(true);
  });
});
