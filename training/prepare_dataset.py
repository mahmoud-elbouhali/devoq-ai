#!/usr/bin/env python3
"""Assemble le dataset YOLO a partir d'images + labels annotes.

Prend un dossier contenant des paires (image, label .txt au format YOLO),
melange de facon deterministe, decoupe en train/val/test, puis copie dans la
structure deja en place :

    datasets/processed/images/{train,val,test}
    datasets/processed/labels/{train,val,test}

Seules les images possedant un fichier .txt correspondant sont prises en compte
(une image sans .txt = non annotee = ignoree, avec un avertissement).
Un .txt vide est valide : il signifie "aucune vis sur l'image" (negatif utile).

Usage :
    python training/prepare_dataset.py --src datasets/raw/annotated
    python training/prepare_dataset.py --src datasets/raw/annotated --val 0.2 --test 0.1 --seed 42 --clean
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
SPLITS = ("train", "val", "test")

REPO_ROOT = Path(__file__).resolve().parents[1]
PROCESSED = REPO_ROOT / "datasets" / "processed"


def stable_fraction(name: str) -> float:
    """Hachage deterministe d'un nom -> reel dans [0, 1). Stable entre executions."""
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def find_pairs(src: Path) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    missing: list[str] = []
    for img in sorted(src.rglob("*")):
        if img.suffix.lower() not in IMAGE_EXTS:
            continue
        label = img.with_suffix(".txt")
        if label.exists():
            pairs.append((img, label))
        else:
            missing.append(img.name)
    if missing:
        print(f"[!] {len(missing)} image(s) sans label .txt ignoree(s) : "
              f"{', '.join(missing[:5])}{' ...' if len(missing) > 5 else ''}")
    return pairs


def assign_split(name: str, val_frac: float, test_frac: float) -> str:
    f = stable_fraction(name)
    if f < test_frac:
        return "test"
    if f < test_frac + val_frac:
        return "val"
    return "train"


def clean_processed() -> None:
    for kind in ("images", "labels"):
        for split in SPLITS:
            d = PROCESSED / kind / split
            if d.exists():
                for f in d.iterdir():
                    if f.name != ".gitkeep":
                        f.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description="Assemble le dataset YOLO (train/val/test).")
    parser.add_argument("--src", required=True, help="Dossier des paires image + .txt.")
    parser.add_argument("--val", type=float, default=0.2, help="Fraction validation (defaut 0.2).")
    parser.add_argument("--test", type=float, default=0.1, help="Fraction test (defaut 0.1).")
    parser.add_argument("--clean", action="store_true",
                        help="Vider les dossiers processed avant de copier.")
    args = parser.parse_args()

    src = Path(args.src).resolve()
    if not src.exists():
        raise SystemExit(f"Dossier source introuvable : {src}")
    if args.val + args.test >= 1.0:
        raise SystemExit("val + test doit etre < 1.0")

    pairs = find_pairs(src)
    if not pairs:
        raise SystemExit("Aucune paire (image + .txt) trouvee. As-tu annote des images ?")

    if args.clean:
        clean_processed()

    for kind in ("images", "labels"):
        for split in SPLITS:
            (PROCESSED / kind / split).mkdir(parents=True, exist_ok=True)

    counts = {s: 0 for s in SPLITS}
    for img, label in pairs:
        split = assign_split(img.stem, args.val, args.test)
        shutil.copy2(img, PROCESSED / "images" / split / img.name)
        shutil.copy2(label, PROCESSED / "labels" / split / (img.stem + ".txt"))
        counts[split] += 1

    total = sum(counts.values())
    print(f"\nDataset assemble dans {PROCESSED.relative_to(REPO_ROOT)} :")
    for split in SPLITS:
        print(f"  {split:5s}: {counts[split]:4d} image(s)")
    print(f"  total: {total} image(s)")
    if counts["train"] < 30:
        print("\n[!] Tres peu d'images d'entrainement. Vise au moins ~50-100 images "
              "annotees pour un modele de vis exploitable.")


if __name__ == "__main__":
    main()
