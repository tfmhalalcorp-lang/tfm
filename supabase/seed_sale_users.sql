-- =====================================================================
-- Seed SALE staff accounts directly via SQL
-- =====================================================================
-- Same pattern as seed_demo_users.sql — creates sale1/sale2/sale3 with
-- role 'sale' (จัดการคำสั่งซื้อ + รายงาน).
--
-- Login email = <username>@tfm-internal.app
-- Password    = <username> + "123", e.g. sale1 -> "sale1123".
-- Safe to re-run: usernames/emails that already exist are skipped.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_users text[][] := array[
    array['sale1','sale'], array['sale2','sale'], array['sale3','sale']
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
      raise notice 'FAILED % (%) - %', v_username, v_role, sqlerrm;
    end;
  end loop;
end $$;

-- Verify afterwards:
-- select username, role from public.profiles where username like 'sale%' order by username;
