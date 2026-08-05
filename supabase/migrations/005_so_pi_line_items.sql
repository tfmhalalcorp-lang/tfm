-- =====================================================================
-- OrderCenter — SO/PI Line Items (header + multi-product lines)
-- =====================================================================
-- Run this ONCE, after 002/003/004. Reworks SO/PI from "one product per
-- order" into a proper header + line-items model: one so_pi document can
-- now carry multiple product lines, each with its own product/brand/can
-- size/packing/shrink-pack/RTD/qty. Safe to run even with existing so_pi
-- rows (there was no legacy SO/PI data — this is a brand-new module — so
-- dropping the old single-product columns loses nothing).
-- =====================================================================

-- Payment Term now allows a free-text "Other" value typed in the UI, so a
-- fixed-list CHECK constraint no longer fits — drop it (column stays text).
alter table public.so_pi drop constraint if exists so_pi_payment_term_check;

-- Move product/brand/qty from the SO/PI header down to line items.
alter table public.so_pi drop column if exists brand_id;
alter table public.so_pi drop column if exists product_id;
alter table public.so_pi drop column if exists qty;

create table public.so_pi_items (
  id           uuid primary key default gen_random_uuid(),
  so_pi_id     uuid not null references public.so_pi(id) on delete cascade,
  product_id   uuid references public.products(id),
  brand_id     uuid references public.brands(id),
  cansize_id   uuid references public.can_sizes(id),
  packing      integer,
  shrink_pack  text check (shrink_pack in ('Yes', 'No', 'Other')),
  rtd          text check (rtd in ('Yes', 'No', 'Other')),
  qty          numeric(12,2) not null default 0 check (qty >= 0),
  recorded_by  text,
  created_at   timestamptz not null default now()
);

comment on table public.so_pi_items is
  'Line items of an SO/PI — one document (so_pi) can have many product lines. Deleted together with their parent (on delete cascade), unlike every other child table in this schema, since line items have no independent meaning outside their SO/PI.';

alter table public.so_pi_items enable row level security;
create policy so_pi_items_select on public.so_pi_items for select to authenticated using (true);
create policy so_pi_items_insert on public.so_pi_items for insert to authenticated with check ( (select public.app_current_role()) = 'admin' );
create policy so_pi_items_update on public.so_pi_items for update to authenticated using ( (select public.app_current_role()) = 'admin' ) with check ( (select public.app_current_role()) = 'admin' );
create policy so_pi_items_delete on public.so_pi_items for delete to authenticated using ( (select public.app_current_role()) = 'admin' );

revoke all on public.so_pi_items from anon;
grant select, insert, update, delete on public.so_pi_items to authenticated;

create index so_pi_items_so_pi_idx on public.so_pi_items(so_pi_id);
