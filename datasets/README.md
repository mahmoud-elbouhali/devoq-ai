# Dataset Specialise Pour Le Comptage De Pieces/Vis

Ce dossier sert a preparer le dataset necessaire pour entrainer un vrai modele de detection specialise sur vos pieces.

Le projet peut deja fonctionner avec le detecteur `baseline`, mais pour un comptage robuste avec chevauchement, variations de lumiere et vraies conditions atelier, il faut un dataset annote puis un modele YOLOX exporte en ONNX.

## Objectif

Construire un dataset d'images reelles prises avec la camera cible, puis annoter chaque piece individuellement.

Le modele final devra apprendre a detecter :

- soit une seule classe `screw` si toutes les pieces a compter sont du meme type
- soit plusieurs classes si vous devez distinguer plusieurs references

Pour un premier objectif de comptage simple, il vaut mieux commencer par **une seule classe**.

## Structure Conseillee

Les dossiers existants peuvent etre utilises ainsi :

- `raw/`
  Images brutes capturees depuis la camera ou le telephone
- `extracted/`
  Images nettoyees, recadrees ou dedouillees avant annotation
- `processed/`
  Dataset final pret pour export, entrainement ou conversion
- `rejected/`
  Datasets telecharges mais rejetes
- `out-of-scope/`
  Datasets lies aux vis/pieces mais hors sujet pour le comptage principal

Structure recommandee dans `processed/` :

```text
processed/
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
```

## Ce Qu'il Faut Photographier

Le dataset doit ressembler au vrai contexte de production.

Inclure :

- fond reel utilise pendant le comptage
- meme camera ou camera tres proche
- meme angle de vue
- plusieurs niveaux de lumiere
- ombres legeres et fortes
- pieces bien separees
- pieces proches
- pieces qui se touchent
- petits chevauchements
- quantites faibles, moyennes et elevees
- quelques images negatives avec 0 piece si possible

Eviter :

- images trop parfaites si elles ne representent pas le reel
- uniquement un seul niveau de lumiere
- uniquement des pieces bien espacees

## Volume Minimum Recommande

Pour demarrer proprement :

- minimum exploitable : `300` a `500` images annotees
- cible correcte : `800` a `1500` images
- cible plus solide : `2000+` images si les conditions sont variees

Il faut surtout de la **diversite utile**, pas seulement du volume.

## Regles D'Annotation

Chaque piece visible doit etre annotee separement.

Regles :

- une boite par piece
- annoter meme les pieces partiellement visibles si elles sont vraiment presentes
- ne pas fusionner deux pieces proches dans une seule boite
- garder des boites serrees autour de l'objet
- rester coherent sur tout le dataset

Si une image contient `25` pieces visibles, il doit y avoir `25` annotations.

## Format D'Annotation

Le plus simple pour commencer avec les outils d'annotation courants :

- images `.jpg` ou `.png`
- annotations au format YOLO texte

Exemple pour une classe unique :

```text
0 0.512500 0.438000 0.082000 0.067000
0 0.605000 0.472000 0.079000 0.065000
```

Format d'une ligne YOLO :

```text
class_id x_center y_center width height
```

Les valeurs sont normalisees entre `0` et `1`.

Si vous utilisez un outil comme Label Studio, CVAT, Roboflow ou LabelImg, exportez dans un format compatible YOLO ou COCO. Le choix final dependra du pipeline d'entrainement retenu.

## Repartition Train / Validation / Test

Repartition recommandee :

- `70%` train
- `20%` validation
- `10%` test

Ou :

- `70%` train
- `15%` validation
- `15%` test

Important :

- ne pas mettre deux images presque identiques dans train et test
- si vous prenez des rafales, garder une meme scene dans un seul split

## Convention De Nommage

Exemple simple :

```text
piece_000001.jpg
piece_000001.txt
piece_000002.jpg
piece_000002.txt
```

Si vous avez plusieurs sessions :

```text
2026-06-09_session-a_0001.jpg
2026-06-09_session-a_0001.txt
```

## Strategie Pratique Recommandee

1. Capturer d'abord `200` a `300` images reelles.
2. Annoter une seule classe : `screw`.
3. Entrainer un premier modele.
4. Evaluer les erreurs de comptage.
5. Ajouter surtout des images des cas ou le modele echoue.

Cette boucle est plus efficace qu'attendre un gros dataset parfait des le debut.

## Outils D'Annotation Possibles

Vous pouvez utiliser :

- CVAT
- Label Studio
- Roboflow
- LabelImg

Pour ce projet, le plus important n'est pas l'outil, mais :

- la coherence des annotations
- la proximite avec les vraies conditions de prise de vue
- la separation propre entre train/val/test

## Ce Qu'il Manque Encore Dans Le Projet

Le depot est pret pour :

- capturer une image
- appeler le backend
- appeler le microservice IA
- charger un modele `yolox.onnx`

Le depot n'inclut pas encore :

- un vrai dataset annote
- un pipeline d'entrainement YOLOX complet
- un script d'export ONNX adapte a votre futur modele

## Prochaine Etape Concrète

La prochaine etape utile est de definir :

- la classe cible exacte : `screw` seule ou plusieurs classes
- la source des images : camera du poste, telephone, video extraite
- l'outil d'annotation choisi

Ensuite on peut preparer dans ce projet :

- l'arborescence finale du dataset
- un fichier de classes
- un script de verification des annotations
- puis le pipeline d'entrainement/export
