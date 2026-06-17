# Datasets Rejetes

Ce dossier sert a ranger les datasets telecharges mais non retenus pour le projet.

Un dataset va ici si :

- les annotations sont mauvaises
- le format est inutilisable
- la licence pose probleme
- les images sont trop eloignees du besoin reel
- le dataset est incomplet ou incoherent

Exemples de motifs de rejet :

- pas de bounding boxes
- classification seulement
- classes non pertinentes
- trop peu d'images utiles
- annotations fausses

Convention recommandee :

```text
rejected/
  nom-du-dataset/
    README.md
```

Dans le `README.md` du dataset rejete, note :

- source
- date
- raison du rejet
- si une partie du dataset reste recuperable ou non

