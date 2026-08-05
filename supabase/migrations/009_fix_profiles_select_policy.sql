-- =====================================================================
-- OrderCenter — Fix missing/broken profiles read policy
-- =====================================================================
-- Run this ONCE, in the Supabase SQL Editor, after 008_fix_profile_trigger.sql.
-- Fixes a live-database gap: Settings > Users shows "ไม่พบข้อมูล" (no data)
-- even for the logged-in admin's own account. The profiles table has Row
-- Level Security enabled, but the rule that's supposed to let a logged-in
-- user read their own row (or every row, if they're admin) is missing on
-- this project — so every read returns zero rows, even though the data
-- itself is fine. This just (re)creates that one rule, exactly as
-- schema.sql defines it.
-- =====================================================================

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or (select public.app_current_role()) = 'admin' );
