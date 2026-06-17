# Dataset Pret A L'Emploi

Ce dossier contient la structure cible du dataset final pour une seule classe :

- `screw`

L'objectif est de pouvoir prendre un dataset externe deja existant, le normaliser, puis l'utiliser comme base de travail pour l'annotation, le nettoyage ou l'entrainement.

## Structure

```text
processed/
  classes.txt
  dataset.yaml
  imports/
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
```

## Convention Retenue

- une seule classe
- id de classe : `0`
- nom de classe : `screw`

## Comment Utiliser Un Dataset Externe

1. Telecharger le dataset source dans `datasets/raw/`
2. Extraire ou convertir son contenu dans `datasets/extracted/`
3. Copier uniquement les images et annotations valides dans `datasets/processed/images/*` et `datasets/processed/labels/*`
4. Si le dataset source contient plusieurs classes, remapper uniquement la classe `screw` ou la classe equivalente
5. Verifier manuellement un echantillon d'images et labels avant entrainement

## Verification Minimale Avant Utilisation

Verifier que :

- chaque image a son fichier label correspondant
- chaque ligne de label est au format YOLO
- toutes les annotations utilisent la classe `0`
- les boites sont coherentes et serrees autour de chaque vis
- il n'y a pas de doublons evidents entre train et test

## Important

Un dataset externe peut faire gagner du temps, mais il faut verifier :

- la licence
- la qualite des annotations
- la ressemblance avec votre vrai contexte de prise de vue

Si les images sont trop differentes de votre surface, lumiere ou camera, il faudra completer avec vos propres images reelles.

