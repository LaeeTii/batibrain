# Contrat géométrique

Date de mise à jour: 2026-07-20

## Périmètre du document
- Ce document decrit les objets geometriques, leurs invariants, leurs calculs, leurs transformations et leurs cas limites.
- Les parcours utilisateur, les panneaux, les modes d'édition et les règles d'interaction appartiennent a [editeur_2d_global.md](../vues/editeur_2d_global.md).
- Les règles de synchronisation de sélection et d'ouverture des panneaux appartiennent a [edition_2D_synchronisation_selection.md](./edition_2D_synchronisation_selection.md).
- Les règles de verrouillage des sommets, murs, pièces, côtes et profils appartiennent à [verrouillage_geometrique.md](./verrouillage_geometrique.md).

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
- Le brouillon canonique complet est recalculé dès chaque création ou transformation locale; une sauvegarde préalable n'est jamais nécessaire pour utiliser une action topologique sur un objet nouvellement créé.
- Une pièce est modelisee comme un polygone ordonne de sommets.
- Un sommet possède une identité topologique unique dans le niveau et peut être partagé par plusieurs murs ou contours de pièces.
- Le rectangle dessine en 2 clics dans l'IHM est une modalite de creation initiale d'une pièce polygonale a 4 sommets.
- Un mur est une entité topologique autonome modélisée comme un segment épais ordonné défini par deux points.
- Chaque segment entre deux sommets consécutifs du contour d'une pièce référence le mur qui matérialise cette frontière; le mur peut néanmoins exister sans liaison à une pièce.
- Une ouverture est definie relativement a son mur support.
- Une cote est rattachee a un niveau et a deux references de mesure.

