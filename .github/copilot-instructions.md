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