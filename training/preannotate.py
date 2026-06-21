#!/usr/bin/env python3
"""Pre-annotation des vis pour accelerer l'etiquetage manuel.

Genere des labels au format YOLO (un .txt par image) a partir d'un detecteur
classique simple (seuil + composantes connexes) pour accelerer l'annotation
manuelle avant entrainement YOLOX.

ATTENTION : ces annotations sont un POINT DE DEPART imparfait. Elles doivent
etre corrigees a la main dans un outil d'annotation (labelImg) avant
l'entrainement du modele YOLOX.

Format YOLO d'une ligne : `<class_id> <cx> <cy> <w> <h>` (valeurs normalisees 0-1).
Une seule classe ici : screw -> class_id = 0.

Usage :
    python training/preannotate.py --images datasets/raw/captures --out datasets/raw/annotated
    python training/preannotate.py --images datasets/raw/captures --out datasets/raw/annotated --overwrite
    python training/preannotate.py --images datasets/raw/captures/camera-session-20260617
"""
from __future__ import annotations

import argparse
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:  # pragma: no cover - dependance optionnelle du script local
    cv2 = None

# --- Parametres du detecteur de pre-annotation ---
THRESHOLD_OFFSET = 35
MIN_COMPONENT_AREA = 20
MAX_COMPONENT_AREA = 120000

# --- Filtres de taille relative a l'image ---
# Une vis fait au moins 1.5% et au plus 30% de la largeur/hauteur de l'image.
# Elimine les grands rectangles (fond detecte) et le bruit pixel.
MIN_BOX_RATIO = 0.02    # 2% de la dimension image minimum (elimine le bruit pixel)
MAX_BOX_RATIO = 0.30    # 30% de la dimension image maximum (elimine les grands faux rectangles)
EDGE_MARGIN_RATIO = 0.015  # ignore les petits artefacts colles au bord de l'image
OPENCV_BACKGROUND_SIGMA = 31

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
CLASS_NAMES = ["screw"]


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
    # ouverture puis fermeture pour nettoyer le masque binaire
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


def detect_boxes_classic(
    image: np.ndarray,
    min_box_ratio: float = MIN_BOX_RATIO,
    max_box_ratio: float = MAX_BOX_RATIO,
    edge_margin_ratio: float = EDGE_MARGIN_RATIO,
) -> list[tuple[int, int, int, int]]:
    """Retourne une liste de boites (x, y, w, h) en pixels."""
    img_h, img_w = image.shape[:2]
    min_dim = max(5, int(min(img_w, img_h) * min_box_ratio))
    max_w = int(img_w * max_box_ratio)
    max_h = int(img_h * max_box_ratio)
    edge_margin_x = int(img_w * edge_margin_ratio)
    edge_margin_y = int(img_h * edge_margin_ratio)

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
        if w < min_dim or h < min_dim:       # trop petit = bruit pixel
            continue
        if w > max_w or h > max_h:           # trop grand = fausse detection (fond)
            continue
        if (
            min_x <= edge_margin_x
            or min_y <= edge_margin_y
            or max_x >= img_w - edge_margin_x
            or max_y >= img_h - edge_margin_y
        ):
            continue
        boxes.append((min_x, min_y, w, h))
    return boxes


