# AGENTS Guide

This file defines how coding agents (including Codex) should implement and refactor code in this monorepo.

## Monorepo Structure

Current workspace shape:

```text
apps/
  admin/
  agents/
packages/
  ui/
  eslint-config/
  typescript-config/
```

Architecture intent:

- `apps/*`: product applications and app-specific features.
- `packages/ui`: reusable presentational components and design primitives.
- `packages/*-config`: tooling/config only, no app runtime logic.

## Product Context (AAAS-2)

This repository is an **Agent-as-a-Service (AaaS)** extension layer on top of OpenClaw.

- OpenClaw provides runtime agent definitions, workspaces, and channel/runtime execution surfaces.
- `aaas-2` provides multi-tenant product flows:
  - consumer onboarding and agent activation (`apps/agents`)
  - admin catalog/metadata management (`apps/admin`)
  - Supabase-backed per-user state and onboarding data

Core principle: treat OpenClaw as the runtime/source-of-truth for available agents, and Supabase as the per-user state layer.

## OpenClaw Integration Surface

`aaas-2` reads runtime data directly from OpenClaw via:

- OpenClaw config files:
  - `.openclaw/openclaw.json`
  - resolved from env/path candidates such as `OPENCLAW_HOME`, `OPENCLAW_CONFIG_PATH`
- OpenClaw agent directories:
  - `.openclaw/agents/*`
- OpenClaw workspace roots:
  - `.openclaw/workspace/*`
  - used for per-user workspace resolution and onboarding flavor files
- OpenClaw bridge endpoints (when local file/binary access is unavailable):
  - config bridge (`OPENCLAW_CONFIG_BRIDGE_URL`)
  - agent bridge (`OPENCLAW_AGENT_BRIDGE_URL`)
  - gateway bridge for WhatsApp account binding flows

Data read from OpenClaw includes:

- runtime agent catalog (`id`, display name, model, status, workspace)
- runtime defaults/models from OpenClaw config
- runtime workspace template files used to seed per-user workspace docs
- runtime channel config/write targets for Telegram/WhatsApp sync

## Supabase Data Model and Relationships

Primary tables used by the product:

- `profiles`
  - key: `id` (FK -> `auth.users.id`)
  - stores user metadata and global onboarding gate: `is_onboarded`
  - `is_admin` controls admin-only capabilities
- `consumer_agent_settings`
  - key: `id`; unique (`user_id`, `agent_id`)
  - FK: `user_id` -> `auth.users.id`
  - per-user per-agent activation + runtime config overlays:
    - `is_active`
    - `tool_overrides` (channel/connection metadata, etc.)
    - `workspace_ref` (maps user+agent to a concrete OpenClaw workspace directory)
- `consumer_agent_onboarding_profiles`
  - key: (`user_id`, `agent_id`)
  - FK: `user_id` -> `auth.users.id`
  - persists onboarding-collected data:
    - user/agent naming
    - description
    - knowledge sources
    - preferred channels
    - raw onboarding payload snapshot
- `agent_catalog_metadata`
  - key: `agent_id` (runtime agent id)
  - admin-maintained catalog enrichment (description, capabilities)
  - read by consumer onboarding/discovery to improve UX labels
- `assistants` (existing table expected by app layer)
  - read for runtime-agent metadata enrichment (`runtime_agent_id`, `role_label`, `primary_channel`)

Relationship model:

- OpenClaw `agent_id` links runtime catalog entries to app-layer records (`consumer_agent_settings`, `consumer_agent_onboarding_profiles`, `agent_catalog_metadata`, `assistants.runtime_agent_id`).
- `workspace_ref` in `consumer_agent_settings` resolves into a physical workspace path under OpenClaw workspace roots.
- onboarding completion writes both:
  - relational state (Supabase tables)
  - workspace documents (`ONBOARDING_PROFILE.md`, `USER.md`, `IDENTITY.md`) in the resolved OpenClaw workspace path.

## End-to-End Flow Contract

Canonical user path:

1. Runtime agent list is loaded from OpenClaw (`/api/openclaw/agents`).
2. User starts onboarding for a selected runtime `agent_id`.
3. On completion:
   - `consumer_agent_settings` upsert activates the agent and ensures workspace resolution.
   - `consumer_agent_onboarding_profiles` upsert stores collected onboarding payload.
   - workspace flavor files are written into the resolved OpenClaw workspace directory.
   - `profiles.is_onboarded` is set for first-login gate completion.

After first onboarding:

- global `profiles.is_onboarded` is only an initial-access gate.
- additional agents are configured through scoped onboarding (`/onboarding?agentId=<id>`) from Discover.

## Critical Invariants

- Keep OpenClaw runtime catalog and app-layer user state loosely coupled by `agent_id`, not by filesystem assumptions alone.
- Never treat system/orchestrator agents (for example runtime `main`) as user-selectable onboarding targets.
- Keep network/filesystem/DB access in data layer modules; UI components should remain orchestration/presentation only.
- Any change to onboarding flow must preserve both:
  - Supabase persistence contract
  - OpenClaw workspace/document side effects.

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
