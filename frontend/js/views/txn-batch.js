import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const resource = createTxnResource({
  table: 'prod_batches',
  dateField: 'prodbatch_date',
  select: '*, can_sizes(cansize_name), brands(brand_name)',
  searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, prodbatch_date: '', batch_id: '', cansize_id: '', brand_id: '' }),
  toForm: (item) => ({
    id: item.id,
    prodbatch_date: item.prodbatch_date,
    batch_id: item.batch_id,
    cansize_id: item.cansize_id,
    brand_id: item.brand_id,
  }),
  validate: (form) =>
    !form.prodbatch_date || !form.batch_id || !form.cansize_id || !form.brand_id
      ? 'กรุณากรอกข้อมูลให้ครบถ้วน'
      : null,
  toPayload: (form) => ({
    prodbatch_date: form.prodbatch_date,
    batch_id: form.batch_id.trim(),
    cansize_id: form.cansize_id,
    brand_id: form.brand_id,
  }),
  loadExtra: async () => {
    const [{ data: brands }, { data: canSizes }] = await Promise.all([
      supabase.from('brands').select('id, brand_name').order('brand_name'),
      supabase.from('can_sizes').select('id, cansize_name').order('cansize_name'),
    ]);
    return { brands: brands || [], canSizes: canSizes || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('batchTxn', resource);
});

registerView('prod-batch', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'batchTxn',
    title: 'รายการ Batch ผลิต',
    theadHtml: `<th class="px-3 py-2">วันที่ผลิต</th><th class="px-3 py-2">Batch ID</th><th class="px-3 py-2">Brand</th><th class="px-3 py-2">ขนาด</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodbatch_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.brands?.brand_name || '-'"></td>
      <td class="px-3 py-2" x-text="item.can_sizes?.cansize_name || '-'"></td>
    `,
    colCount: 5,
    modalTitleAdd: 'เพิ่ม Batch ใหม่',
    modalTitleEdit: 'แก้ไข Batch',
    modalFieldsHtml: `
      <div>
        <label class="form-label">วันที่ผลิต (Manufacturing Date)</label>
        <input type="date" x-model="form.prodbatch_date" required class="form-control">
      </div>
      <div>
        <label class="form-label">Batch ID</label>
        <input type="text" x-model="form.batch_id" required :readonly="isEdit"
               :class="isEdit ? 'bg-gray-100 text-gray-500' : ''" class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">BRAND</label>
        <select x-model="form.brand_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก Brand --</option>
          <template x-for="b in extra.brands" :key="b.id"><option :value="b.id" x-text="b.brand_name"></option></template>
        </select>
      </div>
      <div>
        <label class="form-label">CAN SIZE</label>
        <select x-model="form.cansize_id" required class="form-control" data-no-tom>
          <option value="">-- เลือกขนาด --</option>
          <template x-for="c in extra.canSizes" :key="c.id"><option :value="c.id" x-text="c.cansize_name"></option></template>
        </select>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