## Invariants
- L'ordre des sommets d'une pièce doit rester stable afin de permettre le calcul fiable des murs, angles, surfaces et perimetres.
- Une pièce possède au moins trois sommets aux coordonnées finies, ordonnés de manière unique et continue à partir de zéro.
- La fermeture d'une pièce est implicite entre son dernier et son premier sommet; le premier sommet n'est pas dupliqué en fin de liste.
- Le contour d'une pièce ne peut pas s'auto-intersecter.
- Le déplacement d'un sommet sur un sommet consécutif du même contour fusionne les deux sommets, retire le mur devenu nul et réordonne le contour sans doublon.
- Le déplacement d'un sommet sur un sommet d'une autre pièce crée un sommet partagé unique dans les deux projections.
- La suppression directe d'un sommet déverrouillé retire ce sommet du contour et remplace ses deux murs adjacents par un unique mur reliant le sommet précédent au sommet suivant.
- Le mur entrant conserve son identité et ses propriétés lorsqu'il n'est pas partagé; s'il est partagé avec une autre pièce, la nouvelle frontière reçoit une identité propre afin de laisser la géométrie voisine inchangée.
- Deux sommets non consécutifs d'une même pièce ne sont pas fusionnés automatiquement, car cette opération scinderait le contour; l'interaction est refusée avant mutation.
- Une fusion est refusée si elle supprimerait un mur portant une ouverture ou si elle réduirait la pièce à moins de trois sommets.
- Une suppression directe de sommet est refusée si la pièce serait réduite à moins de trois sommets, si le sommet est verrouillé, si un profil verrouillé devrait être modifié ou si l'un des murs adjacents porte une ouverture.
- Une nouvelle pièce rectangulaire utilise les deux points saisis pour déterminer sa largeur et sa profondeur; aucune dimension n'est appliquée par défaut. Elle utilise le nom `Nouvelle pièce` si aucun nom n'est fourni, le type `autre` et la couleur de sol `#E5FFFC`.
- Un mur peut exister seul ou etre lie a une ou deux pièces.
- Un mur ne peut jamais être lié à trois pièces.
- Un mur lie a une seule pièce est extérieur pour cette pièce.
- Un mur lie a deux pièces differentes est intérieur pour les deux pièces.
- Un mur sans liaison est qualifié de détaché; cette qualification complète les états extérieur et intérieur sans être persistée.
- Une transformation topologique est refusée dans son ensemble si elle doit déplacer, remplacer ou supprimer un sommet verrouillé.
- Chaque mur possède exactement deux faces et deux profils de hauteur propres, liés par défaut et dissociables.
- Les faces stables sont toujours ordonnées `gauche`, puis `droite`, relativement au segment orienté du sommet de début vers le sommet de fin.
- Chaque profil est une liste de points ordonnée par leur distance depuis le début du segment; à la création, sa hauteur est uniforme et provient de la hauteur de mur par défaut de l'utilisateur courant.
- Deux murs consécutifs d'une même pièce partagent la hauteur de leur point d'extrémité commun, face intérieure avec face intérieure et face extérieure avec face extérieure.
- La modification d'une seule face à une extrémité commune ne modifie que la même face sémantique du mur voisin; lorsque les deux faces sont modifiées, les deux extrémités correspondantes du mur voisin sont synchronisées.
- Le lien entre profils est actif par défaut; lorsqu'il est actif, les deux profils possèdent exactement les mêmes positions et hauteurs.
- Toute modification effectuée avec le lien actif est répercutée atomiquement sur les deux faces.
- La désactivation du lien conserve les profils courants; leur édition devient indépendante.
- La remise en liaison copie le profil de la face affichée vers l'autre face après confirmation explicite.
- Pour un mur mitoyen, l'orientation de chaque face vers l'une des deux pièces est calculée depuis la topologie.
- Les projections locales d'un même mur mitoyen partagent toujours les deux mêmes profils physiques, face par face; une modification de profil est répercutée atomiquement dans toutes ses projections.
- Lorsque les deux pièces parcourent le mur mitoyen en sens opposés, la face gauche d'une projection correspond à la face droite de l'autre et les positions des points sont inversées depuis la nouvelle origine.
- Pour un mur extérieur, les faces intérieure et extérieure sont toutes deux éditables.
- Si le sens du segment est inversé par une transformation topologique, les profils sont permutés afin de rester attachés à la même face physique.
- Lors de cette inversion, les distances des points sont recalculées depuis la nouvelle origine du segment (`nouvelle distance = longueur du mur - ancienne distance`) et leur ordre est inversé.
- Lorsque la longueur d’un mur change sans inversion, les distances de ses points de profils sont recalculées proportionnellement sur la nouvelle longueur; leurs identifiants et hauteurs sont conservés.
- Si ce recalage devait modifier la distance d’un point de profil verrouillé, le déplacement du sommet ou du mur est refusé avant toute mutation du brouillon.
- L'édition géométrique d'un mur mitoyen doit impacter de facon coherente les deux pièces liees a ce mur.
- L'état verrouillé d'un mur est calculé depuis ses deux sommets; l'état verrouillé d'une pièce est calculé depuis tous les murs de son contour.
- Un mur n'est supprimable que lorsqu'il n'est plus lie a aucune pièce.
- Une ouverture doit rester entierement comprise dans son mur support.
- Les ouvertures d'un meme mur ne doivent pas se chevaucher.
- La hauteur utile d'une ouverture doit rester compatible avec la hauteur disponible du mur support.
- La hauteur utile d'une ouverture doit être compatible avec le profil disponible sur chacune des deux faces du mur.
- La hauteur disponible sous une ouverture est contrôlée à ses deux extrémités et à chaque point intermédiaire de chacun des deux profils compris dans sa largeur.
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
- Les pièces adjacentes à une ouverture sont exactement les pièces liées à son unique mur support lorsque sa caractéristique intérieur/extérieur est compatible.

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
- Suppression d'un sommet du contour avec raccordement du mur entre ses voisins immédiats.
- Creation d'un mur intérieur coupant une pièce en deux avec generation automatique d'une nouvelle pièce.
	- cette capacite géométrique peut etre restreinte par la vue consommatrice; RoomEditor2DView interdit explicitement ce cas.
- Repositionnement du decalage d'une cote.
- Detachement d'un mur de son ancrage.
- Coupe d'un mur en deux.
- Placement d'une ouverture sur un mur support.
- Lorsque le lien est inactif, ajout, déplacement, modification ou suppression d'un point de profil sur une face sans modifier le profil de l'autre face.
- Ajout, déplacement, modification ou suppression simultanée du point correspondant sur les deux faces lorsque leur lien est actif.
- Toute transformation géométrique interroge le verrou des points affectés avant la première mutation du brouillon.

