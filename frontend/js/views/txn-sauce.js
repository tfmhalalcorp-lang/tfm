import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'qc_sauce',
  dateField: 'qcsauce_date',
  select: '*, sauces(sauce_brand)',
  searchPredicate: (item, q) =>
    (item.batch_id || '').toLowerCase().includes(q) || (item.sauces?.sauce_brand || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, qcsauce_date: '', batch_id: '', sauce_id: '', qty_used: 0, qty_remaining: 0, qty_waste: 0 }),
  toForm: (item) => ({
    id: item.id,
    qcsauce_date: item.qcsauce_date,
    batch_id: item.batch_id,
    sauce_id: item.sauce_id,
    qty_used: item.qty_used,
    qty_remaining: item.qty_remaining,
    qty_waste: item.qty_waste,
  }),
  validate: (form) => (!form.qcsauce_date || !form.batch_id || !form.sauce_id ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
  toPayload: (form) => ({
    qcsauce_date: form.qcsauce_date,
    batch_id: form.batch_id,
    sauce_id: form.sauce_id,
    qty_used: Number(form.qty_used || 0),
    qty_remaining: Number(form.qty_remaining || 0),
    qty_waste: Number(form.qty_waste || 0),
  }),
  loadExtra: async () => {
    const [batches, { data: sauces }] = await Promise.all([
      fetchOpenBatches(),
      supabase.from('sauces').select('id, sauce_brand').order('sauce_brand'),
    ]);
    return { batches, sauces: sauces || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('sauceTxn', resource);
});

registerView('qc-sauce', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'sauceTxn',
    title: 'บันทึกการใช้ซอส',
    theadHtml: `<th class="px-3 py-2">วันที่ผลิต</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2">แบรนด์ซอส</th><th class="px-3 py-2 text-right">ปริมาณ (ลิตร)</th><th class="px-3 py-2 text-right">เหลือใช้ (ลิตร)</th><th class="px-3 py-2 text-right">ทิ้ง (ลิตร)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.qcsauce_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.sauces?.sauce_brand || '-'"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty_used).toLocaleString()"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty_remaining).toLocaleString()"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty_waste).toLocaleString()"></td>
    `,
    colCount: 7,
    modalTitleAdd: 'เพิ่มบันทึกการใช้ซอส',
    modalTitleEdit: 'แก้ไขบันทึกการใช้ซอส',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.qcsauce_date" required class="form-control"></div>
        <div>
          <label class="form-label">Batch</label>
          <select x-model="form.batch_id" required class="form-control" data-no-tom>
            <option value="">-- เลือก Batch --</option>
            <template x-for="b in extra.batches" :key="b.batch_id"><option :value="b.batch_id" x-text="b.batch_id"></option></template>
          </select>
        </div>
      </div>
      <div>
        <label class="form-label">แบรนด์ซอส</label>
        <select x-model="form.sauce_id" required class="form-control" data-no-tom>
          <option value="">-- เลือกแบรนด์ซอส --</option>
          <template x-for="s in extra.sauces" :key="s.id"><option :value="s.id" x-text="s.sauce_brand"></option></template>
        </select>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div><label class="form-label">ปริมาณ (ลิตร)</label><input type="number" step="0.01" min="0" x-model.number="form.qty_used" required class="form-control"></div>
        <div><label class="form-label">เหลือใช้ (ลิตร)</label><input type="number" step="0.01" min="0" x-model.number="form.qty_remaining" class="form-control"></div>
        <div><label class="form-label">ทิ้ง (ลิตร)</label><input type="number" step="0.01" min="0" x-model.number="form.qty_waste" class="form-control"></div>
      </div>
    `,
    modalWidthClass: 'max-w-xl',
  });
});
