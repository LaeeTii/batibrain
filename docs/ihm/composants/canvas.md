# Composants - Canvas

## Objectif
- Definir le comportement des composants de rendu plan, de rendu mural de face, de mesures et de navigation visuelle des éditeurs à canvas.

## Liste des composants
- Canvas2D
- CanvasOverlayMeasurements
- CanvasZoomControls
- CanvasScaleIndicator
- WallElevationCanvas

## Technologie de rendu
- Le moteur de rendu et d'interaction des canvas est React-Konva (`react-konva` + `konva`) pour:
	- Canvas2D,
	- WallElevationCanvas,
	- les canvas de plan de niveau et de pièce.
- La bascule est directe: aucun nouveau comportement canvas ne doit être implémenté en SVG.
- Les coordonnées métier restent exprimées en centimètres dans le repère du niveau; le canvas applique uniquement une projection visuelle (zoom, pan, reset) sans modifier les données métier.

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
- Les mesures en focus restent visibles en édition meme si l'option globale correspondante est decochee.
- Les controles de zoom restent disponibles en permanence dans la zone canvas.
- Le viewport est un état visuel de session: aucune interaction d'édition (création, déplacement, sélection) ne doit forcer un recadrage automatique.

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
	- les niveaux inferieurs et superieurs coches sont visibles mais non editables,
	- les niveaux inferieurs utilisent une teinte gris/rose,
	- les niveaux superieurs utilisent une teinte gris/bleu,
	- l'opacite varie de -20% par ecart de niveau.
- Rendu des notes:
	- les notes liees au niveau actif sont affichees a 100% d'opacite,
	- les notes des autres niveaux coches sont affichees avec opacite reduite,
	- une note est representee par une bulle et un icone relies a son objet.

## Règles metier
- Les unites de mesure affichees sont en cm pour les longueurs et en m2 pour les surfaces.
- Les longueurs et annotations doivent suivre les règles du contrat géométrique.
- Les règles de synchronisation de sélection ne sont pas redefinies ici et sont referencees depuis la logique dediee.
- Les icônes de pièces sont affichées par défaut sur tous les canvas.
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
	- une seule face du mur est affichée à la fois et le changement de face conserve le zoom et le mur sélectionné,
	- le contour supérieur relie dans l'ordre les points du profil de la face active,
	- les deux extrémités du profil et leurs hauteurs sont toujours visibles en mode édition,
	- les ouvertures sont projetées à leur position sur le mur et leurs largeur, hauteur, allège et distances aux extrémités peuvent être cotées,
	- lorsque le lien des profils est inactif, le profil de la face opposée n'est jamais modifié indirectement,
	- lorsque le lien est actif, toute modification graphique du profil courant est répercutée sur le profil opposé dans la même action métier.

## Cas limites
- Tentative de creation/édition hors mode actif: aucune modification persistante ne doit etre appliquee.
- Objet devenu invalide pendant interaction: retour a un etat stable avec message d'erreur.
- Échec persistance apres action: rollback visuel conforme a la vue globale.
- Si l'objet selectionne appartient a un niveau non editable, le canvas conserve l'affichage contextuel sans autoriser l'édition directe.
- Si aucune option de mesure n'est activee, l'echelle graphique reste visible en continu.

## Criteres d'acceptation testables
- Given plusieurs niveaux sont coches, When le canvas est affiche, Then seul le niveau actif est editable et les autres restent en contexte visuel.
- Given les icônes de pièces sont activées, When une pièce possède un type différent de `autre`, Then l'icône dérivée est affichée sous son nom et sa surface.
- Given l'option Icônes de pièces est désactivée, When le canvas est rendu, Then aucune icône de pièce n'est affichée.
- Given l'option Surfaces est désactivée, When le canvas est rendu, Then aucune valeur de surface de pièce n'est affichée.
- Given une ouverture est en cours d'édition, When les options de côtes sont masquees, Then les distances directement liees a l'ouverture restent visibles.
- Given un template d'ouverture est en cours de pose, When un mur incompatible est survolé, Then aucun aperçu ni mesure de positionnement n'est affiché.
- Given l'utilisateur clique sur un objet visible, When la sélection est appliquee, Then l'objet est surligne dans le canvas et propage vers les autres zones.
- Given l'utilisateur clique sur reset zoom, When l'action est terminee, Then le niveau de zoom revient a sa valeur initiale.
- Given WallEditorView affiche une face, When l'utilisateur choisit l'autre face, Then le canvas rend le profil propre à cette face sans changer le mur sélectionné.
- Given une ouverture dépasse la hauteur disponible sur une face, When une modification de profil est validée, Then la modification est refusée avec un message explicite.
- Given les profils sont liés, When un point est ajouté ou déplacé sur le canvas, Then le point correspondant est ajouté ou déplacé à la même position et hauteur sur l'autre face.

## References
- Referentiel global : [ihm.md](../ihm.md)
- Vue associee : [editeur_2d_global.md](../vues/editeur_2d_global.md)
- Vue mur associée : [wall_editor_view.md](../vues/wall_editor_view.md)
- Logique sélection : [edition_2D_synchronisation_selection.md](../logique/edition_2D_synchronisation_selection.md)
- Logique géométrique : [geometry.md](../logique/geometry.md)

## État d’implémentation V1-21
- `Canvas2D`, `CanvasOverlayMeasurements`, `CanvasZoomControls`, `CanvasScaleIndicator` et le contrôle des options d’affichage sont disponibles comme composants partagés.
- Le viewport de navigation est un état visuel indépendant : zoom, panoramique et réinitialisation ne modifient jamais les coordonnées métier reçues en entrée.
- `GlobalEditor2DView` utilise dès V1-21 le canvas partagé pour la consultation multi-niveaux et les options d’affichage; ses panneaux, états complets et interactions de sélection restent à intégrer dans les tâches suivantes.
