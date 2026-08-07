import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';
import { supabase } from '../lib/supabaseClient.js';

const baseResource = createTxnResource({
  table: 'machine_pm',
  dateField: 'machinepm_date',
  select: '*, machines(machine_name)',
  searchPredicate: (item, q) =>
    (item.machines?.machine_name || '').toLowerCase().includes(q) || (item.detail || '').toLowerCase().includes(q),
  emptyForm: () => ({
    id: null,
    machinepm_date: '',
    machine_id: '',
    detail: '',
    start_time: '',
    end_time: '',
    downtime: 0,
    solve: '',
    can_waste: 0,
    employee: '',
  }),
  toForm: (item) => ({
    id: item.id,
    machinepm_date: item.machinepm_date,
    machine_id: item.machine_id,
    detail: item.detail || '',
    start_time: (item.start_time || '').slice(0, 5),
    end_time: (item.end_time || '').slice(0, 5),
    downtime: item.downtime,
    solve: item.solve || '',
    can_waste: item.can_waste,
    employee: item.employee || '',
  }),
  validate: (form) => (!form.machinepm_date || !form.machine_id || !form.detail ? 'กรุณากรอกวันที่, เครื่องจักร และอาการเสีย' : null),
  toPayload: (form) => ({
    machinepm_date: form.machinepm_date,
    machine_id: form.machine_id,
    detail: form.detail.trim(),
    start_time: form.start_time || null,
    end_time: form.end_time || null,
    downtime: Number(form.downtime || 0),
    solve: form.solve || '',
    can_waste: 0,
    employee: form.employee || '',
  }),
  loadExtra: async () => {
    const { data: machines } = await supabase.from('machines').select('id, machine_name').order('machine_name');
    return { machines: machines || [] };
  },
});

function machinePmComponent() {
  return Object.assign(baseResource(), {
    calcDowntime() {
      if (!this.form.start_time || !this.form.end_time) return;
      const [sh, sm] = this.form.start_time.split(':').map(Number);
      const [eh, em] = this.form.end_time.split(':').map(Number);
      let diff = eh * 60 + em - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      this.form.downtime = diff;
    },
  });
}

document.addEventListener('alpine:init', () => {
  Alpine.data('machinePmTxn', machinePmComponent);
});

registerView('ma-log', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'machinePmTxn',
    title: 'บันทึกแจ้งซ่อม (Breakdown)',
    theadHtml: `<th class="px-3 py-2">วันที่</th><th class="px-3 py-2">เครื่องจักร</th><th class="px-3 py-2">อาการ/สาเหตุ</th><th class="px-3 py-2 text-right">หยุดเครื่อง (นาที)</th><th class="px-3 py-2">ผู้แจ้ง/ซ่อม</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.machinepm_date)"></td>
      <td class="px-3 py-2 font-semibold" x-text="item.machines?.machine_name || '-'"></td>
      <td class="px-3 py-2 max-w-[260px] truncate" :title="item.detail" x-text="item.detail"></td>
      <td class="px-3 py-2 text-right" x-text="Number(item.downtime).toLocaleString()"></td>
      <td class="px-3 py-2" x-text="item.employee || '-'"></td>
    `,
    colCount: 6,
    modalTitleAdd: 'เพิ่มบันทึกแจ้งซ่อม',
    modalTitleEdit: 'แก้ไขบันทึกแจ้งซ่อม',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่แจ้ง</label><input type="date" x-model="form.machinepm_date" required class="form-control"></div>
        <div>
          <label class="form-label">เครื่องจักร</label>
          <select x-model="form.machine_id" required class="form-control" data-no-tom>
            <option value="">-- เลือกเครื่องจักร --</option>
            <template x-for="m in extra.machines" :key="m.id"><option :value="m.id" x-text="m.machine_name"></option></template>
          </select>
        </div>
      </div>
      <div><label class="form-label">อาการเสีย (Issue)</label><textarea x-model="form.detail" required rows="2" class="form-control"></textarea></div>
      <div class="grid grid-cols-3 gap-4 items-end">
        <div><label class="form-label">เวลาเริ่ม</label><input type="time" x-model="form.start_time" @change="calcDowntime()" class="form-control"></div>
        <div><label class="form-label">เวลาเสร็จ</label><input type="time" x-model="form.end_time" @change="calcDowntime()" class="form-control"></div>
        <div><label class="form-label">หยุดเครื่อง (นาที)</label><input type="number" min="0" x-model.number="form.downtime" class="form-control"></div>
      </div>
      <div><label class="form-label">การแก้ไข (Solution)</label><textarea x-model="form.solve" rows="2" class="form-control"></textarea></div>
      <div><label class="form-label">ผู้ปฏิบัติงาน</label><input type="text" x-model="form.employee" class="form-control" data-no-flatpickr></div>
    `,
    modalWidthClass: 'max-w-xl',
  });
});
