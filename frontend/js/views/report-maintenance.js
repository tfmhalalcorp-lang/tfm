import { registerView } from '../router.js';
import { fetchFiltered } from '../dashboards/dashboard-data.js';
import { getLocalDate, alertError, toLocale, formatDate } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { reportHeaderHtml, exportButtonsHtml } from '../reports/report-helpers.js';

function component() {
  return {
    startDate: getLocalDate(),
    endDate: getLocalDate(),
    loading: false,
    rows: [],

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const pm = await fetchFiltered('machine_pm', 'machinepm_date', filters, '*, machines(machine_name)');
        this.rows = pm
          .map((r) => ({
            date: r.machinepm_date,
            machine: r.machines?.machine_name || '-',
            detail: r.detail || '-',
            downtime: Number(r.downtime || 0),
            solve: r.solve || '-',
            employee: r.employee || '-',
          }))
          .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    fmt(n) {
      return toLocale(n);
    },
    fmtDate(d) {
      return formatDate(d);
    },
    totalDowntime() {
      return this.rows.reduce((s, r) => s + r.downtime, 0);
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'maReportTable', sheetName: 'ซ่อมบำรุง' }], `รายงานซ่อมบำรุง_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('maReportPrintable', `รายงานซ่อมบำรุง_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('maReport', component);
});

registerView('report-maintenance', async (container) => {
  container.innerHTML = `
  <div x-data="maReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="maReportPrintable" x-show="!loading">
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="card text-center py-3"><div class="text-xs text-gray-500">จำนวนครั้งที่เกิด</div><div class="text-xl font-bold text-red-600" x-text="rows.length"></div></div>
        <div class="card text-center py-3"><div class="text-xs text-gray-500">รวมเวลาหยุด (Downtime)</div><div class="text-xl font-bold text-amber-500" x-text="fmt(totalDowntime()) + ' นาที'"></div></div>
      </div>
      <div class="card">
        ${reportHeaderHtml('รายงานการซ่อมบำรุง', '', '')}
        <h4 class="report-section-title">ตารางรายละเอียดการซ่อมบำรุง</h4>
        <div class="overflow-x-auto">
          <table class="report-table" id="maReportTable">
            <thead><tr><th>ลำดับ</th><th>ชื่อเครื่องจักร</th><th>อาการ</th><th>Downtime (นาที)</th><th>วิธีการซ่อม</th><th>ผู้รับผิดชอบ</th></tr></thead>
            <tbody>
              <template x-for="(r, idx) in rows" :key="idx">
                <tr><td x-text="idx+1"></td><td class="font-semibold" x-text="r.machine"></td><td x-text="r.detail"></td><td x-text="fmt(r.downtime)"></td><td x-text="r.solve"></td><td x-text="r.employee"></td></tr>
              </template>
              <tr class="report-summary-row"><td colspan="3">รวม Downtime</td><td x-text="fmt(totalDowntime())"></td><td colspan="2"></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
});
