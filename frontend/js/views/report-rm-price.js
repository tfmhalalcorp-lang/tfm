// รายงานวิเคราะห์ราคา RM (RM Price Analysis) — admin-only (see role-access.js:
// the 'report-rm-price' item carries its own `roles: ['admin']`, narrower
// than the "รายงาน" group it lives in). Line chart of RM price per batch
// (one point per RM record, not averaged by date) split by brand, plus a
// cross-tab-style table grouped by brand (brand name shown once per group
// via rowspan, not repeated on every row) — both scoped to whichever
// brands are checked in the brand filter.
import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchFiltered } from '../dashboards/dashboard-data.js';
import { alertError, destroyCharts } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { reportHeaderHtml, exportButtonsHtml, formatDate, toLocale } from '../reports/report-helpers.js';

const CHART_ID = 'rmPriceChart';
const BRAND_COLORS = ['#e67e22', '#337ab7', '#8e44ad', '#d9534f', '#2e8b57', '#c2185b', '#607d8b', '#f0ad4e'];

function ninetyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function sortRows(rows) {
  return [...rows].sort(
    (a, b) => a.brand.localeCompare(b.brand) || a.date.localeCompare(b.date) || a.batch_id.localeCompare(b.batch_id)
  );
}

function component() {
  return {
    startDate: ninetyDaysAgo(),
    endDate: today(),
    loading: false,
    allRows: [],
    allBrands: [],
    selectedBrands: [],

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const [rm, { data: batches }] = await Promise.all([
          fetchFiltered('prod_rm', 'prodrm_date', filters, 'prodrm_date, batch_id, rm_price'),
          supabase.from('prod_batches').select('batch_id, brands(brand_name)'),
        ]);

        const brandByBatch = {};
        (batches || []).forEach((b) => (brandByBatch[b.batch_id] = b.brands?.brand_name || 'ไม่ระบุแบรนด์'));

        this.allRows = (rm || [])
          .filter((r) => r.rm_price != null)
          .map((r) => ({
            date: r.prodrm_date,
            batch_id: r.batch_id,
            brand: brandByBatch[r.batch_id] || 'ไม่ระบุแบรนด์',
            rm_price: Number(r.rm_price),
          }));

        this.allBrands = [...new Set(this.allRows.map((r) => r.brand))].sort();
        this.selectedBrands = [...this.allBrands];

        this.$nextTick(() => this.renderChart());
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    get filteredRows() {
      return this.allRows.filter((r) => this.selectedBrands.includes(r.brand));
    },

    /** Flat rows grouped/sorted by brand, with a rowspan count on each
     *  group's first row so the template renders the brand cell once per
     *  group instead of repeating it on every row (cross-tab style) —
     *  followed by one Min/Max/Avg summary row per brand group. */
    get pivotRows() {
      const sorted = sortRows(this.filteredRows);
      const groupSize = {};
      sorted.forEach((r) => (groupSize[r.brand] = (groupSize[r.brand] || 0) + 1));
      const seen = new Set();
      const out = [];
      let currentBrand = null;
      let currentPrices = [];
      const flushSummary = () => {
        if (currentBrand === null) return;
        out.push({
          type: 'summary',
          brand: currentBrand,
          min: Math.min(...currentPrices),
          max: Math.max(...currentPrices),
          avg: currentPrices.reduce((s, v) => s + v, 0) / currentPrices.length,
        });
      };
      sorted.forEach((r) => {
        if (r.brand !== currentBrand) {
          flushSummary();
          currentBrand = r.brand;
          currentPrices = [];
        }
        currentPrices.push(r.rm_price);
        const isFirstOfGroup = !seen.has(r.brand);
        seen.add(r.brand);
        out.push({ type: 'data', ...r, showBrand: isFirstOfGroup, brandRowspan: isFirstOfGroup ? groupSize[r.brand] : 0 });
      });
      flushSummary();
      return out;
    },

    fmt(n) {
      return toLocale(n);
    },
    fmtDate(d) {
      return formatDate(d);
    },

    toggleBrand(brand) {
      const i = this.selectedBrands.indexOf(brand);
      if (i === -1) this.selectedBrands.push(brand);
      else this.selectedBrands.splice(i, 1);
      this.renderChart();
    },

    renderChart() {
      destroyCharts([CHART_ID]);
      const el = document.getElementById(CHART_ID);
      if (!el || !window.Chart) return;

      const rows = sortRows(this.filteredRows);
      const labels = rows.map((r) => `${r.batch_id} (${this.fmtDate(r.date)})`);
      const brands = [...new Set(rows.map((r) => r.brand))].sort();

      const datasets = brands.map((brand, i) => {
        const data = rows.map((r) => (r.brand === brand ? r.rm_price : null));
        const color = BRAND_COLORS[i % BRAND_COLORS.length];
        return { label: brand, data, borderColor: color, backgroundColor: color, spanGaps: true, tension: 0.3 };
      });

      new Chart(el, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            y: { title: { display: true, text: 'บาท/กก.' } },
            x: { title: { display: true, text: 'Batch (วันที่)' }, ticks: { autoSkip: true, maxRotation: 60, minRotation: 60 } },
          },
        },
      });
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'rmPriceTable', sheetName: 'RM Price' }], `วิเคราะห์ราคาRM_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('rmPricePrintable', `วิเคราะห์ราคาRM_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('rmPriceReport', component);
});

