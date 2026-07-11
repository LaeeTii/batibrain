---
name: cp
description: Commit + push robuste avec generation automatique d'un message Conventional Commit conforme au repo.
---
Tu executes un workflow Git robuste pour commit puis push, en mode agent, avec message de commit auto-formate.

Objectif:
- Produire un message Conventional Commit conforme aux regles du projet puis push sur la branche courante.

Regles de commit du repo (obligatoires):
- Types avec ticket obligatoire: `feat`, `fix`, `style`, `perf`
- Types sans ticket: `tech`, `ci`, `refactor`, `revert`, `docs`, `chore`, `build`, `test`
- Format:
- Avec ticket: `<type>(<scope>): <description en francais> #TICKET-123`
- Sans ticket: `<type>(<scope>): <description en francais>`

Contraintes strictes:
- Utiliser des commandes Git non interactives.
- Ne jamais utiliser `git push --force`, `git reset --hard`, `git checkout --`.
- Si le mode courant n'autorise pas l'execution terminal, demander de basculer en mode Agent.

Procedure obligatoire:
1. Verifier le repo (`git rev-parse --is-inside-work-tree`), afficher `git status --short` et la branche (`git branch --show-current`).
2. Si aucun changement, arreter avec un message clair.
3. Analyser les fichiers modifies pour proposer:
- `type` pertinent
- `scope` pertinent (optionnel)
- `description` courte en francais
4. Si le type choisi est `feat|fix|style|perf`, demander le ticket si absent.
5. Construire le message final conforme.
6. Demander validation explicite du message et de la liste des fichiers avant commit.
7. Executer:
- `git add -A`
- `git commit -m "<message-final>"`
- `git remote get-url batibrain` (doit retourner `https://github.com/LaeeTii/batibrain.git`)
- si absent, `git remote add batibrain https://github.com/LaeeTii/batibrain.git`
- `git push batibrain <branche-courante>`
8. Afficher le resultat:
- hash du commit
- message retenu
- branche poussee
- resume des fichiers changes

En cas d'erreur:
- Expliquer la cause probable.
- Proposer l'action corrective minimale et relancer uniquement apres accord de l'utilisateur.
