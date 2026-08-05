import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const resource = createTxnResource({
  table: 'production_plans',
  dateField: 'plan_date',
  select: '*, so_pi(doc_no), products(product_name)',
  searchPredicate: (item, q) => (item.plan_no || '').toLowerCase().includes(q) || (item.so_pi?.doc_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, plan_no: '', so_pi_id: '', plan_date: '', product_id: '', qty: 0, expected_load_date: '' }),
  toForm: (item) => ({
    id: item.id,
    plan_no: item.plan_no,
    so_pi_id: item.so_pi_id,
    plan_date: item.plan_date,
    product_id: item.product_id || '',
    qty: item.qty,
    expected_load_date: item.expected_load_date || '',
  }),
  validate: (form) => (!form.plan_no || !form.so_pi_id || !form.plan_date ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
  toPayload: (form) => ({
    plan_no: form.plan_no.trim(),
    so_pi_id: form.so_pi_id,
    plan_date: form.plan_date,
    product_id: form.product_id || null,
    qty: Number(form.qty || 0),
    expected_load_date: form.expected_load_date || null,
  }),
  loadExtra: async () => {
    const [{ data: soPiList }, { data: products }] = await Promise.all([
      supabase.from('so_pi').select('id, doc_no').order('doc_no'),
      supabase.from('products').select('id, product_name').order('product_name'),
    ]);
    return { soPiList: soPiList || [], products: products || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('planTxn', resource);
});

registerView('order-plan', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'planTxn',
    title: 'รายการแผนการผลิต',
    theadHtml: `<th class="px-3 py-2">หมายเลขแผนผลิต</th><th class="px-3 py-2">อ้างอิง SO/PI</th><th class="px-3 py-2">วันที่ผลิต</th><th class="px-3 py-2">สินค้า</th><th class="px-3 py-2 text-right">จำนวน</th><th class="px-3 py-2">วันที่คาดว่าจะโหลด</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-semibold" x-text="item.plan_no"></td>
      <td class="px-3 py-2" x-text="item.so_pi?.doc_no || '-'"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.plan_date)"></td>
      <td class="px-3 py-2" x-text="item.products?.product_name || '-'"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty).toLocaleString()"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="item.expected_load_date ? fmtDate(item.expected_load_date) : '-'"></td>
    `,
    colCount: 7,
    modalTitleAdd: 'เพิ่มแผนการผลิต',
    modalTitleEdit: 'แก้ไขแผนการผลิต',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">หมายเลขแผนผลิต</label><input type="text" x-model="form.plan_no" required class="form-control" data-no-flatpickr></div>
        <div>
          <label class="form-label">อ้างอิง SO/PI</label>
          <select x-model="form.so_pi_id" required class="form-control" data-no-tom>
            <option value="">-- เลือก SO/PI --</option>
            <template x-for="s in extra.soPiList" :key="s.id"><option :value="s.id" x-text="s.doc_no"></option></template>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.plan_date" required class="form-control"></div>
        <div>
          <label class="form-label">สินค้า</label>
          <select x-model="form.product_id" class="form-control" data-no-tom>
            <option value="">-- เลือกสินค้า --</option>
            <template x-for="p in extra.products" :key="p.id"><option :value="p.id" x-text="p.product_name"></option></template>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">จำนวน</label><input type="number" min="0" x-model.number="form.qty" class="form-control"></div>
        <div><label class="form-label">วันที่คาดว่าจะโหลด</label><input type="date" x-model="form.expected_load_date" class="form-control"></div>
      </div>
    `,
    modalWidthClass: 'max-w-xl',
    desktopOnly: true,
  });
});
