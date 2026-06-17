import { Router } from "express";
import type { Request, Response } from "express";
import { DatasetCaptureStore } from "../services/dataset/DatasetCaptureStore.js";
import { validateDatasetCaptureRequest } from "../validators/datasetCaptureSchemas.js";

export function createDatasetRoutes(store = new DatasetCaptureStore()): Router {
  const router = Router();

  router.post("/captures", async (req: Request, res: Response) => {
    const parsed = validateDatasetCaptureRequest(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "INVALID_DATASET_CAPTURE_REQUEST",
        message: "Dataset capture payload is invalid.",
        details: parsed.issues,
      });
      return;
    }

    try {
      const saved = await store.save(parsed.data);
      res.status(201).json({
        success: true,
        ...saved,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save dataset capture";
      res.status(500).json({
        success: false,
        error: "DATASET_CAPTURE_SAVE_FAILED",
        message,
      });
    }
  });

  return router;
}
