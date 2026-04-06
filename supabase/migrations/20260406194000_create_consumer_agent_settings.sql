create table if not exists public.consumer_agent_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text not null,
  is_active boolean not null default false,
  tool_overrides jsonb not null default '{}'::jsonb,
  workspace_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consumer_agent_settings
  add column if not exists user_id uuid,
  add column if not exists agent_id text,
  add column if not exists is_active boolean,
  add column if not exists tool_overrides jsonb,
  add column if not exists workspace_ref text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.consumer_agent_settings
set
  is_active = coalesce(is_active, false),
  tool_overrides = coalesce(tool_overrides, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  is_active is null
  or tool_overrides is null
  or created_at is null
  or updated_at is null;

alter table public.consumer_agent_settings
  alter column user_id set not null,
  alter column agent_id set not null,
  alter column is_active set default false,
  alter column is_active set not null,
  alter column tool_overrides set default '{}'::jsonb,
  alter column tool_overrides set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'consumer_agent_settings_user_id_agent_id_key'
  ) then
    alter table public.consumer_agent_settings
      add constraint consumer_agent_settings_user_id_agent_id_key unique (user_id, agent_id);
  end if;
end
$$;

create index if not exists consumer_agent_settings_user_id_idx
  on public.consumer_agent_settings (user_id);

create or replace function public.set_consumer_agent_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists consumer_agent_settings_set_updated_at on public.consumer_agent_settings;
create trigger consumer_agent_settings_set_updated_at
before update on public.consumer_agent_settings
for each row
execute function public.set_consumer_agent_settings_updated_at();

alter table public.consumer_agent_settings enable row level security;

grant select, insert, update, delete on public.consumer_agent_settings to authenticated;

drop policy if exists "consumer_agent_settings_select_own" on public.consumer_agent_settings;
create policy "consumer_agent_settings_select_own"
on public.consumer_agent_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "consumer_agent_settings_insert_own" on public.consumer_agent_settings;
create policy "consumer_agent_settings_insert_own"
on public.consumer_agent_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "consumer_agent_settings_update_own" on public.consumer_agent_settings;
create policy "consumer_agent_settings_update_own"
on public.consumer_agent_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "consumer_agent_settings_delete_own" on public.consumer_agent_settings;
create policy "consumer_agent_settings_delete_own"
on public.consumer_agent_settings
for delete
to authenticated
using (auth.uid() = user_id);
