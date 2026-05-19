from dataclasses import dataclass
from typing import Protocol

import numpy as np

from app.schemas import DetectionBox


@dataclass(frozen=True)
class DetectorResult:
    quantity: int
    detections: list[DetectionBox]
    confidence: float
    inference_ms: int


class Detector(Protocol):
    model_version: str
    capabilities: list[str]

    def detect(self, image: np.ndarray) -> DetectorResult:
        ...
