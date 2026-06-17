export interface CountEngineInfo {
  service: string;
  status: string;
  mode: "mock" | "real";
  model_version: string;
  capabilities: string[];
}

export interface CountDetection {
  x: number;
  y: number;
  w: number;
  h: number;
  conf: number;
}

export interface CountTestControls {
  force_quantity?: number;
  force_confidence?: number;
  force_error?: boolean;
  force_timeout?: boolean;
  force_latency_ms?: number;
}

export interface CountRequestPayload {
  request_id: string;
  product_id?: number;
  item_code?: string;
  image_base64: string;
  metadata?: Record<string, unknown>;
  test_controls?: CountTestControls;
}

export interface CountResponse {
  request_id: string;
  success: true;
  quantity: number;
  confidence: number;
  detections: CountDetection[];
  inference_ms: number;
  model_version: string;
  mode: "mock" | "real";
  warnings: string[];
}

export interface CountErrorResponse {
  request_id?: string;
  success?: false;
  error: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
}

export interface CountHistoryEntry {
  id: string;
  capturedAt: string;
  quantity: number;
  confidence: number;
  inferenceMs: number;
  mode: "mock" | "real";
  cameraLabel?: string;
  itemCode?: string;
}

export interface DatasetCapturePayload {
  request_id: string;
  image_base64: string;
  session_name?: string;
  notes?: string;
  product_id?: number;
  item_code?: string;
  metadata?: Record<string, unknown>;
}

export interface DatasetCaptureResponse {
  success: true;
  capture_id: string;
  session_name: string;
  image_path: string;
  metadata_path: string;
  saved_at: string;
}
