# Produit — Application de gestion de travaux maison

## Objectif
Construire une application web + mobile pour piloter des travaux de maison, avec un coeur métier centré sur les pièces et les murs.

## MVP

### Modules prioritaires
1. Pièces polygonales
2. Murs et ouvertures
3. Vue de dessus + vue de face d'un mur
4. Métriques automatiques
5. Tâches par pièce / mur
6. Documents et photos

## Règles produit
- Une pièce est définie par une liste ordonnée de sommets `(x, y)`.
- Un mur correspond à un segment entre deux sommets consécutifs.
- Les angles sont calculés, pas stockés.
- Les coordonnées sont globales pour permettre une vue étage.
- Les modifications géométriques partent de la vue de dessus.

## Hors périmètre MVP
- moteur de contraintes CAO avancé
- collaboration temps réel complexe
- moteur 3D complet
- automatisation LLM sans validation humaine

## Découpage de livraison

### V1
- création / édition de pièce polygonale
- affichage des longueurs de murs
- sélection d'un mur
- ajout d'ouverture simple
- sauvegarde en base

### V1.1
- murs en pente via `hauteur_gauche` / `hauteur_droite`
- tâches
- documents

### V1.2
- assistant LLM orienté actions avec prévisualisation et validation
