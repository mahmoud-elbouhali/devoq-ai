from pathlib import Path
from time import perf_counter

import numpy as np
from PIL import Image

from app import config
from app.detectors.base import DetectorResult
from app.schemas import DetectionBox


def nms(boxes: np.ndarray, scores: np.ndarray, threshold: float) -> list[int]:
    if len(boxes) == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep: list[int] = []

    while order.size > 0:
        index = int(order[0])
        keep.append(index)
        if order.size == 1:
            break

        xx1 = np.maximum(x1[index], x1[order[1:]])
        yy1 = np.maximum(y1[index], y1[order[1:]])
        xx2 = np.minimum(x2[index], x2[order[1:]])
        yy2 = np.minimum(y2[index], y2[order[1:]])

        width = np.maximum(0.0, xx2 - xx1 + 1)
        height = np.maximum(0.0, yy2 - yy1 + 1)
        intersection = width * height
        union = areas[index] + areas[order[1:]] - intersection
        iou = np.divide(intersection, union, out=np.zeros_like(intersection), where=union > 0)

        remaining = np.where(iou <= threshold)[0]
        order = order[remaining + 1]

    return keep


class YoloXOnnxDetector:
    def __init__(self) -> None:
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise RuntimeError(
                "onnxruntime is required for AI_DETECTOR_MODE=yolox_onnx"
            ) from exc

        model_path = Path(config.YOLOX_MODEL_PATH)
        if not model_path.exists():
            raise RuntimeError(f"YOLOX model file not found: {model_path}")

        self._ort = ort
        self.session = ort.InferenceSession(
            str(model_path),
            providers=config.YOLOX_PROVIDERS,
        )
        self.input_name = self.session.get_inputs()[0].name
        self.model_version = config.MODEL_VERSION
        self.capabilities = [
            "single_capture",
            "live_preview",
            "yolox_onnx_inference",
            "instance_counting",
            "overlap_robustness",
        ]

    def preprocess(self, image: np.ndarray) -> tuple[np.ndarray, float]:
        input_size = config.YOLOX_INPUT_SIZE
        height, width = image.shape[:2]
        ratio = min(input_size / height, input_size / width)
        resized_height = max(1, int(round(height * ratio)))
        resized_width = max(1, int(round(width * ratio)))

        resized = np.array(Image.fromarray(image).resize((resized_width, resized_height), Image.BILINEAR))

        padded = np.full((input_size, input_size, 3), 114, dtype=np.uint8)
        padded[:resized_height, :resized_width] = resized
        tensor = padded.astype(np.float32).transpose(2, 0, 1)[None, :, :, :]
        return tensor, ratio

    def postprocess(self, raw_output: np.ndarray, ratio: float) -> DetectorResult:
        predictions = np.squeeze(raw_output)
        if predictions.ndim != 2 or predictions.shape[1] < 6:
            raise RuntimeError(f"Unsupported YOLOX output shape: {predictions.shape}")

        boxes_cxcywh = predictions[:, :4]
        objectness = predictions[:, 4]
        class_scores = predictions[:, 5:]
        if class_scores.size == 0:
            class_scores = np.ones((predictions.shape[0], 1), dtype=np.float32)

        class_indices = np.argmax(class_scores, axis=1)
        class_confidence = class_scores[np.arange(class_scores.shape[0]), class_indices]
        scores = objectness * class_confidence

        keep_mask = scores >= config.YOLOX_CONFIDENCE_THRESHOLD
        if not np.any(keep_mask):
            return DetectorResult(quantity=0, detections=[], confidence=0.42, inference_ms=0)

        boxes_cxcywh = boxes_cxcywh[keep_mask]
        scores = scores[keep_mask]
        class_indices = class_indices[keep_mask]

        half_width = boxes_cxcywh[:, 2] / 2
        half_height = boxes_cxcywh[:, 3] / 2
        boxes_xyxy = np.stack([
            boxes_cxcywh[:, 0] - half_width,
            boxes_cxcywh[:, 1] - half_height,
            boxes_cxcywh[:, 0] + half_width,
            boxes_cxcywh[:, 1] + half_height,
        ], axis=1)
        boxes_xyxy /= max(ratio, 1e-6)

        if config.YOLOX_TARGET_CLASSES and config.YOLOX_CLASS_NAMES:
            class_names = np.array([
                config.YOLOX_CLASS_NAMES[index] if index < len(config.YOLOX_CLASS_NAMES) else str(index)
                for index in class_indices
            ])
            target_mask = np.isin(class_names, list(config.YOLOX_TARGET_CLASSES))
            if not np.any(target_mask):
                return DetectorResult(quantity=0, detections=[], confidence=0.42, inference_ms=0)
            boxes_xyxy = boxes_xyxy[target_mask]
            scores = scores[target_mask]

        keep_indices = nms(boxes_xyxy, scores, config.YOLOX_NMS_THRESHOLD)
        kept_boxes = boxes_xyxy[keep_indices]
        kept_scores = scores[keep_indices]

        detections = [
            DetectionBox(
                x=max(0, int(round(box[0]))),
                y=max(0, int(round(box[1]))),
                w=max(1, int(round(box[2] - box[0]))),
                h=max(1, int(round(box[3] - box[1]))),
                conf=round(float(score), 2),
            )
            for box, score in zip(kept_boxes, kept_scores, strict=False)
        ]

        confidence = float(np.mean(kept_scores)) if len(kept_scores) > 0 else 0.42
        return DetectorResult(
            quantity=len(detections),
            detections=detections,
            confidence=round(max(0.0, min(1.0, confidence)), 2),
            inference_ms=0,
        )

    def detect(self, image: np.ndarray) -> DetectorResult:
        started_at = perf_counter()
        tensor, ratio = self.preprocess(image)
        outputs = self.session.run(None, {self.input_name: tensor})
        result = self.postprocess(outputs[0], ratio)
        inference_ms = int(round((perf_counter() - started_at) * 1000))
        return DetectorResult(
            quantity=result.quantity,
            detections=result.detections,
            confidence=result.confidence,
            inference_ms=inference_ms,
        )
