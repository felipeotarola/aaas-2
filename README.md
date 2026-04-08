# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Supabase auth setup (admin + agents)

Both `apps/admin` and `apps/agents` now use the same Supabase Auth project.

### 1) Configure env

Copy env files for both apps:

```bash
cp apps/admin/.env.example apps/admin/.env.local
cp apps/agents/.env.example apps/agents/.env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

For OpenClaw-backed discovery/chat, this repo now defaults to a single-VPS-friendly setup and most OpenClaw env keys are optional.

Recommended minimal setup:

- `OPENCLAW_GATEWAY_TOKEN` (**required** for WhatsApp gateway auth)
- `OPENCLAW_CONFIG_BRIDGE_URL` (optional override; if unset the app probes:
  `http://127.0.0.1:4311/api/openclaw/config`, then
  `https://agents.felipeotarola.com/api/openclaw/config`)

Optional overrides (only if your deployment differs from defaults):

- `OPENCLAW_GATEWAY_WS_URL` / `OPENCLAW_GATEWAY_URL` (otherwise defaults resolve to local gateway `ws://127.0.0.1:18789/ws`)
- `OPENCLAW_CONFIG_PATH` (otherwise writable paths are probed, including `/var/lib/openclaw/openclaw.json` and `/tmp/.openclaw/openclaw.json`)
- `OPENCLAW_CLI_PATH` (CLI path override; not required when bridge/local gateway paths work)
- `OPENCLAW_AGENT_BRIDGE_URL`, `OPENCLAW_AGENT_BRIDGE_TOKEN`, `OPENCLAW_CONFIG_BRIDGE_TOKEN`

### 2) Apply DB migration

Run the SQL in:

- `supabase/migrations/20260403_create_profiles.sql`

This creates `public.profiles` with `is_admin boolean`.

### 3) Grant admin access

Set `profiles.is_admin = true` for users that should access `apps/admin`.

Example SQL:

```sql
update public.profiles
set is_admin = true
where email = 'admin@example.com';
```

Users without `is_admin=true` can still use `apps/agents`, but are blocked from `apps/admin`.

## Adding components

To add components to your app, run the following command at the root of your `admin` app:

```bash
pnpm dlx shadcn@latest add button -c apps/admin
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
