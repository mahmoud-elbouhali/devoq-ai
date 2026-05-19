import type { CountRequest, CountTestControls } from "../services/count/types.js";

const DATA_URL_PREFIX = /^data:image\/(png|jpeg|jpg|webp);base64,/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{6,120}$/;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTestControls(value: unknown, issues: ValidationIssue[]): CountTestControls | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isPlainObject(value)) {
    issues.push({ path: "test_controls", message: "must be an object" });
    return undefined;
  }

  const controls: CountTestControls = {};
  const record = value as Record<string, unknown>;
  const forceQuantity = record.force_quantity;
  const forceConfidence = record.force_confidence;
  const forceError = record.force_error;
  const forceTimeout = record.force_timeout;
  const forceLatencyMs = record.force_latency_ms;

  if (forceQuantity !== undefined) {
    if (typeof forceQuantity !== "number" || !Number.isInteger(forceQuantity) || forceQuantity < 0) {
      issues.push({ path: "test_controls.force_quantity", message: "must be a non-negative integer" });
    } else {
      controls.force_quantity = forceQuantity;
    }
  }

  if (forceConfidence !== undefined) {
    if (typeof forceConfidence !== "number" || forceConfidence < 0 || forceConfidence > 1) {
      issues.push({ path: "test_controls.force_confidence", message: "must be a number between 0 and 1" });
    } else {
      controls.force_confidence = forceConfidence;
    }
  }

  if (forceError !== undefined) {
    if (typeof forceError !== "boolean") {
      issues.push({ path: "test_controls.force_error", message: "must be a boolean" });
    } else {
      controls.force_error = forceError;
    }
  }

  if (forceTimeout !== undefined) {
    if (typeof forceTimeout !== "boolean") {
      issues.push({ path: "test_controls.force_timeout", message: "must be a boolean" });
    } else {
      controls.force_timeout = forceTimeout;
    }
  }

  if (forceLatencyMs !== undefined) {
    if (typeof forceLatencyMs !== "number" || !Number.isFinite(forceLatencyMs) || forceLatencyMs < 0) {
      issues.push({ path: "test_controls.force_latency_ms", message: "must be a non-negative number" });
    } else {
      controls.force_latency_ms = forceLatencyMs;
    }
  }

  return controls;
}

export function validateCountRequest(value: unknown): ValidationResult<CountRequest> {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      success: false,
      issues: [{ path: "", message: "body must be a JSON object" }],
    };
  }

  const record = value as Record<string, unknown>;
  const productId = record.product_id;
  const itemCode = record.item_code;
  const imageBase64 = record.image_base64;
  const metadata = record.metadata;
  const requestId = record.request_id;

  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
    issues.push({ path: "request_id", message: "must be a string matching the request id format" });
  }

  if (productId !== undefined && (typeof productId !== "number" || !Number.isInteger(productId) || productId <= 0)) {
    issues.push({ path: "product_id", message: "must be a positive integer" });
  }

  if (itemCode !== undefined && (typeof itemCode !== "string" || itemCode.trim().length === 0)) {
    issues.push({ path: "item_code", message: "must be a non-empty string" });
  }

  if (typeof imageBase64 !== "string" || !DATA_URL_PREFIX.test(imageBase64)) {
    issues.push({ path: "image_base64", message: "must be a valid image data URL" });
  } else {
    const maxBytes = Number(process.env.COUNT_MAX_IMAGE_BYTES ?? 7_000_000);
    const payloadBytes = Buffer.byteLength(imageBase64, "utf8");
    if (payloadBytes > maxBytes) {
      issues.push({ path: "image_base64", message: `image exceeds max size of ${maxBytes} bytes` });
    }
  }

  if (metadata !== undefined && !isPlainObject(metadata)) {
    issues.push({ path: "metadata", message: "must be an object" });
  }

  const testControls = validateTestControls(record.test_controls, issues);

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      request_id: requestId as string,
      product_id: productId as number | undefined,
      item_code: itemCode as string | undefined,
      image_base64: imageBase64 as string,
      metadata: metadata as CountRequest["metadata"],
      test_controls: testControls,
    },
  };
}
