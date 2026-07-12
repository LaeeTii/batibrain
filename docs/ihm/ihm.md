# Plan UI

## Liste des vues
- LoginView
- DashboardView
- GlobalEditor2DView
- ProjectMetricsView
- PhotosView
- DocumentsView
- WorksView
- TasksView
- PlanningView
- RoomEditor2DView
- WallEditorView


## Liste des composants metier

### Layouts
- DashboardLayout
- Note: a ce stade, DashboardLayout est documente en mode leger car son usage est specifique a DashboardView. Une spec transverse complete sera faite si la reutilisation multi-vues est confirmee.

### Panels
- EditorCreationPanel
- EditorDetailPanel
- Note: EditorDetailPanel est le conteneur du panneau de détail; le contrat detaille du tree interne est documente dans [composants/transverses.md](./composants/transverses.md).

### Sections
- LevelsSection
- RoomsSection
- WallsSection
- OpeningsSection
- DimensionsSection
- NotesSection
- Note: les contrats fonctionnels detailles (champs, valeurs par defaut, modes, actions) sont documentes dans [composants/sections.md](./composants/sections.md).

### Canvas
- Canvas2D
- CanvasOverlayMeasurements
- CanvasZoomControls
- CanvasScaleIndicator
- Note: les règles fines de rendu, d'affichage de mesures et de navigation visuelle sont documentees dans [composants/canvas.md](./composants/canvas.md).

### Cards
- RoomCard

### Composants transverses
- SettingsModal
- AppSidebar
- SidebarProjectContext
- Editor2DHeaderControls
- DetailTree
- ProjectNotesBubble
- SelectionSyncBridge
- ProjectCollaborationModal
- AppNotifications
- AdminModal
- Note: DetailTree, ProjectNotesBubble et SelectionSyncBridge portent la source de verite de la synchronisation transverse et des interactions communes dans [composants/transverses.md](./composants/transverses.md).
- Note: ProjectCollaborationModal et AppNotifications portent la gestion des accès projet et l'acceptation des invitations dans [composants/transverses.md](./composants/transverses.md).

## Socle constant des vues métier
- Toutes les vues métier authentifiées affichent les composants transverses suivants:
	- AppSidebar, dans son état ouvert ou fermé courant;
	- le bouton icône cloche d'AppNotifications en haut à droite de l'application;
	- le bouton icône roue crantée ouvrant SettingsModal en haut à droite de l'application.
- Ces actions globales restent disponibles lors des changements de vue.
- La navigation principale d'AppSidebar présente chaque destination sous forme de lien avec une icône explicite et un libellé visible; elle distingue la vue active et n'active pas les destinations indisponibles.
- Lorsque AppSidebar est fermée, son bouton icône menu reste disponible en haut à gauche et les boutons Notifications et Paramètres restent disponibles en haut à droite.
- LoginView est exclue de ce socle applicatif authentifié.
- Les contrats détaillés de ces composants sont définis dans [composants/transverses.md](./composants/transverses.md).

## Droits projet transverses
- Les projets accessibles sont les projets possédés par l'utilisateur ou ceux dont il a accepté l'invitation.
- Le rôle lecture autorise la consultation, la navigation et les exports, mais interdit toute création, modification ou suppression.
- Le rôle écriture autorise l'édition de toutes les ressources du projet, sous réserve du verrou d'édition applicable.
- Seul le propriétaire peut gérer les invitations et collaborateurs ou modifier le projet lui-même.
- Ces règles s'appliquent à toutes les vues métier, sauf dérogation explicitement documentée.

## Règles d'implementation frontend
- Les conventions techniques frontend (stack, composants UI, icones, styles, checklist) sont definies dans [.github/frontend.instructions.md](../.github/frontend.instructions.md).

## Terminologie commune
- Magnetisme (snapping): terme fonctionnel unique pour la capture des points/segments pendant l'édition (sources + distance de capture).
- Options d'affichage (affichage/masquage): terme fonctionnel unique pour les bascules de visibilite (grille, règles, côtes, angles, notes, surfaces, icônes de pièces).
- Regle documentaire:
	- utiliser en priorite `magnetisme (snapping)` dans les specifications,
	- utiliser en priorite `options d'affichage (affichage/masquage)` dans les specifications.

## Interactions clavier transverses
- Suppression de l'element selectionne:
	- Touche `Suppr` (PC) ou touche `Delete` (Mac).
	- Comportement attendu: si un element est selectionne et supprimable, il est supprime; sinon, aucune action.
- Annuler/Retablir (historique utilisateur):
	- Annuler: `Ctrl+Z` (PC) / `Cmd+Z` (Mac).
	- Retablir: `Ctrl+Shift+Z` (PC) / `Cmd+Shift+Z` (Mac).
	- Capacite d'historique: 20 actions maximum conservees pour l'annulation.
	- Regle de pile: une nouvelle action utilisateur apres annulation vide la pile de retablissement.
- Navigation au clavier dans les champs:
	- Touche `Tab`: focus sur le champ suivant interactif.
	- `Shift+Tab`: focus sur le champ precedent interactif.
	- Le parcours suit l'ordre de tabulation defini par la vue/composant.

## Actions undo/redo dans le header (regle transverse obligatoire)
- Portee:
	- Cette regle s'applique a toutes les vues metier existantes et a venir.
	- Exception autorisee uniquement si la vue mentionne explicitement une derogation dans sa specification.
- Positionnement:
	- Les boutons `Annuler` et `Retablir` sont affiches dans le header principal, en haut a droite.
	- Les boutons sont presentes sous forme de petites icones explicites (undo/redo).
- Disponibilite:
	- Bouton `Annuler` actif uniquement si au moins une action est disponible dans l'historique d'annulation.
	- Bouton `Retablir` actif uniquement si au moins une action est disponible dans l'historique de retablissement.
	- Si aucune action n'est disponible, le bouton correspondant est grise et non cliquable.
- Cohérence clavier/souris:
	- Les boutons pilotent la meme pile d'historique que les raccourcis clavier (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`).
	- La capacite maximale de l'historique reste fixee a 20 actions.
