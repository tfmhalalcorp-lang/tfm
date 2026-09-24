-- =====================================================================
-- 022 — Role restructure: rename roles + widen order-pipeline access
-- =====================================================================
-- Renames the two role identifiers that changed name (department roles
-- otherwise keep their existing per-department scope):
--   admin        -> admin   (unchanged)
--   prod         -> pd
--   wh           -> wh      (unchanged)
--   qc           -> qc      (unchanged)
--   ma           -> ma      (unchanged)
--   rpt          -> sale
--
-- 'sale' additionally gains write access to the whole order pipeline
-- ("จัดการคำสั่งซื้อ" menu group), which was admin-only before.
--
-- Run this once, after schema.sql and all prior numbered migrations.
-- =====================================================================

-- 1. Widen the check constraint temporarily so both old and new role
--    values are valid while we migrate existing rows.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','prod','wh','qc','ma','rpt','pd','sale'));

-- 2. Migrate existing profile rows to the new role names.
update public.profiles set role = 'pd'   where role = 'prod';
update public.profiles set role = 'sale' where role = 'rpt';

-- 3. Narrow the constraint to the final role set.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','pd','wh','qc','ma','sale'));

-- 4. New signups default to 'sale' instead of the old 'rpt' when no
--    role is supplied in user_metadata.
create or replace function public.handle_new_user()
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
    coalesce(new.raw_user_meta_data->>'role', 'sale')
  );
  return new;
end;
$$;

-- =====================================================================
-- 5. Production-floor RLS — rename 'prod' to 'pd' everywhere it appears.
--    Per-department scoping (qc_waste, issue_log) is unchanged.
-- =====================================================================

drop policy prod_batches_insert on public.prod_batches;
drop policy prod_batches_update on public.prod_batches;
drop policy prod_batches_delete on public.prod_batches;
create policy prod_batches_insert on public.prod_batches for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_batches_update on public.prod_batches for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_batches_delete on public.prod_batches for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );

drop policy prod_rm_insert on public.prod_rm;
drop policy prod_rm_update on public.prod_rm;
drop policy prod_rm_delete on public.prod_rm;
create policy prod_rm_insert on public.prod_rm for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_rm_update on public.prod_rm for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_rm_delete on public.prod_rm for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );

drop policy prod_can_insert on public.prod_can;
drop policy prod_can_update on public.prod_can;
drop policy prod_can_delete on public.prod_can;
create policy prod_can_insert on public.prod_can for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd','qc') );
create policy prod_can_update on public.prod_can for update to authenticated using ( (select public.app_current_role()) in ('admin','pd','qc') ) with check ( (select public.app_current_role()) in ('admin','pd','qc') );
create policy prod_can_delete on public.prod_can for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd','qc') );

drop policy prod_fillq_insert on public.prod_fillq;
drop policy prod_fillq_update on public.prod_fillq;
drop policy prod_fillq_delete on public.prod_fillq;
create policy prod_fillq_insert on public.prod_fillq for insert to authenticated with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_fillq_update on public.prod_fillq for update to authenticated using ( (select public.app_current_role()) in ('admin','pd') ) with check ( (select public.app_current_role()) in ('admin','pd') );
create policy prod_fillq_delete on public.prod_fillq for delete to authenticated using ( (select public.app_current_role()) in ('admin','pd') );

-- prod_fillw (qc-only) and wh_in (wh-only) and machine_pm (ma-only) don't
-- reference 'prod' at all, so they need no change.

drop policy qc_waste_insert on public.qc_waste;
drop policy qc_waste_update on public.qc_waste;
drop policy qc_waste_delete on public.qc_waste;
create policy qc_waste_insert on public.qc_waste for insert to authenticated with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
);
create policy qc_waste_update on public.qc_waste for update to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
) with check (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
);
create policy qc_waste_delete on public.qc_waste for delete to authenticated using (
  (select public.app_current_role()) = 'admin'
  or ( (select public.app_current_role()) = 'pd' and department = 'PD' )
  or ( (select public.app_current_role()) = 'wh' and department = 'WH' )
  or ( (select public.app_current_role()) = 'qc' and department = 'QC' )
);

drop policy issue_log_insert on public.issue_log;
drop policy issue_log_update on public.issue_log;
drop policy issue_log_delete on public.issue_log;
create policy issue_log_insert on public.issue_log for insert to authenticated with check (
  (select public.app_current_role()) in ('admin','pd','wh','qc','ma')
);
create policy issue_log_update on public.issue_log for update to authenticated using (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'pd' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
) with check (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'pd' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
);
create policy issue_log_delete on public.issue_log for delete to authenticated using (
  (select public.app_current_role()) = 'admin'
  or department = case (select public.app_current_role())
       when 'pd' then 'PD' when 'wh' then 'WH' when 'qc' then 'QC' when 'ma' then 'EN' end
);

-- =====================================================================
-- 6. Order-management RLS — 'sale' joins 'admin' on every order-pipeline
--    table, since SALE now owns the "จัดการคำสั่งซื้อ" menu group.
-- =====================================================================

