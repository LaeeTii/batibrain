# Contrat géométrique

## Périmètre du document
- Ce document decrit les objets geometriques, leurs invariants, leurs calculs, leurs transformations et leurs cas limites.
- Les parcours utilisateur, les panneaux, les modes d'édition et les règles d'interaction appartiennent a [editeur_2d_global.md](../vues/editeur_2d_global.md).
- Les règles de synchronisation de sélection et d'ouverture des panneaux appartiennent a [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md).

## Objets geometriques
- Point : coordonnees 2D dans le plan d'un niveau.
- Segment : paire ordonnee de points.
- Polygone : liste ordonnée de points avec fermeture implicite entre le dernier et le premier.
- Pièce : polygone ferme ordonne.
- Mur : segment support avec epaisseur et proprietes metier attachees.
- Face de mur : côté stable gauche ou droit relativement au segment ordonné, portant son propre profil de hauteur.
- Ouverture : intervalle positionne sur un mur support, avec dimensions et orientation.
- Cote : mesure entre deux references geometriques avec un decalage d'affichage.

## Source de verite
- Les pièces et les murs sont deux entites geometriques de premier rang.
- Une pièce est modelisee comme un polygone ordonne de sommets.
- Le rectangle dessine en 2 clics dans l'IHM est une modalite de creation initiale d'une pièce polygonale a 4 sommets.
- Un mur est modelise comme un segment epais defini par deux points.
- Une ouverture est definie relativement a son mur support.
- Une cote est rattachee a un niveau et a deux references de mesure.

## Invariants
- L'ordre des sommets d'une pièce doit rester stable afin de permettre le calcul fiable des murs, angles, surfaces et perimetres.
- Une pièce possède au moins trois sommets aux coordonnées finies, ordonnés de manière unique et continue à partir de zéro.
- La fermeture d'une pièce est implicite entre son dernier et son premier sommet; le premier sommet n'est pas dupliqué en fin de liste.
- Le contour d'une pièce ne peut pas s'auto-intersecter.
- Une nouvelle pièce utilise un rectangle initial de `200 × 200 cm`, le nom `Nouvelle pièce` si aucun nom n'est fourni, le type `autre` et la couleur de sol `#E5FFFC`.
- Un mur peut exister seul ou etre lie a une ou deux pièces.
- Un mur ne peut jamais être lié à trois pièces.
- Un mur lie a une seule pièce est extérieur pour cette pièce.
- Un mur lie a deux pièces differentes est intérieur pour les deux pièces.
- Chaque mur possède exactement deux faces et deux profils de hauteur propres, liés par défaut et dissociables.
- Chaque profil est une liste de points ordonnée par leur distance depuis le début du segment; à la création, sa hauteur est uniforme et provient de la hauteur de mur par défaut de l'utilisateur courant.
- Le lien entre profils est actif par défaut; lorsqu'il est actif, les deux profils possèdent exactement les mêmes positions et hauteurs.
- Toute modification effectuée avec le lien actif est répercutée atomiquement sur les deux faces.
- La désactivation du lien conserve les profils courants; leur édition devient indépendante.
- La remise en liaison copie le profil de la face affichée vers l'autre face après confirmation explicite.
- Pour un mur mitoyen, l'orientation de chaque face vers l'une des deux pièces est calculée depuis la topologie.
- Pour un mur extérieur, les faces intérieure et extérieure sont toutes deux éditables.
- Si le sens du segment est inversé par une transformation topologique, les profils sont permutés afin de rester attachés à la même face physique.
- L'édition géométrique d'un mur mitoyen doit impacter de facon coherente les deux pièces liees a ce mur.
- Un mur n'est supprimable que lorsqu'il n'est plus lie a aucune pièce.
- Une ouverture doit rester entierement comprise dans son mur support.
- Les ouvertures d'un meme mur ne doivent pas se chevaucher.
- La hauteur utile d'une ouverture doit rester compatible avec la hauteur disponible du mur support.
- La hauteur utile d'une ouverture doit être compatible avec le profil disponible sur chacune des deux faces du mur.
- Une ouverture intérieure ne peut appartenir qu'a un mur lié à deux pièces.
- Une ouverture extérieure ne peut appartenir qu'a un mur lié à une seule pièce.
- Une cote de distance nulle est invalide.

