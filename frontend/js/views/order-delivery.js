import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const resource = createTxnResource({
  table: 'deliveries',
  dateField: 'bill_of_load_date',
  select: '*, so_pi(doc_no)',
  searchPredicate: (item, q) => (item.iv_no || '').toLowerCase().includes(q) || (item.so_pi?.doc_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, so_pi_id: '', bill_of_load_date: '', iv_no: '' }),
  toForm: (item) => ({ id: item.id, so_pi_id: item.so_pi_id, bill_of_load_date: item.bill_of_load_date, iv_no: item.iv_no }),
  validate: (form) => (!form.so_pi_id || !form.bill_of_load_date || !form.iv_no ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
  toPayload: (form) => ({
    so_pi_id: form.so_pi_id,
    bill_of_load_date: form.bill_of_load_date,
    iv_no: form.iv_no.trim(),
  }),
  loadExtra: async () => {
    const { data: soPiList } = await supabase.from('so_pi').select('id, doc_no').order('doc_no');
    return { soPiList: soPiList || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('deliveryTxn', resource);
});

registerView('order-delivery', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'deliveryTxn',
    title: 'รายการจัดส่ง/ส่งมอบสินค้า',
    theadHtml: `<th class="px-3 py-2">อ้างอิง SO/PI</th><th class="px-3 py-2">Bill of Load Date</th><th class="px-3 py-2">IV No.</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-semibold" x-text="item.so_pi?.doc_no || '-'"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.bill_of_load_date)"></td>
      <td class="px-3 py-2" x-text="item.iv_no"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มบันทึกการจัดส่ง',
    modalTitleEdit: 'แก้ไขบันทึกการจัดส่ง',
    modalFieldsHtml: `
      <div>
        <label class="form-label">อ้างอิง SO/PI</label>
        <select x-model="form.so_pi_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก SO/PI --</option>
          <template x-for="s in extra.soPiList" :key="s.id"><option :value="s.id" x-text="s.doc_no"></option></template>
        </select>
      </div>
      <div><label class="form-label">Bill of Load Date</label><input type="date" x-model="form.bill_of_load_date" required class="form-control"></div>
      <div><label class="form-label">IV No.</label><input type="text" x-model="form.iv_no" required class="form-control" data-no-flatpickr></div>
    `,
    modalWidthClass: 'max-w-md',
    desktopOnly: true,
  });
});
