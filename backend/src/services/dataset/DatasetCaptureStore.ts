import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatasetCaptureRequest } from "../../validators/datasetCaptureSchemas.js";

const DATA_URL_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i;

function sanitizeSegment(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

function resolveCaptureDir(): string {
  if (process.env.DATASET_CAPTURE_DIR) {
    return path.resolve(process.env.DATASET_CAPTURE_DIR);
  }

  return path.resolve(process.cwd(), "../datasets/raw/captures");
}

function getExtension(dataUrl: string): string {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Unsupported image data URL");
  }

  const raw = match[1].toLowerCase();
  return raw === "jpeg" ? "jpg" : raw;
}

function decodeImage(dataUrl: string): Buffer {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Unsupported image data URL");
  }

  return Buffer.from(match[2], "base64");
}

function createStamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export interface DatasetCaptureResult {
  capture_id: string;
  session_name: string;
  image_path: string;
  metadata_path: string;
  saved_at: string;
}

export class DatasetCaptureStore {
  async save(input: DatasetCaptureRequest): Promise<DatasetCaptureResult> {
    const savedAt = new Date();
    const captureId = randomUUID().slice(0, 8);
    const sessionName = sanitizeSegment(input.session_name, "default-session");
    const extension = getExtension(input.image_base64);
    const stamp = createStamp(savedAt);
    const baseDir = resolveCaptureDir();
    const sessionDir = path.join(baseDir, sessionName);
    const fileStem = `${stamp}-${captureId}`;
    const imageFilename = `${fileStem}.${extension}`;
    const metadataFilename = `${fileStem}.json`;
    const imagePath = path.join(sessionDir, imageFilename);
    const metadataPath = path.join(sessionDir, metadataFilename);

    await mkdir(sessionDir, { recursive: true });
    await writeFile(imagePath, decodeImage(input.image_base64));
    await writeFile(
      metadataPath,
      `${JSON.stringify({
        capture_id: captureId,
        request_id: input.request_id,
        session_name: sessionName,
        saved_at: savedAt.toISOString(),
        image_filename: imageFilename,
        product_id: input.product_id,
        item_code: input.item_code,
        notes: input.notes,
        metadata: input.metadata ?? {},
      }, null, 2)}\n`,
      "utf8",
    );

    return {
      capture_id: captureId,
      session_name: sessionName,
      image_path: path.posix.join("datasets", "raw", "captures", sessionName, imageFilename),
      metadata_path: path.posix.join("datasets", "raw", "captures", sessionName, metadataFilename),
      saved_at: savedAt.toISOString(),
    };
  }
}
