-- =====================================================================
-- Clear all transactional / order-pipeline data
-- =====================================================================
-- Deletes every production/QC/WH/MA transaction AND every order-pipeline
-- record (SO/PI, plans, booking, packaging, DO, delivery, accounting).
--
-- KEPT (not touched):
--   - auth.users / public.profiles        (all user accounts)
--   - public.customers, public.brands, public.suppliers,
--     public.can_sizes, public.machines, public.sauces, public.products
--     (Settings master data)
--
-- Deletes run in FK-dependency order (children before parents) inside
-- one transaction — if anything fails, nothing is deleted.
--
-- ⚠️ IRREVERSIBLE. Make sure you have a backup/export of anything you
-- might still need before running this (Supabase Dashboard → Database →
-- Backups, or export each table first) — there is no undo.
-- =====================================================================

begin;

-- --- Order pipeline (จัดการคำสั่งซื้อ) ---
delete from public.accounting_entries;
delete from public.deliveries;
delete from public.delivery_order_items;
delete from public.delivery_order_containers;
delete from public.delivery_orders;
delete from public.carton_label_preps;
delete from public.booking_confirmations;
delete from public.wh_load_ready;
delete from public.production_plan_items;
delete from public.production_plans;
delete from public.so_pi_items;
delete from public.so_pi;

-- --- Production / QC / Warehouse / Maintenance transactions ---
delete from public.qc_sauce;
delete from public.qc_waste;
delete from public.issue_log;
delete from public.machine_pm;
delete from public.wh_in;
delete from public.prod_emptycan;
delete from public.prod_fillq;
delete from public.prod_can;
delete from public.prod_fillw;
delete from public.prod_rm;
delete from public.prod_batches;

commit;

-- Sanity check — every row count below should read 0:
-- select
--   (select count(*) from public.so_pi) as so_pi,
--   (select count(*) from public.prod_batches) as prod_batches,
--   (select count(*) from public.qc_waste) as qc_waste,
--   (select count(*) from public.issue_log) as issue_log,
--   (select count(*) from public.accounting_entries) as accounting_entries;
