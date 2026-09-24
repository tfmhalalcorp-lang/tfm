import { registerView } from '../router.js';
import { fetchOrderTrackingRows } from '../dashboards/dashboard-data.js';
import { computeOrderTrackingDashboard } from '../dashboards/aggregations.js';
import { getLocalDate, destroyCharts, alertError, formatDate, toLocale } from '../lib/ui-helpers.js';

const CHART_IDS = ['orderPackagingChart', 'orderLeadTimeChart'];

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dashboardComponent() {
  return {
    startDate: daysAgoIso(30),
    endDate: getLocalDate(),
    loading: false,
    data: null,
    fmtDate: formatDate,
    fmt: toLocale,

    async init() {
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
        const raw = await fetchOrderTrackingRows({ startDate: this.startDate, endDate: this.endDate });
        this.data = computeOrderTrackingDashboard(raw);
        this.$nextTick(() => this.renderCharts());
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    currencyEntries(obj) {
      return Object.entries(obj || {});
    },

    renderCharts() {
      if (!this.data || !window.Chart) return;
      destroyCharts(CHART_IDS);
      const d = this.data;

      const packagingEl = document.getElementById('orderPackagingChart');
      if (packagingEl) {
        new Chart(packagingEl, {
          type: 'bar',
          data: {
            labels: d.packagingChart.map((r) => r.doc_no),
            datasets: [
              { label: 'พร้อมแล้ว', data: d.packagingChart.map((r) => r.ready), backgroundColor: '#4CAF50' },
              { label: 'ไม่ใช้รายการนี้', data: d.packagingChart.map((r) => r.notUsed), backgroundColor: '#bdbdbd' },
              { label: 'ยังไม่ระบุ', data: d.packagingChart.map((r) => r.pending), backgroundColor: '#e57373' },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true, max: 4, ticks: { stepSize: 1 } }, y: { stacked: true } },
            plugins: { legend: { position: 'bottom' } },
          },
        });
      }

      const leadTimeEl = document.getElementById('orderLeadTimeChart');
      if (leadTimeEl) {
        new Chart(leadTimeEl, {
          type: 'bar',
          data: {
            labels: d.leadTimeChart.map((r) => r.doc_no),
            datasets: [
              {
                label: 'Lead time (วัน)',
                data: d.leadTimeChart.map((r) => r.days),
                backgroundColor: d.leadTimeChart.map((r) => (r.completed ? '#4CAF50' : '#f0ad4e')),
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => `${ctx.raw} วัน (${d.leadTimeChart[ctx.dataIndex].completed ? 'เสร็จแล้ว' : 'กำลังดำเนินการ'})` } },
            },
            scales: { x: { title: { display: true, text: 'วัน' } } },
          },
        });
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('orderTrackingDashboard', dashboardComponent);
});

registerView('dashboard-order-tracking', async (container) => {
  container.innerHTML = `
  <div x-data="orderTrackingDashboard" x-init="init()">
    <div class="card mb-4">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
        <button class="btn btn-secondary" @click="setToday()"><i class="fa-solid fa-calendar-day"></i> วันนี้</button>
      </div>
    </div>

    <template x-if="loading">
      <div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>
    </template>

    <template x-if="!loading && data">
      <div>
        <h3 class="text-primary font-bold border-b-2 border-gray-100 pb-2 mb-3">ภาพรวมคำสั่งซื้อ</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <div class="card text-center py-3"><div class="text-xs text-gray-500">คำสั่งซื้อทั้งหมด</div><div class="text-xl font-bold text-gray-800" x-text="data.scorecards.totalOrders"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">วางแผนแล้ว</div><div class="text-xl font-bold text-sky-600" x-text="data.scorecards.withPlan"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">จัดเตรียม Packaging แล้ว</div><div class="text-xl font-bold text-teal-600" x-text="data.scorecards.withPackaging"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">Confirm Booking แล้ว</div><div class="text-xl font-bold text-green-600" x-text="data.scorecards.withBookingConfirmed"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">มี DO แล้ว</div><div class="text-xl font-bold text-purple-600" x-text="data.scorecards.withDO"></div></div>
          <div class="card text-center py-3"><div class="text-xs text-gray-500">มี Invoice แล้ว</div><div class="text-xl font-bold text-amber-600" x-text="data.scorecards.withInvoice"></div></div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div class="card py-3">
            <div class="text-xs text-gray-500 mb-1">มูลค่าการสั่งซื้อรวม</div>
            <template x-for="[cur, v] in currencyEntries(data.scorecards.valueByCurrency)" :key="cur">
              <div class="text-lg font-bold text-gray-800"><span x-text="fmt(v)"></span> <span class="text-xs font-normal text-gray-400" x-text="cur"></span></div>
            </template>
          </div>
          <div class="card py-3">
            <div class="text-xs text-gray-500 mb-1">มูลค่าเฉลี่ยต่อคำสั่งซื้อ</div>
            <template x-for="[cur, v] in currencyEntries(data.scorecards.avgValueByCurrency)" :key="cur">
              <div class="text-lg font-bold text-gray-800"><span x-text="fmt(v)"></span> <span class="text-xs font-normal text-gray-400" x-text="cur"></span></div>
            </template>
          </div>
          <div class="card py-3">
            <div class="text-xs text-gray-500 mb-1">มูลค่าที่ยังไม่จัดส่ง (ยังไม่มี DO)</div>
            <template x-for="[cur, v] in currencyEntries(data.scorecards.notShippedValueByCurrency)" :key="cur">
              <div class="text-lg font-bold text-red-600"><span x-text="fmt(v)"></span> <span class="text-xs font-normal text-gray-400" x-text="cur"></span></div>
            </template>
            <div class="text-sm text-gray-400" x-show="Object.keys(data.scorecards.notShippedValueByCurrency).length === 0">-</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
          <div class="card">
            <h4 class="font-semibold text-sm mb-2 text-center">ความพร้อมของ Packaging แยกตามคำสั่งซื้อ</h4>
            <div :style="'height:' + Math.max(220, data.packagingChart.length * 28) + 'px'"><canvas id="orderPackagingChart"></canvas></div>
          </div>
          <div class="card">
            <h4 class="font-semibold text-sm mb-2 text-center">
              Lead Time แต่ละคำสั่งซื้อ
              <span class="text-xs font-normal text-gray-400">
                (เฉลี่ย <span x-text="fmt(data.leadTimeStats.avg)"></span> วัน, ต่ำสุด <span x-text="data.leadTimeStats.min"></span>, สูงสุด <span x-text="data.leadTimeStats.max"></span> — เฉพาะที่เสร็จแล้ว)
              </span>
            </h4>
            <div :style="'height:' + Math.max(220, data.leadTimeChart.length * 28) + 'px'"><canvas id="orderLeadTimeChart"></canvas></div>
          </div>
        </div>

        <h3 class="text-primary font-bold border-b-2 border-gray-100 pb-2 mb-3">สรุป Booking / DO / ตู้คอนเทนเนอร์ รายคำสั่งซื้อ</h3>
        <div class="card mb-5">
          <div class="overflow-x-auto -mx-1">
            <table class="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr class="bg-gray-50 text-gray-600 text-left">
                  <th class="px-3 py-2">SO/PI</th>
                  <th class="px-3 py-2">สถานะ Booking</th>
                  <th class="px-3 py-2">Loading / ETD</th>
                  <th class="px-3 py-2">DO - ตู้คอนเทนเนอร์</th>
                  <th class="px-3 py-2 text-right">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                <template x-if="data.crosstab.length === 0">
                  <tr><td colspan="5" class="text-center py-8 text-gray-400">ไม่มีรายการในช่วงวันที่ที่เลือก</td></tr>
                </template>
                <template x-for="row in data.crosstab" :key="row.doc_no">
                  <tr class="border-b border-gray-100">
                    <td class="px-3 py-2 font-semibold whitespace-nowrap" x-text="row.doc_no"></td>
                    <td class="px-3 py-2"><span class="badge" :class="row.bookingCls" x-text="row.bookingLabel"></span></td>
                    <td class="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                      <span x-text="row.loadingDate ? fmtDate(row.loadingDate) : '-'"></span> /
                      <span x-text="row.etdOnBoard ? fmtDate(row.etdOnBoard) : '-'"></span>
                    </td>
                    <td class="px-3 py-2" x-text="row.doAndContainers"></td>
                    <td class="px-3 py-2 text-right" x-text="fmt(row.qty)"></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <h3 class="text-primary font-bold border-b-2 border-gray-100 pb-2 mb-3">รายการคำสั่งซื้อ</h3>
        <div class="card">
          <div class="overflow-x-auto -mx-1">
            <table class="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr class="bg-gray-50 text-gray-600 text-left">
                  <th class="px-3 py-2">เลขที่</th>
                  <th class="px-3 py-2">วันที่</th>
                  <th class="px-3 py-2">ลูกค้า</th>
                  <th class="px-3 py-2">ปลายทาง</th>
                  <th class="px-3 py-2 text-right">มูลค่า</th>
                  <th class="px-3 py-2 text-right">จำนวนวัน</th>
                  <th class="px-3 py-2 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                <template x-if="data.orderTable.length === 0">
                  <tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่มีรายการในช่วงวันที่ที่เลือก</td></tr>
                </template>
                <template x-for="row in data.orderTable" :key="row.doc_no">
                  <tr class="border-b border-gray-100" :class="row.overdue ? 'bg-amber-50' : ''">
                    <td class="px-3 py-2 font-semibold whitespace-nowrap" x-text="row.doc_no"></td>
                    <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(row.doc_date)"></td>
                    <td class="px-3 py-2" x-text="row.customer_name"></td>
                    <td class="px-3 py-2" x-text="row.destination"></td>
                    <td class="px-3 py-2 text-right whitespace-nowrap"><span x-text="fmt(row.netTotal)"></span> <span class="text-xs text-gray-400" x-text="row.currency"></span></td>
                    <td class="px-3 py-2 text-right" x-text="row.daysOpen"></td>
                    <td class="px-3 py-2 text-center">
                      <span class="badge bg-amber-100 text-amber-700" x-show="row.overdue" title="ยังไม่จัดส่ง ยังไม่ Confirm Booking และเกิน 7 วันนับจากวันที่สั่งซื้อ">
                        <i class="fa-solid fa-triangle-exclamation"></i> เกินกำหนด
                      </span>
                      <span class="badge bg-gray-100 text-gray-500" x-show="!row.overdue && row.hasIssue">ข้อมูลไม่ครบ</span>
                      <span class="badge bg-green-100 text-green-700" x-show="!row.overdue && !row.hasIssue">ปกติ</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>`;
});
