-- =====================================================================
-- 028 — ส่วนงานบัญชี: currency + payment installments
-- =====================================================================
-- accounting_entries used to be capped at exactly one row per delivery
-- (a `unique (delivery_id)` constraint — "one invoice -> one payment
-- schedule"). This lifts that cap so a delivery can have several
-- payment installments (งวดที่ 1, 2, 3, ...), and adds a currency
-- (USD/THB) tag per entry.
-- =====================================================================

alter table public.accounting_entries drop constraint accounting_entries_delivery_id_key;

alter table public.accounting_entries add column currency text not null default 'USD' check (currency in ('USD','THB'));
alter table public.accounting_entries add column installment_no integer not null default 1 check (installment_no >= 1);

comment on table public.accounting_entries is
  'Payment schedule for a delivery/invoice — one row per installment '
  '(installment_no, due_date, amount, currency). A delivery may have '
  'several rows (one per installment).';

create index accounting_entries_delivery_id_idx on public.accounting_entries(delivery_id);
