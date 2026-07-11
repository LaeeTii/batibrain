# Modèle de données BatiBrain

Date de mise à jour: 2026-07-10

## Objectif
Ce document décrit le modèle de données métier actuel, reconstruit à partir des spécifications dans `docs/ihm/`.

Ce document ne remplace pas les sources fonctionnelles principales (`docs/ihm/`), mais fournit un référentiel unifié pour:
- les entités métier,
- leurs relations,
- les invariants transverses,
- les contraintes de persistance,
- le niveau de maturité de chaque domaine.

## Sources utilisées
- `docs/ihm/logique/geometry.md`
- `docs/ihm/logique/edition_2D_synchronisation_selection.md`
- `docs/ihm/vues/dashboard_view.md`
- `docs/ihm/vues/editeur_2d_global.md`
- `docs/ihm/vues/room_editor_2d_view.md`
- `docs/ihm/composants/sections.md`
- `docs/ihm/composants/transverses.md`
- `docs/ihm/composants/pdf.md`
- `docs/ihm/vues/tasks_view.md`
- `docs/ihm/vues/documents_view.md`
- `docs/ihm/vues/photos_view.md`
- `docs/ihm/vues/works_view.md`
- `docs/ihm/vues/planning_view.md`
- `docs/ihm/vues/project_metrics_view.md`

## Statut de maturité par domaine
| Domaine | Statut | Commentaire |
|---|---|---|
| Projet / niveaux / pièces / murs / ouvertures / côtes / notes | Stabilisé | Contrats IHM détaillés disponibles (vues + logique + composants). |
| Authentification / session | Stabilisé | Contrat détaillé disponible dans LoginView. |
| Exports PDF plan et plan + détail | Stabilisé | Matrice complète de templates et données minimales définies. |
| Tâches | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Documents | Legacy minimal | Intention et exigences minimales définies, détail IHM à compléter. |
| Photos | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Travaux | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Planning | Legacy minimal | Intention uniquement, détail IHM à compléter. |
| Métriques projet avancées | Legacy minimal | Orientation globale définie, KPIs détaillés à arbitrer. |

## Entités coeur (stabilisées)

### UserSession
Représente la session d'authentification active.

Champs minimaux:
- `userId`
- `accessToken`
- `refreshToken` (selon provider)
- `rememberMe`
- `expiresAt`

Règles:
- L'accès aux vues métier nécessite une session valide.
- Sans session valide, redirection vers LoginView.
- Après déconnexion, la session locale est invalidée.

### Project
Projet courant de rénovation.

Champs minimaux:
- `id`
- `name`
- `description` (optionnel)
- `updatedAt`
- `isSoftDeleted`

Règles:
- Le projet courant est le contexte global des vues métier.
- Si aucun projet n'est explicitement sélectionné, le projet courant par défaut est le dernier projet modifié.
- Un projet supprimé logiquement est exclu des listes actives par défaut.

### Level
Niveau d'un projet.

Champs minimaux:
- `id`
- `projectId`
- `name`
- `levelNumber` (entier)
- `isVisible`
- `isSoftDeleted`

Règles:
- Un niveau appartient à un seul projet.
- Le niveau `0` est obligatoire et non supprimable.
- Au moins un niveau doit rester visible dans l'éditeur global.
- Un seul niveau est éditable à un instant donné.
- Un niveau supprimé logiquement est exclu des listes actives par défaut.

### Room
Pièce d'un niveau.

Champs minimaux:
- `id`
- `projectId`
- `levelId`
- `name`
- `type` (optionnel)
- `floorColor`
- `wallThicknessCm`
- `wallHeightCm`
- `isSoftDeleted`

Règles:
- Si `name` est vide à la création, la valeur par défaut est `Nouvelle pièce`.
- La suppression dans le dashboard est logique (`isSoftDeleted = true`).
- Les pièces supprimées logiquement sont masquées par défaut et exclues des exports globaux par défaut.

### Vertex
Sommet 2D d'une pièce dans le repère du niveau.

Champs minimaux:
- `id` (recommandé)
- `roomId`
- `orderIndex`
- `xCm`
- `yCm`

