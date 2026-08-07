import { registerView } from '../router.js';
import { createTxnResource, txnListTemplate } from '../data/txn-factory.js';

const DEPT_LABELS = { PD: 'ผลิต', WH: 'คลัง', QC: 'QC', EN: 'วิศวกรรม' };
const DEPT_COLORS = {
  PD: 'bg-red-100 text-red-700',
  WH: 'bg-amber-100 text-amber-700',
  QC: 'bg-sky-100 text-sky-700',
  EN: 'bg-purple-100 text-purple-700',
};
const ROLE_DEPT_MAP = { prod: 'PD', wh: 'WH', qc: 'QC', ma: 'EN' };

const baseResource = createTxnResource({
  table: 'issue_log',
  dateField: 'issue_date',
  searchPredicate: (item, q) => (item.reporter || '').toLowerCase().includes(q) || (item.detail || '').toLowerCase().includes(q),
  emptyForm: () => {
    const auth = Alpine.store('auth');
    const dept = ROLE_DEPT_MAP[auth.role] || 'PD';
    return { id: null, issue_date: '', department: dept, reporter: auth.fullname || '', detail: '', status: 'รอแก้ไข' };
  },
  toForm: (item) => ({
    id: item.id,
    issue_date: item.issue_date,
    department: item.department,
    reporter: item.reporter,
    detail: item.detail,
    status: item.status,
  }),
  validate: (form) => (!form.issue_date || !form.reporter || !form.detail ? 'กรุณากรอกวันที่, ผู้แจ้ง และรายละเอียดปัญหา' : null),
  toPayload: (form) => ({
    issue_date: form.issue_date,
    department: form.department,
    reporter: form.reporter.trim(),
    detail: form.detail.trim(),
    status: form.status,
  }),
});

function issueLogComponent() {
  return Object.assign(baseResource(), {
    deptLabel(d) {
      return DEPT_LABELS[d] || d;
    },
    deptClass(d) {
      return DEPT_COLORS[d] || 'bg-gray-100 text-gray-600';
    },
  });
}

document.addEventListener('alpine:init', () => {
  Alpine.data('issueLogTxn', issueLogComponent);
});

registerView('issue-log', async (container) => {
  container.innerHTML = txnListTemplate({
    dataExpr: 'issueLogTxn',
    title: 'รายการแจ้งปัญหาในการผลิต',
    theadHtml: `<th class="px-3 py-2">วันที่แจ้ง</th><th class="px-3 py-2">แผนก</th><th class="px-3 py-2">ผู้แจ้ง</th><th class="px-3 py-2">รายละเอียด</th><th class="px-3 py-2">สถานะ</th>`,
    rowHtml: `
      <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(item.issue_date)"></td>
      <td class="px-3 py-2"><span class="badge" :class="deptClass(item.department)" x-text="deptLabel(item.department)"></span></td>
      <td class="px-3 py-2" x-text="item.reporter"></td>
      <td class="px-3 py-2 max-w-[320px]" x-text="item.detail"></td>
      <td class="px-3 py-2">
        <span class="badge" :class="item.status === 'แก้ไขแล้ว' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
              x-text="(item.status === 'แก้ไขแล้ว' ? '✔ ' : '⏳ ') + item.status"></span>
      </td>
    `,
    colCount: 6,
    modalTitleAdd: 'แจ้งปัญหาใหม่',
    modalTitleEdit: 'แก้ไขรายการแจ้งปัญหา',
    modalFieldsHtml: `
      <div class="grid grid-cols-2 gap-4">
        <div><label class="form-label">วันที่แจ้ง</label><input type="date" x-model="form.issue_date" required class="form-control"></div>
        <div>
          <label class="form-label">แผนก (Department)</label>
          <select x-model="form.department" required class="form-control" data-no-tom>
            <option value="PD">ผลิต (PD)</option>
            <option value="WH">คลังสินค้า (WH)</option>
            <option value="QC">QC</option>
            <option value="EN">วิศวกรรม (EN)</option>
          </select>
        </div>
      </div>
      <div><label class="form-label">ผู้แจ้ง</label><input type="text" x-model="form.reporter" required class="form-control" data-no-flatpickr></div>
      <div><label class="form-label">รายละเอียดปัญหา</label><textarea x-model="form.detail" required rows="4" class="form-control"></textarea></div>
      <div>
        <label class="form-label">สถานะ</label>
        <select x-model="form.status" required class="form-control" data-no-tom>
          <option value="รอแก้ไข">รอแก้ไข</option>
          <option value="แก้ไขแล้ว">แก้ไขแล้ว</option>
        </select>
      </div>
    `,
    modalWidthClass: 'max-w-lg',
  });
});
