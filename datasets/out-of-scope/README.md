# Datasets Hors Sujet

Ce dossier sert a ranger les datasets qui parlent de vis, pieces ou inspection visuelle, mais qui ne correspondent pas directement au besoin principal du projet.

Un dataset va ici si :

- il traite une seule vis en gros plan
- il sert a la detection de defauts ou d'anomalies
- il est utile pour l'inspection qualite mais pas pour le comptage multi-vis
- il peut inspirer un futur sous-projet, mais pas l'entrainement actuel

Exemple typique :

- dataset MVTec AD `screw`
  utile pour anomalie/inspection
  non adapte comme dataset principal de comptage

Convention recommandee :

```text
out-of-scope/
  nom-du-dataset/
    README.md
```

Dans le `README.md` du dataset range ici, note :

- source
- objectif reel du dataset
- pourquoi il est hors sujet pour le comptage
- si certaines images restent reutilisables a titre secondaire

