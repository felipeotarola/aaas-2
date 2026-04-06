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

For OpenClaw-backed agent discovery in both apps (especially in production), also set at least one of:

- `OPENCLAW_HOME` (e.g. `/home/node/.openclaw`)
- `OPENCLAW_CONFIG_PATH` + `OPENCLAW_AGENTS_ROOT`
- `OPENCLAW_CONFIG_BRIDGE_URL` (fallback HTTP bridge, default probe is `http://127.0.0.1:4311/api/openclaw/config`)

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
