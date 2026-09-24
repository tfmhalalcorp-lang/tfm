-- =====================================================================
-- 026 — Sauce Usage (QC menu)
-- =====================================================================
-- New QC transaction screen: production date, batch, sauce brand,
-- quantity used / remaining / discarded (liters).
-- Run this AFTER 025_sauces.sql.
-- =====================================================================

create table public.qc_sauce (
  id             uuid primary key default gen_random_uuid(),
  qcsauce_date   date not null,
  batch_id       text not null references public.prod_batches(batch_id) on delete restrict,
  sauce_id       uuid not null references public.sauces(id),
  qty_used       numeric(12,2) not null default 0 check (qty_used >= 0),
  qty_remaining  numeric(12,2) not null default 0 check (qty_remaining >= 0),
  qty_waste      numeric(12,2) not null default 0 check (qty_waste >= 0),
  created_at     timestamptz not null default now()
);

alter table public.qc_sauce enable row level security;

create policy qc_sauce_select on public.qc_sauce for select to authenticated using (true);
create policy qc_sauce_insert on public.qc_sauce for insert to authenticated with check ( (select public.app_current_role()) in ('admin','qc') );
create policy qc_sauce_update on public.qc_sauce for update to authenticated using ( (select public.app_current_role()) in ('admin','qc') ) with check ( (select public.app_current_role()) in ('admin','qc') );
create policy qc_sauce_delete on public.qc_sauce for delete to authenticated using ( (select public.app_current_role()) in ('admin','qc') );

revoke all on public.qc_sauce from anon;
grant select, insert, update, delete on public.qc_sauce to authenticated;

create index qc_sauce_batch_id_idx on public.qc_sauce(batch_id);
create index qc_sauce_date_idx     on public.qc_sauce(qcsauce_date);
