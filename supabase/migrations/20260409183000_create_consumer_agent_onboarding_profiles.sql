create table if not exists public.consumer_agent_onboarding_profiles (
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id text not null,
  user_name text,
  agent_name text,
  agent_description text,
  knowledge_sources jsonb not null default '[]'::jsonb,
  channels text[] not null default '{}'::text[],
  onboarding_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_id)
);

create or replace function public.set_consumer_agent_onboarding_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists consumer_agent_onboarding_profiles_set_updated_at on public.consumer_agent_onboarding_profiles;
create trigger consumer_agent_onboarding_profiles_set_updated_at
before update on public.consumer_agent_onboarding_profiles
for each row
execute function public.set_consumer_agent_onboarding_profiles_updated_at();

alter table public.consumer_agent_onboarding_profiles enable row level security;

grant select, insert, update on public.consumer_agent_onboarding_profiles to authenticated;

drop policy if exists "consumer_agent_onboarding_profiles_select_own" on public.consumer_agent_onboarding_profiles;
create policy "consumer_agent_onboarding_profiles_select_own"
on public.consumer_agent_onboarding_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "consumer_agent_onboarding_profiles_insert_own" on public.consumer_agent_onboarding_profiles;
create policy "consumer_agent_onboarding_profiles_insert_own"
on public.consumer_agent_onboarding_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "consumer_agent_onboarding_profiles_update_own" on public.consumer_agent_onboarding_profiles;
create policy "consumer_agent_onboarding_profiles_update_own"
on public.consumer_agent_onboarding_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
