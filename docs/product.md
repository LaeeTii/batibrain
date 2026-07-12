# Produit — BatiBrain (roadmap active)

Date de mise à jour: 2026-07-10

## Positionnement
BatiBrain n'est pas un MVP: c'est une vraie application produit, livrée par versions successives.

## Source de vérité fonctionnelle
- La description fonctionnelle détaillée des écrans et interactions est portée par `docs/ihm/`.
- Le backlog consolidé et la priorisation des features sont portés par `docs/spec.md`.
- Ce fichier formalise le découpage de livraison V1 à V5, avec un jalon intermédiaire V2.1.

## Invariants produit
- Une pièce est définie par une liste ordonnée de sommets `(x, y)`.
- Un mur est le segment entre deux sommets consécutifs.
- Un mur peut être lié à deux pièces au maximum; lorsqu'une troisième pièce rejoint l'intérieur d'un mur, un sommet de jonction scinde ce mur en deux afin de former trois murs distincts autour de ce sommet.
- Les angles sont calculés, pas stockés.
- Les coordonnées sont globales au niveau.
- Les calculs métier sont exprimés en centimètres.
- Les valeurs par défaut restent: pièce `200 x 200 cm`, mur `10 cm` d'épaisseur, `250 cm` de hauteur.

## Découpage de livraison

### V1 — Socle applicatif métier
Inclut le socle principal déjà décrit dans `docs/ihm/` (hors modules explicitement reportés en V2 et V3) et les features de la spec prévues pour la V1.

Périmètre attendu:
- Authentification et accès application (LoginView).
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
	- verrouillage pour éviter les conflits d'édition (la collaboration temps réel complexe n'est pas prévue),
	- verrouillage manuel des pièces, murs et ouvertures contre les modifications accidentelles,
	- validation d'adjacence des ouvertures intérieures,
	- icône de pièce configurable,
	- vue mur dédiée (vue de face),
	- profils de hauteur multiples sur un mur.

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
