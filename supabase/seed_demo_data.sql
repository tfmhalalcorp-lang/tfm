-- =====================================================================
-- OrderCenter — Demo/Test Data (RESTORE SCRIPT)
-- =====================================================================
-- HOW TO RUN (restore into Supabase):
--   1. Open the target Supabase project → SQL Editor → New query.
--   2. Paste this entire file and click Run (or: `supabase db execute
--      -f supabase/seed_demo_data.sql`, or `psql "$DATABASE_URL" -f
--      supabase/seed_demo_data.sql`).
--   3. Requires the schema to already be migrated through
--      021_delivery_invoice_manual_fields.sql.
--
-- WHAT THIS CREATES
--   A small self-contained demo dataset for exercising the order
--   pipeline end to end: 5 customers, 3 brands, 4 products (all coded
--   "DEMO-…" so they're trivially identifiable and never collide with
--   real data), plus 16 SO/PI orders dated every day from 1–12 Aug 2026
--   (1–2 per day), deliberately spread across every stage of the
--   pipeline — some brand new, some mid-plan, some booking-pending,
--   some booking-confirmed, some DO'd, some fully invoiced/accounted —
--   so every dashboard card, chart, and completeness-notification rule
--   has real data to show immediately after seeding.
--
-- IDEMPOTENCY
--   Safe to run more than once. Master data and so_pi use
--   `on conflict (<unique code>) do nothing`. so_pi's child tables
--   have no natural unique key (same convention as the rest of the
--   app — "the row for this so_pi_id" is authoritative), so each of
--   those inserts is guarded with `where not exists (...)` keyed on
--   the parent id instead.
-- =====================================================================


-- =====================================================================
-- 1. MASTER DATA
-- =====================================================================

insert into public.customers (customer_code, customer_name) values ('DEMO-CUST-01', 'Demo Customer — Sunrise Import') on conflict (customer_code) do nothing;
insert into public.customers (customer_code, customer_name) values ('DEMO-CUST-02', 'Demo Customer — Ocean Trading') on conflict (customer_code) do nothing;
insert into public.customers (customer_code, customer_name) values ('DEMO-CUST-03', 'Demo Customer — Golden Harbor') on conflict (customer_code) do nothing;
insert into public.customers (customer_code, customer_name) values ('DEMO-CUST-04', 'Demo Customer — Blue Wave') on conflict (customer_code) do nothing;
insert into public.customers (customer_code, customer_name) values ('DEMO-CUST-05', 'Demo Customer — Pacific Star') on conflict (customer_code) do nothing;

insert into public.brands (brand_code, brand_name, customer_id) values ('DEMO-BR-01', 'Demo Brand — Sunrise', (select id from public.customers where customer_code = 'DEMO-CUST-01')) on conflict (brand_code) do nothing;
insert into public.brands (brand_code, brand_name, customer_id) values ('DEMO-BR-02', 'Demo Brand — Ocean', (select id from public.customers where customer_code = 'DEMO-CUST-02')) on conflict (brand_code) do nothing;
insert into public.brands (brand_code, brand_name, customer_id) values ('DEMO-BR-03', 'Demo Brand — Golden', (select id from public.customers where customer_code = 'DEMO-CUST-03')) on conflict (brand_code) do nothing;

insert into public.products (product_code, product_name) values ('DEMO-PRD-01', 'Demo Tuna Chunk in Oil') on conflict (product_code) do nothing;
insert into public.products (product_code, product_name) values ('DEMO-PRD-02', 'Demo Tuna Flakes in Brine') on conflict (product_code) do nothing;
insert into public.products (product_code, product_name) values ('DEMO-PRD-03', 'Demo Sardine in Tomato Sauce') on conflict (product_code) do nothing;
insert into public.products (product_code, product_name) values ('DEMO-PRD-04', 'Demo Mackerel in Oil') on conflict (product_code) do nothing;