Règles:
- Une pièce est un polygone fermé ordonné de sommets.
- L'ordre des sommets doit rester stable pour garantir le calcul des murs, angles, surfaces et périmètres.

### Wall
Segment support et propriétés métier associées.

Champs minimaux:
- `id`
- `roomId` (ou liaison topologique équivalente)
- `startVertexId`
- `endVertexId`
- `thicknessCm`
- `heightProfile` (liste ordonnée de points de hauteur)
- `material` (optionnel)
- `insulation` (optionnel)

Structure minimale d'un point de `heightProfile`:
- `positionCm` (distance horizontale depuis `startVertexId`)
- `heightCm` (hauteur locale au point)

Règles:
- La longueur métier de référence est la longueur intérieure.
- Un mur peut être lié à 0, 1 ou 2 pièces.
- Mur lié à 1 pièce: extérieur pour cette pièce.
- Mur lié à 2 pièces: intérieur/mitoyen pour les deux.
- Dans RoomEditor2DView, la suppression d'un mur mitoyen est interdite.
- `heightProfile` doit être ordonné par `positionCm` croissante.
- `positionCm` doit rester dans l'intervalle `[0, longueurDuMurCm]`.
- Deux points de `heightProfile` ne peuvent pas partager la même `positionCm`.
- Si `heightProfile` contient exactement 2 points (début et fin), on couvre le cas de pente simple.
- Si `heightProfile` contient plus de 2 points, on couvre le cas multi-hauteurs.

### HeightProfilePoint
Point de profil de hauteur d'un mur.

Champs minimaux:
- `positionCm` (distance horizontale depuis le début du mur)
- `heightCm` (distance en hauteur au point)

Règles:
- Cette structure est embarquée dans `Wall.heightProfile`.
- Les points sont triés par `positionCm` croissante.

### Opening
Ouverture positionnée sur un mur (porte, fenêtre, baie, autre).

Champs minimaux:
- `id`
- `wallId`
- `type`
- `startRatio` ou position équivalente
- `widthCm`
- `heightCm`
- `bottomCm` (allège)
- `orientation` (si applicable)

Règles:
- Une ouverture doit rester entièrement comprise dans son mur support.
- Les ouvertures d'un même mur ne se chevauchent pas.
- La hauteur utile de l'ouverture doit respecter la hauteur disponible du mur.

### Dimension
Cote de mesure rattachée au niveau actif.

Champs minimaux:
- `id`
- `levelId`
- `name`
- `type` (`point-point`, `wall-wall`, `point-on-wall`)
- `distanceCm`
- `offsetCm`
- `referenceA`
- `referenceB`

Règles:
- Une cote de distance nulle est invalide.
- Une cote devient persistante après validation du décalage.

### Note
Note métier rattachée au projet ou à un objet (pièce, mur, point, ouverture, niveau).

Champs minimaux:
- `id`
- `projectId`
- `originType`
- `originId` (optionnel si note projet)
- `text`

Règles:
- Sans sélection d'objet, une note est rattachée au projet.
- Si l'objet parent disparaît, la note reste accessible via son rattachement projet.

### DisplayOptions
Options d'affichage (affichage/masquage) de l'éditeur.

Champs minimaux:
- `showGrid`
- `showRules`
- `showDimensions`
- `showAngles`
- `showNotes`

### SnappingOptions
Options de magnétisme (snapping).

Champs minimaux:
- `snapGrid`
- `snapVertices`
- `snapIntersections`
- `snapWalls`
- `snapMidpoints`
- `snapDistanceCm`

### SelectionState
État de sélection transverse.

Champs minimaux:
- `selectedType`
- `selectedId`
- `selectedLevelId` (si applicable)
- `source` (`canvas`, `creation-list`, `detail-tree`, `project-notes-bubble`)

Règles:
- La sélection active est unique à un instant donné.
- La dernière intention explicite gagne.
- Une sélection invalide est nettoyée.

## Entités legacy minimales (à compléter)

### Task
Intention minimale: CRUD de tâches avec statut et priorité, filtrées par projet, niveau, pièce, mur.

Champs minimaux connus:
- `id`
- `projectId`
- `levelId` (optionnel)
- `roomId` (optionnel)
- `wallId` (optionnel)
- `title`
- `status`
- `priority`

