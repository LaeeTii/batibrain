# Project Guidelines

## Documentation First

- Before writing or changing code, consult the relevant documentation in [docs/](../docs/).
- Use [docs/product.md](../docs/product.md) for MVP scope, feature priorities, and product rules.
- Use [docs/architecture.md](../docs/architecture.md) for monorepo boundaries and responsibility split between shared, web, mobile, and Supabase.
- Use [docs/geometry.md](../docs/geometry.md) for geometric invariants, derived calculations, and unit conventions.
- Use [docs/data-model.md](../docs/data-model.md) for persistence rules, entities, and relationships.
- Use [README.md](../README.md) for the recommended development order.
- If code, request, and documentation conflict, call out the mismatch explicitly and prefer the documented rule unless the user asks to change it.

## Architecture Guardrails

- Keep geometric and shared business logic in [shared/](../shared/).
- Keep UI behavior and rendering concerns in [web/](../web/) and [mobile/](../mobile/).
- Treat Supabase and PostgreSQL as the source of truth for persisted business data.
- Keep derived values such as angles, metrics, and projections computed from source data unless the documentation is updated first.

## Product And Data Conventions

- Model a room as an ordered list of `(x, y)` vertices.
- Treat each wall as the segment between two consecutive vertices.
- Keep coordinates in a shared level coordinate system.
- Use centimeters as the business unit in calculations and persisted geometry unless the documentation for the project changes.

## Change Discipline

- When a code change modifies documented behavior, update the relevant file in [docs/](../docs/) in the same change.
- Do not introduce features beyond the current MVP priorities unless the user explicitly asks for them.
- If the documentation does not fully answer the task, make the smallest assumption consistent with the existing docs and state that assumption clearly.

## UI Guidelines

- **Always use `DashboardLayout` for new views**: Every new page in `web/src/views/` must be wrapped in the `DashboardLayout` component from `web/src/components/DashboardLayout.tsx` to ensure the sidebar (`dashboard-sidebar`) is displayed consistently across all pages.
- When creating new views, always use the defined CSS variables for button styling:
  - **Create buttons** (`Créer`, `Ajouter`, `Nouveau`): Use `--create-button-color` (green) and `--create-button-text-color` (white) with class `dashboard-createButton`
  - **View buttons** (`Vue`, `Voir`): Use `--view-button-color` (blue) and `--view-button-text-color` (white) with class `dashboard-viewButton`
  - **Export buttons** (`Export`, `Exporter`): Use `--export-button-color` (gray) and `--export-button-text-color` (white) with class `dashboard-exportButton`
  - **Outline buttons**: Keep using `dashboard-outlineButton` for secondary actions

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