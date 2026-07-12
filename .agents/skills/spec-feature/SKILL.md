---
name: spec-feature
description: Intégrer une fonctionnalité dans la documentation sans modifier le code, maintenir la cohérence entre spécification, IHM, architecture et modèle de données, puis préparer le commit et le push avec $cp. Utiliser pour documenter ou spécifier une nouvelle feature et lorsque l’utilisateur invoque spec-feature.
---

# Spécifier une fonctionnalité

- Autoriser uniquement les changements dans `docs/`, `supabase/` et les instructions ou prompts du workflow `spec-feature` lorsqu'une règle de ce workflow évolue explicitement.
- Ne modifier aucun fichier de code.
- Ne pas inventer de règle métier, d’écran, de donnée ou de comportement.

## Procédure

1. Identifier la feature demandée et reformuler l’objectif en trois à cinq lignes.
2. Lire `docs/projet.md` et ses sources.
3. Recenser les impacts dans la spec, l’IHM, l’architecture et le modèle de données.
4. Identifier les informations absentes, ambiguës ou contradictoires.
5. Poser uniquement les questions bloquantes nécessaires avant l’écriture concernée, sans demander de validation intermédiaire.
6. Définir le plan fichier par fichier et réaliser directement les modifications dans le périmètre autorisé.
7. Si les data-models sont impactés, mettre à jour l'unique script d'initialisation dans `supabase/migrations/20260703_000002_init_v2.sql` et documenter les changements dans `docs/data-model.md`.
8. Déclarer explicitement la fonctionnalité dans `docs/spec.md`.
9. Vérifier la cohérence des documents modifiés.
10. Marquer la feature comme terminée dans `docs/spec.md`.
11. Invoquer `$cp` pour préparer le message de commit, la liste exacte des fichiers et le push de la branche courante.
12. Demander une unique validation explicite portant sur le commit et le push préparés par `$cp`. Ne demander aucune autre validation pendant le workflow.
13. Après validation, laisser `$cp` créer le commit, pousser la branche et afficher son récapitulatif.
