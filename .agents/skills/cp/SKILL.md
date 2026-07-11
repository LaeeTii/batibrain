---
name: cp
description: Créer un message Conventional Commit conforme au dépôt, faire valider les fichiers et le message, committer puis pousser la branche courante. Utiliser lorsque l’utilisateur demande de commit, de pousser les changements, de faire un commit et push, ou invoque le workflow cp.
---

# Commit et push

- Suivre les règles Git du `AGENTS.md` racine.
- Utiliser des commandes Git non interactives.
- Ne jamais utiliser `git push --force`, `git reset --hard` ou `git checkout --`.
- Ne jamais inclure de changement hors périmètre sans validation.

## Procédure

1. Vérifier le dépôt, le statut, la branche et le diff pertinent.
2. Arrêter clairement si aucun changement n’est présent.
3. Déterminer le type, le scope éventuel et une description courte en français.
4. Demander le ticket requis s’il manque.
5. Présenter le message et la liste exacte des fichiers, puis demander une validation explicite.
6. Ajouter uniquement les fichiers validés et créer le commit.
7. Vérifier que le remote cible pointe vers `https://github.com/LaeeTii/batibrain.git`. Utiliser `origin` par défaut.
8. Pousser la branche courante sans forcer.
9. Afficher le hash, le message, la branche distante et le résumé des fichiers.

En cas d’erreur, expliquer la cause et proposer l’action corrective minimale avant de relancer.
