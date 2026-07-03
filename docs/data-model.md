# Modèle de données

## Vue d'ensemble

### `projects`
- projet de rénovation

### `levels`
- niveaux / étages d'un projet

### `pieces`
- une pièce appartenant à un niveau

### `piece_vertices`
- liste ordonnée de points `(x, y)` définissant la forme d'une pièce

### `walls`
- propriétés métier des segments entre sommets

### `openings`
- porte / fenêtre ancrée sur un mur

### `documents`
- devis, DPE, photos, administratif, etc.

### `tasks`
- tâches liées à un projet, une pièce ou un mur

## Règles importantes
- la forme d'une pièce est connue par ses sommets ordonnés
- les murs sont rattachés à une pièce et référencent leur sommet de départ et de fin
- les angles sont calculés en lecture, pas stockés
- les coordonnées doivent être exprimées dans le même repère pour toutes les pièces d'un étage

## Exemple conceptuel

Pièce en L :

```
v0 = (0, 0)
v1 = (500, 0)
v2 = (500, 300)
v3 = (200, 300)
v4 = (200, 500)
v5 = (0, 500)
```

Les murs sont alors les segments :
- v0 -> v1
- v1 -> v2
- v2 -> v3
- v3 -> v4
- v4 -> v5
- v5 -> v0
