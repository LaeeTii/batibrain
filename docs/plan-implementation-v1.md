# Plan d’implémentation refactoré de la V1

Date de mise à jour: 2026-07-15

## Rôle du document

Ce document définit l’ordre d’exécution de la V1. Il ne porte aucun statut de réalisation: l’état réel, les preuves et les blocages sont tenus uniquement dans [matrice-livraison-v1.md](./matrice-livraison-v1.md).

Chaque tâche doit produire un incrément vérifiable comprenant le code, les tests, les éventuelles migrations incrémentales et la documentation directement concernée. Les anciennes tâches V1-01 à V1-33 restent traçables dans la table de correspondance finale.

## Règles communes

- Lire `docs/projet.md`, la matrice de livraison et les spécifications concernées avant chaque tâche.
- Considérer `docs/ihm/` comme source fonctionnelle principale.
- Placer les types et la logique métier frontend dans `web/src/domain/`.
- Placer les accès techniques Supabase dans `web/src/data/`; `web/src/services/` orchestre les cas d’usage sans dupliquer le domaine.
- Utiliser Supabase/PostgreSQL comme source des données persistées.
- Ne jamais modifier une migration appliquée, notamment `20260703_000002_init_v2.sql`; toute évolution utilise une nouvelle migration `<YYYYMMDDHHMMSS>_<description>.sql` au préfixe unique.
- Normaliser les longueurs et coordonnées en centimètres et les surfaces en centimètres carrés; appliquer les préférences utilisateur à la saisie et à l’affichage.
- Refuser atomiquement toute transformation topologique affectant une pièce, un mur ou une ouverture verrouillé.
- Ne pas introduire de fonctionnalité prévue après la V1.
- Terminer chaque tâche par les tests pertinents, `npm run check`, les tests Supabase applicables et la mise à jour de la matrice de livraison.

## Séquencement refactoré

### V1-R00 — Assainir le socle avant toute nouvelle fonction

Objectif: rendre le dépôt et la base reproductibles, puis empêcher l’usage d’un chemin d’écriture connu comme incompatible.

- Sortir le provisionnement du profil initial de `supabase/migrations/`, supprimer toute donnée personnelle du mécanisme et documenter une procédure sûre de création du premier administrateur.
- Vérifier la chaîne complète des migrations sur une base vide sans modifier l’historique appliqué.
- Corriger la configuration de test React-Konva afin que `Canvas2D.test.tsx` et `GlobalEditor2DView.test.tsx` s’exécutent.
- Ajouter un contrôle de lint au portail qualité.
- Désactiver les écritures de RoomEditor2DView tant que V1-R20 n’est pas terminée; la consultation peut rester accessible si elle respecte les droits.
- Critère de sortie: base neuve reproductible, aucun fichier de migration ignoré, `npm run check` vert et aucun chemin de production ne persiste avec l’ancien schéma Room/Wall/Opening.

### V1-R10 — Unifier le domaine et la persistance géométriques

Objectif: disposer d’un seul modèle V1 et d’une seule frontière transactionnelle avant de poursuivre les écrans.

- Conserver un modèle canonique unique pour pièce, mur topologique autonome, liaison mur-pièce, ouverture et profils de hauteur.
- Supprimer ou isoler les types et services historiques incompatibles.
- Remplacer les RPC ou adaptateurs périmés et imposer une sauvegarde transactionnelle unique pour création, mise à jour, scission, intersection et chevauchement.
- Préserver les ouvertures compatibles et tous les points de profils lors des normalisations topologiques.
- Vérifier tous les verrous avant la première écriture; refuser la transaction complète lorsqu’un objet affecté est verrouillé.
- Garantir structurellement qu’un mur est lié à zéro, une ou deux pièces, jamais trois.
- Critère de sortie: tests domaine et base couvrant succès, refus verrouillé, rollback transactionnel, ouvertures et profils multiples.

### V1-R11 — Stabiliser préférences, options de vue et unités

Objectif: appliquer le même contrat d’unités et d’affichage dans toutes les projections.

- Utiliser les préférences pour les unités de saisie et d’affichage, avec `cm` et `m2` comme valeurs initiales.
- Convertir vers cm et cm² avant calcul ou persistance, sans réinterpréter les données existantes après un changement de préférence.
- Persister et relire les options de vue par utilisateur et projet.
- Appliquer unités et options aux canvas, dashboard, éditeurs, PDF et métriques.
- Critère de sortie: tests croisés cm/m/mm et m2/cm2/mm2 sur saisie, affichage, rechargement et export.

### V1-R12 — Revalider accès, comptes, projets et collaboration asynchrone

Objectif: fermer les écarts des anciennes tâches V1-09 à V1-20 hors verrou collaboratif final.

