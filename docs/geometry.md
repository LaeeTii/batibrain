# Contrat geometrique

## Perimetre du document
- Ce document decrit les objets geometriques, leurs invariants, leurs calculs, leurs transformations et leurs cas limites.
- Les parcours utilisateur, les panneaux, les modes d'edition et les regles d'interaction appartiennent a [ihm_editeur_2d_global.md](./ihm_editeur_2d_global.md).
- Les regles de synchronisation de selection et d'ouverture des panneaux appartiennent a [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md).

## Objets geometriques
- Point : coordonnees 2D dans le plan d'un niveau.
- Segment : paire ordonnee de points.
- Piece : polygone ferme ordonne.
- Mur : segment support avec epaisseur et proprietes metier attachees.
- Ouverture : intervalle positionne sur un mur support, avec dimensions et orientation.
- Cote : mesure entre deux references geometriques avec un decalage d'affichage.

## Source de verite
- Les pieces et les murs sont deux entites geometriques de premier rang.
- Une piece est modelisee comme un polygone ordonne de sommets.
- Le rectangle dessine en 2 clics dans l'IHM est une modalite de creation initiale d'une piece polygonale a 4 sommets.
- Un mur est modelise comme un segment epais defini par deux points.
- Une ouverture est definie relativement a son mur support.
- Une cote est rattachee a un niveau et a deux references de mesure.

## Invariants
- L'ordre des sommets d'une piece doit rester stable afin de permettre le calcul fiable des murs, angles, surfaces et perimetres.
- Un mur peut exister seul ou etre lie a une ou deux pieces.
- Un mur lie a une seule piece est exterieur pour cette piece.
- Un mur lie a deux pieces differentes est interieur pour les deux pieces.
- Une ouverture doit rester entierement comprise dans son mur support.
- Les ouvertures d'un meme mur ne doivent pas se chevaucher.
- La hauteur utile d'une ouverture doit rester compatible avec la hauteur disponible du mur support.
- Une cote de distance nulle est invalide.

## Calculs derives
- Longueur d'un mur.
- Surface d'une piece.
- Perimetre d'une piece.
- Angle a chaque sommet de piece.
- Orientation d'un mur.
- Distances gauche et droite entre une ouverture et les extremites de son mur support.
- Type interieur ou exterieur d'un mur selon ses liaisons aux pieces.

## Convention de longueur de mur
- Le rendu du plan doit tenir compte de l'epaisseur des murs dans l'affichage des segments muraux.
- La longueur metier de reference d'un mur est sa longueur interieure.
- La longueur interieure d'un mur dans une piece correspond a la mesure exterieure du segment support, diminuee des epaisseurs des murs lies a ses extremites du cote interieur de la piece.
- Les longueurs affichees sur le canvas et exportees utilisent cette longueur interieure comme valeur de reference, sauf mention contraire explicite.
- Lorsqu'un mur est partage par deux pieces, la longueur interieure se calcule relativement a la piece et au cote interieur consideres.

## Transformations et topologie
- Creation d'une piece polygonale a partir d'une saisie rectangulaire initiale.
- Creation d'un mur par deux points.
- Deplacement d'un point, d'un mur, d'une piece, d'une ouverture ou d'une cote sans rupture des invariants.
- Repositionnement du decalage d'une cote.
- Detachement d'un mur de son ancrage.
- Coupe d'un mur en deux.
- Placement d'une ouverture sur un mur support.

## Regles de scission et d'intersection
- Si l'extremite d'un mur est posee sur un mur existant, le mur support est scinde au point d'ancrage et le nouveau mur est lie a ce point.
- L'operation "Couper en deux" cree deux segments colineaires partageant le point de coupe. Le mur de gauche garde le focus fonctionnel, le mur de droite reprend les memes proprietes.
- Si des murs se croisent sur un meme niveau, ils doivent etre scindes au point d'intersection pour produire des segments elementaires.
- Si des pieces se chevauchent sur un meme niveau, les murs concernes sont scindes aux intersections necessaires et la zone de chevauchement devient une nouvelle piece.

## Cas limites et validations
- Refuser une ouverture hors du mur support.
- Refuser deux ouvertures chevauchantes sur un meme mur.
- Refuser une cote de longueur nulle.
- Recalculer les segments elementaires apres toute coupe, intersection ou creation d'ancrage sur mur.
- Recalculer les relations mur-piece apres toute modification topologique.

## Algorithmes attendus
- Distance entre deux points.
- Projection d'un point sur un segment.
- Detection d'intersection entre segments.
- Decoupe d'un segment par un point d'intersection ou de coupe.
- Surface de polygone par formule du shoelace.
- Perimetre de polygone.
- Angle entre trois points.
- Verification d'appartenance d'une ouverture a son mur support.
- Verification de non-chevauchement entre ouvertures d'un meme mur.

## Unite metier
Le centimetre est l'unite metier de reference pour la base, les calculs et les affichages de mesure. Le m2 est l'unite metier de reference pour les surfaces. Les conversions d'unite sont effectuees a l'affichage selon le contexte utilisateur.
