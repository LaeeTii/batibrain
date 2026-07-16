# Matrice de livraison de la V1

Date du dernier audit: 2026-07-15

## Rôle et règles de statut

Ce document est l’unique source du statut réel de la V1. Les spécifications définissent le contrat cible; elles ne prouvent jamais que le comportement est livré.

Statuts autorisés:

- `À faire`: aucune implémentation exploitable identifiée.
- `Partiel`: une partie existe, mais des critères ou parcours importants manquent.
- `À valider`: l’implémentation paraît présente, mais la recette complète n’a pas été démontrée.
- `Bloqué`: l’implémentation ne doit pas progresser avant la levée du blocage indiqué.
- `Différé fin V1`: volontairement planifié après les autres fonctions V1, mais requis avant publication.
- `Terminé`: tous les critères sont vérifiés avec tests, migration éventuelle et preuve de recette.

Une ligne ne passe à `Terminé` que si `npm run check` et les validations de base applicables sont verts.

## État de référence de l’audit

- Branche auditée: `main`, code de référence `8dca245`.
- `npm run typecheck`: réussi.
- `npm run build`: réussi, avec un avertissement sur le bundle principal de 1,59 Mo.
- `npm run check`: échec; 28 fichiers et 126 tests passent, deux suites React-Konva échouent avant exécution faute de configuration `canvas`.
- Aucun script de lint n’est défini.
- La chaîne de migrations n’est pas reproductible tant qu’un script local de profil initial reste ignoré dans `supabase/migrations/`.

## Matrice des tâches historiques

| ID | Périmètre | Statut | Écart principal / preuve attendue |
|---|---|---|---|
| V1-01 | Socle frontend et tests | Partiel | Structure présente, mais `npm run check` échoue et aucun lint n’est configuré. |
| V1-02 | Primitives géométriques | À valider | Domaine et tests unitaires présents; recette globale à rejouer après convergence des modèles. |
| V1-03 | Domaine des pièces | Partiel | Deux modèles concurrents subsistent et le runtime RoomEditor utilise encore le modèle historique. |
| V1-04 | Murs et topologie | Partiel | Topologie présente, mais cardinalité DB et préservation complète des dépendances ne sont pas garanties. |
| V1-05 | Profils de hauteur | Partiel | Domaine testé, mais non consommé par une vue de production et aplatissement possible lors d’une normalisation. |
| V1-06 | Ouvertures | Partiel | Validations canoniques présentes, mais le runtime RoomEditor utilise encore l’ancien contrat. |
| V1-07 | Schéma et base neuve | Bloqué | Migration initiale immuable; script local ignoré à sortir de la chaîne et reset neuf à démontrer. |
| V1-08 | Transactions métier | Partiel | Adaptateur inutilisé, RPC périmée et sauvegarde RoomEditor séquentielle non atomique. |
| V1-09 | Politiques RLS | À valider | Politiques présentes; matrice complète et invariants topologiques à rejouer sur base neuve. |
| V1-10 | Session et LoginView | À valider | Parcours présent; politique de blocage et recette de session restent à démontrer. |
| V1-11 | Demande et approbation de compte | À valider | Fonctions présentes; recette serveur et absence de création partielle à rejouer. |
| V1-12 | Profil et compte | À valider | Parcours présents; conformité Mantine et retours génériques à corriger. |
| V1-13 | Administration | À valider | Parcours présents; modales, suppressions et dernier administrateur à recetter. |
| V1-14 | Coquille applicative | Partiel | Coquille présente, mais routes WallEditor absentes et Métriques reste un placeholder. |
| V1-15 | Préférences et compte | Partiel | Préférences persistées, mais unités et options ne sont pas appliquées partout. |
| V1-16 | Projets et contexte | À valider | Parcours présent; recette propriétaire, suppression et base neuve à compléter. |
| V1-17 | Invitations et collaborations | À valider | Parcours présent; recette multi-utilisateur complète à rejouer. |
| V1-18 | Verrou collaboratif | Différé fin V1 | Neutralisé volontairement; réactivation et recette prévues en V1-R40. |
| V1-19 | Verrous manuels | Partiel | Domaine, RPC et bouton présents, mais intégration incomplète dans les vues de production. |
| V1-20 | Dashboard, niveaux et cartes | Partiel | Écran présent; notes, unités, PDF et retours utilisateur restent incohérents. |
| V1-21 | Canvas partagé | Partiel | Canvas React-Konva présent, tests rouges et RoomEditor conserve un canvas SVG distinct. |
| V1-22 | Sélection, panneaux, historique | Partiel | Consultation et historique présents; les mutations secondaires sont encore désactivées. |
| V1-23 | Affichage éditeur global | Partiel | Vue présente, options non persistées et droits/verrous incomplets selon les parcours. |
| V1-24 | Édition géométrique globale | Partiel | Pièces et chevauchements présents; ouvertures refusées en bloc et profils multiples non préservés. |
| V1-25 | Objets secondaires globaux | À faire | Seule la création de pièce est active; autres créations explicitement désactivées. |
| V1-26 | RoomEditor2DView | Bloqué | Persistance incompatible et non atomique; écriture à désactiver jusqu’à la refonte V1-R20. |
| V1-27 | WallEditor en lecture | À faire | Aucune route ni vue de production. |
| V1-28 | Édition des profils | À faire | Logique domaine partielle seulement, sans intégration de production. |
| V1-29 | Six exports PDF | Partiel | Exports Dashboard partiels; variantes éditeurs absentes. |
| V1-30 | ProjectMetricsView | À faire | Route placeholder, aucun tableau, filtre ou tri. |
| V1-31 | Exports Métriques | Bloqué | Aucun export; contrat PDF/Excel/CSV détaillé à compléter avant code. |
| V1-32 | Recette sécurité/concurrence | À faire | Verrou collaboratif différé et tests DB complets non exécutés. |
| V1-33 | Recette fonctionnelle V1 | À faire | Portail qualité rouge et fonctions V1-25 à V1-31 incomplètes. |

## Décisions de cadrage gelées

- Le verrou collaboratif reste obligatoire pour la publication 1.0, mais est traité après les autres fonctions V1.
- Un mur est une entité topologique autonome reliée à zéro, une ou deux pièces.
- Intersections et chevauchements avec création de pièce restent dans la V1.
- Toute transformation topologique affectant un objet verrouillé est refusée atomiquement.
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
