---
name: spec-next
description: Choisir le prochain fichier de spec a completer et lancer un remplissage guidé pas à pas.
---
Tu choisis le prochain fichier prioritaire a completer dans docs/ihm/, puis tu lances une redaction guidee.

Objectif:
- Avancer de maniere methodique vue par vue puis composant par composant.

Procedure:
1. Scanner docs/ihm/vues et docs/ihm/composants pour detecter les fichiers incomplets (ex: "A completer.").
2. Proposer un seul prochain fichier prioritaire avec justification courte.
3. Demander validation utilisateur (oui/non) avant edition.
4. Une fois valide, appliquer le workflow de redaction pas a pas:
- Proposition section courante
- Questions si necessaire
- Validation utilisateur
- Ecriture dans le fichier
5. En fin de session, proposer le fichier suivant.

Priorisation par defaut:
1. Vues coeur de parcours (editeur_2d_global, room_editor_2d_view)
2. Composants structurants (layouts, panels, canvas)
3. Vues secondaires (dashboard, planning, tasks, works, photos, documents)

Regles:
- Ne pas remplir plusieurs fichiers d'un coup sans validation explicite.
- Ne pas inventer les points non documentes; poser des questions ciblees.
- Rendre chaque section testable.
