import { registerView } from '../router.js';
import { fetchFiltered } from '../dashboards/dashboard-data.js';
import { WASTE_FIELDS_9, WASTE_LABELS_9 } from '../dashboards/aggregations.js';
import { getLocalDate, alertError, toLocale, formatDate } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { reportHeaderHtml, exportButtonsHtml } from '../reports/report-helpers.js';

function component() {
  return {
    startDate: getLocalDate(),
    endDate: getLocalDate(),
    loading: false,
    rows: [],
    fields: WASTE_FIELDS_9,
    labels: WASTE_LABELS_9,

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const waste = await fetchFiltered('qc_waste', 'qcwaste_date', filters);
        this.rows = waste
          .map((r) => {
            const row = { date: r.qcwaste_date, batch_id: r.batch_id };
            let total = 0;
            WASTE_FIELDS_9.forEach((f) => {
              row[f] = Number(r[f] || 0);
              total += row[f];
            });
            row.total = total;
            return row;
          })
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
    colTotal(f) {
      return this.rows.reduce((s, r) => s + r[f], 0);
    },
    grandTotal() {
      return this.rows.reduce((s, r) => s + r.total, 0);
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'qcReportTable', sheetName: 'ข้อเสีย' }], `รายงานQC_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('qcReportPrintable', `รายงานQC_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('qcReport', component);
});

registerView('report-qc', async (container) => {
  container.innerHTML = `
  <div x-data="qcReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="qcReportPrintable" class="card" x-show="!loading">
      ${reportHeaderHtml('รายงานตรวจสอบคุณภาพ', '', '')}
      <div class="overflow-x-auto">
        <table class="report-table" id="qcReportTable">
          <thead><tr><th>ลำดับ</th><th>วันที่</th><th>BATCH</th><template x-for="f in fields" :key="f"><th x-text="labels[f]"></th></template><th>รวม</th></tr></thead>
          <tbody>
            <template x-for="(r, idx) in rows" :key="idx">
              <tr>
                <td x-text="idx+1"></td><td x-text="fmtDate(r.date)"></td><td class="font-semibold" x-text="r.batch_id"></td>
                <template x-for="f in fields" :key="f"><td x-text="fmt(r[f])"></td></template>
                <td class="font-semibold" x-text="fmt(r.total)"></td>
              </tr>
            </template>
            <tr class="report-summary-row">
              <td colspan="3">รวมทั้งหมด</td>
              <template x-for="f in fields" :key="f"><td x-text="fmt(colTotal(f))"></td></template>
              <td x-text="fmt(grandTotal())"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
});
