import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const resource = createTxnResource({
  table: 'wh_load_ready',
  dateField: 'ready_date',
  select: '*, so_pi(doc_no)',
  searchPredicate: (item, q) => (item.so_pi?.doc_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, so_pi_id: '', ready_date: '', remark: '' }),
  toForm: (item) => ({ id: item.id, so_pi_id: item.so_pi_id, ready_date: item.ready_date, remark: item.remark || '' }),
  validate: (form) => (!form.so_pi_id || !form.ready_date ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
  toPayload: (form) => ({
    so_pi_id: form.so_pi_id,
    ready_date: form.ready_date,
    remark: form.remark || '',
  }),
  loadExtra: async () => {
    const { data: soPiList } = await supabase.from('so_pi').select('id, doc_no').order('doc_no');
    return { soPiList: soPiList || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('loadReadyTxn', resource);
});

registerView('wh-load-ready', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'loadReadyTxn',
    title: 'บันทึกวันที่พร้อมโหลดสินค้า',
    theadHtml: `<th class="px-3 py-2">อ้างอิง SO/PI</th><th class="px-3 py-2">วันที่พร้อมโหลด</th><th class="px-3 py-2">หมายเหตุ</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-semibold" x-text="item.so_pi?.doc_no || '-'"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.ready_date)"></td>
      <td class="px-3 py-2" x-text="item.remark || '-'"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มวันที่พร้อมโหลด',
    modalTitleEdit: 'แก้ไขวันที่พร้อมโหลด',
    modalFieldsHtml: `
      <div>
        <label class="form-label">อ้างอิง SO/PI</label>
        <select x-model="form.so_pi_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก SO/PI --</option>
          <template x-for="s in extra.soPiList" :key="s.id"><option :value="s.id" x-text="s.doc_no"></option></template>
        </select>
      </div>
      <div><label class="form-label">วันที่พร้อมโหลด</label><input type="date" x-model="form.ready_date" required class="form-control"></div>
      <div><label class="form-label">หมายเหตุ</label><input type="text" x-model="form.remark" class="form-control" data-no-flatpickr></div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
