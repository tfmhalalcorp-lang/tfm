import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchOpenBatches } from '../data/open-batches.js';

const resource = createTxnResource({
  table: 'wh_in',
  dateField: 'whin_date',
  select: '*, brands(brand_name), so_pi(doc_no)',
  searchPredicate: (item, q) =>
    (item.batch_id || '').toLowerCase().includes(q) ||
    (item.so_no || '').toLowerCase().includes(q) ||
    (item.so_pi?.doc_no || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, whin_date: '', batch_id: '', brand_id: '', so_pi_id: '', so_no: '', can_sum: 0, can_hold: 0, remark: '' }),
  toForm: (item) => ({
    id: item.id,
    whin_date: item.whin_date,
    batch_id: item.batch_id,
    brand_id: item.brand_id,
    so_pi_id: item.so_pi_id || '',
    so_no: item.so_no || '',
    can_sum: item.can_sum,
    can_hold: item.can_hold,
    remark: item.remark || '',
  }),
  validate: (form) =>
    !form.whin_date || !form.batch_id || !form.brand_id || form.can_sum === '' || form.can_sum === null
      ? 'กรุณากรอกข้อมูลให้ครบถ้วน'
      : null,
  toPayload: (form) => ({
    whin_date: form.whin_date,
    batch_id: form.batch_id,
    brand_id: form.brand_id,
    so_pi_id: form.so_pi_id || null,
    so_no: form.so_no || '',
    can_sum: Number(form.can_sum || 0),
    can_hold: Number(form.can_hold || 0),
    remark: form.remark || '',
  }),
  loadExtra: async () => {
    const [batches, { data: brands }, { data: soPiList }] = await Promise.all([
      fetchOpenBatches(),
      supabase.from('brands').select('id, brand_name').order('brand_name'),
      supabase.from('so_pi').select('id, doc_no').order('doc_no'),
    ]);
    return { batches, brands: brands || [], soPiList: soPiList || [] };
  },
});

document.addEventListener('alpine:init', () => {
  Alpine.data('whInTxn', resource);
});

registerView('wh-in', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'whInTxn',
    title: 'บันทึกรับเข้าคลัง',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">Batch</th><th class="px-3 py-2">แบรนด์</th><th class="px-3 py-2">SO No.</th><th class="px-3 py-2 text-right">รับเข้าคลัง (กระป๋อง)</th><th class="px-3 py-2 text-right">กัก (กระป๋อง)</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.whin_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.batch_id"></td>
      <td class="px-3 py-2" x-text="item.brands?.brand_name || '-'"></td>
      <td class="px-3 py-2" x-text="item.so_pi?.doc_no || item.so_no || '-'"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.can_sum).toLocaleString()"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.can_hold).toLocaleString()"></td>
    `,
    colCount: 7,
    modalTitleAdd: 'เพิ่มบันทึกรับเข้าคลัง',
    modalTitleEdit: 'แก้ไขบันทึกรับเข้าคลัง',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่รับเข้า</label><input type="date" x-model="form.whin_date" required class="form-control"></div>
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
          <label class="form-label">แบรนด์</label>
          <select x-model="form.brand_id" required class="form-control" data-no-tom>
            <option value="">-- เลือก Brand --</option>
            <template x-for="b in extra.brands" :key="b.id"><option :value="b.id" x-text="b.brand_name"></option></template>
          </select>
        </div>
        <div>
          <label class="form-label">อ้างอิง SO/PI</label>
          <select x-model="form.so_pi_id" class="form-control" data-no-tom
                  @change="const s = extra.soPiList.find(x => x.id === form.so_pi_id); form.so_no = s ? s.doc_no : ''">
            <option value="">-- ไม่อ้างอิง SO/PI --</option>
            <template x-for="s in extra.soPiList" :key="s.id"><option :value="s.id" x-text="s.doc_no"></option></template>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">จำนวนดี (กระป๋อง)</label><input type="number" min="0" x-model.number="form.can_sum" required class="form-control"></div>
        <div><label class="form-label">จำนวนกัก/รอตรวจสอบ</label><input type="number" min="0" x-model.number="form.can_hold" class="form-control"></div>
      </div>
      <div><label class="form-label">หมายเหตุ</label><input type="text" x-model="form.remark" class="form-control" data-no-flatpickr></div>
    `,
    modalWidthClass: 'max-w-xl',
  });
});
