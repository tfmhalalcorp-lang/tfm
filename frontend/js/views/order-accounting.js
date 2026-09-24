import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { toLocale } from '../lib/ui-helpers.js';

const resource = createTxnResource({
  table: 'accounting_entries',
  dateField: 'due_date',
  select: '*, deliveries(iv_no, so_pi(doc_no))',
  searchPredicate: (item, q) => (item.deliveries?.iv_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, delivery_id: '', currency: 'USD', installment_no: 1, due_date: '', amount: 0 }),
  toForm: (item) => ({
    id: item.id,
    delivery_id: item.delivery_id,
    currency: item.currency || 'USD',
    installment_no: item.installment_no || 1,
    due_date: item.due_date,
    amount: item.amount,
  }),
  validate: (form) => (!form.delivery_id || !form.due_date ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
  toPayload: (form) => ({
    delivery_id: form.delivery_id,
    currency: form.currency,
    installment_no: Number(form.installment_no || 1),
    due_date: form.due_date,
    amount: Number(form.amount || 0),
  }),
  loadExtra: async () => {
    const { data: deliveries } = await supabase.from('deliveries').select('id, iv_no, so_pi(doc_no)').order('iv_no');
    return { deliveries: deliveries || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('accountingTxn', resource);
});

registerView('order-accounting', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'accountingTxn',
    title: 'รายการบัญชี/การชำระเงิน',
    theadHtml: `<th class="px-3 py-2">IV No.</th><th class="px-3 py-2">อ้างอิง SO/PI</th><th class="px-3 py-2">สกุลเงิน</th><th class="px-3 py-2">งวดที่</th><th class="px-3 py-2">วันที่กำหนดชำระ</th><th class="px-3 py-2 text-right">ยอดเงิน</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-semibold" x-text="item.deliveries?.iv_no || '-'"></td>
      <td class="px-3 py-2" x-text="item.deliveries?.so_pi?.doc_no || '-'"></td>
      <td class="px-3 py-2" x-text="item.currency || 'USD'"></td>
      <td class="px-3 py-2" x-text="item.installment_no || 1"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.due_date)"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.amount).toLocaleString(undefined,{minimumFractionDigits:2})"></td>
    `,
    colCount: 7,
    modalTitleAdd: 'เพิ่มรายการบัญชี',
    modalTitleEdit: 'แก้ไขรายการบัญชี',
    modalFieldsHtml: `
      <div>
        <label class="form-label">เลือกอ้างอิง IV No.</label>
        <select x-model="form.delivery_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก IV No. --</option>
          <template x-for="d in extra.deliveries" :key="d.id">
            <option :value="d.id" x-text="d.iv_no + (d.so_pi ? (' (' + d.so_pi.doc_no + ')') : '')"></option>
          </template>
        </select>
      </div>
      <div>
        <label class="form-label">สกุลเงิน (Currency)</label>
        <div class="flex gap-4">
          <label class="inline-flex items-center gap-1.5"><input type="radio" value="USD" x-model="form.currency"> USD</label>
          <label class="inline-flex items-center gap-1.5"><input type="radio" value="THB" x-model="form.currency"> THB</label>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div><label class="form-label">งวดที่</label><input type="number" min="1" x-model.number="form.installment_no" class="form-control"></div>
        <div><label class="form-label">วันที่กำหนดชำระ</label><input type="date" x-model="form.due_date" required class="form-control"></div>
        <div><label class="form-label">ยอดเงิน</label><input type="number" step="0.01" min="0" x-model.number="form.amount" class="form-control"></div>
      </div>
    `,
    modalWidthClass: 'max-w-md',
    desktopOnly: true,
  });
});
