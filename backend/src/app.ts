import cors from "cors";
import express from "express";
import { createCountRoutes } from "./routes/countRoutes.js";
import { createCountEngine } from "./services/count/createCountEngine.js";

const app = express();
const countEngine = createCountEngine();

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(",") || "*",
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT ?? "12mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "devoq-ai",
    mode: countEngine.info.mode,
  });
});

app.use("/v1", createCountRoutes(countEngine));

export default app;
