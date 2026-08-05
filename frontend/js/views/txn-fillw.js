import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'prod_fillw',
  dateField: 'prodfillw_date',
  searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, prodfillw_date: '', batch_id: '', weight: 0 }),
  toForm: (item) => ({ id: item.id, prodfillw_date: item.prodfillw_date, batch_id: item.batch_id, weight: item.weight }),
  validate: (form) =>
    !form.prodfillw_date || !form.batch_id || form.weight === '' || form.weight === null ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null,
  toPayload: (form) => ({
    prodfillw_date: form.prodfillw_date,
    batch_id: form.batch_id,
    weight: Number(form.weight || 0),
  }),
  loadExtra: async () => ({ batches: await fetchOpenBatches() }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('fillwTxn', resource);
});

registerView('prod-fillweight', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'fillwTxn',
    title: 'บันทึก Fill Weight',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2 text-right">น้ำหนัก (กรัม)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodfillw_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.weight).toLocaleString()"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มบันทึก Fill Weight',
    modalTitleEdit: 'แก้ไขบันทึก Fill Weight',
    modalFieldsHtml: `
      <div><label class="form-label">วันที่ชั่ง</label><input type="date" x-model="form.prodfillw_date" required class="form-control"></div>
      <div>
        <label class="form-label">Batch</label>
        <select x-model="form.batch_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก Batch --</option>
          <template x-for="b in extra.batches" :key="b.batch_id"><option :value="b.batch_id" x-text="b.batch_id"></option></template>
        </select>
      </div>
      <div><label class="form-label">น้ำหนัก (กรัม)</label><input type="number" step="0.01" min="0" x-model.number="form.weight" required class="form-control"></div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
