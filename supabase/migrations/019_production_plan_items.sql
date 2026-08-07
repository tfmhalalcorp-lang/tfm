-- =====================================================================
-- OrderCenter — Production Plan: multiple plans per SO/PI + line items
-- =====================================================================
-- Run this ONCE, after 018_delivery_bl_google_drive.sql, in the Supabase
-- SQL Editor.
--
-- production_plan_items is new: which SO/PI products (and how much of
-- each) a given production plan covers — same child-table pattern as
-- delivery_order_items. production_plans itself already allowed more
-- than one row per so_pi_id (no unique constraint), so "multiple plans
-- per SO" needed no schema change there — only the order-hub UI treated
-- it as one-per-SO/PI, which is now fixed to a list+form like the DO
-- screen. production_plans.qty is kept and now holds the sum of this
-- plan's item quantities (product_id stays unused/null, same as before).
-- =====================================================================

create table public.production_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.production_plans(id) on delete cascade,
  product_id  uuid references public.products(id),
  qty         numeric(12,2) not null default 0 check (qty >= 0),
  created_at  timestamptz not null default now()
);

alter table public.production_plan_items enable row level security;
create policy production_plan_items_select on public.production_plan_items for select to authenticated using (true);
create policy production_plan_items_insert on public.production_plan_items for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy production_plan_items_update on public.production_plan_items for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy production_plan_items_delete on public.production_plan_items for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index production_plan_items_plan_idx on public.production_plan_items(plan_id);

revoke all on public.production_plan_items from anon;
grant select, insert, update, delete on public.production_plan_items to authenticated;
