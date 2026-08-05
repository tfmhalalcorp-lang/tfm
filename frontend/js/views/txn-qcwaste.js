import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const WASTE_LABELS = {
  waste_let: 'Let',
  waste_steam: 'Steam',
  waste_float: 'Float',
  waste_qc: 'QC',
  waste_it: 'IT',
  waste_spur: 'Spur',
  waste_seam: 'Seam',
  waste_seamer: 'Seamer',
  waste_breakdown: 'Breakdown',
  waste_bumped: 'บุบ',
  waste_swollen: 'บวม',
  waste_falseseam: 'False Seam',
  waste_received: 'รับกระป๋อง',
  waste_other: 'อื่นๆ',
};
const WASTE_FIELDS = Object.keys(WASTE_LABELS);

const wasteInputsHtml = WASTE_FIELDS.map(
  (k) => `
  <div>
    <label class="form-label text-xs">${WASTE_LABELS[k]}</label>
    <input type="number" min="0" x-model.number="form.${k}" class="form-control">
  </div>`
).join('');

function makeQcWasteResource(dept) {
  return createTxnResource({
    table: 'qc_waste',
    dateField: 'qcwaste_date',
    searchPredicate: (item, q) => (item.batch_id || '').toLowerCase().includes(q),
    fetchItems: async () => {
      const { data, error } = await supabase
        .from('qc_waste')
        .select('*, can_sizes(cansize_name)')
        .eq('department', dept)
        .order('qcwaste_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    },
    emptyForm: () => {
      const f = { id: null, qcwaste_date: '', batch_id: '', department: dept, cansize_id: '' };
      WASTE_FIELDS.forEach((k) => (f[k] = 0));
      return f;
    },
    toForm: (item) => {
      const f = {
        id: item.id,
        qcwaste_date: item.qcwaste_date,
        batch_id: item.batch_id,
        department: item.department,
        cansize_id: item.cansize_id,
      };
      WASTE_FIELDS.forEach((k) => (f[k] = item[k]));
      return f;
    },
    validate: (form) => (!form.qcwaste_date || !form.batch_id || !form.cansize_id ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : null),
    toPayload: (form) => {
      const p = {
        qcwaste_date: form.qcwaste_date,
        batch_id: form.batch_id,
        department: form.department,
        cansize_id: form.cansize_id,
      };
      WASTE_FIELDS.forEach((k) => (p[k] = Number(form[k] || 0)));
      return p;
    },
    loadExtra: async () => {
      const [batches, { data: canSizes }] = await Promise.all([
        fetchOpenBatches(),
        supabase.from('can_sizes').select('id, cansize_name').order('cansize_name'),
      ]);
      return { batches, canSizes: canSizes || [] };
    },
  });
}

function qcWasteComponent(dept) {
  const base = makeQcWasteResource(dept)();
  return {
    ...base,
    wasteTotal(item) {
      return WASTE_FIELDS.reduce((sum, k) => sum + Number(item[k] || 0), 0);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('qcWasteTxn_PD', () => qcWasteComponent('PD'));
  Alpine.data('qcWasteTxn_WH', () => qcWasteComponent('WH'));
  Alpine.data('qcWasteTxn_QC', () => qcWasteComponent('QC'));
});

function template(dataExpr, deptLabelTh) {
  return txnListTemplate({
    dataExpr,
    title: `บันทึกของเสีย - Waste Log (${deptLabelTh})`,
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2">CAN SIZE</th><th class="px-3 py-2 text-right">รวมของเสีย</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.qcwaste_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.can_sizes?.cansize_name || '-'"></td>
      <td class="px-3 py-2 text-right font-semibold" x-text="wasteTotal(item).toLocaleString()"></td>
    `,
    colCount: 5,
    modalTitleAdd: 'เพิ่มบันทึกของเสีย',
    modalTitleEdit: 'แก้ไขบันทึกของเสีย',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่</label><input type="date" x-model="form.qcwaste_date" required class="form-control"></div>
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
          <label class="form-label">ส่วนงาน (Department)</label>
          <select x-model="form.department" required class="form-control" data-no-tom>
            <option value="PD">ผลิต (PD)</option>
            <option value="WH">คลังสินค้า (WH)</option>
            <option value="QC">QC</option>
          </select>
        </div>
        <div>
          <label class="form-label">CAN SIZE</label>
          <select x-model="form.cansize_id" required class="form-control" data-no-tom>
            <option value="">-- เลือกขนาด --</option>
            <template x-for="c in extra.canSizes" :key="c.id"><option :value="c.id" x-text="c.cansize_name"></option></template>
          </select>
        </div>
      </div>
      <div class="pt-3 border-t">
        <h4 class="text-sm font-semibold text-gray-600 mb-2">รายละเอียดของเสีย (หน่วย: กระป๋อง)</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${wasteInputsHtml}</div>
      </div>
    `,
    modalWidthClass: 'max-w-2xl',
  });
}

registerView('qc-waste', async (container) => { container.innerHTML = template('qcWasteTxn_QC', 'QC'); });
registerView('waste-pd', async (container) => { container.innerHTML = template('qcWasteTxn_PD', 'ผลิต / PD'); });
registerView('waste-wh', async (container) => { container.innerHTML = template('qcWasteTxn_WH', 'คลังสินค้า / WH'); });
