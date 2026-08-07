-- =====================================================================
-- OrderCenter — Order Hub Stages: Confirm Booking, Carton/Label Prep, DO,
-- and Delivery rework
-- =====================================================================
-- Run this ONCE, after 012_so_pi_currency.sql, in the Supabase SQL Editor.
--
--  - booking_confirmations / carton_label_preps / delivery_orders are new,
--    one row per so_pi_id (same convention as production_plans/deliveries:
--    no DB-level unique constraint, the order-hub UI treats "the latest
--    row for this so_pi_id" as authoritative).
--  - delivery_order_containers is a child table of delivery_orders, since
--    one DO can carry more than one container number.
--  - deliveries.iv_no is renamed to invoice_no (same slot, clearer name
--    now that the delivery screen also captures invoice_date/etd/eta).
--    bill_of_load_date is no longer collected by the UI, so it's relaxed
--    to nullable rather than dropped (existing values are kept).
-- =====================================================================


-- =====================================================================
-- 1. BOOKING_CONFIRMATIONS
-- =====================================================================
create table public.booking_confirmations (
  id                  uuid primary key default gen_random_uuid(),
  so_pi_id            uuid not null references public.so_pi(id) on delete restrict,
  loading_date        date,
  etd_on_board        date,
  ready_to_load_date  date,
  created_at          timestamptz not null default now()
);

alter table public.booking_confirmations enable row level security;
create policy booking_confirmations_select on public.booking_confirmations for select to authenticated using (true);
create policy booking_confirmations_insert on public.booking_confirmations for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy booking_confirmations_update on public.booking_confirmations for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy booking_confirmations_delete on public.booking_confirmations for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index booking_confirmations_so_pi_idx on public.booking_confirmations(so_pi_id);


-- =====================================================================
-- 2. CARTON_LABEL_PREPS
-- =====================================================================
create table public.carton_label_preps (
  id           uuid primary key default gen_random_uuid(),
  so_pi_id     uuid not null references public.so_pi(id) on delete restrict,
  carton_ready boolean not null default false,
  label_ready  boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.carton_label_preps enable row level security;
create policy carton_label_preps_select on public.carton_label_preps for select to authenticated using (true);
create policy carton_label_preps_insert on public.carton_label_preps for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy carton_label_preps_update on public.carton_label_preps for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy carton_label_preps_delete on public.carton_label_preps for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index carton_label_preps_so_pi_idx on public.carton_label_preps(so_pi_id);


-- =====================================================================
-- 3. DELIVERY_ORDERS + DELIVERY_ORDER_CONTAINERS
-- =====================================================================
create table public.delivery_orders (
  id         uuid primary key default gen_random_uuid(),
  so_pi_id   uuid not null references public.so_pi(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.delivery_orders enable row level security;
create policy delivery_orders_select on public.delivery_orders for select to authenticated using (true);
create policy delivery_orders_insert on public.delivery_orders for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_orders_update on public.delivery_orders for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_orders_delete on public.delivery_orders for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index delivery_orders_so_pi_idx on public.delivery_orders(so_pi_id);

create table public.delivery_order_containers (
  id                 uuid primary key default gen_random_uuid(),
  delivery_order_id  uuid not null references public.delivery_orders(id) on delete cascade,
  container_no       text not null,
  created_at         timestamptz not null default now()
);

alter table public.delivery_order_containers enable row level security;
create policy delivery_order_containers_select on public.delivery_order_containers for select to authenticated using (true);
create policy delivery_order_containers_insert on public.delivery_order_containers for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_order_containers_update on public.delivery_order_containers for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_order_containers_delete on public.delivery_order_containers for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index delivery_order_containers_do_idx on public.delivery_order_containers(delivery_order_id);


-- =====================================================================
-- 4. DELIVERIES — rework for the improved "ส่งมอบ" screen
-- =====================================================================
alter table public.deliveries rename column iv_no to invoice_no;
alter table public.deliveries alter column bill_of_load_date drop not null;

alter table public.deliveries
  add column invoice_date date,
  add column etd           date,
  add column eta           date;


-- =====================================================================
-- 5. GRANTS
-- =====================================================================
revoke all on public.booking_confirmations, public.carton_label_preps,
  public.delivery_orders, public.delivery_order_containers
  from anon;

grant select, insert, update, delete on
  public.booking_confirmations, public.carton_label_preps,
  public.delivery_orders, public.delivery_order_containers
  to authenticated;
