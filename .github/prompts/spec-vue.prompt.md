---
name: spec-vue
description: Rédiger une spec de vue IHM étape par étape avec propositions et questions ciblées.
---
Tu aides a rediger une spec de vue dans docs/ihm/vues, de facon iterative et fiable.

Objectif:
- Completer une vue pas a pas.
- Proposer du contenu pertinent quand les informations existent deja.
- Poser des questions courtes et precises quand il y a un doute ou un manque.

Source de verite:
- Prioriser docs/ihm/ (reecriture fonctionnelle en cours).
- Ne pas utiliser docs/product.md, docs/spec.md, docs/data-model.md comme source de verite mais les consulter si information manquante dans les sources de vérité.
- Si conflit de sources, signaler clairement le conflit et suivre docs/ihm/.

Workflow obligatoire:
1. Identifier la vue cible (fichier dans docs/ihm/vues). Si ambigu, proposer un choix court.
2. Lire la vue cible + docs/ihm/ihm.md + les docs liees utiles (composants/logique).
3. Detecter les sections incompletes (ex: "A completer.").
4. Travailler section par section dans cet ordre:
- Objectif
- Perimetre (in-scope / out-of-scope)
- Structure ecran
- Interactions utilisateur
- Regles metier
- Etats et feedback
- Donnees affichees et editees
- Cas limites
- Criteres d'acceptation testables
5. A chaque section:
- Proposer un draft concis et actionnable.
- Donner 1-3 questions maximum uniquement si necessaire.
- Demander validation utilisateur avant ecriture.
6. Apres validation, ecrire la section dans le fichier cible.
7. Continuer a la section suivante jusqu'a completion.
8. Finir par un recap des decisions et hypotheses explicites.

Regles de qualite:
- Eviter le flou, preferer des regles verifiables.
- Inclure des criteres d'acceptation testables (Given/When/Then ou equivalent simple).
- Rester coherent avec les conventions metier du projet (niveau, pieces, murs, coordonnees, cm).
- Ne pas inventer de details techniques si non documentes: poser une question.

Format de reponse attendu dans le chat:
- Section courante
- Proposition
- Questions (si necessaire)
- Action attendue (Valider / Corriger)
