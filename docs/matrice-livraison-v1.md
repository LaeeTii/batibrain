# Matrice de livraison de la V1

Date du dernier audit: 2026-07-20

## Rôle et règles de statut

Ce document est l’unique source du statut réel de la V1. Les spécifications définissent le contrat cible; elles ne prouvent jamais que le comportement est livré.

Statuts autorisés:

- `À faire`: aucune implémentation exploitable identifiée.
- `Partiel`: une partie existe, mais des critères ou parcours importants manquent.
- `À valider`: l’implémentation paraît présente, mais la recette complète n’a pas été démontrée.
- `Bloqué`: l’implémentation ne doit pas progresser avant la levée du blocage indiqué.
- `Hors V1`: explicitement reporté après la version 1.0 et non requis pour sa publication.
- `Terminé`: tous les critères sont vérifiés avec tests, migration éventuelle et preuve de recette.

Une ligne ne passe à `Terminé` que si `npm run check` et les validations de base applicables sont verts.

## État de référence de l’audit

- Branche auditée: `main`.
- `npm run check`: réussi; lint, 34 fichiers et 159 tests, typecheck et build sont verts.
- Le build conserve un avertissement non bloquant sur le bundle principal de 1,60 Mo.
- Les 20 migrations versionnées sont rejouées sans erreur sur une base Supabase locale recréée avec Podman; la migration de stabilisation des préférences et options est incluse.
- Les 7 fichiers de scénarios SQL totalisent 79 tests verts; les préférences, options de vue, droits de lecture et invariants géométriques sont couverts.
- Aucun fichier de migration n’est ignoré et le provisionnement initial est isolé dans `supabase/scripts/`, sans donnée personnelle.

## Matrice des jalons refactorés engagés

| ID | Statut | Preuves |
|---|---|---|
| V1-R00 | Terminé | Base neuve rejouée, 18 migrations concordantes, 67 tests SQL verts, `npm run check` vert avec lint et 139 tests, RoomEditor2DView verrouillée en lecture seule et script générique documenté pour le premier administrateur. |
| V1-R10 | Terminé | Modèle canonique `vertices` + associations ordonnées, murs autonomes et profils complets; `load_level_geometry`/`save_level_geometry` remplacent les RPC partielles. Migration 19/19 rejouée, 6 scénarios SQL validés (succès, verrou, rollback, profils multi-points, ouverture, cardinalité) et `npm run check` vert avec 32 fichiers et 149 tests. |
| V1-R11 | Terminé | Conversions centralisées cm/m/mm et m2/cm2/mm2 sans réinterprétation des données; unités appliquées aux canvas, dashboard, éditeurs et PDF existants; options du canvas global relues et enregistrées par utilisateur et projet. Migration 20/20, 79 tests SQL et `npm run check` vert avec 34 fichiers et 159 tests. |
| V1-R21 | À faire | À exécuter après V1-R20 et avant V1-R30; référence actuelle du chunk principal: 1,60 Mo minifié et environ 480 Ko compressé. |

## Matrice des tâches historiques

