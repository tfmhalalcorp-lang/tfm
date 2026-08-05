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