## Règles de scission et d'intersection
- Si l'extremite d'un mur est posee sur un mur existant, le mur support est scinde au point d'ancrage et le nouveau mur est lie a ce point.
- Si le mur d'une troisième pièce rejoint l'intérieur d'un mur existant, le point de jonction devient un sommet partagé, le mur existant est scindé en deux murs et le mur aboutissant constitue le troisième mur autour de ce sommet.
- Une telle jonction est toujours représentée par trois murs distincts; elle ne doit jamais produire un mur unique lié à trois pièces.
- Lors de cette scission, la première moitié conserve l'identité du mur support, la seconde reçoit une nouvelle identité et les deux recopient ses propriétés et relations; le mur aboutissant conserve les siennes.
- L'operation "Couper en deux" créé deux segments colineaires partageant le point de coupe. Le mur de gauche garde le focus fonctionnel, le mur de droite reprend les memes proprietes.
- L'opération `Détacher` remplace l'extrémité choisie du mur par un nouveau sommet à la position indiquée, sans déplacer le sommet d'ancrage ni les murs voisins.
- Chaque pièce liée au mur détaché perd son contour fermé et est supprimée; tous ses murs sont conservés au niveau, perdent uniquement cette liaison et deviennent autonomes s'ils ne sont liés à aucune autre pièce.
- Les sommets des murs autonomes restent des objets géométriques sélectionnables et déplaçables; le déplacement d'un sommet partagé propage sa position à tous les murs autonomes qui le référencent.
- Lorsqu'un sommet autonome est capturé sur un autre sommet autonome par le magnétisme des sommets, leurs identités sont fusionnées et tous les murs incidents sont raccordés à l'unique sommet conservé.
- Si ce raccordement ferme un composant simple d'au moins trois murs, sans branche ni auto-intersection, ce cycle devient le contour ordonné d'une nouvelle pièce et chacun de ses murs reçoit la liaison vers cette pièce.
- Les ouvertures devenues incompatibles avec la nouvelle qualification de leur mur sont supprimées dans la même transaction.
- Si des murs se croisent sur un meme niveau, ils doivent etre scindes au point d'intersection pour produire des segments elementaires.
- Si des pièces se chevauchent sur un meme niveau, les murs concernes sont scindes aux intersections necessaires et la zone de chevauchement devient une nouvelle pièce.
- Avant toute scission, intersection ou création de pièce issue d'un chevauchement, tous les sommets affectés sont contrôlés; la présence d'un sommet verrouillé annule l'opération avant toute mutation du brouillon.
- Si une pièce est supprimee, chaque mur precedemment mitoyen perd uniquement le lien vers cette pièce et conserve ses liens restants.
- Apres suppression d'une pièce, un mur conserve est requalifie extérieur/intérieur selon son nouveau nombre de pièces liees.
- Après toute modification topologique, les ouvertures du mur sont revérifiées; toute ouverture dont la caractéristique intérieur/extérieur ne correspond plus à la qualification du mur est supprimée.

## Cas limites et validations
- Refuser une ouverture hors du mur support.
- Refuser un profil sans point aux deux extrémités, non ordonné, hors des bornes du mur ou contenant une hauteur non positive.
- Refuser une modification de profil qui rend une ouverture existante incompatible avec l'une des deux faces.
- Refuser toute persistance partielle qui rendrait différents deux profils dont le lien est actif.
- Refuser une remise en liaison non confirmée; après confirmation, le profil de la face affichée devient la source copiée vers la face opposée.
- Refuser deux ouvertures chevauchantes sur un meme mur.
- Refuser la pose d'un template intérieur sur un mur extérieur et d'un template extérieur sur un mur intérieur.
- Refuser une cote de longueur nulle.
- Refuser la suppression d'un mur tant qu'il reste lie a au moins une pièce.
- Recalculer les segments elementaires apres toute coupe, intersection ou creation d'ancrage sur mur.
- Recalculer les relations mur-pièce apres toute modification topologique.
- Refuser toute topologie qui lierait un même mur à trois pièces; appliquer la scission au point de jonction avant persistance.
- Refuser atomiquement toute topologie qui déplacerait, remplacerait ou supprimerait un sommet verrouillé.
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
- Calcul de l'état verrouillé d'un mur, d'une pièce, d'une côte et d'un profil depuis leurs points.

## Conventions des primitives V1
- La projection d'un point sur un segment est bornée aux deux extrémités; pour un segment de longueur nulle, elle retourne son point unique.
- L'orientation d'un polygone utilise le repère cartésien: aire signée positive pour le sens antihoraire, négative pour le sens horaire et nulle pour un polygone dégénéré.
- L'orientation d'un segment est exprimée en degrés dans l'intervalle `[0, 360[` depuis l'axe horizontal positif; elle est indéfinie pour un segment de longueur nulle.
- Le centroïde d'un polygone non dégénéré est son centroïde surfacique; pour un polygone dégénéré, le barycentre de ses sommets est utilisé.
- Les angles intérieurs tiennent compte de la concavité et sont compris entre `0` et `360` degrés; ils valent `0` lorsque le polygone est dégénéré.
- La longueur intérieure ne peut pas être négative après déduction des épaisseurs des murs liés aux deux extrémités.

## Unités

- Les coordonnées et longueurs sont normalisées en centimètres dans la base et les calculs.
- Les surfaces sont calculées et normalisées en centimètres carrés.
- Les préférences de l'utilisateur déterminent les unités de saisie et d'affichage, avec `cm` pour les longueurs et `m2` pour les surfaces comme valeurs initiales.
- Toute saisie est convertie vers l'unité interne avant calcul ou persistance; changer de préférence ne réinterprète jamais les données existantes.
