from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app import config
from app.detectors import create_detector
from app.image_utils import decode_data_url
from app.schemas import CountRequest, CountResult, ServiceInfo

app = FastAPI(title="devoq-ai-ai-service")
detector = create_detector()


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "devoq-ai-ai-service",
        "mode": "real",
    }


@app.get("/v1/info", response_model=ServiceInfo)
def info() -> ServiceInfo:
    return ServiceInfo(
        model_version=detector.model_version,
        capabilities=detector.capabilities,
    )


@app.post("/v1/count", response_model=CountResult)
def count(payload: CountRequest) -> CountResult:
    controls = payload.test_controls
    if controls and controls.force_error:
        raise HTTPException(status_code=502, detail={
            "error": "COUNT_FAILED",
            "message": "Forced AI service error",
        })

    if controls and controls.force_timeout:
        raise HTTPException(status_code=504, detail={
            "error": "COUNT_TIMEOUT",
            "message": "Forced AI service timeout",
        })

    try:
        image = decode_data_url(payload.image_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail={
            "error": "INVALID_IMAGE",
            "message": str(exc),
        }) from exc

    try:
        result = detector.detect(image)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={
            "error": "DETECTOR_RUNTIME_ERROR",
            "message": str(exc),
        }) from exc

    quantity = result.quantity
    confidence = result.confidence
    if controls and controls.force_quantity is not None:
        quantity = controls.force_quantity
    if controls and controls.force_confidence is not None:
        confidence = controls.force_confidence

    warnings: list[str] = []
    if confidence < 0.7:
        warnings.append("Low confidence result: operator confirmation recommended.")
    if quantity == 0:
        warnings.append("No object detected in the current frame.")
    if config.DETECTOR_MODE == "baseline":
        warnings.append("Baseline detector active: overlapping objects may be merged.")

    inference_ms = controls.force_latency_ms if controls and controls.force_latency_ms is not None else result.inference_ms

    return CountResult(
        request_id=payload.request_id,
        quantity=quantity,
        confidence=round(max(0.0, min(1.0, confidence)), 2),
        detections=result.detections,
        inference_ms=inference_ms,
        model_version=detector.model_version,
        warnings=warnings,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Any, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        return json_response(exc.status_code, exc.detail)
    return json_response(exc.status_code, {
        "error": "AI_SERVICE_ERROR",
        "message": str(exc.detail),
    })


def json_response(status_code: int, payload: dict[str, Any]) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=payload)
