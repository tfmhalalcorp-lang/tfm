import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchFiltered } from '../dashboards/dashboard-data.js';
import { getLocalDate, alertError, toLocale, formatDate } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { reportHeaderHtml, exportButtonsHtml } from '../reports/report-helpers.js';

function component() {
  return {
    startDate: getLocalDate(),
    endDate: getLocalDate(),
    batchText: '',
    loading: false,
    allRows: [],

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const [fillW, batches, rm, { data: suppliers }] = await Promise.all([
          fetchFiltered('prod_fillw', 'prodfillw_date', filters),
          supabase.from('prod_batches').select('batch_id, brands(brand_name)'),
          supabase.from('prod_rm').select('batch_id, fish_type, supplier_id'),
          supabase.from('suppliers').select('id, fish_type'),
        ]);

        const brandByBatch = {};
        (batches || []).forEach((b) => (brandByBatch[b.batch_id] = b.brands?.brand_name || '-'));

        const supplierFishMap = {};
        (suppliers || []).forEach((s) => (supplierFishMap[s.id] = s.fish_type));

        const fishByBatch = {};
        (rm || []).forEach((r) => {
          if (fishByBatch[r.batch_id]) return;
          fishByBatch[r.batch_id] = r.fish_type || supplierFishMap[r.supplier_id] || '-';
        });

        this.allRows = fillW.map((r) => ({
          date: r.prodfillw_date,
          batch_id: r.batch_id,
          brand: brandByBatch[r.batch_id] || '-',
          fish: fishByBatch[r.batch_id] || '-',
          weight: Number(r.weight || 0),
        }));
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    get rows() {
      const q = this.batchText.trim().toLowerCase();
      if (!q) return this.allRows;
      return this.allRows.filter((r) => r.batch_id.toLowerCase().includes(q));
    },

    fmt(n) {
      return toLocale(n);
    },
    fmtDate(d) {
      return formatDate(d);
    },
    total() {
      return this.rows.reduce((s, r) => s + r.weight, 0);
    },
    average() {
      return this.rows.length ? this.total() / this.rows.length : 0;
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'fwReportTable', sheetName: 'Fill Weight' }], `รายงานFillWeight_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('fwReportPrintable', `รายงานFillWeight_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('fwReport', component);
});

registerView('report-fillweight', async (container) => {
  container.innerHTML = `
  <div x-data="fwReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">Batch</label><input type="text" x-model="batchText" placeholder="ค้นหา Batch..." data-no-flatpickr class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="fwReportPrintable" class="card" x-show="!loading">
      ${reportHeaderHtml('รายงาน Fill Weight', '', '')}
      <div class="overflow-x-auto">
        <table class="report-table" id="fwReportTable">
          <thead><tr><th>ลำดับ</th><th>วันที่</th><th>Batch</th><th>Brand</th><th>Fish Type</th><th>Fill Weight (กรัม)</th></tr></thead>
          <tbody>
            <template x-for="(r, idx) in rows" :key="idx">
              <tr><td x-text="idx+1"></td><td x-text="fmtDate(r.date)"></td><td class="font-semibold" x-text="r.batch_id"></td><td x-text="r.brand"></td><td x-text="r.fish"></td><td x-text="fmt(r.weight)"></td></tr>
            </template>
            <tr class="report-summary-row"><td colspan="5">รวม (Total)</td><td x-text="fmt(total())"></td></tr>
            <tr class="report-summary-row"><td colspan="5">เฉลี่ย (Avg)</td><td x-text="average().toFixed(2)"></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
});