-- Reuses the real can-size codes if they already exist (no-op via
-- on conflict); creates them if this is a bare-schema/test project.
insert into public.can_sizes (cansize_code, cansize_name) values ('202x308', 'Jitney') on conflict (cansize_code) do nothing;
insert into public.can_sizes (cansize_code, cansize_name) values ('300x407', 'Tall Tin') on conflict (cansize_code) do nothing;


-- =====================================================================
-- 2. SO/PI ORDERS — one block per order (header, items, then whichever
--    downstream stage rows this demo order has reached)
-- =====================================================================

-- ---------------------------------------------------------------------
-- #1  DEMO-SO-20260801-1 — fully complete (invoice + accounting)
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, buyer_id, port, destination, incoterm, currency, payment_term, agent, delivery_due_date, discount, vat_percent, box_qty, container_qty)
values ('SO', 'DEMO-SO-20260801-1', '2026-08-01', (select id from public.customers where customer_code = 'DEMO-CUST-01'), (select id from public.customers where customer_code = 'DEMO-CUST-01'), (select id from public.customers where customer_code = 'DEMO-CUST-01'), 'Laem Chabang', 'Los Angeles, USA', 'FOB', 'USD', 'T/T', 'Pacific Shipping Agency', '2026-08-20', 0, 0, 8000, 1)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), (select id from public.products where product_code = 'DEMO-PRD-01'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 5000, 1.25, 'demo-seed'),
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 3000, 1.45, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0001', (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), '2026-08-02', 8000, '2026-08-15')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0001'), (select id from public.products where product_code = 'DEMO-PRD-01'), 5000),
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0001'), (select id from public.products where product_code = 'DEMO-PRD-02'), 3000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0001'));

insert into public.booking_confirmations (so_pi_id, loading_date, etd_on_board)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), '2026-08-14', '2026-08-16'
where not exists (select 1 from public.booking_confirmations where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'));

insert into public.carton_label_preps (so_pi_id, carton_ready, cover_ready, base_paper_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), true, true, true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'));

insert into public.delivery_orders (so_pi_id, do_no, do_date)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), 'DEMO-DO-0001', '2026-08-16'
where not exists (select 1 from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'));

insert into public.delivery_order_containers (delivery_order_id, container_no)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1')), 'DEMO-CONT-0001A')
) as x(delivery_order_id, container_no)
where not exists (select 1 from public.delivery_order_containers where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1')));

insert into public.delivery_order_items (delivery_order_id, product_id, qty)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1')), (select id from public.products where product_code = 'DEMO-PRD-01'), 5000),
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1')), (select id from public.products where product_code = 'DEMO-PRD-02'), 3000)
) as x(delivery_order_id, product_id, qty)
where not exists (select 1 from public.delivery_order_items where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1')));

insert into public.deliveries (so_pi_id, invoice_no, invoice_date, etd, eta, bl_drive_file_id, bl_drive_view_url, terms_of_payment_text, total_amount_words, merchandise_text)
values ((select id from public.so_pi where doc_no = 'DEMO-SO-20260801-1'), 'DEMO-INV-0001', '2026-08-18', '2026-08-16', '2026-08-30', 'demo-file-0001', 'https://drive.google.com/demo-0001', 'T/T 100% before shipment', 'TEN THOUSAND SIX HUNDRED AND 00/100 US DOLLARS ONLY', 'Canned Tuna Products')
on conflict (invoice_no) do nothing;

insert into public.accounting_entries (delivery_id, due_date, amount)
values ((select id from public.deliveries where invoice_no = 'DEMO-INV-0001'), '2026-08-25', 10600.00)
on conflict (delivery_id) do nothing;

-- ---------------------------------------------------------------------
-- #2  DEMO-PI-20260801-2 — invoiced, accounting NOT yet recorded
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, notify_party_id, port, destination, incoterm, currency, payment_term, deposit_date, agent, discount, vat_percent, box_qty, container_qty)
values ('PI', 'DEMO-PI-20260801-2', '2026-08-01', (select id from public.customers where customer_code = 'DEMO-CUST-02'), (select id from public.customers where customer_code = 'DEMO-CUST-02'), (select id from public.customers where customer_code = 'DEMO-CUST-02'), 'Bangkok', 'Dubai, UAE', 'CFR', 'THB', 'Deposit', '2026-08-05', 'Gulf Freight Co.', 5000, 7, 6500, 1)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 8000, 38.50, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0002', (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), '2026-08-02', 8000, '2026-08-14')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0002'), (select id from public.products where product_code = 'DEMO-PRD-02'), 8000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0002'));

