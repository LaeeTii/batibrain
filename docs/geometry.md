# Moteur géométrique

## Source de vérité
- `piece_vertices` = géométrie principale
- `walls` = données métier attachées aux segments

## Calculs dérivés
- longueur de mur
- surface de pièce
- périmètre
- angle au sommet
- orientation d'un mur

## Choix MVP
- édition simple par déplacement de sommets
- pas de solveur de contraintes avancé dans un premier temps
- propagation des vues à partir de la vue du dessus

## Fonctions minimales à implémenter
- distance entre deux points
- surface d'un polygone (shoelace)
- périmètre
- angle entre trois points
- génération des murs depuis les sommets
- centroid pour étiquettes / labels

## Unité recommandée
Utiliser le centimètre comme unité métier en base et dans les calculs.
