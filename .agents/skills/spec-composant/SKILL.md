---
name: spec-composant
description: Rédiger progressivement la spécification d’un composant dans docs/ihm/composants avec des propositions concrètes, des questions ciblées et une validation section par section. Utiliser pour compléter ou créer une spec de composant IHM et lorsque l’utilisateur invoque spec-composant.
---

# Spécifier un composant IHM

- Prioriser `docs/ihm/` et signaler tout conflit documentaire.
- Identifier le composant cible, puis lire son fichier, `docs/ihm/ihm.md` et les vues qui l’utilisent.
- Traiter successivement l’objectif, le périmètre, la structure, les états, les interactions, le contrat de données, les règles métier, les erreurs, les cas limites et les critères d’acceptation.
- Pour chaque section, proposer un brouillon concret et poser au maximum trois questions si nécessaire.
- Attendre la validation avant d’écrire chaque section.
- Terminer par les décisions et hypothèses explicites.
- Rendre les règles testables et préserver la cohérence avec les vues consommatrices.
