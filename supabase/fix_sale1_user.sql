-- =====================================================================
-- Fix an existing 'sale1' account (created before this password/role
-- convention existed) to match: password = sale1123, role = sale.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

update auth.users
set encrypted_password = extensions.crypt('sale1123', extensions.gen_salt('bf')),
    updated_at = now()
where email = 'sale1@tfm-internal.app';

update public.profiles set role = 'sale' where username = 'sale1';

-- Verify:
-- select username, role from public.profiles where username = 'sale1';
