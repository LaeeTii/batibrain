# Composants - Canvas

## Objectif
- Definir le comportement des composants de rendu plan, de rendu mural de face, de mesures et de navigation visuelle des éditeurs à canvas.

## Liste des composants
- Canvas2D
- CanvasOverlayMeasurements
- CanvasZoomControls
- CanvasScaleIndicator
- CanvasSnappingOptionsMenu
- WallElevationCanvas

## Technologie de rendu
- Le moteur de rendu et d'interaction des canvas est React-Konva (`react-konva` + `konva`) pour:
	- Canvas2D,
	- WallElevationCanvas,
	- les canvas de plan de niveau et de pièce.
- La bascule est directe: aucun nouveau comportement canvas ne doit être implémenté en SVG.
- Les coordonnées métier restent exprimées en centimètres dans le repère du niveau; le canvas applique uniquement une projection visuelle (zoom, pan, reset) sans modifier les données métier.
- Les valeurs visibles et saisies sont converties dans les unités préférées par l'utilisateur; cette conversion n'altère jamais les coordonnées internes en centimètres ni les surfaces internes en centimètres carrés.

## Responsabilites
- Canvas2D:
	- Rendre les objets du niveau actif et des niveaux visibles.
	- Gerer les interactions de sélection, de creation et de deplacement selon le mode courant.
- CanvasOverlayMeasurements:
	- Afficher côtes, angles et annotations selon options d'affichage et mode d'édition.
- CanvasZoomControls:
	- Fournir zoom, dezoom et reset de zoom.
- CanvasScaleIndicator:
	- Afficher une echelle graphique stable et lisible.
- CanvasSnappingOptionsMenu:
	- Exposer les sources de magnétisme grille, sommets, intersections, murs, milieux et guides orthogonaux ainsi que la distance de capture en centimètres.
- WallElevationCanvas:
	- Rendre de face le contour produit par le profil de hauteur de la face sélectionnée.
	- Afficher les ouvertures du mur et les mesures horizontales et verticales pertinentes.
	- Permettre l'édition des points du profil dans WallEditorView selon les droits effectifs.

## Props et contrat
- Contexte requis:
	- niveau actif,
	- niveaux visibles,
	- objet selectionne,
	- mode d'édition courant.
- Données d'entree:
	- geometres des objets metier,
	- options d'affichage (affichage/masquage: grille, règles, côtes, angles, notes, surfaces, icônes de pièces),
	- options de magnetisme (snapping).
- Sorties et callbacks:
	- sélection d'objet,
	- deplacement/creation/suppression selon mode,
	- changements de zoom,
	- interaction avec l'overlay de mesures.

## Etats et interactions
- Le niveau actif est editable; les autres niveaux visibles sont en contexte non editable.
- La sélection utilisateur dans le canvas est synchronisee vers panneaux et détail tree.
- Une poignée de sommet reste centrée sur le sommet métier correspondant pendant et après son déplacement, y compris avec zoom, panoramique et magnétisme actifs.
- Le déplacement d'un sommet prévisualise la géométrie pendant le glissé, puis enregistre sa position finale au relâchement dans une seule action d'historique dont l'état d'annulation est celui précédant l'appui.
- Le magnétisme des sommets s'applique aussi aux poignées des murs autonomes; au relâchement sur un autre sommet autonome, les deux sommets sont fusionnés et un contour simple ainsi refermé redevient une pièce.
- Lorsque les guides orthogonaux sont actifs, un point déplacé ou créé s'accroche séparément à l'abscisse et à l'ordonnée des sommets de référence situés dans la distance de capture.
- Chaque accrochage orthogonal affiche pendant le geste une ligne temporaire bleue et pointillée, verticale ou horizontale; deux guides simultanés permettent de former un angle droit avec les segments voisins alignés.
- Les guides disparaissent au relâchement, à la sortie du canvas ou à la fin du mode de création et ne sont jamais persistés dans la géométrie.
- Les mesures en focus restent visibles en édition meme si l'option globale correspondante est decochee.
- Les controles de zoom restent disponibles en permanence dans la zone canvas.
- Lorsqu'elle est active, la grille couvre toute la surface visible du canvas, quel que soit son ratio largeur/hauteur.
- Le pas de la grille est fixe et représente `5 cm` dans le repère métier.
- Au premier affichage d'une géométrie et lors de la réinitialisation du zoom, le viewport est centré sur le milieu de son emprise géométrique, indépendamment de l'origine `(0, 0)` de la grille.
- Le viewport est un état visuel de session: aucune interaction d'édition (création, déplacement, sélection) ne doit forcer un recadrage automatique.
- Hors geste de création actif, un clic simple sur le fond du plan signale la fermeture de la sélection et des contextes de création ou d'édition à la vue consommatrice.
- Un déplacement du fond au-delà du seuil de clic reste un panoramique et ne déclenche jamais cette fermeture.
- Un clic droit sur un sommet du plan ouvre un menu avec `Verrouiller` ou `Déverrouiller` et `Supprimer`; sur un point de profil, il ouvre l'action `Verrouiller` ou `Déverrouiller`.
- La suppression d'un sommet est indisponible lorsqu'il est verrouillé ou lorsque la pièce ne conserverait pas au moins trois sommets.
- Une tentative de déplacement d'un point verrouillé est refusée avant toute mutation visuelle ou du brouillon.

