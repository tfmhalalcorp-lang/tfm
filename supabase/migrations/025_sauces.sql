-- =====================================================================
-- 025 — Sauces master data (Settings)
-- =====================================================================
-- New master-data table: sauce code + sauce brand, managed from
-- Settings, same read-all/write-admin-only pattern as every other
-- master table (brands, suppliers, can_sizes, machines).
-- =====================================================================

create table public.sauces (
  id          uuid primary key default gen_random_uuid(),
  sauce_code  text not null unique,
  sauce_brand text not null,
  created_at  timestamptz not null default now()
);

alter table public.sauces enable row level security;

create policy sauces_select on public.sauces for select to authenticated using (true);
create policy sauces_insert on public.sauces for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy sauces_update on public.sauces for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy sauces_delete on public.sauces for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

revoke all on public.sauces from anon;
grant select, insert, update, delete on public.sauces to authenticated;
