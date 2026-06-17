export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

export const DATA_URL_PREFIX = /^data:image\/(png|jpeg|jpg|webp);base64,/i;
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{6,120}$/;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateImageDataUrl(
  value: unknown,
  issues: ValidationIssue[],
  path = "image_base64",
) {
  if (typeof value !== "string" || !DATA_URL_PREFIX.test(value)) {
    issues.push({ path, message: "must be a valid image data URL" });
    return;
  }

  const maxBytes = Number(process.env.COUNT_MAX_IMAGE_BYTES ?? 7_000_000);
  const payloadBytes = Buffer.byteLength(value, "utf8");
  if (payloadBytes > maxBytes) {
    issues.push({ path, message: `image exceeds max size of ${maxBytes} bytes` });
  }
}
