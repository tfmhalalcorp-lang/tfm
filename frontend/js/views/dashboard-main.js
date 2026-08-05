import { registerView } from '../router.js';
import { fetchFiltered, fetchBrandMap, fetchAllBatchIds } from '../dashboards/dashboard-data.js';
import { computeMainDashboard } from '../dashboards/aggregations.js';
import { getLocalDate, destroyCharts, alertError } from '../lib/ui-helpers.js';

const CHART_IDS = ['lineYieldRM', 'barRM', 'barCans', 'barCanRM', 'barYield', 'gaugeChart', 'barWHBatch', 'pieBrand'];

function dashboardComponent() {
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
      } catch (e) {
        /* silent, batch dropdown is a convenience only */
      }
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
        const [rm, cans, fillQ, fillW, whIn, brandMap] = await Promise.all([
          fetchFiltered('prod_rm', 'prodrm_date', filters),
          fetchFiltered('prod_can', 'prodcan_date', filters),
          fetchFiltered('prod_fillq', 'prodfillq_date', filters),
          fetchFiltered('prod_fillw', 'prodfillw_date', filters),
          fetchFiltered('wh_in', 'whin_date', filters),
          fetchBrandMap(),
        ]);
        this.data = computeMainDashboard({ rm, cans, fillQ, fillW, whIn, brandMap });
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

      const lineEl = document.getElementById('lineYieldRM');
      if (lineEl) {
        new Chart(lineEl, {
          type: 'line',
          data: { labels: d.charts.labels, datasets: [{ label: 'Yield RM', data: d.charts.yieldRM, borderColor: '#e67e22', backgroundColor: 'rgba(230,126,34,0.15)', fill: true, tension: 0.3 }] },
          options: {
            responsive: true,
            plugins: { tooltip: { callbacks: { label: (ctx) => `Yield RM: ${ctx.parsed.y} kg/กระป๋อง` } } },
            scales: { y: { title: { display: true, text: 'kg/กระป๋อง' } } },
          },
        });
      }

      const smallBar = (id, label, data, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        new Chart(el, {
          type: 'bar',
          data: { labels: d.charts.labels, datasets: [{ label, data, backgroundColor: color }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: true, text: label, font: { size: 11 } } } },
        });
      };
      smallBar('barRM', 'วัตถุดิบที่ใช้ (kg)', d.charts.rm, '#d9534f');
      smallBar('barCans', 'กระป๋องที่ใช้', d.charts.cans, '#f0ad4e');
      smallBar('barCanRM', 'Can / RM', d.charts.canPerRM, '#337ab7');
      smallBar('barYield', '% Yield', d.charts.yield, '#8e44ad');

      const progressPct = d.gauge.prodQ > 0 ? ((d.gauge.receivedQ / d.gauge.prodQ) * 100).toFixed(1) : 0;
      const gaugeLabel = document.getElementById('gaugeCenterLabel');
      if (gaugeLabel) {
        gaugeLabel.innerHTML = `<div class="text-2xl font-bold text-primary">${progressPct}%</div><div class="text-xs text-gray-500">เข้าคลังแล้ว</div><div class="text-xs text-gray-400 mt-1">${Number(d.gauge.receivedQ).toLocaleString()} / ${Number(d.gauge.prodQ).toLocaleString()} กระป๋อง</div>`;
      }
      const gaugeEl = document.getElementById('gaugeChart');
      if (gaugeEl) {
        new Chart(gaugeEl, {
          type: 'doughnut',
          data: {
            labels: ['รับเข้าคลังแล้ว', 'ยังไม่เข้าคลัง'],
            datasets: [{ data: [d.gauge.receivedQ, Math.max(0, d.gauge.prodQ - d.gauge.receivedQ)], backgroundColor: ['#4CAF50', '#e0e0e0'], borderWidth: 0 }],
          },
          options: { responsive: true, rotation: -90, circumference: 180, cutout: '75%', plugins: { legend: { display: false } } },
        });
      }

      const whBatchEl = document.getElementById('barWHBatch');
      if (whBatchEl) {
        new Chart(whBatchEl, {
          type: 'bar',
          data: { labels: d.charts.labels, datasets: [{ label: 'จำนวนรับเข้าคลัง', data: d.charts.whReceived, backgroundColor: 'rgba(76,175,80,0.6)' }] },
          options: { responsive: true, plugins: { legend: { display: false } } },
        });
      }

      const pieBrandEl = document.getElementById('pieBrand');
      if (pieBrandEl) {
        new Chart(pieBrandEl, {
          type: 'pie',
          data: { labels: d.whChart.labels, datasets: [{ data: d.whChart.data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#E7E9ED'] }] },
          options: { responsive: true, plugins: { legend: { position: 'right' } } },
        });
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('mainDashboard', dashboardComponent);
});

registerView('dashboard', async (container) => {
  container.innerHTML = `
  <div x-data="mainDashboard" x-init="init()">
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

    <template x-if="loading">
      <div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
    </template>

    <template x-if="!loading && data">
      <div>
        <h3 class="text-primary font-bold border-b-2 border-gray-100 pb-2 mb-3">ภาพรวมการผลิต (Production)</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-5">
          <div class="card text-center py-3"><div class="text-xs text-gray-500">วัตถุดิบที่ใช้ (kg)</div><div class="text-xl font-bold text-red-600" x-text="Number(data.scorecards.totalRM).toLocaleString()"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">ผลิตได้ (กระป๋อง)</div><div class="text-xl font-bold text-green-600" x-text="Number(data.scorecards.totalProdQ).toLocaleString()"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">กระป๋องที่ใช้</div><div class="text-xl font-bold text-amber-500" x-text="Number(data.scorecards.totalCans).toLocaleString()"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">Avg Fill Weight</div><div class="text-xl font-bold text-sky-500" x-text="Number(data.scorecards.avgFillWeight).toLocaleString(undefined,{maximumFractionDigits:2})"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">Can / RM</div><div class="text-xl font-bold text-blue-700" x-text="Number(data.scorecards.canPerRM).toLocaleString(undefined,{maximumFractionDigits:2})"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">Yield RM Avg.</div><div class="text-xl font-bold text-orange-600" x-text="Number(data.scorecards.yieldRMAvg).toLocaleString(undefined,{maximumFractionDigits:4})"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">% Yield เฉลี่ย</div><div class="text-xl font-bold text-purple-600" x-text="Number(data.scorecards.avgYield).toLocaleString(undefined,{maximumFractionDigits:2}) + '%'"></div></div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          <div class="card"><h4 class="font-semibold text-sm mb-2 text-center">Yield RM ราย Batch</h4><canvas id="lineYieldRM" height="180"></canvas></div>
          <div class="card lg:col-span-2">
            <h4 class="font-semibold text-sm mb-2 text-center">ประสิทธิผลราย Batch</h4>
            <div class="grid grid-cols-2 gap-3">
              <canvas id="barRM" style="max-height:110px;"></canvas>
              <canvas id="barCans" style="max-height:110px;"></canvas>
              <canvas id="barCanRM" style="max-height:110px;"></canvas>
              <canvas id="barYield" style="max-height:110px;"></canvas>
            </div>
          </div>
        </div>

        <h3 class="text-green-700 font-bold border-b-2 border-gray-100 pb-2 mb-3">ภาพรวมคลังสินค้า (Warehouse)</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div class="card text-center py-3"><div class="text-xs text-gray-500">รับเข้าคลังรวม (กระป๋อง)</div><div class="text-xl font-bold text-green-600" x-text="Number(data.warehouseScorecards.totalReceived).toLocaleString()"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">กักรวม (Hold)</div><div class="text-xl font-bold text-red-600" x-text="Number(data.warehouseScorecards.totalHeld).toLocaleString()"></div></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="card relative flex flex-col items-center justify-center">
            <canvas id="gaugeChart" height="160"></canvas>
            <div id="gaugeCenterLabel" class="absolute inset-x-0 bottom-6 text-center pointer-events-none"></div>
          </div>
          <div class="card"><h4 class="font-semibold text-sm mb-2 text-center">จำนวนรับเข้าคลังราย Batch</h4><canvas id="barWHBatch" height="160"></canvas></div>
          <div class="card"><h4 class="font-semibold text-sm mb-2 text-center">สัดส่วนรับเข้าคลังแยกตามแบรนด์</h4><canvas id="pieBrand" height="160"></canvas></div>
        </div>
      </div>
    </template>
  </div>`;
});
