from typing import Any

from pydantic import BaseModel, Field


class CountTestControls(BaseModel):
    force_quantity: int | None = None
    force_confidence: float | None = None
    force_error: bool | None = None
    force_timeout: bool | None = None
    force_latency_ms: int | None = None


class CountRequest(BaseModel):
    request_id: str = Field(min_length=6, max_length=120)
    product_id: int | None = None
    item_code: str | None = None
    image_base64: str
    metadata: dict[str, Any] | None = None
    test_controls: CountTestControls | None = None


class DetectionBox(BaseModel):
    x: int
    y: int
    w: int
    h: int
    conf: float


class CountResult(BaseModel):
    request_id: str
    success: bool = True
    quantity: int
    confidence: float
    detections: list[DetectionBox]
    inference_ms: int
    model_version: str
    mode: str = "real"
    warnings: list[str] = Field(default_factory=list)


class ServiceInfo(BaseModel):
    service: str = "devoq-ai-ai-service"
    status: str = "ok"
    mode: str = "real"
    model_version: str
    capabilities: list[str]
