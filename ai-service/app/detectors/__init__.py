from app import config
from app.detectors.baseline import BaselineDetector
from app.detectors.base import Detector
from app.detectors.yolox_onnx import YoloXOnnxDetector


def create_detector() -> Detector:
    if config.DETECTOR_MODE == "baseline":
        return BaselineDetector()

    if config.DETECTOR_MODE == "yolox_onnx":
        return YoloXOnnxDetector()

    raise RuntimeError(f"Unsupported AI_DETECTOR_MODE: {config.DETECTOR_MODE}")
