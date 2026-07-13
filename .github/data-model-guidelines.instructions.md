# Data Model Guidelines (app-maison)

## Scope
Règles d'exécution agent pour les changements de modèle de données, types partagés, logique géométrique et persistance.

## Priorité documentaire
Ordre de référence à appliquer:
1. `docs/ihm/` (source fonctionnelle principale)
2. `docs/data-model.md` (référentiel consolidé du modèle)
3. `.github/copilot-instructions.md` (garde-fous de contribution)

En cas de conflit documentaire, demander un arbitrage explicite à l'utilisateur avant implémentation.

## Responsabilités par dossier
- `web/src/domain/types.ts`: types métier du frontend.
- `web/src/domain/geometry.ts`: logique géométrique et validations métier de géométrie.
- `web/src/services/`: accès et persistance Supabase.
- `web/src/lib/`: calculs dérivés orientés affichage et synthèse.

## Règles obligatoires
- Ne jamais modifier une migration déjà appliquée, notamment `supabase/migrations/20260703_000002_init_v2.sql` qui constitue l'historique initial V1.
- Appliquer toute évolution du schéma persistant dans une nouvelle migration horodatée sous `supabase/migrations/`.
- Générer tout éventuel schéma consolidé depuis la chaîne des migrations au lieu de le maintenir manuellement.
- Définir les types métier dans `web/src/domain/types.ts`.
- Éviter toute duplication de type dans les vues, composants, services et utilitaires.
- Conserver l'unité métier en centimètres pour la géométrie et les distances.
- Conserver les surfaces affichées en m2.
- Ne pas stocker en source primaire les valeurs dérivées (surface, périmètre, angles, orientation).
- Maintenir l'ordre stable des sommets d'une pièce.
- Maintenir la cohérence topologique après toute modification de mur, coupe ou intersection.
- Pour une édition de mur mitoyen, appliquer une persistance cohérente sur les deux pièces impactées.

## Domaines stabilisés vs domaines en intention legacy
- Domaines stabilisés: projet, niveau, pièce, sommets, murs, ouvertures, côtes, notes, sélection, options d'affichage et magnétisme, exports PDF.
- Domaines legacy minimaux: tâches, documents, photos, travaux, planning, métriques avancées.

Règle d'implémentation:
- Ne pas introduire de schéma définitif pour les domaines legacy minimaux sans arbitrage explicite utilisateur.

## Anti-patterns à éviter
- Dupliquer des types métier déjà présents dans `web/src/domain/types.ts`.
- Utiliser des unités mixtes sans conversion explicite.
- Persister des champs calculés sans justification documentaire.
- Étendre le modèle avec des champs spéculatifs non sourcés par `docs/ihm/`.
- Modifier la structure des entités stabilisées sans mettre à jour la documentation concernée.

## Checklist avant validation
- [ ] Les types modifiés sont alignés avec `docs/data-model.md`.
- [ ] Les invariants géométriques de `docs/ihm/logique/geometry.md` restent respectés.
- [ ] Les règles de sélection de `docs/ihm/logique/edition_2D_synchronisation_selection.md` restent respectées.
- [ ] Les appels de persistance dans `web/src/services/` reflètent le modèle cible.
- [ ] Aucune régression de suppression logique (pièces) n'est introduite.
- [ ] Toute évolution de persistance possède une nouvelle migration horodatée et les migrations antérieures restent inchangées.
- [ ] Les impacts documentaires sont mis à jour dans le même changement.

## Mise à jour documentaire obligatoire
Mettre à jour les fichiers impactés dans le même changement lorsque le modèle évolue:
- `docs/data-model.md`
- `docs/ihm/` (vue, composant, logique concerné)
- `.github/data-model-guidelines.instructions.md` si une règle agent change

## Références rapides
- `docs/data-model.md`
- `docs/ihm/logique/geometry.md`
- `docs/ihm/logique/edition_2D_synchronisation_selection.md`
- `web/src/domain/types.ts`
- `web/src/domain/geometry.ts`
