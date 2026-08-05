import { registerView } from '../router.js';
import { fetchFiltered, fetchAllBatchIds } from '../dashboards/dashboard-data.js';
import { computeWasteDashboard } from '../dashboards/aggregations.js';
import { getLocalDate, destroyCharts, alertError, toLocale } from '../lib/ui-helpers.js';

const CHART_IDS = ['chartWasteByType'];

function component() {
  return {
    startDate: getLocalDate(),
    endDate: getLocalDate(),
    batchFilter: '',
    batchOptions: [],
    loading: false,
    data: null,

    async init() {
      try {
        this.batchOptions = await fetchAllBatchIds();
      } catch (e) {}
      await this.search();
    },

    setToday() {
      this.startDate = getLocalDate();
      this.endDate = getLocalDate();
      this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate, batchFilter: this.batchFilter };
        const [waste, fillQ, cans] = await Promise.all([
          fetchFiltered('qc_waste', 'qcwaste_date', filters),
          fetchFiltered('prod_fillq', 'prodfillq_date', filters),
          fetchFiltered('prod_can', 'prodcan_date', filters),
        ]);
        this.data = computeWasteDashboard({ waste, fillQ, cans });
        this.$nextTick(() => this.renderChart());
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    renderChart() {
      if (!this.data || !window.Chart) return;
      destroyCharts(CHART_IDS);
      const el = document.getElementById('chartWasteByType');
      if (!el) return;
      new Chart(el, {
        type: 'bar',
        data: { labels: this.data.chartByType.labels, datasets: this.data.chartByType.datasets },
        options: {
          responsive: true,
          plugins: { title: { display: false } },
          scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'จำนวน (กระป๋อง)' } } },
        },
      });
    },

    fmt(n) {
      return toLocale(n);
    },

    ratioClass(ratio) {
      if (ratio > 5) return 'text-red-600 font-semibold';
      if (ratio > 2) return 'text-amber-600 font-semibold';
      return 'text-green-600 font-semibold';
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('wasteDashboard', component);
});

registerView('dashboard-waste', async (container) => {
  container.innerHTML = `
  <div x-data="wasteDashboard" x-init="init()">
    <div class="card mb-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <div>
          <label class="form-label">Batch</label>
          <select x-model="batchFilter" class="form-control w-[180px]" data-no-tom>
            <option value="">-- ทั้งหมด --</option>
            <template x-for="b in batchOptions" :key="b"><option :value="b" x-text="b"></option></template>
          </select>
        </div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
        <button class="btn btn-secondary" @click="setToday()"><i class="fa-solid fa-calendar-day"></i> วันนี้</button>
      </div>
    </div>

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <template x-if="!loading && data">
      <div>
        <div class="grid grid-cols-3 gap-3 mb-5">
          <div class="card text-center py-3"><div class="text-xs text-gray-500">ของเสียจากผลิต (PD)</div><div class="text-xl font-bold text-red-600" x-text="fmt(data.deptTotals.PD)"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">ของเสียจากคลัง (WH)</div><div class="text-xl font-bold text-amber-500" x-text="fmt(data.deptTotals.WH)"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">ของเสียจาก QC</div><div class="text-xl font-bold text-sky-500" x-text="fmt(data.deptTotals.QC)"></div></div>
        </div>

        <div class="card mb-5">
          <h4 class="font-semibold text-sm mb-2">สัดส่วนของเสียแยกตามประเภท</h4>
          <canvas id="chartWasteByType" height="90"></canvas>
        </div>

        <div class="card mb-5 overflow-x-auto">
          <h4 class="font-semibold text-sm mb-2">สรุปของเสียแยกตามแผนก</h4>
          <table class="report-table">
            <thead><tr><th>แผนก</th><template x-for="f in data.wasteFields" :key="f"><th x-text="data.wasteLabels[f]"></th></template><th>รวม</th></tr></thead>
            <tbody>
              <template x-for="dept in ['PD','WH','QC']" :key="dept">
                <tr>
                  <td class="font-semibold" x-text="dept"></td>
                  <template x-for="f in data.wasteFields" :key="f"><td x-text="fmt(data.deptSummary[dept][f])"></td></template>
                  <td class="font-semibold" x-text="fmt(data.deptTotals[dept])"></td>
                </tr>
              </template>
              <tr class="report-summary-row">
                <td>รวมทั้งหมด</td>
                <template x-for="f in data.wasteFields" :key="f"><td x-text="fmt(data.totalSummary[f])"></td></template>
                <td x-text="fmt(data.grandTotal)"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card overflow-x-auto">
          <h4 class="font-semibold text-sm mb-2">สรุปของเสียแยกตาม Batch</h4>
          <table class="report-table">
            <thead><tr><th>Batch</th><template x-for="f in data.wasteFields" :key="f"><th x-text="data.wasteLabels[f]"></th></template><th>รวมของเสีย</th><th>ยอดผลิต</th><th>% สัดส่วน</th></tr></thead>
            <tbody>
              <template x-for="row in data.batchRows" :key="row.batch_id">
                <tr>
                  <td class="font-semibold" x-text="row.batch_id"></td>
                  <template x-for="f in data.wasteFields" :key="f"><td x-text="fmt(row.waste[f])"></td></template>
                  <td x-text="fmt(row.total)"></td>
                  <td x-text="fmt(row.prodQ)"></td>
                  <td :class="ratioClass(row.ratio)" x-text="row.ratio.toFixed(2) + '%'"></td>
                </tr>
              </template>
              <tr x-show="data.batchRows.length === 0"><td :colspan="data.wasteFields.length + 4" class="text-gray-400 py-4">ไม่พบข้อมูล</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>`;
});
