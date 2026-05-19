export interface CountTestControls {
  force_quantity?: number;
  force_confidence?: number;
  force_error?: boolean;
  force_timeout?: boolean;
  force_latency_ms?: number;
}

export interface CountMetadata {
  source?: string;
  camera_label?: string;
  captured_at?: string;
  [key: string]: unknown;
}

export interface CountRequest {
  request_id: string;
  product_id?: number;
  item_code?: string;
  image_base64: string;
  metadata?: CountMetadata;
  test_controls?: CountTestControls;
}

export interface DetectionBox {
  x: number;
  y: number;
  w: number;
  h: number;
  conf: number;
}

export interface CountResult {
  request_id: string;
  success: true;
  quantity: number;
  confidence: number;
  detections: DetectionBox[];
  inference_ms: number;
  model_version: string;
  mode: "mock" | "real";
  warnings: string[];
}

export interface CountEngineInfo {
  mode: "mock" | "real";
  model_version: string;
  capabilities: string[];
}

export interface CountEngine {
  readonly info: CountEngineInfo;
  count(input: CountRequest): Promise<CountResult>;
}
