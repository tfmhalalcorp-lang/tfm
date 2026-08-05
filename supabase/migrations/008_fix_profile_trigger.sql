-- =====================================================================
-- OrderCenter — Fix missing/broken profile auto-creation trigger
-- =====================================================================
-- Run this ONCE, in the Supabase SQL Editor. Fixes a live-database gap:
-- accounts created via netlify/functions/admin-users.js (or the Supabase
-- Dashboard) ended up in auth.users but never got a matching row in
-- public.profiles, because the on_auth_user_created trigger from
-- schema.sql either never got created on this project or was dropped at
-- some point. Symptom: "add user" reports success, but the new account
-- never appears in Settings > Users (and can't actually log in, since
-- the whole app's role system reads from profiles).
--
-- This (re)creates the trigger/function exactly as schema.sql defines
-- them, then backfills a profiles row for every existing auth.users
-- account that's missing one — recovering the originally-intended
-- username/fullname/role from auth.users.raw_user_meta_data where
-- available (that's the metadata admin-users.js already sets on create,
-- so no data was actually lost, it just never landed in profiles).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_.-]', '_', 'g')
  );
  insert into public.profiles (id, username, fullname, role)
  values (
    new.id,
    v_username,
    coalesce(nullif(new.raw_user_meta_data->>'fullname', ''), v_username),
    coalesce(new.raw_user_meta_data->>'role', 'rpt')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: any auth.users row with no matching profiles row yet
-- (this recovers the test account you just created).
insert into public.profiles (id, username, fullname, role)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data->>'username', ''),
    regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_.-]', '_', 'g')
  ),
  coalesce(nullif(u.raw_user_meta_data->>'fullname', ''), split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'role', 'rpt')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