insert into public.booking_confirmations (so_pi_id, loading_date, etd_on_board)
select (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), '2026-08-13', '2026-08-15'
where not exists (select 1 from public.booking_confirmations where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'));

insert into public.carton_label_preps (so_pi_id, carton_ready, cover_not_used, base_paper_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), true, true, true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'));

insert into public.delivery_orders (so_pi_id, do_no, do_date)
select (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), 'DEMO-DO-0002', '2026-08-15'
where not exists (select 1 from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'));

insert into public.delivery_order_containers (delivery_order_id, container_no)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2')), 'DEMO-CONT-0002A')
) as x(delivery_order_id, container_no)
where not exists (select 1 from public.delivery_order_containers where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2')));

insert into public.delivery_order_items (delivery_order_id, product_id, qty)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2')), (select id from public.products where product_code = 'DEMO-PRD-02'), 8000)
) as x(delivery_order_id, product_id, qty)
where not exists (select 1 from public.delivery_order_items where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2')));

insert into public.deliveries (so_pi_id, invoice_no, invoice_date, etd, eta, bl_drive_file_id, bl_drive_view_url, terms_of_payment_text, total_amount_words, merchandise_text)
values ((select id from public.so_pi where doc_no = 'DEMO-PI-20260801-2'), 'DEMO-INV-0002', '2026-08-17', '2026-08-15', '2026-08-27', 'demo-file-0002', 'https://drive.google.com/demo-0002', 'Deposit 30% + balance before shipment', 'THREE HUNDRED TWENTY FOUR THOUSAND TWO HUNDRED TEN AND 00/100 THAI BAHT ONLY', 'Canned Tuna Products')
on conflict (invoice_no) do nothing;
-- (deliberately no accounting_entries row — exercises the "delivery exists, accounting not yet recorded" notification)

-- ---------------------------------------------------------------------
-- #3  DEMO-SO-20260802-1 — DO issued, booking confirmed, not yet invoiced
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty, container_qty)
values ('SO', 'DEMO-SO-20260802-1', '2026-08-02', (select id from public.customers where customer_code = 'DEMO-CUST-03'), (select id from public.customers where customer_code = 'DEMO-CUST-03'), 'Laem Chabang', 'Ho Chi Minh, Vietnam', 'FOB', 'USD', 'Non Deposit', 'Mekong Logistics', 0, 0, 6000, 1)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), (select id from public.products where product_code = 'DEMO-PRD-03'), (select id from public.brands where brand_code = 'DEMO-BR-03'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 4000, 1.10, 'demo-seed'),
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), (select id from public.products where product_code = 'DEMO-PRD-04'), (select id from public.brands where brand_code = 'DEMO-BR-03'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 2000, 1.30, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0003', (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), '2026-08-03', 6000, '2026-08-12')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0003'), (select id from public.products where product_code = 'DEMO-PRD-03'), 4000),
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0003'), (select id from public.products where product_code = 'DEMO-PRD-04'), 2000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0003'));

