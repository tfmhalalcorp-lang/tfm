-- =====================================================================
-- OrderCenter — SO/PI Consignee / Buyer / Notify Party
-- =====================================================================
-- Run this ONCE, after 006_customer_details.sql, in the Supabase SQL
-- Editor. Each SO/PI can reference a customer (from the customers table,
-- see 006 for the customer.status multi-select) to fill the CONSIGNEE,
-- BUYER, and NOTIFY PARTY roles on the shipping document. All three are
-- independent, nullable references — a document can leave any of them
-- blank, and picking one has no bearing on the others.
-- =====================================================================

alter table public.so_pi
  add column consignee_id   uuid references public.customers(id) on delete set null,
  add column buyer_id       uuid references public.customers(id) on delete set null,
  add column notify_party_id uuid references public.customers(id) on delete set null;

create index so_pi_consignee_idx    on public.so_pi(consignee_id);
create index so_pi_buyer_idx        on public.so_pi(buyer_id);
create index so_pi_notify_party_idx on public.so_pi(notify_party_id);
