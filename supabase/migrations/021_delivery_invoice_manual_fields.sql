-- =====================================================================
-- OrderCenter — Delivery: manual Invoice fields
-- =====================================================================
-- Run this ONCE, after 020_so_pi_deposit_date.sql, in the Supabase SQL
-- Editor. Terms of Payment wording, Total Amount in Words, and
-- Merchandise description are typed once on the "บันทึกการส่งมอบ" screen
-- and persisted here, instead of being re-typed each time the Commercial
-- Invoice is opened for printing.
-- =====================================================================

alter table public.deliveries
  add column terms_of_payment_text text,
  add column total_amount_words    text,
  add column merchandise_text      text;
