import { registerView } from '../router.js';
import { fetchFiltered, fetchSupplierMap, fetchAllBatchIds } from '../dashboards/dashboard-data.js';
import { computeRMDashboard } from '../dashboards/aggregations.js';
import { getLocalDate, destroyCharts, alertError, toLocale } from '../lib/ui-helpers.js';

const CHART_IDS = ['pieRMWeight', 'pieRMBatch', 'lineRMSupplier'];
const PIE_COLORS = ['#d9534f', '#5cb85c', '#337ab7', '#f0ad4e', '#5bc0de', '#8e44ad', '#e67e22', '#1abc9c', '#e74c3c', '#2c3e50', '#f39c12', '#27ae60', '#3498db', '#9b59b6', '#16a085'];

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
        const [rm, fillQ, cans, fillW, supplierMap] = await Promise.all([
          fetchFiltered('prod_rm', 'prodrm_date', filters),
          fetchFiltered('prod_fillq', 'prodfillq_date', filters),
          fetchFiltered('prod_can', 'prodcan_date', filters),
          fetchFiltered('prod_fillw', 'prodfillw_date', filters),
          fetchSupplierMap(),
        ]);
        this.data = computeRMDashboard({ rm, fillQ, cans, fillW, supplierMap });
        this.$nextTick(() => this.renderCharts());
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    renderCharts() {
      if (!this.data || !window.Chart) return;
      destroyCharts(CHART_IDS);
      const d = this.data;

      const pieWeightEl = document.getElementById('pieRMWeight');
      if (pieWeightEl) {
        new Chart(pieWeightEl, {
          type: 'pie',
          data: { labels: d.pieWeight.labels, datasets: [{ data: d.pieWeight.data, backgroundColor: PIE_COLORS }] },
          options: { responsive: true, plugins: { legend: { position: 'right' } } },
        });
      }
      const pieBatchEl = document.getElementById('pieRMBatch');
      if (pieBatchEl) {
        new Chart(pieBatchEl, {
          type: 'pie',
          data: { labels: d.pieBatch.labels, datasets: [{ data: d.pieBatch.data, backgroundColor: PIE_COLORS }] },
          options: { responsive: true, plugins: { legend: { position: 'right' } } },
        });
      }
      const lineEl = document.getElementById('lineRMSupplier');
      if (lineEl) {
        new Chart(lineEl, {
          type: 'line',
          data: { labels: d.lineChart.labels, datasets: d.lineChart.datasets },
          options: { responsive: true, scales: { y: { title: { display: true, text: 'น้ำหนัก (kg)' } } } },
        });
      }
    },

    fmt(n) {
      return toLocale(n);
    },
    yieldClass(pct) {
      if (pct > 50) return 'text-green-600 font-semibold';
      if (pct > 30) return 'text-amber-600 font-semibold';
      return 'text-red-600 font-semibold';
    },
    crosstabTotals() {
      if (!this.data) return { perSupplier: {}, rm: 0, prodQ: 0 };
      const perSupplier = {};
      this.data.crosstab.suppliers.forEach((s) => {
        perSupplier[s] = this.data.crosstab.rows.reduce((sum, r) => sum + (r.supplierWeights[s] || 0), 0);
      });
      const rm = this.data.crosstab.rows.reduce((s, r) => s + r.totalRM, 0);
      const prodQ = this.data.crosstab.rows.reduce((s, r) => s + r.prodQ, 0);
      return { perSupplier, rm, prodQ };
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('rmDashboard', component);
});

registerView('dashboard-rm', async (container) => {
  container.innerHTML = `
  <div x-data="rmDashboard" x-init="init()">
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
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div class="card text-center py-3 border-t-4 border-red-500"><div class="text-xs text-gray-500">RM ใช้รวม (kg)</div><div class="text-xl font-bold text-red-600" x-text="fmt(data.scorecards.totalWeight)"></div></div>
          <div class="card text-center py-3 border-t-4 border-sky-500"><div class="text-xs text-gray-500">จำนวน Supplier</div><div class="text-xl font-bold text-sky-600" x-text="data.scorecards.supplierCount"></div></div>
          <div class="card text-center py-3 border-t-4 border-amber-500"><div class="text-xs text-gray-500">จำนวนบิล</div><div class="text-xl font-bold text-amber-600" x-text="data.scorecards.billCount"></div></div>
          <div class="card text-center py-3 border-t-4 border-purple-500">
            <div class="text-xs text-gray-500">% เศษเหลือ / ใช้ทั้งหมด</div>
            <div class="text-xl font-bold text-purple-600" x-text="data.scorecards.balancePct.toFixed(2) + '%'"></div>
            <div class="text-[11px] text-gray-400">เศษเหลือ <span x-text="fmt(data.scorecards.totalBalance)"></span> kg</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div class="card"><h4 class="font-semibold text-sm mb-2 text-center">สัดส่วนน้ำหนัก RM แยกตาม Supplier</h4><canvas id="pieRMWeight" height="200"></canvas></div>
          <div class="card"><h4 class="font-semibold text-sm mb-2 text-center">สัดส่วนจำนวน Batch แยกตาม Supplier</h4><canvas id="pieRMBatch" height="200"></canvas></div>
        </div>
        <div class="card mb-5">
          <h4 class="font-semibold text-sm mb-2 text-center">การใช้วัตถุดิบแยกตาม Supplier ตามช่วงเวลา</h4>
          <canvas id="lineRMSupplier" height="90"></canvas>
        </div>

        <div class="card overflow-x-auto">
          <h4 class="font-semibold text-sm mb-2">Crosstab: Batch &times; Supplier</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Batch</th>
                <template x-for="s in data.crosstab.suppliers" :key="s"><th x-text="s"></th></template>
                <th>รวม RM (kg)</th><th>ยอดผลิต</th><th>% Yield</th>
              </tr>
            </thead>
            <tbody>
              <template x-for="row in data.crosstab.rows" :key="row.batch_id">
                <tr>
                  <td class="font-semibold" x-text="row.batch_id"></td>
                  <template x-for="s in data.crosstab.suppliers" :key="s"><td x-text="fmt(row.supplierWeights[s])"></td></template>
                  <td x-text="fmt(row.totalRM)"></td>
                  <td x-text="fmt(row.prodQ)"></td>
                  <td :class="yieldClass(row.yieldPct)" x-text="row.yieldPct.toFixed(2) + '%'"></td>
                </tr>
              </template>
              <tr x-show="data.crosstab.rows.length === 0"><td :colspan="data.crosstab.suppliers.length + 4" class="text-gray-400 py-4">ไม่พบข้อมูล</td></tr>
              <template x-if="data.crosstab.rows.length > 0">
                <tr class="report-summary-row">
                  <td>รวม</td>
                  <template x-for="s in data.crosstab.suppliers" :key="s"><td x-text="fmt(crosstabTotals().perSupplier[s])"></td></template>
                  <td x-text="fmt(crosstabTotals().rm)"></td>
                  <td x-text="fmt(crosstabTotals().prodQ)"></td>
                  <td></td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>`;
});
