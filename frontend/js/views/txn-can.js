import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'prod_can',
  dateField: 'prodcan_date',
  searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q) || (item.basket_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, prodcan_date: '', batch_id: '', basket_no: '', can_sum: 0 }),
  toForm: (item) => ({ id: item.id, prodcan_date: item.prodcan_date, batch_id: item.batch_id, basket_no: item.basket_no || '', can_sum: item.can_sum }),
  validate: (form) =>
    !form.prodcan_date || !form.batch_id || !form.basket_no || form.can_sum === '' || form.can_sum === null
      ? 'กรุณากรอกข้อมูลให้ครบถ้วน'
      : null,
  toPayload: (form) => ({
    prodcan_date: form.prodcan_date,
    batch_id: form.batch_id,
    basket_no: form.basket_no.trim(),
    can_sum: Number(form.can_sum || 0),
  }),
  loadExtra: async () => ({ batches: await fetchOpenBatches() }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('canUsageTxn', resource);
});

function template() {
  return txnListTemplate({
    dataExpr: 'canUsageTxn',
    title: 'บันทึกการใช้กระป๋อง',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2">หมายเลขตะกร้า</th><th class="px-3 py-2 text-right">จน.กระป๋องที่ใช้ (กระป๋อง)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.prodcan_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.basket_no"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.can_sum).toLocaleString()"></td>
    `,
    colCount: 5,
    modalTitleAdd: 'เพิ่มบันทึกการใช้กระป๋อง',
    modalTitleEdit: 'แก้ไขบันทึกการใช้กระป๋อง',
    modalFieldsHtml: `
      <div><label class="form-label">วันที่ใช้</label><input type="date" x-model="form.prodcan_date" required class="form-control"></div>
      <div>
        <label class="form-label">Batch</label>
        <select x-model="form.batch_id" required class="form-control" data-no-tom>
          <option value="">-- เลือก Batch --</option>
          <template x-for="b in extra.batches" :key="b.batch_id"><option :value="b.batch_id" x-text="b.batch_id"></option></template>
        </select>
      </div>
      <div><label class="form-label">หมายเลขตะกร้า (Basket No.)</label><input type="text" x-model="form.basket_no" required class="form-control" data-no-flatpickr></div>
      <div class="flex items-end gap-2">
        <div class="flex-1"><label class="form-label">จน.กระป๋องที่ใช้</label><input type="number" min="0" x-model.number="form.can_sum" required class="form-control"></div>
        <span class="pb-2 text-gray-500 text-sm">กระป๋อง</span>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
}

registerView('prod-can', async (container) => { container.innerHTML = template(); });
registerView('qc-can', async (container) => { container.innerHTML = template(); });
