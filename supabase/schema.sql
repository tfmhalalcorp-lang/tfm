-- =====================================================================
-- OrderCenter — Supabase Schema
-- =====================================================================
-- Run this ENTIRE file once, in order, in the Supabase SQL Editor on a
-- fresh project (Project → SQL Editor → New query → paste → Run).
-- It is written to run top-to-bottom exactly once; re-running it on a
-- database that already has these objects will error on the CREATE
-- TABLE / CREATE POLICY statements (Postgres has no "CREATE POLICY IF
-- NOT EXISTS"). If you need to re-apply it, drop the affected objects
-- first or run it against a fresh project.
--
-- gen_random_uuid() is built into Postgres 13+ core (no extension
-- needed) — Supabase projects run PG15+, so it works out of the box.
-- =====================================================================


-- =====================================================================
-- 1. PROFILES — extends auth.users with app-specific fields
-- =====================================================================
-- One row per login account, 1:1 with auth.users. Populated automatically
-- by the handle_new_user() trigger below whenever a new auth user is
-- created (either via the Supabase Dashboard with user metadata set, or
-- via netlify/functions/admin-users.js).

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_.-]{3,32}$'),
  fullname   text not null,
  role       text not null check (role in ('admin','prod','wh','qc','ma','rpt')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'App user profile, 1:1 with auth.users. Auto-created by handle_new_user() '
  'from auth.users.raw_user_meta_data. All writes (create/update/delete of '
  'accounts) go through netlify/functions/admin-users.js using the service '
  'role key — never directly from the browser.';

alter table public.profiles enable row level security;


-- =====================================================================
-- 2. app_current_role() — RLS helper, used by every policy below
-- =====================================================================
-- SECURITY DEFINER so it runs with owner privileges and bypasses RLS on
-- `profiles` internally — without this, a policy on `profiles` that
-- calls this function would recurse into itself. `set search_path =
-- public` is required hardening for any SECURITY DEFINER function (
-- prevents search-path hijacking). Deliberately NOT named `current_role`
-- — that's a reserved Postgres identifier/built-in.

create function public.app_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke execute on function public.app_current_role() from public;
grant execute on function public.app_current_role() to authenticated;


-- =====================================================================
-- 3. handle_new_user() — auto-provision profile row on auth signup
-- =====================================================================

-- Falls back to deriving a username from the email's local part (and a
-- 'rpt' role) when no user_metadata is supplied — some Supabase Dashboard
-- versions don't expose a metadata field in the quick "Add user" dialog,
-- so bootstrapping must still work with just email + password.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_.-]', '_', 'g')
  );
  insert into public.profiles (id, username, fullname, role)
  values (
    new.id,
    v_username,
    coalesce(nullif(new.raw_user_meta_data->>'fullname', ''), v_username),
    coalesce(new.raw_user_meta_data->>'role', 'rpt')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- profiles RLS: read own row, or any row if admin. No insert/update/delete
-- policy exists for `authenticated` on purpose — all writes go through the
-- service-role Netlify Function (which bypasses RLS entirely).
create policy profiles_select on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 4. MASTER DATA
-- =====================================================================

create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  customer_name text not null,
  created_at    timestamptz not null default now()
);

