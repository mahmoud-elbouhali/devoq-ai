from app.detectors.base import Detector
from app.detectors.yolox_onnx import YoloXOnnxDetector


def create_detector() -> Detector:
    return YoloXOnnxDetector()
