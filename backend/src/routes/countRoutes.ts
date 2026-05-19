import { Router } from "express";
import type { Request, Response } from "express";
import { CountEngineError } from "../services/count/CountEngine.js";
import type { CountEngine } from "../services/count/types.js";
import { validateCountRequest } from "../validators/countSchemas.js";

export function createCountRoutes(engine: CountEngine): Router {
  const router = Router();

  router.get("/info", (_req: Request, res: Response) => {
    res.json({
      service: "devoq-ai",
      status: "ok",
      mode: engine.info.mode,
      model_version: engine.info.model_version,
      capabilities: engine.info.capabilities,
    });
  });

  router.post("/count", async (req: Request, res: Response) => {
    const parsed = validateCountRequest(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "INVALID_COUNT_REQUEST",
        message: "Request payload is invalid.",
        details: parsed.issues,
      });
      return;
    }

    try {
      const result = await engine.count(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof CountEngineError) {
        res.status(error.status).json({
          request_id: parsed.data.request_id,
          success: false,
          error: error.code,
          message: error.message,
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Unexpected counting failure";
      res.status(500).json({
        request_id: parsed.data.request_id,
        success: false,
        error: "COUNT_UNEXPECTED_ERROR",
        message,
      });
    }
  });

  return router;
}
