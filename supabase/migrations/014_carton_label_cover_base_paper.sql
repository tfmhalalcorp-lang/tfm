-- =====================================================================
-- OrderCenter — Packaging Prep: add Cover + Base Paper checkboxes
-- =====================================================================
-- Run this ONCE, after 013_order_hub_stages.sql, in the Supabase SQL Editor.
-- carton_label_preps (the "จัดเตรียม Packaging" stage, formerly "เตรียม
-- Carton/Label") gains cover_ready and base_paper_ready, alongside the
-- existing carton_ready/label_ready. Nullable-safe: defaults to false so
-- existing rows are unaffected.
-- =====================================================================

alter table public.carton_label_preps
  add column cover_ready      boolean not null default false,
  add column base_paper_ready boolean not null default false;
