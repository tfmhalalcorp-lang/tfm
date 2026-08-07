-- =====================================================================
-- OrderCenter — Delivery: BL file storage moved to Google Drive
-- =====================================================================
-- Run this ONCE, after 017_delivery_order_header_items.sql, in the
-- Supabase SQL Editor.
--
-- Reverts the BL upload feature from the Supabase Storage bucket added
-- in 016_delivery_bl_upload.sql to Google Drive (product decision — the
-- team already keeps this kind of document in Drive). The old
-- `delivery-docs` bucket/policies from 016 are left in place, unused —
-- remove manually via the Supabase Dashboard (Storage) if you want to
-- fully clean up.
-- =====================================================================

alter table public.deliveries drop column bl_file_path;
alter table public.deliveries
  add column bl_drive_file_id  text,
  add column bl_drive_view_url text;
