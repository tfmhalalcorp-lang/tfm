-- =====================================================================
-- OrderCenter — DO screen: header (DO No./DO Date) + product line items
-- =====================================================================
-- Run this ONCE, after 016_delivery_bl_upload.sql, in the Supabase SQL
-- Editor.
--
--  - delivery_orders gains do_no (manual entry) and do_date.
--  - delivery_order_items is new: which SO/PI products (and how much of
--    each) this particular DO covers — same child-table pattern as
--    delivery_order_containers.
-- =====================================================================

alter table public.delivery_orders
  add column do_no   text,
  add column do_date date;

create table public.delivery_order_items (
  id                 uuid primary key default gen_random_uuid(),
  delivery_order_id  uuid not null references public.delivery_orders(id) on delete cascade,
  product_id         uuid references public.products(id),
  qty                numeric(12,2) not null default 0 check (qty >= 0),
  created_at         timestamptz not null default now()
);

alter table public.delivery_order_items enable row level security;
create policy delivery_order_items_select on public.delivery_order_items for select to authenticated using (true);
create policy delivery_order_items_insert on public.delivery_order_items for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_order_items_update on public.delivery_order_items for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy delivery_order_items_delete on public.delivery_order_items for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create index delivery_order_items_do_idx on public.delivery_order_items(delivery_order_id);

revoke all on public.delivery_order_items from anon;
grant select, insert, update, delete on public.delivery_order_items to authenticated;