## Iconographie
- Zoom avant: `LuZoomIn`, icône seule.
- Zoom arrière: `LuZoomOut`, icône seule.
- Réinitialiser le zoom: `LuScan`, icône seule.
- Les options d'affichage conservent un libellé visible dans leur liste ou leur menu:
	- grille: `LuGrid3X3`;
	- règles: `LuRuler`;
	- côtes: `LuBetweenHorizontalStart`;
	- angles: `LuDraftingCompass`;
	- notes: `LuStickyNote`;
	- surfaces: `LuScan`;
	- icônes de pièces: `LuShapes`.
- Magnétisme (snapping): `LuMagnet`, icône + texte dans les options de l'éditeur.
- Une option masquée utilise `LuEyeOff` en complément de son libellé et de son état accessible.
- Rendu multi-niveaux:
	- le niveau actif conserve son rendu complet et interactif,
	- les niveaux inferieurs et superieurs coches sont rendus en filigrane non interactif,
	- le filigrane reprend le rendu de contexte de RoomEditor2DView: couleur de sol atténuée, contour gris pointillé, nom de la pièce et opacité réduite,
	- l'ordre de superposition suit l'altitude croissante: un niveau d'altitude inférieure est rendu dessous et un niveau d'altitude supérieure est rendu par-dessus le niveau actif,
	- les objets détaillés, mesures, surfaces, icônes et notes des niveaux en filigrane ne sont pas rendus.
- Rendu des notes:
	- les notes liees au niveau actif sont affichees a 100% d'opacite,
	- les notes des autres niveaux coches ne sont pas affichées dans leur filigrane simplifié,
	- une note est representee par une bulle et un icone relies a son objet.

## Règles metier
- Les unités de mesure affichées suivent les préférences utilisateur, préconfigurées en `cm` pour les longueurs et `m2` pour les surfaces.
- Les longueurs et annotations doivent suivre les règles du contrat géométrique.
- Les règles de synchronisation de sélection ne sont pas redefinies ici et sont referencees depuis la logique dediee.
- Les icônes de pièces sont affichées par défaut sur tous les canvas.
- Chaque polygone de pièce utilise sa couleur de sol configurée comme couleur de remplissage du plan.
- Un mur mitoyen est rendu une seule fois à partir de son identifiant unique, même lorsqu’il apparaît dans les relations de ses deux pièces.
- Un mur calculé verrouillé est affiché en rouge sur le plan.
- Une pièce calculée verrouillée affiche un cadenas à côté de son nom.
- L'icône est dérivée du type par le frontend avec `react-icons` et n'est pas persistée.
- Elle est affichée sous le nom et la surface; le type `autre` ne produit aucune icône.
- L'option Icônes de pièces masque ou réaffiche toutes les icônes du canvas courant.
- Les surfaces sont affichées par défaut; l'option Surfaces masque ou réaffiche les valeurs de surface sur le canvas courant.
- Règles d'affichage des mesures:
	- en mode sans édition, côtes cochees: afficher longueurs exterieures du niveau actif,
	- en mode sans édition, côtes cochees: afficher longueurs interieures des pièces,
	- en mode sans édition, angles coches: afficher uniquement les angles differents de 90 degres,
	- en mode sans édition, côtes cochees: afficher les côtes manuelles,
	- en mode sans édition, côtes cochees: afficher distances horizontales des ouvertures,
	- en mode sans édition, côtes cochees: pour chaque fenêtre, afficher allège/hauteur.
- Règles de focus en édition:
	- en édition Pièce, Mur ou Ouverture, les mesures directement liees a l'objet restent prioritaires et visibles,
	- les autres mesures restent visibles mais attenuees si l'option globale correspondante reste active,
	- en édition d'ouverture, les distances gauche/droite restent toujours visibles,
	- en édition de fenêtre, l'annotation allège/hauteur reste toujours visible.
- Règles de prévisualisation des ouvertures:
	- un template intérieur affiche sa prévisualisation et ses mesures uniquement sur un mur lié à deux pièces,
	- un template extérieur affiche sa prévisualisation et ses mesures uniquement sur un mur lié à une pièce,
	- au survol d'un mur incompatible, aucune prévisualisation ni mesure liée à l'ouverture n'est rendue.
