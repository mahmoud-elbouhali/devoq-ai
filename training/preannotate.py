#!/usr/bin/env python3
"""Pre-annotation des vis pour accelerer l'etiquetage manuel.

Genere des labels au format YOLO (un .txt par image) a partir d'un detecteur
classique simple (seuil + composantes connexes), repliquant la logique du
detecteur `baseline` du microservice IA.

ATTENTION : ces annotations sont un POINT DE DEPART imparfait (le baseline
sous-compte les vis qui se touchent et gere mal les fonds non uniformes).
Elles doivent etre corrigees a la main dans un outil d'annotation
(labelImg, Label Studio, Roboflow...) avant l'entrainement.

Format YOLO d'une ligne : `<class_id> <cx> <cy> <w> <h>` (valeurs normalisees 0-1).
Une seule classe ici : screw -> class_id = 0.

Usage :
    python training/preannotate.py --images datasets/raw/captures --out datasets/raw/annotated
    python training/preannotate.py --images datasets/raw/captures/camera-session-20260617
"""
from __future__ import annotations

import argparse
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

# --- Parametres du detecteur baseline (alignes sur ai-service/app/config.py) ---
THRESHOLD_OFFSET = 35
MIN_COMPONENT_AREA = 20
MAX_COMPONENT_AREA = 120000

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def rgb_to_gray(image: np.ndarray) -> np.ndarray:
    return (
        0.299 * image[:, :, 0]
        + 0.587 * image[:, :, 1]
        + 0.114 * image[:, :, 2]
    ).astype(np.uint8)


def _morph(mask: np.ndarray, op: str, pad_value: bool) -> np.ndarray:
    padded = np.pad(mask, 1, mode="constant", constant_values=pad_value)
    neighbors = [
        padded[y : y + mask.shape[0], x : x + mask.shape[1]]
        for y in range(3)
        for x in range(3)
    ]
    reducer = np.logical_or if op == "dilate" else np.logical_and
    return reducer.reduce(neighbors)


def refine_mask(mask: np.ndarray) -> np.ndarray:
    # ouverture puis fermeture, comme le detecteur baseline
    opened = _morph(_morph(mask, "erode", True), "dilate", False)
    return _morph(_morph(opened, "dilate", False), "erode", True)


def connected_components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[int, int, int, int, int]] = []
    directions = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

    for sy in range(height):
        for sx in range(width):
            if not mask[sy, sx] or visited[sy, sx]:
                continue
            queue: deque[tuple[int, int]] = deque([(sy, sx)])
            visited[sy, sx] = True
            min_x = max_x = sx
            min_y = max_y = sy
            area = 0
            while queue:
                cy, cx = queue.popleft()
                area += 1
                min_x, max_x = min(min_x, cx), max(max_x, cx)
                min_y, max_y = min(min_y, cy), max(max_y, cy)
                for dy, dx in directions:
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((ny, nx))
            components.append((min_x, min_y, max_x, max_y, area))
    return components


def detect_boxes(image: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Retourne une liste de boites (x, y, w, h) en pixels."""
    gray = rgb_to_gray(image)
    background_level = int(np.percentile(gray, 92))
    candidate_threshold = max(0, background_level - THRESHOLD_OFFSET)
    threshold = min(candidate_threshold, int(np.percentile(gray, 60)))
    raw_mask = gray <= threshold
    raw_mask[:2, :] = raw_mask[-2:, :] = False
    raw_mask[:, :2] = raw_mask[:, -2:] = False

    mask = refine_mask(raw_mask)
    boxes: list[tuple[int, int, int, int]] = []
    for min_x, min_y, max_x, max_y, area in connected_components(mask):
        if area < MIN_COMPONENT_AREA or area > MAX_COMPONENT_AREA:
            continue
        w = max_x - min_x + 1
        h = max_y - min_y + 1
        if w < 3 or h < 3:
            continue
        boxes.append((min_x, min_y, w, h))
    return boxes


def to_yolo_lines(boxes: list[tuple[int, int, int, int]], img_w: int, img_h: int) -> list[str]:
    lines = []
    for x, y, w, h in boxes:
        cx = (x + w / 2) / img_w
        cy = (y + h / 2) / img_h
        nw = w / img_w
        nh = h / img_h
        lines.append(f"0 {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
    return lines


def iter_images(root: Path):
    for path in sorted(root.rglob("*")):
        if path.suffix.lower() in IMAGE_EXTS:
            yield path


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-annotation YOLO des vis (baseline).")
    parser.add_argument("--images", required=True, help="Dossier contenant les images (recursif).")
    parser.add_argument(
        "--out",
        default=None,
        help="Dossier de sortie. Par defaut : a cote des images (label .txt accole).",
    )
    parser.add_argument(
        "--copy-images",
        action="store_true",
        help="Copier aussi les images dans --out (pratique pour ouvrir un dossier propre dans l'outil d'annotation).",
    )
    args = parser.parse_args()

    images_root = Path(args.images).resolve()
    if not images_root.exists():
        raise SystemExit(f"Dossier introuvable : {images_root}")

    out_root = Path(args.out).resolve() if args.out else None
    if out_root:
        out_root.mkdir(parents=True, exist_ok=True)

    total_images = 0
    total_boxes = 0
    for img_path in iter_images(images_root):
        with Image.open(img_path) as im:
            im = im.convert("RGB")
            arr = np.array(im)
        boxes = detect_boxes(arr)
        lines = to_yolo_lines(boxes, arr.shape[1], arr.shape[0])

        if out_root:
            label_path = out_root / (img_path.stem + ".txt")
            if args.copy_images:
                shutil.copy2(img_path, out_root / img_path.name)
        else:
            label_path = img_path.with_suffix(".txt")

        label_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        total_images += 1
        total_boxes += len(boxes)
        print(f"  {img_path.name}: {len(boxes)} vis -> {label_path.name}")

    print(f"\nTermine : {total_images} image(s), {total_boxes} boite(s) pre-annotee(s).")
    print("Etape suivante : corrige ces boites a la main avant l'entrainement.")


if __name__ == "__main__":
    main()