- Rejouer la matrice RLS pour propriétaire, lecture, écriture, administrateur et utilisateur sans accès.
- Revalider LoginView, demandes de compte, profil, administration, projets, invitations et collaborations.
- Brancher les verrous manuels dans toutes les vues et opérations de production.
- Retirer les succès génériques et blocs informatifs non demandés; conserver erreurs, états indispensables et confirmations destructives.
- Critère de sortie: recettes UI/RLS concordantes et aucune écriture indirecte possible en lecture seule.

### V1-R20 — Refaire les éditeurs sur un socle commun

Objectif: partager le canvas, la sélection, l’historique, les droits et la sauvegarde entre les trois éditeurs.

- Finaliser Canvas2D React-Konva et retirer le canvas SVG du parcours RoomEditor2DView.
- Uniformiser brouillon local, auto-sauvegarde toutes les cinq minutes, bouton `Sauvegarder`, conservation du brouillon en échec et confirmation uniquement lors d’une sortie effective.
- Finaliser les objets secondaires de l’éditeur global: niveaux, murs, ouvertures, côtes et notes.
- Refaire RoomEditor2DView sur le modèle et les services canoniques, puis réactiver son écriture.
- Créer WallEditorView en lecture, puis l’édition complète des profils et ouvertures.
- Critère de sortie: mêmes données et mêmes droits observés depuis les trois vues, sans chemin legacy.

### V1-R30 — Finaliser les sorties PDF

Objectif: produire les six exports PDF définis dans `docs/ihm/composants/pdf.md`.

- Produire les variantes simple et détail du Dashboard, de l’éditeur global et de l’éditeur pièce.
- Pour l’éditeur global, inclure tous les niveaux visibles dans les deux variantes, avec leur détail structuré dans la variante Détail.
- Respecter les options d’affichage et les unités actives.
- Critère de sortie: six fichiers testés sur projet vide, multi-niveaux, pièces supprimées et rôle lecture.

### V1-R31 — Spécifier puis implémenter Métriques et ses exports

Objectif: terminer ProjectMetricsView sans inventer le contrat des formats.

- Compléter d’abord le contrat du PDF, des feuilles Excel, du conditionnement CSV et du nommage des fichiers.
- Implémenter les trois tableaux pièces, murs et ouvertures avec filtres et tris par colonne.
- Exporter exactement les lignes, l’ordre et les unités visibles au déclenchement.
- Critère de sortie: identité vérifiée entre domaine, éditeurs, tableau filtré et chaque fichier exporté.

### V1-R40 — Réactiver le verrou collaboratif

Objectif: ajouter la protection concurrente une fois les parcours d’écriture stabilisés.

- Réactiver la protection SQL et frontend au niveau du projet.
- Acquérir et renouveler le verrou uniquement après une persistance réussie.
- Afficher le détenteur et rendre les vues consultatives pour les autres utilisateurs.
- Tester expiration serveur après deux minutes et prise de relais par une seconde session.
- Critère de sortie: aucune écriture concurrente conflictuelle et aucune gêne sur les parcours de consultation.

### V1-R50 — Recetter et publier la V1

Objectif: produire la preuve de livraison 1.0.

- Exécuter les recettes sécurité, concurrence, droits, topologie, profils, métriques et exports.
- Vérifier accessibilité, performances, base Supabase neuve, compilation et cohérence documentaire.
- Mettre toutes les lignes de la matrice à `Terminé` avec leurs preuves.
- Critère de sortie: checklist de publication 1.0 entièrement verte.

## Correspondance avec l’ancien plan

| Nouveau jalon | Anciennes tâches principalement reprises |
|---|---|
| V1-R00 | V1-01, V1-07, assainissement préalable de V1-26 |
| V1-R10 | V1-02 à V1-08, V1-24 |
| V1-R11 | V1-15, V1-21, unités et options de V1-29 à V1-31 |
| V1-R12 | V1-09 à V1-20 hors V1-18 |
| V1-R20 | V1-21 à V1-28 |
| V1-R30 | V1-29 |
| V1-R31 | V1-30 et V1-31 |
| V1-R40 | V1-18 et partie concurrence de V1-32 |
| V1-R50 | V1-32 et V1-33 |

## Sources de référence

- `docs/projet.md`: gouvernance et Definition of Done.
- `docs/matrice-livraison-v1.md`: source unique du statut réel.
- `docs/product.md`: périmètre de la V1.
- `docs/spec.md`: features et critères fonctionnels.
- `docs/architecture.md`: responsabilités techniques.
- `docs/data-model.md`: entités, relations et persistance.
- `docs/ihm/`: comportements des vues et composants.