create table public.brands (
  id          uuid primary key default gen_random_uuid(),
  brand_code  text not null unique,
  brand_name  text not null,
  customer_id uuid references public.customers(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  supplier_name text not null,
  fish_type     text,
  created_at    timestamptz not null default now()
);

create table public.can_sizes (
  id           uuid primary key default gen_random_uuid(),
  cansize_code text not null unique,
  cansize_name text not null,
  created_at   timestamptz not null default now()
);

create table public.machines (
  id           uuid primary key default gen_random_uuid(),
  machine_code text not null unique,
  machine_name text not null,
  ma_type      text,
  created_at   timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.brands enable row level security;
alter table public.suppliers enable row level security;
alter table public.can_sizes enable row level security;
alter table public.machines enable row level security;

-- Pattern for every master-data table: any authenticated user may read;
-- only admin may write. Written out per table (Postgres has no policy
-- templates / inheritance for RLS policies).

create policy customers_select on public.customers for select to authenticated using (true);
create policy customers_insert on public.customers for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy customers_update on public.customers for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy customers_delete on public.customers for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create policy brands_select on public.brands for select to authenticated using (true);
create policy brands_insert on public.brands for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy brands_update on public.brands for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy brands_delete on public.brands for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create policy suppliers_select on public.suppliers for select to authenticated using (true);
create policy suppliers_insert on public.suppliers for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy suppliers_update on public.suppliers for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy suppliers_delete on public.suppliers for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create policy can_sizes_select on public.can_sizes for select to authenticated using (true);
create policy can_sizes_insert on public.can_sizes for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy can_sizes_update on public.can_sizes for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy can_sizes_delete on public.can_sizes for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

create policy machines_select on public.machines for select to authenticated using (true);
create policy machines_insert on public.machines for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy machines_update on public.machines for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy machines_delete on public.machines for delete to authenticated using ( (select public.app_current_role()) = 'admin' );


-- =====================================================================
-- 5. PRODUCTION BATCHES
-- =====================================================================
-- Dual-key: `id` is the surrogate PK; `batch_id` is the user-entered,
-- unique, IMMUTABLE-after-creation business key that every child
-- transaction table below references directly (matching how every
-- transaction form's Batch dropdown works with batch_id, not the
-- surrogate id).

create table public.prod_batches (
  id             uuid primary key default gen_random_uuid(),
  prodbatch_date date not null,
  batch_id       text not null unique,
  cansize_id     uuid not null references public.can_sizes(id),
  brand_id       uuid not null references public.brands(id),
  created_at     timestamptz not null default now()
);

create function public.reject_batch_id_change()
returns trigger language plpgsql as $$
begin
  if new.batch_id is distinct from old.batch_id then
    raise exception 'batch_id is immutable after creation';
  end if;
  return new;
end;
$$;

create trigger prod_batches_batch_id_immutable
  before update on public.prod_batches
  for each row execute function public.reject_batch_id_change();

alter table public.prod_batches enable row level security;
create policy prod_batches_select on public.prod_batches for select to authenticated using (true);
create policy prod_batches_insert on public.prod_batches for insert to authenticated with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_batches_update on public.prod_batches for update to authenticated using ( (select public.app_current_role()) in ('admin','prod') ) with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_batches_delete on public.prod_batches for delete to authenticated using ( (select public.app_current_role()) in ('admin','prod') );


-- =====================================================================
-- 6. TRANSACTIONAL TABLES
-- =====================================================================
-- All reference prod_batches(batch_id) with ON DELETE RESTRICT — a batch
-- with existing transaction history cannot be deleted, preventing
-- silently orphaned production records.

create table public.prod_rm (
  id           uuid primary key default gen_random_uuid(),
  prodrm_date  date not null,
  batch_id     text not null references public.prod_batches(batch_id) on delete restrict,
  supplier_id  uuid not null references public.suppliers(id),
  billsup_no   text,
  fish_type    text,
  weight       numeric(12,2) not null default 0 check (weight >= 0),
  balance      numeric(12,2) not null default 0 check (balance >= 0),
  fish_balance numeric(12,2) not null default 0 check (fish_balance >= 0),
  created_at   timestamptz not null default now()
);

create table public.prod_fillw (
  id             uuid primary key default gen_random_uuid(),
  prodfillw_date date not null,
  batch_id       text not null references public.prod_batches(batch_id) on delete restrict,
  weight         numeric(12,2) not null check (weight >= 0),
  created_at     timestamptz not null default now()
);

create table public.prod_can (
  id           uuid primary key default gen_random_uuid(),
  prodcan_date date not null,
  batch_id     text not null references public.prod_batches(batch_id) on delete restrict,
  basket_no    text,
  can_sum      numeric(12,2) not null check (can_sum >= 0),
  created_at   timestamptz not null default now()
);

create table public.prod_fillq (
  id             uuid primary key default gen_random_uuid(),
  prodfillq_date date not null,
  batch_id       text not null references public.prod_batches(batch_id) on delete restrict,
  qty            numeric(12,2) not null check (qty >= 0),
  created_at     timestamptz not null default now()
);

create table public.wh_in (
  id         uuid primary key default gen_random_uuid(),
  whin_date  date not null,
  batch_id   text not null references public.prod_batches(batch_id) on delete restrict,
  brand_id   uuid not null references public.brands(id),
  so_no      text,
  can_sum    numeric(12,2) not null default 0 check (can_sum >= 0),
  can_hold   numeric(12,2) not null default 0 check (can_hold >= 0),
  remark     text,
  created_at timestamptz not null default now()
);

create table public.qc_waste (
  id              uuid primary key default gen_random_uuid(),
  qcwaste_date    date not null,
  batch_id        text not null references public.prod_batches(batch_id) on delete restrict,
  department      text not null check (department in ('PD','WH','QC')),
  cansize_id      uuid not null references public.can_sizes(id),
  waste_let       numeric(12,2) not null default 0,
  waste_steam     numeric(12,2) not null default 0,
  waste_float     numeric(12,2) not null default 0,
  waste_qc        numeric(12,2) not null default 0,
  waste_it        numeric(12,2) not null default 0,
  waste_spur      numeric(12,2) not null default 0,
  waste_seam      numeric(12,2) not null default 0,
  waste_seamer    numeric(12,2) not null default 0,
  waste_breakdown numeric(12,2) not null default 0,
  waste_bumped    numeric(12,2) not null default 0,
  waste_swollen   numeric(12,2) not null default 0,
  waste_falseseam numeric(12,2) not null default 0,
  waste_received  numeric(12,2) not null default 0,
  waste_other     numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

create table public.machine_pm (
  id             uuid primary key default gen_random_uuid(),
  machinepm_date date not null,
  machine_id     uuid not null references public.machines(id),
  detail         text not null,
  start_time     time,
  end_time       time,
  downtime       numeric(10,1) not null default 0 check (downtime >= 0),
  solve          text,
  can_waste      numeric(12,2) not null default 0,
  employee       text,
  created_at     timestamptz not null default now()
);

create table public.issue_log (
  id         uuid primary key default gen_random_uuid(),
  issue_date date not null,
  department text not null check (department in ('PD','WH','QC','EN')),
  reporter   text not null,
  detail     text not null,
  status     text not null default 'รอแก้ไข' check (status in ('รอแก้ไข','แก้ไขแล้ว')),
  created_at timestamptz not null default now()
);

alter table public.prod_rm enable row level security;
alter table public.prod_fillw enable row level security;
alter table public.prod_can enable row level security;
alter table public.prod_fillq enable row level security;
alter table public.wh_in enable row level security;
alter table public.qc_waste enable row level security;
alter table public.machine_pm enable row level security;
alter table public.issue_log enable row level security;

-- --- prod_rm: admin, prod ---
create policy prod_rm_select on public.prod_rm for select to authenticated using (true);
create policy prod_rm_insert on public.prod_rm for insert to authenticated with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_rm_update on public.prod_rm for update to authenticated using ( (select public.app_current_role()) in ('admin','prod') ) with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_rm_delete on public.prod_rm for delete to authenticated using ( (select public.app_current_role()) in ('admin','prod') );

-- --- prod_fillw: admin, qc ---
create policy prod_fillw_select on public.prod_fillw for select to authenticated using (true);
create policy prod_fillw_insert on public.prod_fillw for insert to authenticated with check ( (select public.app_current_role()) in ('admin','qc') );
create policy prod_fillw_update on public.prod_fillw for update to authenticated using ( (select public.app_current_role()) in ('admin','qc') ) with check ( (select public.app_current_role()) in ('admin','qc') );
create policy prod_fillw_delete on public.prod_fillw for delete to authenticated using ( (select public.app_current_role()) in ('admin','qc') );

-- --- prod_can: admin, prod, qc (shared form used by both PRODUCTION and QC menus) ---
create policy prod_can_select on public.prod_can for select to authenticated using (true);
create policy prod_can_insert on public.prod_can for insert to authenticated with check ( (select public.app_current_role()) in ('admin','prod','qc') );
create policy prod_can_update on public.prod_can for update to authenticated using ( (select public.app_current_role()) in ('admin','prod','qc') ) with check ( (select public.app_current_role()) in ('admin','prod','qc') );
create policy prod_can_delete on public.prod_can for delete to authenticated using ( (select public.app_current_role()) in ('admin','prod','qc') );

-- --- prod_fillq: admin, prod ---
create policy prod_fillq_select on public.prod_fillq for select to authenticated using (true);
create policy prod_fillq_insert on public.prod_fillq for insert to authenticated with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_fillq_update on public.prod_fillq for update to authenticated using ( (select public.app_current_role()) in ('admin','prod') ) with check ( (select public.app_current_role()) in ('admin','prod') );
create policy prod_fillq_delete on public.prod_fillq for delete to authenticated using ( (select public.app_current_role()) in ('admin','prod') );

-- --- wh_in: admin, wh ---
create policy wh_in_select on public.wh_in for select to authenticated using (true);
create policy wh_in_insert on public.wh_in for insert to authenticated with check ( (select public.app_current_role()) in ('admin','wh') );
create policy wh_in_update on public.wh_in for update to authenticated using ( (select public.app_current_role()) in ('admin','wh') ) with check ( (select public.app_current_role()) in ('admin','wh') );
create policy wh_in_delete on public.wh_in for delete to authenticated using ( (select public.app_current_role()) in ('admin','wh') );

-- --- qc_waste: admin, or prod/wh/qc but ONLY for rows whose department
--     matches their own department (PD/WH/QC) — coupled on insert AND
--     update/delete so a role can't write into another department's log.
create policy qc_waste_select on public.qc_waste for select to authenticated using (true);
create policy qc_waste_insert on public.qc_waste for insert to authenticated with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'prod' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh'   and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc'   and department = 'QC' )
);
create policy qc_waste_update on public.qc_waste for update to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'prod' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh'   and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc'   and department = 'QC' )
) with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'prod' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh'   and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc'   and department = 'QC' )
);
create policy qc_waste_delete on public.qc_waste for delete to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'prod' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh'   and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc'   and department = 'QC' )
);

