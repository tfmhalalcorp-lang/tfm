-- =====================================================================
-- Seed demo staff accounts directly via SQL
-- =====================================================================
-- Alternative to scripts/create-demo-users.js — creates the same 15 auth
-- users (+ matching `profiles` rows, via the existing handle_new_user()
-- trigger) directly in the Supabase SQL Editor, no service-role key or
-- local Node setup needed.
--
-- Run this AFTER 022_role_restructure.sql (so the 'pd'/'wh'/'qc'/'ma'/
-- 'sale' role values are already allowed by the profiles check
-- constraint).
--
-- Inserts directly into auth.users / auth.identities — Supabase's own
-- internal Auth tables, not officially part of the public API surface.
-- This is a common pattern for seeding test accounts, but it bypasses
-- Supabase's Admin API, so double-check login works after running it,
-- and re-run only on projects where a broken schema assumption here is
-- an acceptable risk (i.e. not against a project you can't afford to
-- experiment on).
--
-- Login email = <username>@tfm-internal.app (same scheme the app uses).
-- Password    = <username> + "123", e.g. pd1 -> "pd1123", admin01 -> "admin01123".
-- Safe to re-run: usernames/emails that already exist are skipped.
-- =====================================================================

-- pgcrypto provides crypt()/gen_salt() used below to hash passwords the
-- same way Supabase Auth itself does. Supabase projects normally already
-- have this in the `extensions` schema; this is just a safety net.
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_users text[][] := array[
    array['pd1','pd'],       array['pd2','pd'],       array['pd3','pd'],
    array['wh1','wh'],       array['wh2','wh'],       array['wh3','wh'],
    array['qc1','qc'],       array['qc2','qc'],       array['qc3','qc'],
    array['ma1','ma'],       array['ma2','ma'],       array['ma3','ma'],
    array['admin01','admin'], array['admin02','admin'], array['admin03','admin']
  ];
  v_row text[];
  v_username text;
  v_role text;
  v_email text;
  v_password text;
  v_domain text := 'tfm-internal.app';
  v_id uuid;
begin
  foreach v_row slice 1 in array v_users loop
    v_username := v_row[1];
    v_role     := v_row[2];
    v_email    := v_username || '@' || v_domain;
    v_password := v_username || '123';

    begin
      if exists (select 1 from auth.users where email = v_email) then
        raise notice 'SKIP % (%) - already exists', v_username, v_role;
        continue;
      end if;

      v_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
        v_email, extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('username', v_username, 'role', v_role),
        now(), now(), '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_id,
        jsonb_build_object('sub', v_id::text, 'email', v_email),
        'email', v_id::text, now(), now(), now()
      );

      raise notice 'CREATED % (%) -> password: %', v_username, v_role, v_password;
    exception when others then
      -- Isolate each user in its own sub-transaction (via this exception
      -- block) so one failure doesn't roll back and skip every other row.
      raise notice 'FAILED % (%) - %', v_username, v_role, sqlerrm;
    end;
  end loop;
end $$;

-- Verify afterwards:
-- select username, role from public.profiles where username like any (array['pd%','wh%','qc%','ma%','admin0%']) order by username;
