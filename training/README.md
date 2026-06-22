# Entrainement d'un detecteur de vis (YOLOX) pour Devoq AI

Ce dossier contient le pipeline pour produire le modele YOLOX du microservice IA :
un modele entraine specifiquement sur des vis, exporte en ONNX et branche sur le
microservice IA en mode `yolox_onnx` (le seul detecteur du projet).

## Vue d'ensemble

```
1. Capturer      -> images reelles via la camera (app web)      datasets/raw/captures/
2. Pre-annoter   -> boites de depart automatiques               training/preannotate.py
3. Corriger      -> a la main dans un outil d'annotation        (labelImg / Label Studio)
4. Assembler     -> split train/val/test au format YOLO         training/prepare_dataset.py
5. Entrainer     -> fine-tuning YOLOX-S sur GPU cloud            training/train_yolox_colab.ipynb
6. Deployer      -> models/yolox.onnx + mode yolox_onnx          (voir plus bas)
```

---

## 1. Capturer des images

Avec l'app lancee (frontend + backend + ai-service), ouvre **http://localhost/**,
positionne les vis et clique **« Sauver au dataset »**. Chaque capture est
enregistree dans `datasets/raw/captures/<session>/` (image `.jpg` + metadonnees `.json`).

**Vise 50 a 100+ images**, en variant : nombre de vis, vis qui se touchent /
se chevauchent, positions, orientations, fonds (clair, fonce, texture),
eclairage et distance. La diversite fait la qualite du modele.

## 2. Pre-annoter (gain de temps)

Genere des boites de depart (imparfaites) a partir d'une heuristique vision (morphologie) :

```powershell
python training/preannotate.py --images datasets/raw/captures --out datasets/raw/annotated --copy-images
```

Resultat : un dossier `datasets/raw/annotated/` contenant chaque image **et** son
fichier `.txt` au format YOLO (`<class> <cx> <cy> <w> <h>` normalises, classe `0` = screw).

## 3. Corriger les annotations

Les pre-annotations sont un POINT DE DEPART : l'heuristique rate des vis et en
fusionne. Corrige-les a la main. Outils gratuits recommandes :

- **labelImg** (`pip install labelImg`) : simple, mode YOLO, ouvre directement
  `datasets/raw/annotated/`. Choisis le format **YOLO** dans la barre laterale.
- **Label Studio** (`pip install label-studio`) : plus complet (web).

Regle d'or : une boite serree autour de **chaque** vis visible, y compris celles
qui se touchent. Une image sans vis = fichier `.txt` vide (negatif utile).

## 4. Assembler le dataset

```powershell
python training/prepare_dataset.py --src datasets/raw/annotated --clean
```

Copie les paires (image + `.txt`) dans la structure deja en place, avec un
decoupage deterministe :

```
datasets/processed/images/{train,val,test}
datasets/processed/labels/{train,val,test}
```

Options : `--val 0.2 --test 0.1` (fractions), `--seed` non requis (le split est
stable par hachage du nom de fichier, donc reproductible).

## 5. Entrainer sur Google Colab (GPU gratuit)

1. Compresse `datasets/processed` en **`processed.zip`**.
2. Ouvre [`training/train_yolox_colab.ipynb`](train_yolox_colab.ipynb) dans Colab
   (`Execution > Modifier le type d'execution > GPU`).
3. Deroule les cellules : installation YOLOX -> upload du zip -> conversion
   YOLO→COCO -> fine-tuning de `yolox_s.pth` -> export ONNX -> telechargement de
   `yolox.onnx`.

Le notebook exporte avec `--decode_in_inference`, ce qui produit la sortie
`[1, N, 5+classes]` (cx, cy, w, h, objectness, classes) **exactement** au format
attendu par `ai-service/app/detectors/yolox_onnx.py`. Entree : `[1, 3, 640, 640]`.

> La config d'experience est aussi disponible en local :
> [`training/yolox_screw_exp.py`](yolox_screw_exp.py) (utile si tu entraines hors Colab).

## 6. Deployer le modele

1. Place le `yolox.onnx` telecharge dans **`models/yolox.onnx`** (remplace
   l'ancien modele COCO generique).
2. Relance l'**ai-service** en mode YOLOX. En local (sans Docker), depuis PowerShell :

   ```powershell
   cd C:\eclipse-workspace\devoq-ai\ai-service
   $env:AI_DETECTOR_MODE='yolox_onnx'
   $env:AI_MODEL_VERSION='screw-yolox-v1'
   $env:AI_YOLOX_MODEL_PATH='C:\eclipse-workspace\devoq-ai\models\yolox.onnx'
   # 1 seule classe -> on laisse les filtres de classe vides (toute detection = une vis)
   $env:AI_YOLOX_CLASS_NAMES=''
   $env:AI_YOLOX_TARGET_CLASSES=''
   python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

   Le backend ne fait que relayer vers l'ai-service : c'est bien le modele charge
   par l'**ai-service** qui realise la detection. (Pour l'affichage, le backend
   expose `AI_DETECTOR_MODE=yolox_onnx` et `COUNT_REAL_MODEL_VERSION=screw-yolox-v1`.)

3. Verifie :

   ```powershell
   curl http://localhost:8000/v1/info
   ```

   Le champ mode/version doit refleter YOLOX. Refais une capture dans l'app : le
   comptage doit maintenant gerer les vis proches.

### Avec Docker (alternative)

Le projet fournit deja la cible `make dev-yolox` (voir `docker-compose.yolox.dev.yml`)
qui active `AI_DETECTOR_MODE=yolox_onnx` avec `models/yolox.onnx` monte sur `/models`.

---

## Reglages utiles (variables d'environnement de l'ai-service)

| Variable | Defaut | Role |
|---|---|---|
| `AI_YOLOX_CONFIDENCE_THRESHOLD` | `0.35` | Seuil de confiance ; baisse-le si des vis sont ratees, monte-le si faux positifs |
| `AI_YOLOX_NMS_THRESHOLD` | `0.45` | Suppression des doublons ; monte-le si des vis proches sont fusionnees a tort |
| `AI_YOLOX_INPUT_SIZE` | `640` | Doit correspondre a la taille d'entrainement/export |

## Fichiers de ce dossier

- `preannotate.py` — pre-annotation YOLO automatique (heuristique vision).
- `prepare_dataset.py` — assemblage train/val/test au format YOLO.
- `yolox_screw_exp.py` — config d'experience YOLOX (1 classe `screw`).
- `train_yolox_colab.ipynb` — notebook Colab d'entrainement + export ONNX.
