-- =====================================================================
-- OrderCenter — Customer Details (business name, address, phone, status)
-- =====================================================================
-- Run this ONCE, after 005_so_pi_line_items.sql, in the Supabase SQL
-- Editor. Adds detail columns to the existing customers table — all
-- nullable/defaulted, so existing customer rows and the base create/edit
-- flow are unaffected.
--
-- `status` is a multi-select: one customer can be more than one of
-- ลูกค้า / CONSIGNEE / BUYER / NOTIFY PARTY at the same time, so it's
-- modeled as a text array rather than a single column.
-- =====================================================================

alter table public.customers
  add column business_name text,
  add column address       text,
  add column phone         text,
  add column status        text[] not null default '{}'::text[]
    check (status <@ array['ลูกค้า', 'CONSIGNEE', 'BUYER', 'NOTIFY PARTY']::text[]);