registerView('report-rm-price', async (container) => {
  container.innerHTML = `
  <div x-data="rmPriceReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end mb-3">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
      <div>
        <label class="form-label">แบรนด์ (เลือกได้มากกว่า 1)</label>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <template x-for="brand in allBrands" :key="brand">
            <label class="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
              <input type="checkbox" :checked="selectedBrands.includes(brand)" @change="toggleBrand(brand)">
              <span x-text="brand"></span>
            </label>
          </template>
          <span class="text-gray-400 text-sm" x-show="allBrands.length === 0">ไม่พบแบรนด์ในช่วงวันที่ที่เลือก</span>
        </div>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div class="card mb-4 no-print" x-show="!loading">
      <h4 class="font-semibold text-sm mb-2 text-center">ความสัมพันธ์ราคา RM กับ Batch/วันที่ แยกตามแบรนด์</h4>
      <template x-if="filteredRows.length === 0"><p class="text-center text-gray-400 py-8">ไม่พบข้อมูลราคา RM ในช่วงวันที่/แบรนด์ที่เลือก</p></template>
      <div class="overflow-x-auto" x-show="filteredRows.length > 0">
        <canvas id="${CHART_ID}" height="100"></canvas>
      </div>
    </div>

    <div id="rmPricePrintable" class="card" x-show="!loading">
      ${reportHeaderHtml('วิเคราะห์ราคา RM', '', '')}
      <div class="overflow-x-auto">
        <table class="report-table" id="rmPriceTable">
          <thead><tr><th>แบรนด์</th><th>วันที่</th><th>Batch</th><th>ราคา RM (บาท/กก.)</th></tr></thead>
          <tbody>
            <template x-if="pivotRows.length === 0"><tr><td colspan="4" class="text-gray-400">ไม่พบข้อมูล</td></tr></template>
            <template x-for="(r, idx) in pivotRows" :key="idx">
              <tr :class="r.type === 'summary' ? 'report-summary-row' : ''">
                <template x-if="r.type === 'data' && r.showBrand"><td :rowspan="r.brandRowspan" class="font-semibold align-middle" x-text="r.brand"></td></template>
                <template x-if="r.type === 'data'"><td x-text="fmtDate(r.date)"></td></template>
                <template x-if="r.type === 'data'"><td class="font-semibold" x-text="r.batch_id"></td></template>
                <template x-if="r.type === 'data'"><td x-text="fmt(r.rm_price)"></td></template>
                <template x-if="r.type === 'summary'"><td colspan="3" x-text="'สรุป ' + r.brand + ' — Min / Max / Avg'"></td></template>
                <template x-if="r.type === 'summary'"><td x-text="fmt(r.min) + ' / ' + fmt(r.max) + ' / ' + fmt(r.avg)"></td></template>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
});