## Calculs derives
- Longueur d'un mur.
- Surface d'une pièce.
- Périmètre d'une pièce.
- Angle a chaque sommet de pièce.
- Orientation d'un mur.
- Distances gauche et droite entre une ouverture et les extremites de son mur support.
- Type intérieur ou extérieur d'un mur selon ses liaisons aux pièces.
- Compatibilite entre le type intérieur/extérieur d'un template d'ouverture et la qualification calculee du mur support.
- Orientation calculée de chaque face vers une pièce ou vers l'extérieur.
- Hauteur disponible à une abscisse du mur par interpolation du profil de la face concernée.

## Compatibilité des ouvertures avec les murs
- Le template porte explicitement la caractéristique `intérieur` ou `extérieur`; elle n'est pas déduite du mur au moment de la pose.
- La qualification d'un mur est calculée uniquement depuis ses liaisons: un mur lié à deux pièces est intérieur, un mur lié à une pièce est extérieur.
- Un template intérieur est admissible uniquement sur un mur intérieur.
- Un template extérieur est admissible uniquement sur un mur extérieur.
- Cette validation ne recherche pas deux murs distincts adjacents, colinéaires ou superposés.
- Aucune tolérance géométrique ni règle de recouvrement partiel n'intervient dans cette qualification.

## Convention de longueur de mur
- Le rendu du plan doit tenir compte de l'epaisseur des murs dans l'affichage des segments muraux.
- La longueur metier de reference d'un mur est sa longueur interieure.
- La longueur interieure d'un mur dans une pièce correspond a la mesure exterieure du segment support, diminuee des epaisseurs des murs lies a ses extremites du cote intérieur de la pièce.
- Les longueurs affichees sur le canvas et exportees utilisent cette longueur interieure comme valeur de reference, sauf mention contraire explicite.
- Lorsqu'un mur est partage par deux pièces, la longueur interieure se calcule relativement a la pièce et au cote intérieur consideres.

## Transformations et topologie
- Creation d'une pièce polygonale a partir d'une saisie rectangulaire initiale.
- Creation d'un mur par deux points.
	- son épaisseur et les hauteurs d'extrémité de ses deux profils sont initialisées depuis les préférences de mur par défaut de l'utilisateur courant;
	- en l'absence de préférences enregistrées, les valeurs initiales sont `10 cm` et `250 cm`.
- Deplacement d'un point, d'un mur, d'une pièce, d'une ouverture ou d'une cote sans rupture des invariants.
- Creation d'un mur intérieur coupant une pièce en deux avec generation automatique d'une nouvelle pièce.
	- cette capacite géométrique peut etre restreinte par la vue consommatrice; RoomEditor2DView interdit explicitement ce cas.
- Repositionnement du decalage d'une cote.
- Detachement d'un mur de son ancrage.
- Coupe d'un mur en deux.
- Placement d'une ouverture sur un mur support.
- Lorsque le lien est inactif, ajout, déplacement, modification ou suppression d'un point de profil sur une face sans modifier le profil de l'autre face.
- Ajout, déplacement, modification ou suppression simultanée du point correspondant sur les deux faces lorsque leur lien est actif.

