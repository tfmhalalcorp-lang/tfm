-- =====================================================================
-- 023 — Empty Can Usage (Production menu)
-- =====================================================================
-- Replaces "Can Usage" on the PRODUCTION menu with a new "Empty Can
-- Usage" screen: date, supplier, can size, quantity. Independent of any
-- production batch (unlike prod_can, used by the QC menu's own Can Usage
-- screen, which is unchanged).
--
-- Run this once, after 022_role_restructure.sql.
-- =====================================================================

create table public.prod_emptycan (
  id                uuid primary key default gen_random_uuid(),
  prodemptycan_date date not null,
  supplier_id       uuid not null references public.suppliers(id),
  cansize_id        uuid not null references public.can_sizes(id),
  qty               numeric(12,2) not null default 0 check (qty >= 0),
  created_at        timestamptz not null default now()
);

alter table public.prod_emptycan enable row level security;

create policy prod_emptycan_select on public.prod_emptycan for select to authenticated using (true);
create policy prod_emptycan_insert on public.prod_emptycan for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_emptycan_update on public.prod_emptycan for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_emptycan_delete on public.prod_emptycan for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );

revoke all on public.prod_emptycan from anon;
grant select, insert, update, delete on public.prod_emptycan to authenticated;

create index prod_emptycan_date_idx        on public.prod_emptycan(prodemptycan_date);
create index prod_emptycan_supplier_id_idx on public.prod_emptycan(supplier_id);
create index prod_emptycan_cansize_id_idx  on public.prod_emptycan(cansize_id);
