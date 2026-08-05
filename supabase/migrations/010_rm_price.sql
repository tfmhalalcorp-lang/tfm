-- =====================================================================
-- OrderCenter — RM Price
-- =====================================================================
-- Run this ONCE, after 009_fix_profiles_select_policy.sql, in the
-- Supabase SQL Editor. Adds a price column to prod_rm (Production: RM
-- Usage) so each raw-material receipt can record its price — nullable,
-- so existing rows and the base insert/update flow are unaffected. Used
-- by the new RM price analysis report (admin-only).
-- =====================================================================

alter table public.prod_rm
  add column rm_price numeric(12,2);
