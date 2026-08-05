import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { fetchFiltered, fetchAllBatchIds } from '../dashboards/dashboard-data.js';
import { getLocalDate, alertError, toLocale } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { reportHeaderHtml, emptyRowsHtml, exportButtonsHtml } from '../reports/report-helpers.js';

function component() {
  return {
    startDate: getLocalDate(),
    endDate: getLocalDate(),
    batchFilter: '',
    brandFilter: '',
    batchOptions: [],
    brandOptions: [],
    loading: false,
    rmRows: [],
    batchRows: [],

    async init() {
      try {
        const [{ data: brands }] = await Promise.all([supabase.from('brands').select('id, brand_name').order('brand_name')]);
        this.brandOptions = brands || [];
        this.batchOptions = await fetchAllBatchIds();
      } catch (e) {}
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const filters = { startDate: this.startDate, endDate: this.endDate };
        const [rm, fillW, fillQ, batches, suppliers] = await Promise.all([
          fetchFiltered('prod_rm', 'prodrm_date', filters, '*, suppliers(supplier_name)'),
          fetchFiltered('prod_fillw', 'prodfillw_date', filters),
          fetchFiltered('prod_fillq', 'prodfillq_date', filters),
          fetchFiltered('prod_batches', 'prodbatch_date', filters, '*, can_sizes(cansize_name), brands(brand_name)'),
          supabase.from('suppliers').select('id, supplier_name'),
        ]);

        let filteredBatches = batches;
        if (this.batchFilter) filteredBatches = filteredBatches.filter((b) => b.batch_id === this.batchFilter);
        if (this.brandFilter) filteredBatches = filteredBatches.filter((b) => b.brand_id === this.brandFilter);
        const activeIds = new Set(filteredBatches.map((b) => b.batch_id));

        const filteredRM = rm.filter((r) => activeIds.has(r.batch_id));
        const filteredFillW = fillW.filter((r) => activeIds.has(r.batch_id));
        const filteredFillQ = fillQ.filter((r) => activeIds.has(r.batch_id));

        this.rmRows = filteredRM
          .map((r) => ({
            supplier: r.suppliers?.supplier_name || r.supplier_id || '-',
            bill: r.billsup_no || '-',
            weight: Number(r.weight || 0),
            balance: Number(r.balance || 0),
          }))
          .sort((a, b) => a.supplier.localeCompare(b.supplier));

        this.batchRows = filteredBatches
          .map((b) => {
            const rmForBatch = filteredRM.filter((r) => r.batch_id === b.batch_id);
            const fqForBatch = filteredFillQ.filter((r) => r.batch_id === b.batch_id);
            const fwForBatch = filteredFillW.filter((r) => r.batch_id === b.batch_id);
            const rmWeight = rmForBatch.reduce((s, r) => s + Number(r.weight || 0), 0);
            const prodQty = fqForBatch.reduce((s, r) => s + Number(r.qty || 0), 0);
            const fwAvg = fwForBatch.length > 0 ? fwForBatch.reduce((s, r) => s + Number(r.weight || 0), 0) / fwForBatch.length : 0;
            const yieldPct = rmWeight > 0 ? ((prodQty * fwAvg) / (rmWeight * 10)) * 100 : 0;
            return {
              batch_id: b.batch_id,
              cansize: b.can_sizes?.cansize_name || '-',
              brand: b.brands?.brand_name || '-',
              rmWeight,
              prodQty,
              fwAvg,
              yieldPct,
            };
          })
          .sort((a, b) => a.batch_id.localeCompare(b.batch_id));
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    fmt(n) {
      return toLocale(n);
    },

    rmTotals() {
      return this.rmRows.reduce((acc, r) => ({ weight: acc.weight + r.weight, balance: acc.balance + r.balance }), { weight: 0, balance: 0 });
    },
    batchAverages() {
      const withYield = this.batchRows.filter((r) => r.yieldPct > 0);
      const withFw = this.batchRows.filter((r) => r.fwAvg > 0);
      return {
        rmWeight: this.batchRows.reduce((s, r) => s + r.rmWeight, 0),
        prodQty: this.batchRows.reduce((s, r) => s + r.prodQty, 0),
        fwAvg: withFw.length ? withFw.reduce((s, r) => s + r.fwAvg, 0) / withFw.length : 0,
        yieldPct: withYield.length ? withYield.reduce((s, r) => s + r.yieldPct, 0) / withYield.length : 0,
      };
    },

    exportExcel() {
      exportTablesToExcel(
        [
          { id: 'rmReportTable', sheetName: 'การใช้วัตถุดิบ' },
          { id: 'prodReportTable', sheetName: 'ข้อมูลการผลิต' },
        ],
        `รายงานผลิต_${this.startDate}_${this.endDate}.xlsx`
      );
    },
    exportPdf() {
      exportElementToPdf('productionReportPrintable', `รายงานผลิต_${this.startDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('productionReport', component);
});

registerView('report-production', async (container) => {
  container.innerHTML = `
  <div x-data="productionReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <div>
          <label class="form-label">Batch</label>
          <select x-model="batchFilter" class="form-control w-[160px]" data-no-tom>
            <option value="">-- ทั้งหมด --</option>
            <template x-for="b in batchOptions" :key="b"><option :value="b" x-text="b"></option></template>
          </select>
        </div>
        <div>
          <label class="form-label">Brand</label>
          <select x-model="brandFilter" class="form-control w-[160px]" data-no-tom>
            <option value="">-- ทั้งหมด --</option>
            <template x-for="b in brandOptions" :key="b.id"><option :value="b.id" x-text="b.brand_name"></option></template>
          </select>
        </div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="productionReportPrintable" class="card" x-show="!loading">
      ${reportHeaderHtml('รายงานงานผลิต', '', '')}
      <h4 class="report-section-title">ตารางการใช้วัตถุดิบ</h4>
      <div class="overflow-x-auto mb-6">
        <table class="report-table" id="rmReportTable">
          <thead><tr><th>ลำดับ</th><th>ชื่อ Supplier</th><th>เลขที่บิล</th><th>จำนวนที่ใช้ (kg)</th><th>คงค้าง (kg)</th></tr></thead>
          <tbody>
            <template x-for="(r, idx) in rmRows" :key="idx">
              <tr><td x-text="idx+1"></td><td x-text="r.supplier"></td><td x-text="r.bill"></td><td x-text="fmt(r.weight)"></td><td x-text="fmt(r.balance)"></td></tr>
            </template>
            <tr class="report-summary-row"><td colspan="3">รวม</td><td x-text="fmt(rmTotals().weight)"></td><td x-text="fmt(rmTotals().balance)"></td></tr>
          </tbody>
        </table>
      </div>

      <h4 class="report-section-title">ตารางข้อมูลการผลิต</h4>
      <div class="overflow-x-auto">
        <table class="report-table" id="prodReportTable">
          <thead><tr><th>CAN SIZE</th><th>BRAND</th><th>BATCH</th><th>น้ำหนักวัตถุดิบ (kg)</th><th>จำนวนผลิต</th><th>FILL WEIGHT</th><th>%YIELD</th></tr></thead>
          <tbody>
            <template x-for="r in batchRows" :key="r.batch_id">
              <tr><td x-text="r.cansize"></td><td x-text="r.brand"></td><td class="font-semibold" x-text="r.batch_id"></td><td x-text="fmt(r.rmWeight)"></td><td x-text="fmt(r.prodQty)"></td><td x-text="fmt(r.fwAvg)"></td><td x-text="r.yieldPct.toFixed(2)+'%'"></td></tr>
            </template>
            <tr class="report-summary-row">
              <td colspan="3">รวม / เฉลี่ย</td>
              <td x-text="fmt(batchAverages().rmWeight)"></td>
              <td x-text="fmt(batchAverages().prodQty)"></td>
              <td x-text="fmt(batchAverages().fwAvg)"></td>
              <td x-text="batchAverages().yieldPct.toFixed(2)+'%'"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
});