| ID | Périmètre | Statut | Écart principal / preuve attendue |
|---|---|---|---|
| V1-01 | Socle frontend et tests | Terminé | `npm run check` réussit avec lint, 31 fichiers et 139 tests, typecheck et build. |
| V1-02 | Primitives géométriques | Terminé | Primitives et validations du domaine couvertes par les tests; instantané canonique validé avant persistance. |
| V1-03 | Domaine des pièces | À valider | Modèle canonique unique et adaptateur de lecture livrés; la refonte visuelle de RoomEditor reste suivie par V1-R20. |
| V1-04 | Murs et topologie | Terminé | Murs autonomes, sommets partagés et cardinalité maximale de deux pièces garanties dans le domaine et la base. |
| V1-05 | Profils de hauteur | À valider | Profils complets et multi-points conservés par les normalisations et la transaction; intégration WallEditor suivie par V1-R20. |
| V1-06 | Ouvertures | À valider | Ouvertures compatibles préservées et incompatibles écartées lors de la reconstruction canonique; recette UI complète reportée à V1-R20. |
| V1-07 | Schéma et base neuve | Terminé | Migration initiale inchangée; 18 migrations rejouées et concordantes sur base neuve, aucun fichier de migration ignoré, 67 tests SQL verts. |
| V1-08 | Transactions métier | Terminé | Une seule sauvegarde atomique versionnée par niveau; anciennes RPC supprimées et écritures directes géométriques révoquées. |
| V1-09 | Politiques RLS | À valider | Politiques présentes; matrice complète et invariants topologiques à rejouer sur base neuve. |
| V1-10 | Session et LoginView | À valider | Parcours présent; politique de blocage et recette de session restent à démontrer. |
| V1-11 | Demande et approbation de compte | À valider | Fonctions présentes; recette serveur et absence de création partielle à rejouer. |
| V1-12 | Profil et compte | À valider | Parcours présents; conformité Mantine et retours génériques à corriger. |
| V1-13 | Administration | À valider | Parcours présents; modales, suppressions et dernier administrateur à recetter. |
| V1-14 | Coquille applicative | Partiel | Coquille présente, mais routes WallEditor absentes et Métriques reste un placeholder. |
| V1-15 | Préférences et compte | Terminé | Préférences relues au démarrage, conversions de saisie et d’affichage centralisées, valeurs de mur persistées en cm et contraintes de valeurs initiales validées en base. |
| V1-16 | Projets et contexte | À valider | Parcours présent; recette propriétaire, suppression et base neuve à compléter. |
| V1-17 | Invitations et collaborations | À valider | Parcours présent; recette multi-utilisateur complète à rejouer. |
| V1-18 | Verrou collaboratif | Hors V1 | Reporté après la V1.0; version cible et contrat à respécifier avant réactivation. |
| V1-19 | Verrouillage géométrique | Partiel | Modèle et RPC convergés sur les sommets et points de profils avec revérification transactionnelle; actions complètes des trois éditeurs suivies par V1-R20. |
| V1-20 | Dashboard, niveaux et cartes | Partiel | Écran présent et unités actives appliquées aux cartes, synthèses et PDF; la recette complète des notes, niveaux et retours utilisateur reste à mener. |
| V1-21 | Canvas partagé | Partiel | Canvas React-Konva et ses tests sont verts; RoomEditor conserve un canvas SVG distinct jusqu’à V1-R20. |
| V1-22 | Sélection, panneaux, historique | Partiel | Consultation et historique présents; les mutations secondaires sont encore désactivées. |
| V1-23 | Affichage éditeur global | Partiel | Options d’affichage persistées par utilisateur et projet, y compris en lecture; les droits et verrous complets restent à recetter avec V1-R20 et V1-R12. |
| V1-24 | Édition géométrique globale | À valider | Pièces, intersections et chevauchements utilisent la sauvegarde canonique; ouvertures et profils sont remappés au lieu d’être refusés ou aplatis. |
| V1-25 | Objets secondaires globaux | À faire | Seule la création de pièce est active; autres créations explicitement désactivées. |
| V1-26 | RoomEditor2DView | Bloqué | Consultation maintenue; toutes les écritures, mutations canvas et auto-sauvegardes sont désactivées jusqu’à la refonte V1-R20. |
| V1-27 | WallEditor en lecture | À faire | Aucune route ni vue de production. |
| V1-28 | Édition des profils | À faire | Logique domaine partielle seulement, sans intégration de production. |
| V1-29 | Six exports PDF | Partiel | Exports Dashboard partiels et conversions d’unités branchées sur les moteurs PDF existants; variantes éditeurs absentes. |
| V1-30 | ProjectMetricsView | À faire | Route placeholder, aucun tableau, filtre ou tri. |
| V1-31 | Exports Métriques | Bloqué | Aucun export; contrat PDF/Excel/CSV détaillé à compléter avant code. |
| V1-32 | Recette sécurité | À faire | Recettes droits, verrouillage géométrique et invariants base à compléter; concurrence multi-utilisateur hors V1. |
| V1-33 | Recette fonctionnelle V1 | À faire | Portail qualité vert; fonctions V1-25 à V1-31 encore incomplètes. |

## Décisions de cadrage gelées

- Le verrou collaboratif global du projet est reporté après la V1.0 et n'est plus un critère de publication de la V1.
- Un mur est une entité topologique autonome reliée à zéro, une ou deux pièces.
- Intersections et chevauchements avec création de pièce restent dans la V1.
- Les seuls verrous géométriques persistés sont portés par les sommets du plan et les points de profils; les états des murs, pièces, côtes et profils sont calculés.
- Toute interaction géométrique impliquant un point verrouillé est refusée avant la première mutation du brouillon.
- La frontière transactionnelle revérifie l'état persisté et autorise un déverrouillage accompagné de sa modification dans une même sauvegarde atomique.
- Les préférences pilotent saisie et affichage; les données internes restent en cm et cm², avec cm/m² comme préférences initiales.
- Les trois éditeurs utilisent brouillon local, auto-sauvegarde cinq minutes et sauvegarde manuelle.
- Le PDF détail global couvre tous les niveaux visibles.
- Les exports Métriques reproduisent filtres, tris et unités actifs; leur structure détaillée est spécifiée avant code.
- Les succès génériques et blocs informatifs non demandés sont exclus.
- L’écriture de RoomEditor doit être désactivée tant que sa refonte n’est pas validée.

## Maintenance

Après chaque tâche:

1. mettre à jour uniquement les lignes concernées;
2. ajouter la preuve de test ou de recette dans l’écart principal;
3. ne déclarer `Terminé` qu’après validation de tous les critères;
4. conserver l’historique des migrations appliquées immuable.
