import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const resource = createTxnResource({
  table: 'prod_emptycan',
  dateField: 'prodemptycan_date',
  select: '*, suppliers(supplier_name), can_sizes(cansize_name)',
  searchPredicate: (item, q) =>
    (item.suppliers?.supplier_name || '').toLowerCase().includes(q) ||
    (item.can_sizes?.cansize_name || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, prodemptycan_date: '', supplier_id: '', cansize_id: '', qty: 0 }),
  toForm: (item) => ({
    id: item.id,
    prodemptycan_date: item.prodemptycan_date,
    supplier_id: item.supplier_id,
    cansize_id: item.cansize_id,
    qty: item.qty,
  }),
  validate: (form) =>
    !form.prodemptycan_date || !form.supplier_id || !form.cansize_id || form.qty === '' || form.qty === null
      ? 'กรุณากรอกข้อมูลให้ครบถ้วน'
      : null,
  toPayload: (form) => ({
    prodemptycan_date: form.prodemptycan_date,
    supplier_id: form.supplier_id,
    cansize_id: form.cansize_id,
    qty: Number(form.qty || 0),
  }),
  loadExtra: async () => {
    const [{ data: suppliers }, { data: cansizes }] = await Promise.all([
      // Only can suppliers (can_type set) belong in this dropdown — RM-only
      // suppliers (fish_type but no can_type) don't sell cans.
      supabase.from('suppliers').select('id, supplier_name, can_type').order('supplier_name'),
      supabase.from('can_sizes').select('id, cansize_name').order('cansize_name'),
    ]);
    const canSuppliers = (suppliers || []).filter((s) => (s.can_type || '').trim() !== '');
    return { suppliers: canSuppliers, cansizes: cansizes || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('emptyCanTxn', resource);
});

registerView('prod-emptycan', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'emptyCanTxn',
    title: 'บันทึกการใช้กระป๋องเปล่า',
    theadHtml: `<th class="px-3 py-2">วันที่ผลิต</th><th class="px-3 py-2">Supplier</th><th class="px-3 py-2">ขนาดกระป๋อง</th><th class="px-3 py-2 text-right">จำนวน (กระป๋อง)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodemptycan_date)"></td>
      <td class="px-3 py-2" x-text="item.suppliers?.supplier_name || '-'"></td>
      <td class="px-3 py-2" x-text="item.can_sizes?.cansize_name || '-'"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty).toLocaleString()"></td>
    `,
    colCount: 5,
    modalTitleAdd: 'เพิ่มบันทึกการใช้กระป๋องเปล่า',
    modalTitleEdit: 'แก้ไขบันทึกการใช้กระป๋องเปล่า',
    modalFieldsHtml: `
      <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.prodemptycan_date" required class="form-control"></div>
      <div>
        <label class="form-label">Supplier</label>
        <select x-model="form.supplier_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก Supplier --</option>
          <template x-for="s in extra.suppliers" :key="s.id"><option :value="s.id" x-text="s.supplier_name"></option></template>
        </select>
      </div>
      <div>
        <label class="form-label">ขนาดกระป๋อง (Can Size)</label>
        <select x-model="form.cansize_id" required class="form-control" data-no-tom>
          <option value="">-- เลือกขนาดกระป๋อง --</option>
          <template x-for="c in extra.cansizes" :key="c.id"><option :value="c.id" x-text="c.cansize_name"></option></template>
        </select>
      </div>
      <div class="flex items-end gap-2">
        <div class="flex-1"><label class="form-label">จำนวน</label><input type="number" min="0" x-model.number="form.qty" required class="form-control"></div>
        <span class="pb-2 text-gray-500 text-sm">กระป๋อง</span>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
