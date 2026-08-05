-- =====================================================================
-- OrderCenter — Order Management Migration
-- =====================================================================
-- Run this ONCE, after supabase/schema.sql has already been applied, in
-- the Supabase SQL Editor. Adds the order-to-cash module: SO/PI, Production
-- Plan, Warehouse Load-Ready date, Delivery, and Accounting — plus a new
-- Products master table and one new column on the existing wh_in table.
--
-- Access model (per product decision): every table below is readable by
-- any authenticated user (other screens need to reference these via
-- dropdowns — e.g. Warehouse Stock In selecting an SO/PI), but only admin
-- can insert/update/delete for now. Widen this later by adding roles the
-- same way supabase/schema.sql does for the original tables.
-- =====================================================================


-- =====================================================================
-- 1. PRODUCTS — new master data table
-- =====================================================================
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  product_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated using (true);
create policy products_insert on public.products for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy products_update on public.products for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy products_delete on public.products for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 2. SO_PI — unified Sales Order / Proforma Invoice record
-- =====================================================================
create table public.so_pi (
  id          uuid primary key default gen_random_uuid(),
  doc_type    text not null check (doc_type in ('SO','PI')),
  doc_no      text not null unique,
  doc_date    date not null,
  customer_id uuid references public.customers(id),
  brand_id    uuid references public.brands(id),
  product_id  uuid references public.products(id),
  qty         numeric(12,2) not null default 0 check (qty >= 0),
  created_at  timestamptz not null default now()
);

alter table public.so_pi enable row level security;
create policy so_pi_select on public.so_pi for select to authenticated using (true);
create policy so_pi_insert on public.so_pi for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy so_pi_update on public.so_pi for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy so_pi_delete on public.so_pi for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 3. PRODUCTION_PLANS
-- =====================================================================
create table public.production_plans (
  id                 uuid primary key default gen_random_uuid(),
  plan_no            text not null unique,
  so_pi_id           uuid not null references public.so_pi(id) on delete restrict,
  plan_date          date not null,
  product_id         uuid references public.products(id),
  qty                numeric(12,2) not null default 0 check (qty >= 0),
  expected_load_date date,
  created_at         timestamptz not null default now()
);

alter table public.production_plans enable row level security;
create policy production_plans_select on public.production_plans for select to authenticated using (true);
create policy production_plans_insert on public.production_plans for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy production_plans_update on public.production_plans for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy production_plans_delete on public.production_plans for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 4. WH_LOAD_READY — "date ready to load", independent of wh_in
-- =====================================================================
create table public.wh_load_ready (
  id         uuid primary key default gen_random_uuid(),
  so_pi_id   uuid not null references public.so_pi(id) on delete restrict,
  ready_date date not null,
  remark     text,
  created_at timestamptz not null default now()
);

alter table public.wh_load_ready enable row level security;
create policy wh_load_ready_select on public.wh_load_ready for select to authenticated using (true);
create policy wh_load_ready_insert on public.wh_load_ready for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy wh_load_ready_update on public.wh_load_ready for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy wh_load_ready_delete on public.wh_load_ready for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 5. DELIVERIES
-- =====================================================================
create table public.deliveries (
  id                 uuid primary key default gen_random_uuid(),
  so_pi_id           uuid not null references public.so_pi(id) on delete restrict,
  bill_of_load_date  date not null,
  iv_no              text not null unique,
  created_at         timestamptz not null default now()
);

alter table public.deliveries enable row level security;
create policy deliveries_select on public.deliveries for select to authenticated using (true);
create policy deliveries_insert on public.deliveries for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy deliveries_update on public.deliveries for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy deliveries_delete on public.deliveries for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 6. ACCOUNTING_ENTRIES — keyed off a delivery's IV No.
-- =====================================================================
create table public.accounting_entries (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.deliveries(id) on delete restrict,
  due_date    date not null,
  amount      numeric(14,2) not null default 0 check (amount >= 0),
  created_at  timestamptz not null default now()
);

comment on constraint accounting_entries_delivery_id_key on public.accounting_entries is
  'One accounting/payment entry per delivery (one invoice -> one payment schedule) — relied on by the order-hub UI, which looks up "the" accounting entry for a delivery.';

alter table public.accounting_entries enable row level security;
create policy accounting_entries_select on public.accounting_entries for select to authenticated using (true);
create policy accounting_entries_insert on public.accounting_entries for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy accounting_entries_update on public.accounting_entries for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy accounting_entries_delete on public.accounting_entries for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 7. WH_IN — add SO/PI reference (nullable; existing rows unaffected)
-- =====================================================================
alter table public.wh_in add column so_pi_id uuid references public.so_pi(id);


-- =====================================================================
-- 8. GRANTS (belt-and-suspenders, same pattern as schema.sql)
-- =====================================================================
revoke all on public.products, public.so_pi, public.production_plans,
  public.wh_load_ready, public.deliveries, public.accounting_entries
  from anon;

grant select, insert, update, delete on
  public.products, public.so_pi, public.production_plans,
  public.wh_load_ready, public.deliveries, public.accounting_entries
  to authenticated;


-- =====================================================================
-- 9. INDEXES
-- =====================================================================
create index so_pi_doc_date_idx           on public.so_pi(doc_date);
create index production_plans_so_pi_idx   on public.production_plans(so_pi_id);
create index production_plans_date_idx    on public.production_plans(plan_date);
create index wh_load_ready_so_pi_idx      on public.wh_load_ready(so_pi_id);
create index wh_load_ready_date_idx       on public.wh_load_ready(ready_date);
create index deliveries_so_pi_idx         on public.deliveries(so_pi_id);
create index deliveries_date_idx          on public.deliveries(bill_of_load_date);
-- accounting_entries.delivery_id is UNIQUE above, which already creates an index for it.
create index accounting_entries_due_idx    on public.accounting_entries(due_date);
create index wh_in_so_pi_idx              on public.wh_in(so_pi_id);
