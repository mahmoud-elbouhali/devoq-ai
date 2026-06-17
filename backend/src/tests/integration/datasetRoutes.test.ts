import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";

let server: http.Server | null = null;
let captureDir: string | null = null;

async function startServer(): Promise<string> {
  process.env.COUNT_ENGINE_MODE = "mock";
  captureDir = await mkdtemp(path.join(tmpdir(), "devoq-ai-captures-"));
  process.env.DATASET_CAPTURE_DIR = captureDir;

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
  delete process.env.DATASET_CAPTURE_DIR;

  if (server) {
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
  }

  if (captureDir) {
    await rm(captureDir, { recursive: true, force: true });
    captureDir = null;
  }
});

describe("dataset routes", () => {
  it("saves a dataset capture with image and metadata", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/v1/dataset/captures`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request_id: "req-dataset-1",
        session_name: "Session Blanc 01",
        notes: "test capture",
        image_base64: "data:image/jpeg;base64,ZmFrZQ==",
        metadata: {
          flow: "dataset_capture",
        },
      }),
    });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.session_name).toBe("session-blanc-01");
    expect(json.image_path).toContain("datasets/raw/captures/session-blanc-01/");
    expect(json.metadata_path).toContain("datasets/raw/captures/session-blanc-01/");

    const imageFile = path.join(captureDir!, "session-blanc-01", path.basename(json.image_path));
    const metadataFile = path.join(captureDir!, "session-blanc-01", path.basename(json.metadata_path));

    await access(imageFile);
    await access(metadataFile);

    const metadataRaw = await readFile(metadataFile, "utf8");
    expect(metadataRaw).toContain("\"notes\": \"test capture\"");
    expect(metadataRaw).toContain("\"flow\": \"dataset_capture\"");
  });
});
