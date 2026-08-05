import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'prod_fillq',
  dateField: 'prodfillq_date',
  searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, prodfillq_date: '', batch_id: '', qty: 0 }),
  toForm: (item) => ({ id: item.id, prodfillq_date: item.prodfillq_date, batch_id: item.batch_id, qty: item.qty }),
  validate: (form) =>
    !form.prodfillq_date || !form.batch_id || form.qty === '' || form.qty === null ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null,
  toPayload: (form) => ({
    prodfillq_date: form.prodfillq_date,
    batch_id: form.batch_id,
    qty: Number(form.qty || 0),
  }),
  loadExtra: async () => ({ batches: await fetchOpenBatches() }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('fillqTxn', resource);
});

registerView('prod-fillquantity', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'fillqTxn',
    title: 'บันทึกยอดผลิต (Production Quantity)',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2 text-right">จำนวนที่ได้</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodfillq_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.qty).toLocaleString()"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มบันทึกยอดผลิต',
    modalTitleEdit: 'แก้ไขบันทึกยอดผลิต',
    modalFieldsHtml: `
      <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.prodfillq_date" required class="form-control"></div>
      <div>
        <label class="form-label">Batch</label>
        <select x-model="form.batch_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก Batch --</option>
          <template x-for="b in extra.batches" :key="b.batch_id"><option :value="b.batch_id" x-text="b.batch_id"></option></template>
        </select>
      </div>
      <div><label class="form-label">จำนวนที่ได้</label><input type="number" min="0" x-model.number="form.qty" required class="form-control"></div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
