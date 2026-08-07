-- =====================================================================
-- OrderCenter — Delivery: BL file upload
-- =====================================================================
-- Run this ONCE, after 015_booking_packaging_tweaks.sql, in the Supabase
-- SQL Editor. Adds a private Storage bucket for the customer's Bill of
-- Lading file, uploaded/viewed/deleted from the "บันทึกการส่งมอบ" screen,
-- plus the column on `deliveries` that points at it.
-- =====================================================================

alter table public.deliveries add column bl_file_path text;

insert into storage.buckets (id, name, public)
values ('delivery-docs', 'delivery-docs', false)
on conflict (id) do nothing;

create policy delivery_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'delivery-docs');
create policy delivery_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-docs' and (select public.app_current_role()) = 'admin');
create policy delivery_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'delivery-docs' and (select public.app_current_role()) = 'admin')
  with check (bucket_id = 'delivery-docs' and (select public.app_current_role()) = 'admin');
create policy delivery_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'delivery-docs' and (select public.app_current_role()) = 'admin');