insert into public.booking_confirmations (so_pi_id, loading_date, etd_on_board)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), '2026-08-11', '2026-08-13'
where not exists (select 1 from public.booking_confirmations where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'));

insert into public.carton_label_preps (so_pi_id, carton_ready, cover_ready, base_paper_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), true, true, true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'));

insert into public.delivery_orders (so_pi_id, do_no, do_date)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'), 'DEMO-DO-0003', '2026-08-13'
where not exists (select 1 from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1'));

insert into public.delivery_order_containers (delivery_order_id, container_no)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1')), 'DEMO-CONT-0003A')
) as x(delivery_order_id, container_no)
where not exists (select 1 from public.delivery_order_containers where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1')));

insert into public.delivery_order_items (delivery_order_id, product_id, qty)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1')), (select id from public.products where product_code = 'DEMO-PRD-03'), 4000),
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1')), (select id from public.products where product_code = 'DEMO-PRD-04'), 2000)
) as x(delivery_order_id, product_id, qty)
where not exists (select 1 from public.delivery_order_items where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260802-1')));

-- ---------------------------------------------------------------------
-- #4  DEMO-SO-20260803-1 — DO issued, booking still PENDING (edge case:
--     "no DO" fails so this must NOT count as overdue, even though
--     booking itself is unconfirmed)
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty, container_qty)
values ('SO', 'DEMO-SO-20260803-1', '2026-08-03', (select id from public.customers where customer_code = 'DEMO-CUST-04'), (select id from public.customers where customer_code = 'DEMO-CUST-04'), 'Bangkok', 'Jeddah, Saudi Arabia', 'CIF', 'USD', 'LC', 'Red Sea Agents', 0, 0, 5000, 1)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'), (select id from public.products where product_code = 'DEMO-PRD-01'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 6000, 1.20, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0004', (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'), '2026-08-04', 6000, '2026-08-16')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0004'), (select id from public.products where product_code = 'DEMO-PRD-01'), 6000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0004'));

-- booking_confirmations: no row yet, but so_pi.agent is set -> bookingStatus() = PENDING
insert into public.carton_label_preps (so_pi_id, carton_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'), true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'));
-- (cover/base_paper deliberately left undecided — neither ready nor not_used)

insert into public.delivery_orders (so_pi_id, do_no, do_date)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'), 'DEMO-DO-0004', '2026-08-12'
where not exists (select 1 from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1'));

insert into public.delivery_order_containers (delivery_order_id, container_no)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1')), 'DEMO-CONT-0004A')
) as x(delivery_order_id, container_no)
where not exists (select 1 from public.delivery_order_containers where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1')));

insert into public.delivery_order_items (delivery_order_id, product_id, qty)
select x.* from (values
  ((select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1')), (select id from public.products where product_code = 'DEMO-PRD-01'), 6000)
) as x(delivery_order_id, product_id, qty)
where not exists (select 1 from public.delivery_order_items where delivery_order_id = (select id from public.delivery_orders where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260803-1')));

-- ---------------------------------------------------------------------
-- #5  DEMO-PI-20260803-2 — plan + packaging only, no booking/no DO,
--     9 days old -> should trip the ">7 days, unconfirmed" OVERDUE flag
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, deposit_date, discount, vat_percent, box_qty)
values ('PI', 'DEMO-PI-20260803-2', '2026-08-03', (select id from public.customers where customer_code = 'DEMO-CUST-05'), (select id from public.customers where customer_code = 'DEMO-CUST-05'), 'Laem Chabang', 'Singapore', 'FOB', 'USD', 'Deposit', '2026-08-10', 0, 0, 3000)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-PI-20260803-2'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 3000, 1.35, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260803-2'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0005', (select id from public.so_pi where doc_no = 'DEMO-PI-20260803-2'), '2026-08-04', 3000, '2026-08-18')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0005'), (select id from public.products where product_code = 'DEMO-PRD-02'), 3000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0005'));

insert into public.carton_label_preps (so_pi_id, carton_ready)
select (select id from public.so_pi where doc_no = 'DEMO-PI-20260803-2'), true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260803-2'));
-- (cover/base_paper/label left undecided; no booking; no DO -> OVERDUE)

-- ---------------------------------------------------------------------
-- #6  DEMO-SO-20260804-1 — booking PENDING only (agent set, no
--     etd_on_board), no DO, 8 days old -> OVERDUE
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260804-1', '2026-08-04', (select id from public.customers where customer_code = 'DEMO-CUST-01'), (select id from public.customers where customer_code = 'DEMO-CUST-01'), 'Laem Chabang', 'Los Angeles, USA', 'FOB', 'USD', 'T/T', 'Pacific Shipping Agency', 0, 0, 4500)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260804-1'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 4500, 1.40, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260804-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0006', (select id from public.so_pi where doc_no = 'DEMO-SO-20260804-1'), '2026-08-05', 4500, '2026-08-19')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0006'), (select id from public.products where product_code = 'DEMO-PRD-02'), 4500)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0006'));
-- (no carton_label_preps row; no booking_confirmations row; no DO -> OVERDUE)

