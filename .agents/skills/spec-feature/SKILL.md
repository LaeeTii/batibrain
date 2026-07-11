---
name: spec-feature
description: Intégrer une fonctionnalité dans la documentation sans modifier le code, en maintenant la cohérence entre spécification, IHM, architecture et modèle de données. Utiliser pour documenter ou spécifier une nouvelle feature et lorsque l’utilisateur invoque spec-feature.
---

# Spécifier une fonctionnalité

- Autoriser uniquement les changements dans `docs/`.
- Ne modifier aucun fichier de code, script, migration ou configuration.
- Ne pas inventer de règle métier, d’écran, de donnée ou de comportement.

## Procédure

1. Reformuler l’objectif en trois à cinq lignes.
2. Lire `docs/projet.md` et ses sources.
3. Recenser les impacts dans la spec, l’IHM, l’architecture et le modèle de données.
4. Identifier les informations absentes, ambiguës ou contradictoires.
5. Poser uniquement les questions nécessaires avant l’écriture concernée.
6. Proposer un plan fichier par fichier et attendre sa validation.
7. Modifier uniquement les fichiers validés.
8. Déclarer explicitement la fonctionnalité dans `docs/spec.md`.
9. Vérifier la cohérence des documents modifiés.
10. Récapituler fichiers, décisions, questions résolues et hypothèses autorisées.
