# SortScrews

Source locale :

- `Archive/SortScrews`

Constat :

- le dataset contient surtout des images de **une seule vis par image**
- les labels sont des **classes de classification**
- les classes de `types.json` sont :
  - `background / no screw`
  - `flat 1.5cm`
  - `round 2.5cm`
  - `flat 3.0cm`
  - `flat 3.5cm`
  - `flat 6.0cm`
  - `round 7.5cm`

Pourquoi ce dataset est hors sujet pour le besoin principal :

- il ne contient pas de scenes avec plusieurs vis a compter
- il ne fournit pas de bounding boxes pour chaque vis
- il sert a reconnaitre un type de vis, pas a compter des vis posees sur une surface

Ce dataset peut rester utile pour :

- un futur sous-projet de classification de type de vis
- des tests simples de reconnaissance de presence/absence d'une vis

Ce dataset ne doit pas etre utilise comme dataset principal pour entrainer le comptage multi-vis.

