-- =====================================================================
-- OrderCenter — SO/PI Shipping/Logistics Details
-- =====================================================================
-- Run this ONCE, after 002_order_management.sql, in the Supabase SQL
-- Editor. Adds shipping/logistics detail columns to the existing so_pi
-- table — all nullable, so existing SO/PI rows and the base create/edit
-- flow are unaffected.
--
-- ETD ON PO can be blank, an exact date, or "month/year only" (no day) —
-- modeled as a nullable date (day defaults to the 1st when only
-- month/year is entered) plus a boolean flag that tells the frontend
-- whether to display just "MM/YYYY" or the full date.
-- =====================================================================

alter table public.so_pi
  add column box_qty        numeric(12,2),
  add column box_type       text,
  add column container_qty  numeric(12,2),
  add column port           text,
  add column destination    text,
  add column agent          text,
  add column etd_on_po      date,
  add column etd_month_only boolean not null default false,
  add column payment_term   text check (payment_term in ('Deposit', 'Non Deposit', 'LC'));
