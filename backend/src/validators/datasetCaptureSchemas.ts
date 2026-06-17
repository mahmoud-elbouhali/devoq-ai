import {
  isPlainObject,
  REQUEST_ID_PATTERN,
  type ValidationResult,
  validateImageDataUrl,
} from "./validationUtils.js";

export interface DatasetCaptureRequest {
  request_id: string;
  image_base64: string;
  session_name?: string;
  notes?: string;
  product_id?: number;
  item_code?: string;
  metadata?: Record<string, unknown>;
}

export function validateDatasetCaptureRequest(value: unknown): ValidationResult<DatasetCaptureRequest> {
  const issues: Array<{ path: string; message: string }> = [];

  if (!isPlainObject(value)) {
    return {
      success: false,
      issues: [{ path: "", message: "body must be a JSON object" }],
    };
  }

  const record = value as Record<string, unknown>;
  const requestId = record.request_id;
  const imageBase64 = record.image_base64;
  const sessionName = record.session_name;
  const notes = record.notes;
  const productId = record.product_id;
  const itemCode = record.item_code;
  const metadata = record.metadata;

  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
    issues.push({ path: "request_id", message: "must be a string matching the request id format" });
  }

  validateImageDataUrl(imageBase64, issues);

  if (sessionName !== undefined && (typeof sessionName !== "string" || sessionName.trim().length === 0 || sessionName.length > 80)) {
    issues.push({ path: "session_name", message: "must be a non-empty string up to 80 characters" });
  }

  if (notes !== undefined && (typeof notes !== "string" || notes.trim().length === 0 || notes.length > 500)) {
    issues.push({ path: "notes", message: "must be a non-empty string up to 500 characters" });
  }

  if (productId !== undefined && (typeof productId !== "number" || !Number.isInteger(productId) || productId <= 0)) {
    issues.push({ path: "product_id", message: "must be a positive integer" });
  }

  if (itemCode !== undefined && (typeof itemCode !== "string" || itemCode.trim().length === 0)) {
    issues.push({ path: "item_code", message: "must be a non-empty string" });
  }

  if (metadata !== undefined && !isPlainObject(metadata)) {
    issues.push({ path: "metadata", message: "must be an object" });
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      request_id: requestId as string,
      image_base64: imageBase64 as string,
      session_name: typeof sessionName === "string" ? sessionName.trim() : undefined,
      notes: typeof notes === "string" ? notes.trim() : undefined,
      product_id: productId as number | undefined,
      item_code: typeof itemCode === "string" ? itemCode.trim() : undefined,
      metadata: metadata as Record<string, unknown> | undefined,
    },
  };
}
