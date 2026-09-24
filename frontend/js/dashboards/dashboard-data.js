import { supabase } from '../lib/supabaseClient.js';

/** Fetch rows from `table`, optionally bounded by a date range on `dateField` and an exact batch_id match. */
export async function fetchFiltered(table, dateField, { startDate, endDate, batchFilter }, select = '*') {
  let q = supabase.from(table).select(select);
  if (startDate) q = q.gte(dateField, startDate);
  if (endDate) q = q.lte(dateField, endDate);
  if (batchFilter) q = q.eq('batch_id', batchFilter);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchBrandMap() {
  const { data, error } = await supabase.from('brands').select('id, brand_name');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach((b) => (map[b.id] = b.brand_name));
  return map;
}

export async function fetchSupplierMap() {
  const { data, error } = await supabase.from('suppliers').select('id, supplier_name');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach((s) => (map[s.id] = s.supplier_name));
  return map;
}

export async function fetchAllBatchIds() {
  const { data, error } = await supabase.from('prod_batches').select('batch_id').order('batch_id');
  if (error) throw new Error(error.message);
  return (data || []).map((b) => b.batch_id);
}

/**
 * Everything the order-tracking dashboard needs: so_pi rows in the given
 * doc_date range plus every downstream stage row for those orders — same
 * multi-table shape order-hub.js loads, just date-scoped. `.in()` needs a
 * non-empty array even when there are zero orders in range, so an
 * impossible dummy UUID is used as a safe empty-match fallback (same
 * pattern as report-sales-order.js).
 */
export async function fetchOrderTrackingRows({ startDate, endDate } = {}) {
  let soPiQuery = supabase
    .from('so_pi')
    .select('*, customers!customer_id(customer_name), so_pi_items(product_id, qty, unit_price, products(product_name))')
    .order('doc_date', { ascending: false });
  if (startDate) soPiQuery = soPiQuery.gte('doc_date', startDate);
  if (endDate) soPiQuery = soPiQuery.lte('doc_date', endDate);

  const { data: soPi, error: e1 } = await soPiQuery;
  if (e1) throw new Error(e1.message);
  const rows = soPi || [];
  const idFilter = rows.length ? rows.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000'];

  const [
    { data: plans, error: e2 },
    { data: bookings, error: e3 },
    { data: cartonLabels, error: e4 },
    { data: dos, error: e5 },
    { data: deliveries, error: e6 },
    { data: accounting, error: e7 },
  ] = await Promise.all([
    supabase.from('production_plans').select('*').in('so_pi_id', idFilter).order('plan_date', { ascending: true }),
    supabase.from('booking_confirmations').select('*').in('so_pi_id', idFilter),
    supabase.from('carton_label_preps').select('*').in('so_pi_id', idFilter),
    supabase.from('delivery_orders').select('*, delivery_order_containers(container_no)').in('so_pi_id', idFilter).order('do_date', { ascending: true, nullsFirst: true }),
    supabase.from('deliveries').select('*').in('so_pi_id', idFilter),
    supabase.from('accounting_entries').select('*, deliveries!delivery_id(so_pi_id)'),
  ]);
  if (e2) throw new Error(e2.message);
  if (e3) throw new Error(e3.message);
  if (e4) throw new Error(e4.message);
  if (e5) throw new Error(e5.message);
  if (e6) throw new Error(e6.message);
  if (e7) throw new Error(e7.message);

  return { rows, plans: plans || [], bookings: bookings || [], cartonLabels: cartonLabels || [], dos: dos || [], deliveries: deliveries || [], accounting: accounting || [] };
}
