import { describe, expect, it } from "vitest";
import { validateCountRequest } from "../../validators/countSchemas.js";

describe("validateCountRequest", () => {
  it("accepts a valid counting payload", () => {
    const result = validateCountRequest({
      request_id: "req-123456",
      product_id: 42,
      item_code: "SKU-42",
      image_base64: "data:image/jpeg;base64,ZmFrZQ==",
      metadata: { source: "test" },
      test_controls: { force_quantity: 7, force_confidence: 0.88 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.product_id).toBe(42);
      expect(result.data.test_controls?.force_quantity).toBe(7);
    }
  });

  it("rejects invalid payloads", () => {
    const result = validateCountRequest({
      request_id: "x",
      image_base64: "hello",
      test_controls: { force_confidence: 3 },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((issue) => issue.path === "request_id")).toBe(true);
      expect(result.issues.some((issue) => issue.path === "image_base64")).toBe(true);
      expect(result.issues.some((issue) => issue.path === "test_controls.force_confidence")).toBe(true);
    }
  });
});