- Règles de la vue de face:
	- une seule face du mur est active et éditable à la fois; le profil de la face opposée reste visible en filigrane non interactif et le changement de face conserve le zoom et le mur sélectionné,
	- le contour supérieur relie dans l'ordre les points du profil de la face active,
	- les deux extrémités du profil et leurs hauteurs sont toujours visibles en mode édition,
	- les verticales gauche et droite du mur sont rendues en trait plein, tandis que les verticales des points intermédiaires sont rendues en pointillé,
	- les ouvertures sont projetées à leur position sur le mur et leurs largeur, hauteur, allège et distances aux extrémités peuvent être cotées,
	- lorsque le lien des profils est inactif, le profil de la face opposée n'est jamais modifié indirectement,
	- lorsque le lien est actif, toute modification graphique du profil courant est répercutée sur le profil opposé dans la même action métier.
	- lorsque le lien est actif, le verrouillage ou le déverrouillage d'un point est également répercuté sur le point correspondant du profil opposé.
	- un point de profil verrouillé reste sélectionnable mais ne peut pas être déplacé.

## Cas limites
- Tentative de creation/édition hors mode actif: aucune modification persistante ne doit etre appliquee.
- Objet devenu invalide pendant interaction: retour a un etat stable avec message d'erreur.
- Échec de persistance après action: le brouillon local et le contexte visuel sont conservés; un seul message d'erreur non redondant est affiché et la persistance est retentée selon le contrat transverse.
- Si l'objet selectionne appartient a un niveau non editable, le canvas conserve l'affichage contextuel sans autoriser l'édition directe.
- Si une interaction géométrique affecterait un sommet ou un point de profil verrouillé, elle est refusée sans déplacement temporaire ni historique partiel.
- Si aucune option de mesure n'est activee, l'echelle graphique reste visible en continu.

## Criteres d'acceptation testables
- Given plusieurs niveaux sont coches, When le canvas est affiche, Then seul le niveau actif est editable et les autres restent en contexte visuel.
- Given les icônes de pièces sont activées, When une pièce possède un type différent de `autre`, Then l'icône dérivée est affichée sous son nom et sa surface.
- Given une pièce possède une couleur de sol configurée, When elle est rendue dans le plan, Then son polygone utilise cette couleur de remplissage.
- Given l'option Icônes de pièces est désactivée, When le canvas est rendu, Then aucune icône de pièce n'est affichée.
- Given l'option Surfaces est désactivée, When le canvas est rendu, Then aucune valeur de surface de pièce n'est affichée.
- Given une ouverture est en cours d'édition, When les options de côtes sont masquees, Then les distances directement liees a l'ouverture restent visibles.
- Given un template d'ouverture est en cours de pose, When un mur incompatible est survolé, Then aucun aperçu ni mesure de positionnement n'est affiché.
- Given l'utilisateur clique sur un objet visible, When la sélection est appliquee, Then l'objet est surligne dans le canvas et propage vers les autres zones.
- Given une sélection ou un bloc de création est ouvert, When l'utilisateur clique simplement sur le fond hors objet, Then la sélection et tous les blocs de création ou d'édition sont fermés.
- Given une sélection ou un bloc de création est ouvert, When l'utilisateur maintient le clic et déplace le fond, Then le plan est déplacé sans fermer le contexte courant.
- Given un sommet est déplacé par plusieurs mouvements successifs du pointeur, When l'utilisateur relâche le clic, Then une seule action est ajoutée à l'historique, Annuler restaure l'état précédant l'appui et Rétablir restaure la position finale.
- Given l'éditeur 2D est affiché, When l'utilisateur ouvre `Magnétisme` à côté d'`Affichage`, Then les six sources et la distance de capture sont modifiables et appliquées aux déplacements et créations suivants.
- Given les guides orthogonaux sont actifs, When un sommet est déplacé à proximité de l'abscisse ou de l'ordonnée d'un autre sommet, Then sa coordonnée correspondante est alignée et un guide vertical ou horizontal est affiché pendant le geste.
- Given les guides orthogonaux sont actifs, When un sommet est simultanément proche de l'abscisse d'un sommet voisin et de l'ordonnée de l'autre sommet voisin, Then les deux coordonnées sont alignées et les deux segments adjacents forment un angle droit.
- Given un mur est lié à deux pièces visibles, When le niveau est rendu, Then un seul segment mural interactif est affiché pour cet identifiant.
- Given une géométrie dont l'emprise est éloignée de l'origine de la grille, When le canvas l'affiche pour la première fois, Then le milieu de l'emprise géométrique est au centre du viewport.
- Given l'utilisateur clique sur reset zoom, When l'action est terminee, Then le niveau de zoom revient a sa valeur initiale.
- Given WallEditorView affiche une face, When l'utilisateur choisit l'autre face, Then le canvas rend le profil propre à cette face sans changer le mur sélectionné.
- Given WallEditorView affiche une face, When le canvas est rendu, Then le profil opposé apparaît en filigrane atténué et pointillé derrière le profil actif sans intercepter les interactions.
- Given le profil affiché comporte des points intermédiaires, When le canvas est rendu, Then les verticales gauche et droite sont en trait plein et les guides verticaux intermédiaires sont en pointillé.
- Given une ouverture dépasse la hauteur disponible sur une face, When une modification de profil est validée, Then la modification est refusée avec un message explicite.
- Given les profils sont liés, When un point est ajouté ou déplacé sur le canvas, Then le point correspondant est ajouté ou déplacé à la même position et hauteur sur l'autre face.
- Given un sommet du plan est verrouillé, When l'utilisateur commence un glisser-déposer, Then le sommet ne se déplace pas et le brouillon reste inchangé.
- Given un sommet déverrouillé est éditable, When l'utilisateur ouvre son menu au clic droit, Then les actions de verrouillage et de suppression sont visibles.
- Given un sommet éditable appartient à un contour de plus de trois sommets, When l'utilisateur choisit `Supprimer`, Then le sommet disparaît et le mur résultant relie ses voisins immédiats.
- Given un mur a ses deux sommets verrouillés, When le plan est rendu, Then le mur apparaît en rouge.
- Given tous les murs d'une pièce sont verrouillés, When son nom est rendu, Then un cadenas est affiché à côté de celui-ci.
- Given les profils sont liés, When un point est verrouillé sur une face, Then le point correspondant de l'autre face reçoit le même état.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Vue mur associée : [wall_editor_view.md](../vues/wall_editor_view.md)
- Logique sélection : [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)
- Verrouillage géométrique : [verrouillage_geometrique.md](../logique/verrouillage_geometrique.md)

