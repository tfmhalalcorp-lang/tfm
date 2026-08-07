-- =====================================================================
-- OrderCenter — SO/PI Deposit Date
-- =====================================================================
-- Run this ONCE, after 019_production_plan_items.sql, in the Supabase
-- SQL Editor. Adds the deposit due date shown on the SALES ORDER report
-- when payment_term = 'Deposit' (displayed there as "30% @<date>").
-- Nullable, so existing rows are unaffected.
-- =====================================================================

alter table public.so_pi add column deposit_date date;