-- --- machine_pm: admin, ma ---
create policy machine_pm_select on public.machine_pm for select to authenticated using (true);
create policy machine_pm_insert on public.machine_pm for insert to authenticated with check ( (select public.app_current_role()) in ('admin','ma') );
create policy machine_pm_update on public.machine_pm for update to authenticated using ( (select public.app_current_role()) in ('admin','ma') ) with check ( (select public.app_current_role()) in ('admin','ma') );
create policy machine_pm_delete on public.machine_pm for delete to authenticated using ( (select public.app_current_role()) in ('admin','ma') );

-- --- issue_log: any of admin/prod/wh/qc/ma may INSERT for any department
--     (matches legacy UX where department is only a *default*, still
--     user-editable) but UPDATE/DELETE are department-coupled to the
--     writer's own role (admin bypasses) — a deliberate tightening vs.
--     the legacy backend, which had no write restrictions at all.
create policy issue_log_select on public.issue_log for select to authenticated using (true);
create policy issue_log_insert on public.issue_log for insert to authenticated with check (
  (select public.app_current_role()) in ('admin','prod','wh','qc','ma')
);
create policy issue_log_update on public.issue_log for update to authenticated using (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'prod' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
) with check (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'prod' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
);
create policy issue_log_delete on public.issue_log for delete to authenticated using (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'prod' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
);