-- ---------------------------------------------------------------------
-- #7  DEMO-SO-20260805-1 — booking fully CONFIRMED, no DO yet, 7 days
--     old -> booking confirmed means this must NOT be flagged overdue
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260805-1', '2026-08-05', (select id from public.customers where customer_code = 'DEMO-CUST-02'), (select id from public.customers where customer_code = 'DEMO-CUST-02'), 'Bangkok', 'Dubai, UAE', 'CFR', 'THB', 'Non Deposit', 'Gulf Freight Co.', 0, 7, 5000)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'), (select id from public.products where product_code = 'DEMO-PRD-03'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 5000, 32.00, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0007', (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'), '2026-08-06', 5000, '2026-08-20')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0007'), (select id from public.products where product_code = 'DEMO-PRD-03'), 5000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0007'));

insert into public.booking_confirmations (so_pi_id, loading_date, etd_on_board)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'), '2026-08-19', '2026-08-21'
where not exists (select 1 from public.booking_confirmations where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'));

insert into public.carton_label_preps (so_pi_id, carton_ready, cover_ready, base_paper_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'), true, true, true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-1'));

-- ---------------------------------------------------------------------
-- #8  DEMO-SO-20260805-2 — plan + packaging (some items undecided), no
--     booking, no DO, EXACTLY 7 days old -> boundary case, must NOT be
--     flagged overdue (rule is "> 7 days", not ">= 7")
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260805-2', '2026-08-05', (select id from public.customers where customer_code = 'DEMO-CUST-03'), (select id from public.customers where customer_code = 'DEMO-CUST-03'), 'Laem Chabang', 'Ho Chi Minh, Vietnam', 'FOB', 'USD', 'Non Deposit', 0, 0, 3500)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260805-2'), (select id from public.products where product_code = 'DEMO-PRD-04'), (select id from public.brands where brand_code = 'DEMO-BR-03'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 3500, 1.15, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-2'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0008', (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-2'), '2026-08-06', 3500, '2026-08-21')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0008'), (select id from public.products where product_code = 'DEMO-PRD-04'), 3500)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0008'));

insert into public.carton_label_preps (so_pi_id, carton_ready, base_paper_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-2'), true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260805-2'));
-- (cover/label deliberately left undecided)

-- ---------------------------------------------------------------------
-- #9  DEMO-SO-20260806-1 — plan + packaging, ALL items fully decided
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260806-1', '2026-08-06', (select id from public.customers where customer_code = 'DEMO-CUST-04'), (select id from public.customers where customer_code = 'DEMO-CUST-04'), 'Bangkok', 'Jeddah, Saudi Arabia', 'CIF', 'USD', 'LC', 0, 0, 4000)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260806-1'), (select id from public.products where product_code = 'DEMO-PRD-01'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 4000, 1.22, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260806-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0009', (select id from public.so_pi where doc_no = 'DEMO-SO-20260806-1'), '2026-08-07', 4000, '2026-08-22')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0009'), (select id from public.products where product_code = 'DEMO-PRD-01'), 4000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0009'));

