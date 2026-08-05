import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'prod_rm',
  dateField: 'prodrm_date',
  select: '*, suppliers(supplier_name, fish_type)',
  searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q),
  emptyForm: () => ({
    id: null,
    prodrm_date: '',
    batch_id: '',
    supplier_id: '',
    billsup_no: '',
    fish_type: '',
    weight: 0,
    balance: 0,
    fish_balance: 0,
  }),
  toForm: (item) => ({
    id: item.id,
    prodrm_date: item.prodrm_date,
    batch_id: item.batch_id,
    supplier_id: item.supplier_id,
    billsup_no: item.billsup_no || '',
    fish_type: item.fish_type || '',
    weight: item.weight,
    balance: item.balance,
    fish_balance: item.fish_balance,
  }),
  validate: (form) => (!form.prodrm_date || !form.batch_id || !form.supplier_id ? 'กรุณาเลือก Batch และ Supplier ให้ครบถ้วน' : null),
  toPayload: (form) => ({
    prodrm_date: form.prodrm_date,
    batch_id: form.batch_id,
    supplier_id: form.supplier_id,
    billsup_no: form.billsup_no || '',
    fish_type: form.fish_type || '',
    weight: Number(form.weight || 0),
    balance: Number(form.balance || 0),
    fish_balance: Number(form.fish_balance || 0),
  }),
  loadExtra: async () => {
    const [batches, { data: suppliers }] = await Promise.all([
      fetchOpenBatches(),
      supabase.from('suppliers').select('id, supplier_name, fish_type').order('supplier_name'),
    ]);
    return { batches, suppliers: suppliers || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('rmTxn', resource);
});

registerView('prod-rm', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'rmTxn',
    title: 'รายการเบิกวัตถุดิบ (RM)',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2">Supplier</th><th class="px-3 py-2">เลขที่บิลซื้อ</th><th class="px-3 py-2">ปลา</th><th class="px-3 py-2 text-right">น.น.(kg)</th><th class="px-3 py-2 text-right">คงค้าง (kg.)</th><th class="px-3 py-2 text-right">ปลาคงค้าง (KG)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodrm_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.suppliers?.supplier_name || '-'"></td>
      <td class="px-3 py-2" x-text="item.billsup_no || '-'"></td>
      <td class="px-3 py-2" x-text="item.fish_type || '-'"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.weight).toLocaleString()"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.balance).toLocaleString()"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.fish_balance).toLocaleString()"></td>
    `,
    colCount: 9,
    modalTitleAdd: 'เพิ่มรายการเบิกวัตถุดิบ',
    modalTitleEdit: 'แก้ไขรายการเบิกวัตถุดิบ',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่</label><input type="date" x-model="form.prodrm_date" required class="form-control"></div>
        <div>
          <label class="form-label">Batch</label>
          <select x-model="form.batch_id" required class="form-control" data-no-tom>
            <option value="">-- เลือก Batch --</option>
            <template x-for="b in extra.batches" :key="b.batch_id"><option :value="b.batch_id" x-text="b.batch_id"></option></template>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="form-label">Supplier</label>
          <select x-model="form.supplier_id" required class="form-control" data-no-tom
                  @change="const s = extra.suppliers.find(x => x.id === form.supplier_id); if (s) form.fish_type = s.fish_type || form.fish_type">
            <option value="">-- เลือก Supplier --</option>
            <template x-for="s in extra.suppliers" :key="s.id"><option :value="s.id" x-text="s.supplier_name"></option></template>
          </select>
        </div>
        <div><label class="form-label">เลขที่บิลซื้อ</label><input type="text" x-model="form.billsup_no" class="form-control" data-no-flatpickr></div>
      </div>
      <div>
        <label class="form-label">ชนิดปลา (Fish Type)</label>
        <input type="text" x-model="form.fish_type" placeholder="เลือก Supplier เพื่อดึงอัตโนมัติ หรือพิมพ์เอง" class="form-control" data-no-flatpickr>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div><label class="form-label">น้ำหนัก (Kg)</label><input type="number" step="0.01" min="0" x-model.number="form.weight" class="form-control"></div>
        <div><label class="form-label">คงค้าง (Kg)</label><input type="number" step="0.01" min="0" x-model.number="form.balance" class="form-control"></div>
        <div><label class="form-label">ปลาคงค้าง (KG)</label><input type="number" step="0.01" min="0" x-model.number="form.fish_balance" class="form-control" title="ปลาที่เหลือค้างจากรอบก่อน"></div>
      </div>
    `,
    modalWidthClass: 'max-w-xl',
  });
});
