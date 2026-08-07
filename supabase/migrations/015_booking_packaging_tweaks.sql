-- =====================================================================
-- OrderCenter — Confirm Booking field cleanup + Packaging "not used" flags
-- =====================================================================
-- Run this ONCE, after 014_carton_label_cover_base_paper.sql, in the
-- Supabase SQL Editor.
--
--  - booking_confirmations.ready_to_load_date is dropped: the "Confirm
--    Booking" screen no longer has a separate "วันที่พร้อมโหลด" field —
--    loading_date now serves that purpose (relabeled in the UI as
--    "Loading Date (วันที่พร้อมโหลด)"). The DO screen's read-only ready
--    date now reads loading_date instead.
--  - carton_label_preps gains a "not used" flag alongside each item's
--    "ready" flag, so a packaging item that simply isn't part of this
--    order can be marked N/A instead of just left un-ticked.
-- =====================================================================

alter table public.booking_confirmations drop column ready_to_load_date;

alter table public.carton_label_preps
  add column carton_not_used      boolean not null default false,
  add column cover_not_used       boolean not null default false,
  add column base_paper_not_used  boolean not null default false,
  add column label_not_used       boolean not null default false;