insert into public.carton_label_preps (so_pi_id, carton_ready, cover_ready, base_paper_ready, label_ready)
select (select id from public.so_pi where doc_no = 'DEMO-SO-20260806-1'), true, true, true, true
where not exists (select 1 from public.carton_label_preps where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260806-1'));

-- ---------------------------------------------------------------------
-- #10  DEMO-SO-20260807-1 — plan only, MISSING expected_load_date
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, deposit_date, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260807-1', '2026-08-07', (select id from public.customers where customer_code = 'DEMO-CUST-05'), (select id from public.customers where customer_code = 'DEMO-CUST-05'), 'Laem Chabang', 'Singapore', 'FOB', 'USD', 'Deposit', '2026-08-14', 0, 0, 2500)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260807-1'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 2500, 1.28, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260807-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0010', (select id from public.so_pi where doc_no = 'DEMO-SO-20260807-1'), '2026-08-08', 2500, null)
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0010'), (select id from public.products where product_code = 'DEMO-PRD-02'), 2500)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0010'));

-- ---------------------------------------------------------------------
-- #11  DEMO-SO-20260808-1 — plan only, complete
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260808-1', '2026-08-08', (select id from public.customers where customer_code = 'DEMO-CUST-01'), (select id from public.customers where customer_code = 'DEMO-CUST-01'), 'Laem Chabang', 'Los Angeles, USA', 'FOB', 'USD', 'T/T', 'Pacific Shipping Agency', 0, 0, 3000)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260808-1'), (select id from public.products where product_code = 'DEMO-PRD-03'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 3000, 1.18, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260808-1'));

insert into public.production_plans (plan_no, so_pi_id, plan_date, qty, expected_load_date)
values ('DEMO-PLAN-0011', (select id from public.so_pi where doc_no = 'DEMO-SO-20260808-1'), '2026-08-09', 3000, '2026-08-25')
on conflict (plan_no) do nothing;

insert into public.production_plan_items (plan_id, product_id, qty)
select x.* from (values
  ((select id from public.production_plans where plan_no = 'DEMO-PLAN-0011'), (select id from public.products where product_code = 'DEMO-PRD-03'), 3000)
) as x(plan_id, product_id, qty)
where not exists (select 1 from public.production_plan_items where plan_id = (select id from public.production_plans where plan_no = 'DEMO-PLAN-0011'));

-- ---------------------------------------------------------------------
-- #12  DEMO-PI-20260808-2 — SO/PI only, header itself INCOMPLETE
--      (no port/destination/incoterm/currency/payment_term) — exercises
--      the "order header data missing" notification
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id)
values ('PI', 'DEMO-PI-20260808-2', '2026-08-08', (select id from public.customers where customer_code = 'DEMO-CUST-02'))
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-PI-20260808-2'), (select id from public.products where product_code = 'DEMO-PRD-04'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 1500, 1.05, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-PI-20260808-2'));

-- ---------------------------------------------------------------------
-- #13  DEMO-SO-20260809-1 — SO/PI only, header complete, no plan yet
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260809-1', '2026-08-09', (select id from public.customers where customer_code = 'DEMO-CUST-03'), (select id from public.customers where customer_code = 'DEMO-CUST-03'), 'Laem Chabang', 'Ho Chi Minh, Vietnam', 'FOB', 'USD', 'Non Deposit', 0, 0, 2200)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260809-1'), (select id from public.products where product_code = 'DEMO-PRD-01'), (select id from public.brands where brand_code = 'DEMO-BR-03'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 2200, 1.32, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260809-1'));

-- ---------------------------------------------------------------------
-- #14  DEMO-SO-20260810-1 — SO/PI only, header complete, no plan yet
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260810-1', '2026-08-10', (select id from public.customers where customer_code = 'DEMO-CUST-04'), (select id from public.customers where customer_code = 'DEMO-CUST-04'), 'Bangkok', 'Jeddah, Saudi Arabia', 'CIF', 'USD', 'LC', 0, 0, 1800)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260810-1'), (select id from public.products where product_code = 'DEMO-PRD-02'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '300x407'), 24, 'No', 'No', 1800, 1.42, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260810-1'));

