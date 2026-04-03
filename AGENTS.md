# AGENTS Guide

This file defines how coding agents (including Codex) should implement and refactor code in this monorepo.

## Monorepo Structure

Current workspace shape:

```text
apps/
  admin/
  consumer/
packages/
  ui/
  eslint-config/
  typescript-config/
```

Architecture intent:

- `apps/*`: product applications and app-specific features.
- `packages/ui`: reusable presentational components and design primitives.
- `packages/*-config`: tooling/config only, no app runtime logic.

## Layering Rules (Strict)

Use a clear split between UI components and data layer.

- Component/UI layer:
  - Renders UI.
  - Handles local UI state and event wiring.
  - Must not call external APIs/DB clients directly.
- Data layer:
  - Owns API calls, caching, mapping/normalization, and persistence boundaries.
  - Exposes typed functions/hooks for the UI layer.
  - Contains no JSX/visual concerns.

Dependency direction must always be:

- `UI -> feature service/hook -> data layer -> external system`
- Never `data layer -> UI`

## Recommended Feature Slice

Inside each app, organize by feature first, then by layer:

```text
apps/<app>/src/
  features/
    <feature>/
      components/     # feature-local UI pieces
      hooks/          # feature orchestration hooks
      data/           # API clients, repositories, adapters
      domain/         # types, schemas, business rules
      utils/          # pure helpers local to feature
      index.ts        # public feature exports only
  shared/
    components/       # app-wide components (thin wrappers over packages/ui)
    data/             # app-wide clients (http, auth, cache, query setup)
    domain/           # shared app types/constants
```

## File Size Limits

Keep files small and cohesive.

- Soft limit: `<= 500` lines.
- Hard limit: `<= 600` lines.
- If a file approaches `450+` lines, split before adding new logic.

Split by responsibility, not arbitrarily:

- Extract data access into `data/*`.
- Extract business rules into `domain/*` or pure utils.
- Extract UI sub-sections into smaller components.

## Code Contracts for Agents

When adding/changing code, follow these contracts:

- Add or preserve explicit TypeScript types on public APIs.
- Keep business logic out of page-level components.
- Keep side effects in dedicated hooks/services, not in presentational components.
- Prefer composition over inheritance and overgrown utility files.
- Avoid cross-feature imports unless via a feature public `index.ts`.

## Import Boundaries

Allowed:

- `apps/*` can import from `packages/ui` and own app modules.
- Feature UI can import feature hooks/domain.
- Hooks/services can import data/domain/utils.

Not allowed:

- `packages/ui` importing from `apps/*`.
- UI components importing low-level API clients directly.
- Deep imports across unrelated features.

## Naming and Responsibility

- `*View` / `*Section` / `*Card`: UI-only.
- `use*`: orchestration hook, can call data layer.
- `*Repository` / `*Client` / `*Gateway`: data access.
- `*Mapper` / `*Adapter`: transforms external <-> domain models.

One file, one primary responsibility.

## Change Workflow for Codex

For each task:

1. Identify target feature and layer first.
2. Place code in the correct layer (do not shortcut by adding logic to UI files).
3. Enforce the 500/600 line limits while editing.
4. Update nearby exports (`index.ts`) intentionally.
5. Run relevant checks/tests before finalizing.

## Refactor Triggers

Refactor immediately if any of these are true:

- A component contains significant fetch/transform logic.
- A data module returns view-model-specific formatting.
- A file exceeds 600 lines.
- A feature cannot be understood without opening many unrelated files.

## Definition of Done (Architecture)

A change is complete when:

- Layer boundaries are respected.
- File sizes are within limit.
- Public interfaces are typed.
- No new circular dependencies are introduced.
- The feature remains easy to extend by another coding agent.