## État d’implémentation V1-21
- `Canvas2D`, `CanvasOverlayMeasurements`, `CanvasZoomControls`, `CanvasScaleIndicator` et les contrôles partagés `Affichage` et `Magnétisme` sont disponibles.
- Le viewport de navigation est un état visuel indépendant : zoom, panoramique et réinitialisation ne modifient jamais les coordonnées métier reçues en entrée.
- `GlobalEditor2DView` utilise dès V1-21 le canvas partagé pour la consultation multi-niveaux et les options d’affichage; ses panneaux, états complets et interactions de sélection restent à intégrer dans les tâches suivantes.

## État d’implémentation V1-R11
- Les mesures du canvas partagé sont formatées dans l’unité de longueur active et les surfaces dans l’unité de surface active, sans modifier les valeurs métier en cm et cm².
- Les sept options d’affichage du canvas global sont relues et enregistrées dans `editor_view_settings` pour le couple utilisateur-projet courant.
- Les six sources de magnétisme, dont les guides orthogonaux, et la distance de capture sont relues, appliquées et enregistrées dans `editor_view_settings` pour le même couple utilisateur-projet.
- Les changements d’options sont sérialisés afin qu’une réponse réseau tardive ne puisse pas rétablir une ancienne sélection.
- Les canvas, éditeurs et exports à finaliser dans V1-R20, V1-R30 et V1-R31 consomment le même contrat d’unités et d’options au lieu de définir leurs propres conversions.

## État d’implémentation V1-R20

- GlobalEditor2DView et RoomEditor2DView utilisent `Canvas2D`; le canvas SVG historique n’est plus présent dans le parcours d’édition par pièce.
- GlobalEditor2DView rend les autres niveaux cochés avec le même filigrane non interactif que les pièces de contexte de RoomEditor2DView; leur ordre de superposition suit leur altitude et tous les niveaux visibles participent au cadrage global.
- RoomEditor2DView projette la pièce courante comme contenu principal de `Canvas2D`; les autres pièces restent dans le brouillon canonique du niveau et peuvent être projetées en filigrane non interactif, sans participer au cadrage.
- WallEditorView utilise `WallElevationCanvas` React-Konva avec les mêmes contrôles de zoom et d’échelle.
- Les trois éditeurs partagent le contrat de brouillon, l’historique limité à vingt actions, la sauvegarde manuelle, l’auto-sauvegarde toutes les cinq minutes et la conservation du brouillon en échec.
- Les clics droits sur les sommets du plan ouvrent les actions de verrouillage et de suppression; ceux sur les points de profil pilotent leurs verrous persistés selon les droits du projet.