drop policy products_insert on public.products;
drop policy products_update on public.products;
drop policy products_delete on public.products;
create policy products_insert on public.products for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy products_update on public.products for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy products_delete on public.products for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy so_pi_insert on public.so_pi;
drop policy so_pi_update on public.so_pi;
drop policy so_pi_delete on public.so_pi;
create policy so_pi_insert on public.so_pi for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy so_pi_update on public.so_pi for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy so_pi_delete on public.so_pi for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy so_pi_items_insert on public.so_pi_items;
drop policy so_pi_items_update on public.so_pi_items;
drop policy so_pi_items_delete on public.so_pi_items;
create policy so_pi_items_insert on public.so_pi_items for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy so_pi_items_update on public.so_pi_items for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy so_pi_items_delete on public.so_pi_items for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy production_plans_insert on public.production_plans;
drop policy production_plans_update on public.production_plans;
drop policy production_plans_delete on public.production_plans;
create policy production_plans_insert on public.production_plans for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy production_plans_update on public.production_plans for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy production_plans_delete on public.production_plans for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy production_plan_items_insert on public.production_plan_items;
drop policy production_plan_items_update on public.production_plan_items;
drop policy production_plan_items_delete on public.production_plan_items;
create policy production_plan_items_insert on public.production_plan_items for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy production_plan_items_update on public.production_plan_items for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy production_plan_items_delete on public.production_plan_items for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy wh_load_ready_insert on public.wh_load_ready;
drop policy wh_load_ready_update on public.wh_load_ready;
drop policy wh_load_ready_delete on public.wh_load_ready;
create policy wh_load_ready_insert on public.wh_load_ready for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy wh_load_ready_update on public.wh_load_ready for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy wh_load_ready_delete on public.wh_load_ready for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy deliveries_insert on public.deliveries;
drop policy deliveries_update on public.deliveries;
drop policy deliveries_delete on public.deliveries;
create policy deliveries_insert on public.deliveries for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy deliveries_update on public.deliveries for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy deliveries_delete on public.deliveries for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy accounting_entries_insert on public.accounting_entries;
drop policy accounting_entries_update on public.accounting_entries;
drop policy accounting_entries_delete on public.accounting_entries;
create policy accounting_entries_insert on public.accounting_entries for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy accounting_entries_update on public.accounting_entries for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy accounting_entries_delete on public.accounting_entries for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy booking_confirmations_insert on public.booking_confirmations;
drop policy booking_confirmations_update on public.booking_confirmations;
drop policy booking_confirmations_delete on public.booking_confirmations;
create policy booking_confirmations_insert on public.booking_confirmations for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy booking_confirmations_update on public.booking_confirmations for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy booking_confirmations_delete on public.booking_confirmations for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy carton_label_preps_insert on public.carton_label_preps;
drop policy carton_label_preps_update on public.carton_label_preps;
drop policy carton_label_preps_delete on public.carton_label_preps;
create policy carton_label_preps_insert on public.carton_label_preps for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy carton_label_preps_update on public.carton_label_preps for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy carton_label_preps_delete on public.carton_label_preps for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy delivery_orders_insert on public.delivery_orders;
drop policy delivery_orders_update on public.delivery_orders;
drop policy delivery_orders_delete on public.delivery_orders;
create policy delivery_orders_insert on public.delivery_orders for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_orders_update on public.delivery_orders for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_orders_delete on public.delivery_orders for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy delivery_order_containers_insert on public.delivery_order_containers;
drop policy delivery_order_containers_update on public.delivery_order_containers;
drop policy delivery_order_containers_delete on public.delivery_order_containers;
create policy delivery_order_containers_insert on public.delivery_order_containers for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_order_containers_update on public.delivery_order_containers for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_order_containers_delete on public.delivery_order_containers for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

drop policy delivery_order_items_insert on public.delivery_order_items;
drop policy delivery_order_items_update on public.delivery_order_items;
drop policy delivery_order_items_delete on public.delivery_order_items;
create policy delivery_order_items_insert on public.delivery_order_items for insert to authenticated with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_order_items_update on public.delivery_order_items for update to authenticated using ( (select public.app_current_role()) in ('admin','sale') ) with check ( (select public.app_current_role()) in ('admin','sale') );
create policy delivery_order_items_delete on public.delivery_order_items for delete to authenticated using ( (select public.app_current_role()) in ('admin','sale') );

-- delivery-docs storage bucket policies (from 016_delivery_bl_upload.sql)
-- are orphaned/unused since 018 moved BL uploads to Google Drive — updated
-- here anyway for consistency, in case the bucket is ever reactivated.
-- The BL upload itself now goes through netlify/functions/drive-upload.js,
-- whose own admin-only gate is updated to admin+sale separately.
drop policy if exists delivery_docs_insert on storage.objects;
drop policy if exists delivery_docs_update on storage.objects;
drop policy if exists delivery_docs_delete on storage.objects;
create policy delivery_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'delivery-docs' and (select public.app_current_role()) in ('admin','sale'));
create policy delivery_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'delivery-docs' and (select public.app_current_role()) in ('admin','sale'))
  with check (bucket_id = 'delivery-docs' and (select public.app_current_role()) in ('admin','sale'));
create policy delivery_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'delivery-docs' and (select public.app_current_role()) in ('admin','sale'));
