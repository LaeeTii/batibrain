# Produit — BatiBrain (roadmap active)

Date de mise à jour: 2026-07-16

## Positionnement
BatiBrain n'est pas un MVP: c'est une vraie application produit, livrée par versions successives.

## Source de vérité fonctionnelle
- La description fonctionnelle détaillée des écrans et interactions est portée par `docs/ihm/`.
- Le backlog consolidé et la priorisation des features sont portés par `docs/spec.md`.
- Ce fichier formalise le découpage de livraison V1 à V5, avec un jalon intermédiaire V2.1.

## Invariants produit
- Une pièce est définie par une liste ordonnée de sommets `(x, y)`.
- Un sommet possède une identité topologique unique dans le niveau et peut être partagé par plusieurs murs ou contours de pièces.
- Chaque segment entre deux sommets consécutifs du contour d'une pièce référence un mur.
- Un mur est une entité topologique autonome définie par un segment ordonné; il peut être détaché ou relié à une ou deux pièces.
- Un mur peut être lié à deux pièces au maximum; lorsqu'une troisième pièce rejoint l'intérieur d'un mur, un sommet de jonction scinde ce mur en deux afin de former trois murs distincts autour de ce sommet.
- Les angles sont calculés, pas stockés.
- Les coordonnées sont globales au niveau.
- Les coordonnées, longueurs et calculs internes sont normalisés en centimètres; les surfaces internes sont normalisées en centimètres carrés.
- Les unités de saisie et d'affichage suivent les préférences de l'utilisateur, préconfigurées en `cm` pour les longueurs et `m2` pour les surfaces.
- Une pièce rectangulaire est créée par deux points définissant librement ses dimensions; aucune largeur ni profondeur n'est imposée par défaut. Les valeurs initiales des murs restent `10 cm` d'épaisseur et `250 cm` de hauteur; l'utilisateur peut les personnaliser dans ses paramètres pour les créations futures.

## Découpage de livraison

### V1 — Socle applicatif métier
Inclut le socle principal déjà décrit dans `docs/ihm/` (hors modules explicitement reportés en V2 et V3) et les features de la spec prévues pour la V1.

Périmètre attendu:
- Authentification et accès application (LoginView).
- Demande de création de compte soumise à l'approbation d'un administrateur et administration des comptes.
- Dashboard projet et navigation métier.
- Éditeur 2D global et éditeur 2D par pièce.
- Géométrie pièce/mur/ouvertures, métriques et exports PDF existants.
- ProjectMetricsView rattachée à V1 avec:
	- tableau des métriques projet,
	- filtres,
	- exports PDF, Excel et CSV.
- Vues et composants transverses du socle déjà spécifiés dans `docs/ihm/`.
- Features spec V1 prioritaires:
	- collaboration projet asynchrone simple,
	- verrouillage géométrique des sommets du plan et des points de profils, avec états calculés des murs, pièces, côtes et profils,
	- validation d'adjacence des ouvertures intérieures,
	- icône de pièce configurable,
	- vue mur dédiée (vue de face),
	- profils de hauteur multiples sur un mur.

### Évolution postérieure à la V1.0 — version à préciser

Périmètre attendu:
- Verrouillage collaboratif global du projet pour empêcher deux utilisateurs d'éditer simultanément.
- Affichage du détenteur et mise en lecture seule temporaire des autres sessions.
- Acquisition, renouvellement et expiration du verrou selon un contrat à respécifier avant implémentation.

### V2 — Gestion des documents et photos
Périmètre attendu:
- DocumentsView (upload, listing, suppression, rattachement métier).
- PhotosView (gestion des photos de chantier et rattachement métier).

### V2.1 — PWA (mobile web)
Périmètre attendu:
- Livraison de l'application en Progressive Web App (PWA).
- Installation sur terminaux mobiles depuis le navigateur.
- Expérience responsive renforcée pour les usages chantier.
- Capacités offline de base pour les parcours critiques.

### V3 — Gestion des tâches, travaux et planning
Périmètre attendu:
- TasksView (CRUD, statuts, priorités, filtres).
- WorksView (gestion et suivi des travaux).
- PlanningView (planification, jalons, dépendances selon spec détaillée).

### V4 — IA avec validation humaine
Périmètre attendu:
- Assistant IA orienté intentions.
- Prévisualisation obligatoire des actions.
- Validation explicite utilisateur avant exécution.

### V5 — Moteur 3D complet
Périmètre attendu:
- Vue et interactions 3D complètes du projet.
- Cohérence des données 2D/3D avec le modèle métier.


## Hors périmètre actuel
- Collaboration temps réel complexe.
