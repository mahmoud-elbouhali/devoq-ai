from collections import deque

import numpy as np

from app import config
from app.detectors.base import DetectorResult
from app.schemas import DetectionBox


def rgb_to_gray(image: np.ndarray) -> np.ndarray:
    return (
        (0.299 * image[:, :, 0])
        + (0.587 * image[:, :, 1])
        + (0.114 * image[:, :, 2])
    ).astype(np.uint8)


def dilate(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    result = mask.copy()
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant", constant_values=False)
        neighbors = []
        for y in range(3):
            for x in range(3):
                neighbors.append(padded[y : y + result.shape[0], x : x + result.shape[1]])
        result = np.logical_or.reduce(neighbors)
    return result


def erode(mask: np.ndarray, iterations: int = 1) -> np.ndarray:
    result = mask.copy()
    for _ in range(iterations):
        padded = np.pad(result, 1, mode="constant", constant_values=True)
        neighbors = []
        for y in range(3):
            for x in range(3):
                neighbors.append(padded[y : y + result.shape[0], x : x + result.shape[1]])
        result = np.logical_and.reduce(neighbors)
    return result


def refine_mask(mask: np.ndarray) -> np.ndarray:
    opened = dilate(erode(mask, iterations=1), iterations=1)
    return erode(dilate(opened, iterations=1), iterations=1)


def connected_components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []
    directions = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue

            queue: deque[tuple[int, int]] = deque([(y, x)])
            visited[y, x] = True
            min_x = max_x = x
            min_y = max_y = y
            area = 0

            while queue:
                current_y, current_x = queue.popleft()
                area += 1
                min_x = min(min_x, current_x)
                max_x = max(max_x, current_x)
                min_y = min(min_y, current_y)
                max_y = max(max_y, current_y)

                for delta_y, delta_x in directions:
                    next_y = current_y + delta_y
                    next_x = current_x + delta_x
                    if not (0 <= next_y < height and 0 <= next_x < width):
                        continue
                    if visited[next_y, next_x] or not mask[next_y, next_x]:
                        continue

                    visited[next_y, next_x] = True
                    queue.append((next_y, next_x))

            components.append((min_x, min_y, max_x, max_y, area))

    return components


class BaselineDetector:
    model_version = config.MODEL_VERSION
    capabilities = [
        "single_capture",
        "live_preview",
        "stable_surface_counting",
        "dark_objects_on_light_background",
    ]

    def detect(self, image: np.ndarray) -> DetectorResult:
        gray = rgb_to_gray(image)
        background_level = int(np.percentile(gray, 92))
        candidate_threshold = max(0, background_level - config.THRESHOLD_OFFSET)
        threshold = min(candidate_threshold, int(np.percentile(gray, 60)))
        raw_mask = gray <= threshold

        raw_mask[:2, :] = False
        raw_mask[-2:, :] = False
        raw_mask[:, :2] = False
        raw_mask[:, -2:] = False

        mask = refine_mask(raw_mask)
        components = connected_components(mask)

        detections: list[DetectionBox] = []
        for min_x, min_y, max_x, max_y, area in components:
            if area < config.MIN_COMPONENT_AREA or area > config.MAX_COMPONENT_AREA:
                continue

            width = max_x - min_x + 1
            height = max_y - min_y + 1
            aspect_ratio = max(width, height) / max(1, min(width, height))
            if width < 3 or height < 3:
                continue

            confidence = config.CONFIDENCE_BASE
            if aspect_ratio > 6:
                confidence -= 0.07
            if area < 60:
                confidence -= 0.08

            detections.append(
                DetectionBox(
                    x=min_x,
                    y=min_y,
                    w=width,
                    h=height,
                    conf=round(max(0.35, min(0.99, confidence)), 2),
                )
            )

        quantity = len(detections)
        if quantity == 0:
            return DetectorResult(
                quantity=0,
                detections=[],
                confidence=0.42,
                inference_ms=45,
            )

        mean_confidence = float(np.mean([item.conf for item in detections]))
        return DetectorResult(
            quantity=quantity,
            detections=detections,
            confidence=round(max(0.45, min(0.99, mean_confidence)), 2),
            inference_ms=45,
        )