## Règles de scission et d'intersection
- Si l'extremite d'un mur est posee sur un mur existant, le mur support est scinde au point d'ancrage et le nouveau mur est lie a ce point.
- Si le mur d'une troisième pièce rejoint l'intérieur d'un mur existant, le point de jonction devient un sommet partagé, le mur existant est scindé en deux murs et le mur aboutissant constitue le troisième mur autour de ce sommet.
- Une telle jonction est toujours représentée par trois murs distincts; elle ne doit jamais produire un mur unique lié à trois pièces.
- L'operation "Couper en deux" créé deux segments colineaires partageant le point de coupe. Le mur de gauche garde le focus fonctionnel, le mur de droite reprend les memes proprietes.
- Si des murs se croisent sur un meme niveau, ils doivent etre scindes au point d'intersection pour produire des segments elementaires.
- Si des pièces se chevauchent sur un meme niveau, les murs concernes sont scindes aux intersections necessaires et la zone de chevauchement devient une nouvelle pièce.
- Si une pièce est supprimee, chaque mur precedemment mitoyen perd uniquement le lien vers cette pièce et conserve ses liens restants.
- Apres suppression d'une pièce, un mur conserve est requalifie extérieur/intérieur selon son nouveau nombre de pièces liees.
- Après toute modification topologique, les ouvertures du mur sont revérifiées; toute ouverture dont la caractéristique intérieur/extérieur ne correspond plus à la qualification du mur est supprimée.

## Cas limites et validations
- Refuser une ouverture hors du mur support.
- Refuser un profil sans point aux deux extrémités, non ordonné, hors des bornes du mur ou contenant une hauteur non positive.
- Refuser une modification de profil qui rend une ouverture existante incompatible avec l'une des deux faces.
- Refuser toute persistance partielle qui rendrait différents deux profils dont le lien est actif.
- Refuser deux ouvertures chevauchantes sur un meme mur.
- Refuser la pose d'un template intérieur sur un mur extérieur et d'un template extérieur sur un mur intérieur.
- Refuser une cote de longueur nulle.
- Refuser la suppression d'un mur tant qu'il reste lie a au moins une pièce.
- Recalculer les segments elementaires apres toute coupe, intersection ou creation d'ancrage sur mur.
- Recalculer les relations mur-pièce apres toute modification topologique.
- Refuser toute topologie qui lierait un même mur à trois pièces; appliquer la scission au point de jonction avant persistance.
- Supprimer les ouvertures devenues incompatibles après le recalcul des relations mur-pièce.

## Algorithmes attendus
- Distance entre deux points.
- Projection d'un point sur un segment.
- Detection d'intersection entre segments.
- Decoupe d'un segment par un point d'intersection ou de coupe.
- Normalisation d'une jonction en T par création d'un sommet partagé et de trois segments élémentaires.
- Surface de polygone par formule du shoelace.
- Périmètre de polygone.
- Angle entre trois points.
- Verification d'appartenance d'une ouverture a son mur support.
- Verification de non-chevauchement entre ouvertures d'un meme mur.
- Verification de compatibilité entre la caractéristique du template d'ouverture et le nombre de pièces liées au mur support.
- Interpolation de la hauteur disponible entre deux points consécutifs d'un profil de face.

## Conventions des primitives V1
- La projection d'un point sur un segment est bornée aux deux extrémités; pour un segment de longueur nulle, elle retourne son point unique.
- L'orientation d'un polygone utilise le repère cartésien: aire signée positive pour le sens antihoraire, négative pour le sens horaire et nulle pour un polygone dégénéré.
- L'orientation d'un segment est exprimée en degrés dans l'intervalle `[0, 360[` depuis l'axe horizontal positif; elle est indéfinie pour un segment de longueur nulle.
- Le centroïde d'un polygone non dégénéré est son centroïde surfacique; pour un polygone dégénéré, le barycentre de ses sommets est utilisé.
- Les angles intérieurs tiennent compte de la concavité et sont compris entre `0` et `360` degrés; ils valent `0` lorsque le polygone est dégénéré.
- La longueur intérieure ne peut pas être négative après déduction des épaisseurs des murs liés aux deux extrémités.

## Unite metier
Le centimetre est l'unite metier de reference pour la base, les calculs et les affichages de mesure. Le m2 est l'unite metier de reference pour les surfaces. Les conversions d'unite sont effectuees a l'affichage selon le contexte utilisateur.
