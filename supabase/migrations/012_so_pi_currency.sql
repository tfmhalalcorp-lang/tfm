-- =====================================================================
-- OrderCenter — SO/PI Currency
-- =====================================================================
-- Run this ONCE, after 011_so_pi_incoterm_due_pricing.sql, in the
-- Supabase SQL Editor. Adds the currency that the line-item prices /
-- subtotal / discount / VAT / net total on an SO/PI are quoted in
-- (USD/THB/other — same free-text-with-"__other__" pattern as
-- incoterm/port/payment_term). Nullable, so existing rows are unaffected.
-- =====================================================================

alter table public.so_pi add column currency text;
