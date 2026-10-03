-- =====================================================================
-- 029 — Supplier: separate fish suppliers from can suppliers
-- =====================================================================
-- supplier_type = 'fish' (ผู้ขายปลา) | 'can' (ผู้ขายกระป๋อง).
-- Backfill: rows with can_type filled and no fish_type become 'can';
-- everything else stays 'fish' (the original meaning of a supplier).
-- =====================================================================

alter table public.suppliers
  add column supplier_type text not null default 'fish'
  check (supplier_type in ('fish', 'can'));

update public.suppliers
   set supplier_type = 'can'
 where coalesce(trim(can_type), '') <> ''
   and coalesce(trim(fish_type), '') = '';

create index suppliers_supplier_type_idx on public.suppliers(supplier_type);
