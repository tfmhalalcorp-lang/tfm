import { supabase } from '../lib/supabaseClient.js';

/** Batches created within the last 7 days — mirrors the legacy getOpenBatches() behavior. */
export async function fetchOpenBatches() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('prod_batches')
    .select('batch_id, prodbatch_date')
    .gte('prodbatch_date', cutoffStr)
    .order('batch_id');
  if (error) throw new Error(error.message);
  return data || [];
}
