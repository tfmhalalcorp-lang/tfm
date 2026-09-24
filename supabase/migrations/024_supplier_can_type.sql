-- =====================================================================
-- 024 — Supplier: add can type/size field
-- =====================================================================
-- Adds a "can type/size" free-text field to suppliers (มีอยู่แล้วสำหรับ
-- ปลา ผ่าน fish_type — this is the same idea for can suppliers).
-- =====================================================================

alter table public.suppliers add column can_type text;
