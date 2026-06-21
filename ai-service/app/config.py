import os


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def env_list(name: str) -> list[str]:
    raw = os.getenv(name, "")
    return [item.strip() for item in raw.split(",") if item.strip()]


DETECTOR_MODE = os.getenv("AI_DETECTOR_MODE", "yolox_onnx").strip().lower()
MODEL_VERSION = os.getenv("AI_MODEL_VERSION", "screw-yolox-v1")

THRESHOLD_OFFSET = env_int("AI_THRESHOLD_OFFSET", 35)
MIN_COMPONENT_AREA = env_int("AI_MIN_COMPONENT_AREA", 20)
MAX_COMPONENT_AREA = env_int("AI_MAX_COMPONENT_AREA", 120000)
CONFIDENCE_BASE = env_float("AI_CONFIDENCE_BASE", 0.86)

YOLOX_MODEL_PATH = os.getenv("AI_YOLOX_MODEL_PATH", "../models/yolox.onnx")
YOLOX_INPUT_SIZE = env_int("AI_YOLOX_INPUT_SIZE", 640)
YOLOX_CONFIDENCE_THRESHOLD = env_float("AI_YOLOX_CONFIDENCE_THRESHOLD", 0.35)
YOLOX_NMS_THRESHOLD = env_float("AI_YOLOX_NMS_THRESHOLD", 0.45)
YOLOX_CLASS_NAMES = env_list("AI_YOLOX_CLASS_NAMES")
YOLOX_TARGET_CLASSES = set(env_list("AI_YOLOX_TARGET_CLASSES"))
YOLOX_PROVIDERS = env_list("AI_YOLOX_PROVIDERS") or ["CPUExecutionProvider"]
