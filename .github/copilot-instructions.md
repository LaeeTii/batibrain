# Project Guidelines

## Point d'entrée documentaire (obligatoire)

- Lire d'abord [docs/projet.md](../docs/projet.md).
- Utiliser ensuite les sources fiables déclarées dans [docs/projet.md](../docs/projet.md):
	- [docs/product.md](../docs/product.md)
	- [docs/architecture.md](../docs/architecture.md)
	- [docs/spec.md](../docs/spec.md)
	- [docs/ihm/](../docs/ihm/)
- La source fonctionnelle principale par défaut est [docs/ihm/](../docs/ihm/).
- En cas de conflit entre documents, demander un arbitrage explicite à l'utilisateur au cas par cas avant de coder.

## Répartition des rôles documentaires

- [docs/projet.md](../docs/projet.md): gouvernance projet (sources fiables, roadmap SemVer, workflow feature, DoD, état de fraîcheur).
- [.github/copilot-instructions.md](./copilot-instructions.md): règles d'exécution pour l'agent et garde-fous de contribution.

## Architecture Guardrails

- Keep frontend domain types and geometric business logic in [web/src/domain/](../web/src/domain/).
- Keep UI behavior and rendering concerns in [web/](../web/) including the PWA target.
- Use React-Konva as the default rendering and interaction engine for canvas features in [web/](../web/); avoid adding new SVG-based canvas implementations.
- Treat Supabase and PostgreSQL as the source of truth for persisted business data.
- Keep derived values such as angles, metrics, and projections computed from source data unless the documentation is updated first.

## Product And Data Conventions

- Model a room as an ordered list of `(x, y)` vertices.
- Treat each wall as the segment between two consecutive vertices.
- Keep coordinates in a shared level coordinate system.
- Use centimeters as the business unit in calculations and persisted geometry unless the documentation for the project changes.

## Change Discipline

- When a code change modifies documented behavior, update the relevant file in [docs/](../docs/) in the same change.
- Do not introduce features beyond the validated target version unless the user explicitly asks for them.
- If the documentation does not fully answer the task, make the smallest assumption consistent with the existing docs and state that assumption clearly.
- Ne pas ajouter de bloc de texte informatif (info, note, astuce, bannière d’aide) dans l’interface ou la documentation produit sans demande explicite de l’utilisateur.
- Pour les vues d'édition, ne demander une confirmation de navigation que lors d'une sortie effective de la vue (changement d'écran, fermeture d'onglet, rechargement), jamais lors d'un changement de contexte interne à la même vue.
- En cas d'échec d'auto-sauvegarde, n'afficher qu'un seul message utilisateur non redondant par vue.
- Ne pas afficher de message de succès générique après une action standard (exemple: « Modification appliquée. ») sans demande explicite de l'utilisateur.
- Toujours utiliser les accents en francais lors de la generation de texte (Markdown) et de texte dans le code (commentaires, labels UI, messages, chaines). Ne pas produire de francais sans accents sauf contrainte technique explicite.

## Statut de fraîcheur (rappel)

- Les artefacts suivants sont actuellement non à jour et ne doivent pas servir de source de vérité fonctionnelle:
	- Le code et la documentation sous [web/](../web/)

## Autres Guidelines Spécifiques
| **Thématique**       | **Fichier**                                  | **Description**                                  |
|----------------------|--------------------------------------------|------------------------------------------------|
| **Frontend**         | [frontend.instructions.md](./frontend.instructions.md) | Regles pour les vues, composants et styles web. |
| **IHM**              | [ihm.instructions.md](./ihm.instructions.md) | Routeur de lecture vers la specification IHM (vues, composants, logique). |
| **Modèle de données**| [data-model-guidelines.instructions.md](./data-model-guidelines.instructions.md) | Règles métiers et conventions de données. |
| **Workflow Git**     | [git-workflow.instructions.md](./git-workflow.instructions.md) | Conventional Commit et bonnes pratiques Git. |

---

## Utilisation du conventionnal commit pour git :
### Types Requiring Ticket Reference
- `feat` - New features
- `fix` - Bug fixes  
- `style` - Code style changes (formatting, missing semi-colons, etc.)
- `perf` - Performance improvements

### Types NOT Requiring Ticket Reference
- `tech` - Technical changes
- `ci` - CI/CD configuration changes
- `refactor` - Code refactoring (no functional changes)
- `revert` - Reverting commits
- `docs` - Documentation changes
- `chore` - Miscellaneous changes
- `build` - Build system changes
- `test` - Test-related changes

### Commit Message Format
```
<type>(<scope>): <description en français> <ticket>
```

- **type**: One of the allowed types above
- **scope** (optional): Context of the commit in parentheses
- **description**: Clear summary in French (4-100 characters)
- **ticket**: Required for `feat`, `fix`, `style`, `perf` types - format `#TICKET-NUMBER` or `#TICKET-NUMBER.SUBNUMBER` (e.g., `#JIRA-1.1`)

### Examples
```
feat(login): ajouter le support Google OAuth #AUTH-456
fix(api): gérer les valeurs nulles dans l'endpoint user #API-789
style(component): mettre à jour le style des boutons #UI-234
perf(query): optimiser les requêtes de la base de données #DB-567

tech: mettre à jour la version de node
docs: mettre à jour le README
chore: nettoyer les fichiers temporaires
```

### Usage

#### To create a commit message:
1. Describe your changes briefly
2. This skill will help format it properly
3. Confirm the final message before committing

#### To validate existing commit messages:
1. Provide commit messages to check
2. This skill will identify which ones follow the rules

### Git Integration

This skill can be used with the git tool to:
- Prepare commit messages before committing
- Validate recent commits against the rules
- Guide users through creating properly formatted commits

### Validation Patterns

The skill uses these regex patterns:
- With ticket: `^(feat|fix|style|perf)(\(.+\))?( )?: .{4,100} #[A-Z]+-[0-9]+(?:\.[0-9]+)?$`
- Without ticket: `^(tech|ci|refactor|revert|docs|chore|build|test)(\(.+\))?( )?: .{4,100}$`
- Merge commits: `^Merge .+` (automatically accepted)

Merge commits from pull requests are automatically accepted as valid.