Points à arbitrer:
- Taxonomie détaillée des statuts.
- Affectation utilisateur.
- Échéances, récurrence, dépendances.

### Document
Intention minimale: upload, listing, suppression, rattachement projet/pièce/mur.

Champs minimaux connus:
- `id`
- `projectId`
- `roomId` (optionnel)
- `wallId` (optionnel)
- `name`
- `storagePath`
- `mimeType`

Points à arbitrer:
- Quotas, versioning, droits fins, workflow de validation.

### Photo
Intention minimale: gestion des photos de chantier dans le contexte projet.

Champs minimaux connus:
- `id`
- `projectId`
- `name` (optionnel)
- `storagePath`

Points à arbitrer:
- Métadonnées, annotation, tri, rattachements fins.

### WorkItem
Intention minimale: module de suivi des travaux distinct des tâches et documents.

Champs minimaux connus:
- `id`
- `projectId`
- `name`

Points à arbitrer:
- Workflow, états, KPIs, interactions avec tâches/planning.

### PlanningItem
Intention minimale: vue de planification dans le contexte du projet courant.

Champs minimaux connus:
- `id`
- `projectId`
- `name`

Points à arbitrer:
- Horizon, granularité temporelle, jalons, contraintes, dépendances.

### ProjectKpi
Intention minimale: métriques consolidées cohérentes avec édition et export.

Champs minimaux connus:
- `projectId`
- `surfaceM2` (dérivée)
- `perimeterCm` (dérivée)
- `centroid` (dérivée)

Points à arbitrer:
- Liste finale des KPIs.
- Segmentation projet/niveau/pièce/mur.

## Relations
- `Project` 1..n `Level`
- `Level` 1..n `Room`
- `Room` 1..n `Vertex`
- `Room` 1..n `Wall` (ou liaison topologique équivalente)
- `Wall` 1..n `HeightProfilePoint` (point de profil ordonné par position)
- `Wall` 1..n `Opening`
- `Level` 1..n `Dimension`
- `Project` 1..n `Note`
- `Project` 1..n `Task` (legacy minimal)
- `Project` 1..n `Document` (legacy minimal)
- `Project` 1..n `Photo` (legacy minimal)
- `Project` 1..n `WorkItem` (legacy minimal)
- `Project` 1..n `PlanningItem` (legacy minimal)

## Invariants transverses
- Unités métier: centimètre pour géométrie et mesures; m2 pour surfaces.
- Les coordonnées partagent le même repère au sein d'un niveau.
- Les valeurs dérivées (surface, angle, périmètre, orientation) sont calculées, pas stockées comme source primaire.
- Après modification topologique (coupe/intersection), recalculer segments élémentaires et relations mur-pièce.
- En cas d'édition d'un mur mitoyen, la cohérence des deux pièces doit être conservée.

## Persistance et suppression
- Source de vérité persistée: Supabase/PostgreSQL.
- Suppression logique explicitement définie pour les pièces dans le dashboard.
- Les suppressions physiques et politiques d'archivage des autres domaines restent à arbitrer.

## Exports PDF (données minimales)
Templates stabilisés:
- `pdf_dashboard_global_plan_simple`
- `pdf_dashboard_global_plan_detail`
- `pdf_global_editor_plan_simple`
- `pdf_global_editor_plan_detail`
- `pdf_room_editor_piece_plan_simple`
- `pdf_room_editor_piece_plan_detail`

Contraintes:
- Les options d'affichage actives influencent le rendu.
- Les options de magnétisme n'influencent pas le rendu.
- Les sections obligatoires du détail incluent au minimum: contexte document, plan de la pièce, meta export.

## Hors périmètre à arbitrer explicitement
- Taxonomie complète des statuts de tâche et règles de cycle de vie.
- Modèle détaillé documents/photos (droits, versioning, quotas).
- Modèle complet travaux/planning.
- Modèle final des KPIs produit.

## Note de gouvernance
En cas de conflit entre ce document et une spécification dans `docs/ihm/`, demander un arbitrage explicite à l'utilisateur avant implémentation.