-- =====================================================================
-- 7. TABLE-LEVEL GRANTS
-- =====================================================================
-- RLS is the real per-row gate, but table-level GRANTs are the coarse
-- gate underneath it — belt and suspenders. `anon` gets nothing beyond
-- what Supabase Auth itself needs (which doesn't require table access).

revoke all on public.profiles, public.customers, public.brands, public.suppliers,
  public.can_sizes, public.machines, public.prod_batches, public.prod_rm,
  public.prod_fillw, public.prod_can, public.prod_fillq, public.wh_in,
  public.qc_waste, public.machine_pm, public.issue_log
  from anon;

grant select, insert, update, delete on
  public.customers, public.brands, public.suppliers, public.can_sizes, public.machines,
  public.prod_batches, public.prod_rm, public.prod_fillw, public.prod_can, public.prod_fillq,
  public.wh_in, public.qc_waste, public.machine_pm, public.issue_log
  to authenticated;

grant select on public.profiles to authenticated;


-- =====================================================================
-- 8. INDEXES
-- =====================================================================

create index prod_batches_date_idx  on public.prod_batches(prodbatch_date);
create index prod_rm_batch_id_idx   on public.prod_rm(batch_id);
create index prod_rm_date_idx       on public.prod_rm(prodrm_date);
create index prod_fillw_batch_id_idx on public.prod_fillw(batch_id);
create index prod_fillw_date_idx    on public.prod_fillw(prodfillw_date);
create index prod_can_batch_id_idx  on public.prod_can(batch_id);
create index prod_can_date_idx      on public.prod_can(prodcan_date);
create index prod_fillq_batch_id_idx on public.prod_fillq(batch_id);
create index prod_fillq_date_idx    on public.prod_fillq(prodfillq_date);
create index wh_in_batch_id_idx     on public.wh_in(batch_id);
create index wh_in_date_idx         on public.wh_in(whin_date);
create index qc_waste_batch_id_idx  on public.qc_waste(batch_id);
create index qc_waste_date_idx      on public.qc_waste(qcwaste_date);
create index machine_pm_date_idx    on public.machine_pm(machinepm_date);
create index issue_log_date_idx     on public.issue_log(issue_date);
create index brands_customer_id_idx on public.brands(customer_id);


-- =====================================================================
-- 9. NEXT STEPS (do these after running this file — see README.md)
-- =====================================================================
-- 1. Authentication → Providers → Email → turn OFF "Allow new users to
--    sign up". All accounts must be admin-provisioned.
-- 2. Authentication → URL Configuration: not used by this app (no email
--    links are ever sent — see README for why), safe to leave defaults.
-- 3. Bootstrap the first admin account (Authentication → Users → Add
--    user → "Create new user"):
--      Email:    admin@tfm-internal.app
--      Password: (choose a strong password)
--      Auto Confirm User: YES
--      User Metadata (raw_user_meta_data, as JSON):
--        { "username": "admin", "fullname": "System Admin", "role": "admin" }
--    Saving with that metadata makes handle_new_user() create the
--    matching `profiles` row automatically. Every other account (prod,
--    wh, qc, ma, rpt users) should then be created from inside the app's
--    Settings → Users screen (admin-only), which calls
--    netlify/functions/admin-users.js — not through the Supabase
--    Dashboard, to keep one consistent creation path.