def detect_boxes_opencv(
    image: np.ndarray,
    min_box_ratio: float = MIN_BOX_RATIO,
    max_box_ratio: float = MAX_BOX_RATIO,
    edge_margin_ratio: float = EDGE_MARGIN_RATIO,
) -> list[tuple[int, int, int, int]]:
    """Detection plus robuste pour objets sombres sur fond clair."""
    if cv2 is None:
        raise RuntimeError("OpenCV (cv2) n'est pas installe. Utilise --detector classic.")

    img_h, img_w = image.shape[:2]
    min_dim = max(5, int(min(img_w, img_h) * min_box_ratio))
    max_w = int(img_w * max_box_ratio)
    max_h = int(img_h * max_box_ratio)
    edge_margin_x = int(img_w * edge_margin_ratio)
    edge_margin_y = int(img_h * edge_margin_ratio)

    gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
    background = cv2.GaussianBlur(gray, (0, 0), OPENCV_BACKGROUND_SIGMA)
    dark_score = cv2.subtract(background, gray)
    dark_score = cv2.normalize(dark_score, None, 0, 255, cv2.NORM_MINMAX).astype("uint8")
    _, mask = cv2.threshold(dark_score, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes: list[tuple[int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)
        if area < max(MIN_COMPONENT_AREA, min_dim * min_dim * 0.7):
            continue
        if w < min_dim or h < min_dim:
            continue
        if w > max_w or h > max_h:
            continue
        if (
            x <= edge_margin_x
            or y <= edge_margin_y
            or x + w >= img_w - edge_margin_x
            or y + h >= img_h - edge_margin_y
        ):
            continue
        boxes.append((x, y, w, h))
    return sorted(boxes, key=lambda box: (box[1], box[0]))


def detect_boxes(
    image: np.ndarray,
    detector: str = "opencv",
    min_box_ratio: float = MIN_BOX_RATIO,
    max_box_ratio: float = MAX_BOX_RATIO,
    edge_margin_ratio: float = EDGE_MARGIN_RATIO,
) -> list[tuple[int, int, int, int]]:
    if detector == "opencv":
        return detect_boxes_opencv(image, min_box_ratio, max_box_ratio, edge_margin_ratio)
    if detector == "classic":
        return detect_boxes_classic(image, min_box_ratio, max_box_ratio, edge_margin_ratio)
    raise ValueError(f"Detecteur inconnu : {detector}")


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
    parser = argparse.ArgumentParser(description="Pre-annotation YOLO des vis pour entrainement YOLOX.")
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
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Reecrire les labels .txt existants. Sans cette option, les corrections manuelles sont conservees.",
    )
    parser.add_argument(
        "--detector",
        choices=("opencv", "classic"),
        default="opencv",
        help="Algorithme de pre-annotation (defaut opencv).",
    )
    parser.add_argument(
        "--min-box-ratio",
        type=float,
        default=MIN_BOX_RATIO,
        help=f"Taille minimale relative d'une boite (defaut {MIN_BOX_RATIO}). Augmenter pour ignorer plus de petits objets.",
    )
    parser.add_argument(
        "--max-box-ratio",
        type=float,
        default=MAX_BOX_RATIO,
        help=f"Taille maximale relative d'une boite (defaut {MAX_BOX_RATIO}). Baisser pour ignorer plus de grandes fusions.",
    )
    parser.add_argument(
        "--edge-margin-ratio",
        type=float,
        default=EDGE_MARGIN_RATIO,
        help=f"Marge relative ignoree pres des bords (defaut {EDGE_MARGIN_RATIO}).",
    )
    args = parser.parse_args()

    images_root = Path(args.images).resolve()
    if not images_root.exists():
        raise SystemExit(f"Dossier introuvable : {images_root}")

    out_root = Path(args.out).resolve() if args.out else None
    if out_root:
        out_root.mkdir(parents=True, exist_ok=True)
        classes_path = out_root / "classes.txt"
        if args.overwrite or not classes_path.exists():
            try:
                classes_path.write_text("\n".join(CLASS_NAMES) + "\n", encoding="utf-8")
            except PermissionError:
                print(f"[!] Impossible d'ecrire {classes_path}. Ferme LabelImg si tu veux regenerer ce fichier.")

    total_images = 0
    skipped_labels = 0
    total_boxes = 0
    for img_path in iter_images(images_root):
        if out_root:
            label_path = out_root / (img_path.stem + ".txt")
            if args.copy_images:
                image_out = out_root / img_path.name
                if args.overwrite or not image_out.exists():
                    try:
                        shutil.copy2(img_path, image_out)
                    except PermissionError:
                        print(f"[!] Impossible de copier {image_out}. Ferme LabelImg si cette image est ouverte.")
        else:
            label_path = img_path.with_suffix(".txt")

        if label_path.exists() and not args.overwrite:
            skipped_labels += 1
            print(f"  {img_path.name}: label existant conserve -> {label_path.name}")
            continue

        with Image.open(img_path) as im:
            im = im.convert("RGB")
            arr = np.array(im)
        boxes = detect_boxes(
            arr,
            detector=args.detector,
            min_box_ratio=args.min_box_ratio,
            max_box_ratio=args.max_box_ratio,
            edge_margin_ratio=args.edge_margin_ratio,
        )
        lines = to_yolo_lines(boxes, arr.shape[1], arr.shape[0])

        label_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        total_images += 1
        total_boxes += len(boxes)
        print(f"  {img_path.name}: {len(boxes)} vis -> {label_path.name}")

    print(f"\nTermine : {total_images} image(s), {total_boxes} boite(s) pre-annotee(s).")
    if skipped_labels:
        print(f"Labels existants conserves : {skipped_labels}. Utilise --overwrite pour les regenerer.")
    if out_root:
        print(f"Classes YOLO : {out_root / 'classes.txt'}")
    print("Etape suivante : corrige ces boites a la main avant l'entrainement.")


if __name__ == "__main__":
    main()
