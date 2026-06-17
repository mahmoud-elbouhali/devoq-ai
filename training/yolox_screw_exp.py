#!/usr/bin/env python3
"""Configuration d'experience YOLOX pour le comptage de vis (1 classe).

Fichier d'exp YOLOX (a passer via `-f`) qui fine-tune YOLOX-S sur le dataset
de vis au format COCO. A utiliser dans le notebook Colab (voir
training/train_yolox_colab.ipynb) ou en local.

Le dataset YOLO (datasets/processed) est converti en COCO par le notebook ;
ce fichier attend donc une arborescence COCO :

    <data_dir>/
      train2017/            # images d'entrainement
      val2017/              # images de validation
      annotations/
        instances_train2017.json
        instances_val2017.json

Reference : YOLOX/exps/example/custom (Megvii-BaseDetection/YOLOX).
"""
import os

from yolox.exp import Exp as MyBaseExp


class Exp(MyBaseExp):
    def __init__(self):
        super().__init__()

        # --- Modele : taille "S" (depth/width de YOLOX-S) ---
        self.depth = 0.33
        self.width = 0.50

        # --- Une seule classe : screw ---
        self.num_classes = 1

        # --- Donnees ---
        # Surcharge possible via la variable d'env YOLOX_DATA_DIR (le notebook la pose).
        self.data_dir = os.environ.get("YOLOX_DATA_DIR", "datasets/coco")
        self.train_ann = "instances_train2017.json"
        self.val_ann = "instances_val2017.json"
        self.train_name = "train2017"
        self.val_name = "val2017"

        # --- Taille d'entree (doit correspondre a AI_YOLOX_INPUT_SIZE = 640) ---
        self.input_size = (640, 640)
        self.test_size = (640, 640)
        self.multiscale_range = 5

        # --- Entrainement (valeurs raisonnables pour un petit dataset) ---
        self.max_epoch = int(os.environ.get("YOLOX_MAX_EPOCH", 100))
        self.data_num_workers = 2
        self.eval_interval = 5
        self.warmup_epochs = 5
        # desactive l'augmentation forte sur les dernieres epoques
        self.no_aug_epochs = 15
        self.print_interval = 10

        # --- Augmentation (utile quand peu d'images) ---
        self.mosaic_prob = 1.0
        self.mixup_prob = 1.0
        self.hsv_prob = 1.0
        self.flip_prob = 0.5
        self.degrees = 10.0
        self.translate = 0.1
        self.mosaic_scale = (0.5, 1.5)
        self.mixup_scale = (0.5, 1.5)
        self.shear = 2.0

        # nom de l'experience (dossier de sortie YOLOX_outputs/<exp_name>)
        self.exp_name = "yolox_screw"
