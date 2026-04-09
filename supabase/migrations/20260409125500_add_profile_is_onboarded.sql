alter table public.profiles
  add column if not exists is_onboarded boolean;

update public.profiles
set is_onboarded = false
where is_onboarded is null;

alter table public.profiles
  alter column is_onboarded set default false,
  alter column is_onboarded set not null;

grant update (is_onboarded) on public.profiles to authenticated;
