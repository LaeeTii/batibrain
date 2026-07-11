# Backlog de développement

Date: 2026-07-11
Référence de gouvernance: [docs/projet.md](docs/projet.md)
Source fonctionnelle principale: [docs/ihm/](docs/ihm/)

## Stratégie d'exécution retenue

- Découpage vertical par IHM (vue par vue), pas par lots horizontaux (tout CRUD puis toute logique puis toute IHM).
- Pour chaque tranche: CRUD minimal nécessaire + logique métier nécessaire + IHM ciblée + tests ciblés.
- Les actions non prêtes restent désactivées avec libellé explicite "À venir".
- Toute divergence documentaire est bloquante et nécessite un arbitrage explicite avant implémentation.

## Définition de terminé par tranche

- Comportement conforme à la vue IHM ciblée.
- Données persistées dans Supabase/PostgreSQL selon le modèle validé.
- Gestion des états UI: chargement, vide, erreur, succès.
- Tests pertinents verts (unitaire logique + intégration service + test UI critique).
- Documentation impactée mise à jour dans docs/ le même jour.

## Ordre recommandé des tranches

## 2.0 — Documents et photos

### B2-01 — Fondations techniques partagées
- Cible: socle transversal pour fiabiliser les tranches suivantes.
- IHM liée: transversale.
- Portée:
  - Contrats TypeScript alignés avec le modèle de données actuel.
  - Normalisation des erreurs services (format unique).
  - Convention soft-delete appliquée partout.
  - Validation d'entrées côté services.
- Dépendances: aucune.
- Livrable: socle prêt pour vues Documents/Photos.

### B2-02 — DocumentsView MVP
- Cible: [docs/ihm/vues/documents_view.md](docs/ihm/vues/documents_view.md).
- Portée:
  - CRUD documents (liste, création, renommage, suppression logique).
  - Upload/référence de fichier via storage_path.
  - Filtres minimum par projet.
  - UI complète de la vue avec états.
- Dépendances: B2-01.
- Hors portée: OCR, classement intelligent.

### B2-03 — PhotosView MVP
- Cible: [docs/ihm/vues/photos_view.md](docs/ihm/vues/photos_view.md).
- Portée:
  - CRUD photos (liste, ajout, suppression logique, méta de base).
  - Association projet/pièce/mur si défini dans la vue.
  - UI complète de la vue avec états.
- Dépendances: B2-01.
- Hors portée: annotation avancée.

### B2-04 — Liaison éditeur 2D vers médias
- Cible: cohérence entre éditeur et vues médias.
- Portée:
  - Liens depuis contexte pièce/mur vers documents/photos.
  - Actions non implémentées affichées désactivées.
- Dépendances: B2-02, B2-03.

## 2.1 — PWA mobile web

### B2.1-01 — Fondations PWA
- Cible: installation + offline minimal.
- Portée:
  - Manifest, icônes, service worker de base.
  - Shell mobile pour navigation principale.
- Dépendances: B2-02, B2-03.

### B2.1-02 — Vues prioritaires mobile
- Cible: Dashboard, Documents, Photos en responsive mobile.
- Portée:
  - Ajustements ergonomiques mobiles.
  - Vérification interactions tactiles essentielles.
- Dépendances: B2.1-01.

## 3.0 — Tâches, travaux, planning

### B3-01 — TasksView MVP
- Cible: [docs/ihm/vues/tasks_view.md](docs/ihm/vues/tasks_view.md).
- Portée:
  - CRUD tâches + statuts + priorités + échéance.
  - Filtres de base.
  - UI complète de la vue.
- Dépendances: B2-01.

### B3-02 — WorksView MVP
- Cible: [docs/ihm/vues/works_view.md](docs/ihm/vues/works_view.md).
- Portée:
  - CRUD work_items + statut.
  - Lien projet et affichage synthétique.
  - UI complète de la vue.
- Dépendances: B2-01.

### B3-03 — PlanningView MVP
- Cible: [docs/ihm/vues/planning_view.md](docs/ihm/vues/planning_view.md).
- Portée:
  - CRUD planning_items.
  - Contrôle cohérence dates (start_at <= end_at).
  - UI complète de la vue.
- Dépendances: B2-01.

### B3-04 — Synchronisation transverse 3.0
- Cible: cohérence entre tâches, travaux, planning.
- Portée:
  - Liens de navigation entre les 3 vues.
  - Compteurs/états globaux minimum dans dashboard.
- Dépendances: B3-01, B3-02, B3-03.

## 4.0 — IA avec validation humaine

### B4-01 — Journalisation des suggestions IA
- Cible: traçabilité des propositions.
- Portée:
  - Stockage des suggestions IA, statut proposé/accepté/rejeté.
  - UI de revue et validation humaine.
- Dépendances: B3-04.

### B4-02 — Assistance IA sur tâches et planning
- Cible: aide à la priorisation et au séquencement.
- Portée:
  - Génération de propositions non destructives.
  - Application uniquement après validation explicite.
- Dépendances: B4-01.

## 5.0 — Moteur 3D complet

### B5-01 — Préparation données 3D
- Cible: données exploitables pour extrusions et volumes.
- Portée:
  - Validation géométrie 2D prête pour conversion 3D.
  - Contrats de sortie pour moteur 3D.
- Dépendances: B3-04.

### B5-02 — Viewer 3D initial
- Cible: visualisation des pièces et murs.
- Portée:
  - Rendu 3D de base.
  - Navigation caméra standard.
- Dépendances: B5-01.

### B5-03 — Édition 3D assistée
- Cible: interactions 3D utiles au métier.
- Portée:
  - Ajustements de hauteurs et ouvertures en 3D.
  - Synchronisation 2D/3D.
- Dépendances: B5-02.

## File d'exécution immédiate (prochaines tranches)

1. B2-01 — Fondations techniques partagées.
2. B2-02 — DocumentsView MVP.
3. B2-03 — PhotosView MVP.
4. B2-04 — Liaison éditeur 2D vers médias.

## Règles de pilotage

- Une tranche active à la fois.
- Pas d'ajout de périmètre en cours de tranche.
- Revue de fin de tranche obligatoire avant de passer à la suivante.
- Si conflit entre docs: arrêt, question, arbitrage, puis reprise.
