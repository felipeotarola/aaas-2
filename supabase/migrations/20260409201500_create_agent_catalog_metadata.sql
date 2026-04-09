create table if not exists public.agent_catalog_metadata (
  agent_id text primary key,
  description text,
  capabilities text[] not null default '{}'::text[],
  updated_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_agent_catalog_metadata_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_catalog_metadata_set_updated_at on public.agent_catalog_metadata;
create trigger agent_catalog_metadata_set_updated_at
before update on public.agent_catalog_metadata
for each row
execute function public.set_agent_catalog_metadata_updated_at();

alter table public.agent_catalog_metadata enable row level security;

grant select, insert, update, delete on public.agent_catalog_metadata to authenticated;

drop policy if exists "agent_catalog_metadata_select_all" on public.agent_catalog_metadata;
create policy "agent_catalog_metadata_select_all"
on public.agent_catalog_metadata
for select
to authenticated
using (true);

drop policy if exists "agent_catalog_metadata_insert_admin" on public.agent_catalog_metadata;
create policy "agent_catalog_metadata_insert_admin"
on public.agent_catalog_metadata
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "agent_catalog_metadata_update_admin" on public.agent_catalog_metadata;
create policy "agent_catalog_metadata_update_admin"
on public.agent_catalog_metadata
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "agent_catalog_metadata_delete_admin" on public.agent_catalog_metadata;
create policy "agent_catalog_metadata_delete_admin"
on public.agent_catalog_metadata
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
