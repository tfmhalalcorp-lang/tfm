-- =====================================================================
-- 027 — Waste Log (MA) — reuses the shared qc_waste table
-- =====================================================================
-- Adds a 4th department to the existing waste-log table (previously
-- PD/WH/QC only): 'MA'. Unlike the other three, the MA entry form only
-- captures a plain quantity + which machine it happened on (no batch, no
-- can size, no waste-category breakdown) — so batch_id/cansize_id are
-- widened to nullable, and two new columns are added: machine_id (FK to
-- machines) and waste_qty (the plain quantity).
-- =====================================================================

alter table public.qc_waste alter column batch_id drop not null;
alter table public.qc_waste alter column cansize_id drop not null;

alter table public.qc_waste add column machine_id uuid references public.machines(id);
alter table public.qc_waste add column waste_qty numeric(12,2) not null default 0 check (waste_qty >= 0);

alter table public.qc_waste drop constraint qc_waste_department_check;
alter table public.qc_waste add constraint qc_waste_department_check check (department in ('PD','WH','QC','MA'));

drop policy qc_waste_insert on public.qc_waste;
drop policy qc_waste_update on public.qc_waste;
drop policy qc_waste_delete on public.qc_waste;

create policy qc_waste_insert on public.qc_waste for insert to authenticated with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
  or ( (select public.app_current_role()) = 'ma' and department = 'MA' )
);
create policy qc_waste_update on public.qc_waste for update to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
  or ( (select public.app_current_role()) = 'ma' and department = 'MA' )
) with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
  or ( (select public.app_current_role()) = 'ma' and department = 'MA' )
);
create policy qc_waste_delete on public.qc_waste for delete to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
  or ( (select public.app_current_role()) = 'ma' and department = 'MA' )
);

create index qc_waste_machine_id_idx on public.qc_waste(machine_id);
