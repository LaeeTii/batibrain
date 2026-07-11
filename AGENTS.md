# Instructions du projet BatiBrain

## Documentation obligatoire

- Lire d’abord `docs/projet.md`, puis les sources fiables qu’il déclare.
- Considérer `docs/ihm/` comme la source fonctionnelle principale par défaut.
- En cas de conflit entre documents, demander un arbitrage explicite avant de coder.
- Mettre à jour la documentation concernée dans le même changement lorsqu’un comportement documenté évolue.
- Ne pas introduire de fonctionnalité au-delà de la version cible validée sans demande explicite.
- Si la documentation est incomplète, faire l’hypothèse minimale compatible et l’indiquer clairement.

## Architecture et données

- Conserver les types et la logique métier frontend dans `web/src/domain/`.
- Conserver le comportement et le rendu de l’interface dans `web/`.
- Utiliser Supabase et PostgreSQL comme sources de vérité des données persistées.
- Représenter une pièce par une liste ordonnée de sommets `(x, y)` et chaque mur par le segment entre deux sommets consécutifs.
- Utiliser un système de coordonnées commun au niveau et les centimètres comme unité métier.
- Calculer les angles, métriques et projections à partir des données sources plutôt que de les persister.

## Langue

- Toujours utiliser les accents en français dans le Markdown, les commentaires, les libellés, les messages et les chaînes, sauf contrainte technique explicite.

## État de fraîcheur

Ne pas considérer comme sources de vérité fonctionnelles tant qu’ils ne sont pas remis à jour :

- `supabase/migrations/20260703_000001_init.sql` ;
- le code et la documentation sous `web/`.

## Workflow Git

- Utiliser des commandes Git non interactives.
- Ne jamais utiliser `git push --force`, `git reset --hard` ou `git checkout --` sans demande explicite.
- Formater les commits avec `<type>(<scope>): <description en français> <ticket>`.
- Exiger un ticket pour `feat`, `fix`, `style` et `perf` ; ne pas l’exiger pour `tech`, `ci`, `refactor`, `revert`, `docs`, `chore`, `build` et `test`.
- Utiliser un ticket au format `#TICKET-123` ou `#TICKET-123.1` et une description de 4 à 100 caractères.
- Nommer les branches selon `<type>/<description-kebab-case>-<ticket>` lorsque le ticket est applicable.
- Vérifier les tests et le lint applicables avant un commit.
- Fusionner les PR avec un merge commit, sans squash ni rebase, sauf instruction explicite contraire.
