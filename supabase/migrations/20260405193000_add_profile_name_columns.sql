alter table public.profiles
  add column if not exists full_name text,
  add column if not exists name text,
  add column if not exists first_name text,
  add column if not exists last_name text;

update public.profiles as p
set
  full_name = coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), '')
  ),
  name = coalesce(
    nullif(btrim(p.name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
  ),
  first_name = coalesce(
    nullif(btrim(p.first_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'first_name'), '')
  ),
  last_name = coalesce(
    nullif(btrim(p.last_name), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'last_name'), '')
  )
from auth.users as u
where p.id = u.id;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  next_full_name text := coalesce(
    nullif(btrim(meta ->> 'full_name'), ''),
    nullif(btrim(meta ->> 'name'), '')
  );
  next_name text := coalesce(
    nullif(btrim(meta ->> 'name'), ''),
    nullif(btrim(meta ->> 'full_name'), '')
  );
  next_first_name text := nullif(btrim(meta ->> 'first_name'), '');
  next_last_name text := nullif(btrim(meta ->> 'last_name'), '');
begin
  insert into public.profiles (id, email, full_name, name, first_name, last_name)
  values (new.id, new.email, next_full_name, next_name, next_first_name, next_last_name)
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      name = coalesce(excluded.name, public.profiles.name),
      first_name = coalesce(excluded.first_name, public.profiles.first_name),
      last_name = coalesce(excluded.last_name, public.profiles.last_name),
      updated_at = now();

  return new;
end;
$$;