-- ---------------------------------------------------------------------
-- #15  DEMO-SO-20260811-1 — SO/PI only, header complete, no plan yet
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, deposit_date, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260811-1', '2026-08-11', (select id from public.customers where customer_code = 'DEMO-CUST-05'), (select id from public.customers where customer_code = 'DEMO-CUST-05'), 'Laem Chabang', 'Singapore', 'FOB', 'USD', 'Deposit', '2026-08-20', 0, 0, 2600)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260811-1'), (select id from public.products where product_code = 'DEMO-PRD-03'), (select id from public.brands where brand_code = 'DEMO-BR-02'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 2600, 1.09, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260811-1'));

-- ---------------------------------------------------------------------
-- #16  DEMO-SO-20260812-1 — SO/PI only, header complete, created today
-- ---------------------------------------------------------------------
insert into public.so_pi (doc_type, doc_no, doc_date, customer_id, consignee_id, port, destination, incoterm, currency, payment_term, agent, discount, vat_percent, box_qty)
values ('SO', 'DEMO-SO-20260812-1', '2026-08-12', (select id from public.customers where customer_code = 'DEMO-CUST-01'), (select id from public.customers where customer_code = 'DEMO-CUST-01'), 'Laem Chabang', 'Los Angeles, USA', 'FOB', 'USD', 'T/T', 'Pacific Shipping Agency', 0, 0, 3200)
on conflict (doc_no) do nothing;

insert into public.so_pi_items (so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
select x.* from (values
  ((select id from public.so_pi where doc_no = 'DEMO-SO-20260812-1'), (select id from public.products where product_code = 'DEMO-PRD-01'), (select id from public.brands where brand_code = 'DEMO-BR-01'), (select id from public.can_sizes where cansize_code = '202x308'), 48, 'No', 'No', 3200, 1.27, 'demo-seed')
) as x(so_pi_id, product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price, recorded_by)
where not exists (select 1 from public.so_pi_items where so_pi_id = (select id from public.so_pi where doc_no = 'DEMO-SO-20260812-1'));


-- =====================================================================
-- 3. CLEANUP (commented out — run manually if you want to remove the
--    demo dataset later; child-first order because several stage
--    tables are `on delete restrict` against so_pi)
-- =====================================================================
-- delete from public.accounting_entries where delivery_id in (select id from public.deliveries where invoice_no like 'DEMO-INV-%');
-- delete from public.deliveries where invoice_no like 'DEMO-INV-%';
-- delete from public.delivery_order_items where delivery_order_id in (select id from public.delivery_orders where do_no like 'DEMO-DO-%');
-- delete from public.delivery_order_containers where delivery_order_id in (select id from public.delivery_orders where do_no like 'DEMO-DO-%');
-- delete from public.delivery_orders where do_no like 'DEMO-DO-%';
-- delete from public.carton_label_preps where so_pi_id in (select id from public.so_pi where doc_no like 'DEMO-%');
-- delete from public.booking_confirmations where so_pi_id in (select id from public.so_pi where doc_no like 'DEMO-%');
-- delete from public.production_plan_items where plan_id in (select id from public.production_plans where plan_no like 'DEMO-PLAN-%');
-- delete from public.production_plans where plan_no like 'DEMO-PLAN-%';
-- delete from public.so_pi_items where so_pi_id in (select id from public.so_pi where doc_no like 'DEMO-%');
-- delete from public.so_pi where doc_no like 'DEMO-%';
-- delete from public.products where product_code like 'DEMO-PRD-%';
-- delete from public.brands where brand_code like 'DEMO-BR-%';
-- delete from public.customers where customer_code like 'DEMO-CUST-%';
