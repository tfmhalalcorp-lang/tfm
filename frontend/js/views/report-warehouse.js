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
    brandSummaries: [],

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const whIn = await fetchFiltered('wh_in', 'whin_date', filters, '*, brands(brand_name)');
        this.rows = whIn
          .map((r) => ({
            date: r.whin_date,
            brand: r.brands?.brand_name || r.brand_id || '-',
            batch_id: r.batch_id,
            good: Number(r.can_sum || 0),
            hold: Number(r.can_hold || 0),
          }))
          .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

        const byBrand = {};
        this.rows.forEach((r) => {
          if (!byBrand[r.brand]) byBrand[r.brand] = { brand: r.brand, good: 0, hold: 0 };
          byBrand[r.brand].good += r.good;
          byBrand[r.brand].hold += r.hold;
        });
        this.brandSummaries = Object.values(byBrand).sort((a, b) => a.brand.localeCompare(b.brand));
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
    grandTotal() {
      return this.rows.reduce((acc, r) => ({ good: acc.good + r.good, hold: acc.hold + r.hold }), { good: 0, hold: 0 });
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'whReportTable', sheetName: 'รับเข้าคลัง' }], `รายงานคลัง_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('warehouseReportPrintable', `รายงานคลัง_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('warehouseReport', component);
});

registerView('report-warehouse', async (container) => {
  container.innerHTML = `
  <div x-data="warehouseReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="warehouseReportPrintable" class="card" x-show="!loading">
      ${reportHeaderHtml('รายงานรับเข้าคลังสินค้า', '', '')}
      <h4 class="report-section-title">ตารางรับเข้าคลังสินค้า</h4>
      <div class="overflow-x-auto">
        <table class="report-table" id="whReportTable">
          <thead><tr><th>ลำดับ</th><th>วันที่เข้าคลัง</th><th>BRAND</th><th>BATCH</th><th>กระป๋อง(ดี)</th><th>กระป๋อง(กัก)</th></tr></thead>
          <tbody>
            <template x-for="(r, idx) in rows" :key="idx">
              <tr><td x-text="idx+1"></td><td x-text="fmtDate(r.date)"></td><td x-text="r.brand"></td><td class="font-semibold" x-text="r.batch_id"></td><td x-text="fmt(r.good)"></td><td x-text="fmt(r.hold)"></td></tr>
            </template>
            <template x-for="s in brandSummaries" :key="s.brand">
              <tr class="bg-gray-50 font-semibold"><td colspan="2"></td><td x-text="'รวม '+s.brand"></td><td></td><td x-text="fmt(s.good)"></td><td x-text="fmt(s.hold)"></td></tr>
            </template>
            <tr class="report-summary-row" style="border-top:3px solid #333;"><td colspan="4">รวมทั้งหมด</td><td x-text="fmt(grandTotal().good)"></td><td x-text="fmt(grandTotal().hold)"></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
});
