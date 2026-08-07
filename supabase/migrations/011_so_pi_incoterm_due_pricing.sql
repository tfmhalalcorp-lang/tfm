-- =====================================================================
-- OrderCenter — SO/PI Incoterm, Due Date, Item Pricing, Discount/VAT
-- =====================================================================
-- Run this ONCE, after 010_rm_price.sql, in the Supabase SQL Editor.
--
--  - so_pi.box_type is renamed to incoterm — it was a free-text "box
--    type" field, now repurposed to hold the shipping Incoterm
--    (FOB/CRF/CNF/FAS/other), same text-with-"__other__" pattern as
--    port/payment_term already use. Renamed (not a new column) since
--    it's the same slot in the form, just redefined — no data is lost,
--    existing values just get reinterpreted going forward.
--  - so_pi.delivery_due_date is new — a manually-entered delivery due
--    date, replacing the "Agent" field in that spot (agent column is
--    left in place, just no longer surfaced in the UI for now).
--  - so_pi.discount / so_pi.vat_percent are new header-level fields for
--    the order total (subtotal itself is always computed live from
--    so_pi_items, never stored, so it can't go stale).
--  - so_pi_items.unit_price is new — line total (qty × unit_price) is
--    likewise always computed, never stored.
-- =====================================================================

alter table public.so_pi rename column box_type to incoterm;

alter table public.so_pi
  add column delivery_due_date date,
  add column discount         numeric(12,2),
  add column vat_percent      numeric(5,2);

alter table public.so_pi_items
  add column unit_price numeric(12,2);
