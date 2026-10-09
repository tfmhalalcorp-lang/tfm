-- 030 — Let the 'pd' role add/edit/delete brands and suppliers (previously admin only)
drop policy if exists brands_insert on public.brands;
drop policy if exists brands_update on public.brands;
drop policy if exists brands_delete on public.brands;
create policy brands_insert on public.brands for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy brands_update on public.brands for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy brands_delete on public.brands for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );

drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;
create policy suppliers_insert on public.suppliers for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy suppliers_update on public.suppliers for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy suppliers_delete on public.suppliers for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );
