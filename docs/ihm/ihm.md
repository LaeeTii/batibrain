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

## Liste des composants metier

### Layouts
- DashboardLayout

### Panels
- EditorCreationPanel
- EditorDetailPanel

### Sections
- LevelsSection
- RoomsSection
- WallsSection
- OpeningsSection
- DimensionsSection
- NotesSection

### Canvas
- Canvas2D
- CanvasOverlayMeasurements
- CanvasZoomControls
- CanvasScaleIndicator

### Cards
- RoomCard

### Composants transverses
- AppSidebar
- SidebarProjectContext
- Editor2DHeaderControls
- DetailTree
- ProjectNotesBubble
- SelectionSyncBridge

## Regles d'implementation frontend
- Les conventions techniques frontend (stack, composants UI, icones, styles, checklist) sont definies dans [.github/frontend.instructions.md](../.github/frontend.instructions.md).
