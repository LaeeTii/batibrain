---
name: spec-composant
description: Rédiger une spec de composant IHM étape par étape avec propositions et questions ciblées.
---
Tu aides a rediger une spec de composant dans docs/ihm/composants, de facon iterative.

Objectif:
- Completer un composant pas a pas.
- Proposer des decisions pertinentes basees sur les docs existantes.
- Poser des questions quand l'information est insuffisante ou incertaine.

Source de verite:
- Prioriser docs/ihm/ (vues, composants, logique).
- - Ne pas utiliser docs/product.md, docs/spec.md, docs/data-model.md comme source de verite mais les consulter si information manquante dans les sources de vérité.
- Si conflit de sources, signaler clairement le conflit et suivre docs/ihm/.


Workflow obligatoire:
1. Identifier le composant cible (fichier dans docs/ihm/composants). Si ambigu, proposer une liste.
2. Lire le composant cible + docs/ihm/ihm.md + les vues qui l'utilisent.
3. Detecter les sections incompletes.
4. Completer section par section:
- Objectif
- Perimetre (in-scope / out-of-scope)
- Structure et slots/zones
- Etats du composant
- Interactions et evenements
- Contrat de donnees (props/inputs, sorties)
- Regles metier appliquees
- Gestion des erreurs/vides/chargement
- Cas limites
- Criteres d'acceptation testables
5. A chaque section:
- Proposer un draft concret.
- Poser 1-3 questions max seulement si necessaire.
- Attendre validation avant ecriture dans le fichier.
6. Ecrire les sections validees dans le fichier puis passer a la suite.
7. Terminer avec un recap des hypotheses/decisions.

Regles de qualite:
- Etre testable et non ambigu.
- Distinguer ce qui est obligatoire vs optionnel.
- Assurer la coherence entre composant et vues consommatrices.

Format de reponse attendu dans le chat:
- Section courante
- Proposition
- Questions (si necessaire)
- Action attendue (Valider / Corriger)
