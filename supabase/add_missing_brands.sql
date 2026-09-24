-- =====================================================================
-- Add the 5 brand codes missing before running import_production_data.sql
-- =====================================================================
-- brand_name is set to the same text as the code as a placeholder — go
-- to Settings → Brands afterward to give them real names / link them to
-- a customer, if needed. customer_id is left blank (nullable).
--
-- Run this BEFORE import_production_data.sql, then re-run
-- preflight_check_import.sql to confirm it now returns zero rows.
-- =====================================================================

insert into public.brands (brand_code, brand_name) values
  ('LFB', 'LFB'),
  ('MNS', 'MNS'),
  ('PDSทดลองแป้ง', 'PDSทดลองแป้ง'),
  ('SBM', 'SBM'),
  ('SBS', 'SBS')
on conflict (brand_code) do nothing;
