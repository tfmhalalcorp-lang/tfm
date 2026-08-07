// SALES ORDER report — a printable replica of the company's paper SALES
// ORDER form. One row per so_pi_item; SO/PI-level fields (port, agent,
// ETD ON PO, deposit terms, booking dates) are shown only on the first
// item row of each SO/PI and left blank on the rest, matching the paper
// form's grouping convention. Carton/Cover/Base paper/Label readiness is
// tracked per SO/PI (not per item) in this system, so that status repeats
// on every item row of the same SO/PI.
import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { getLocalDate, alertError, toLocale } from '../lib/ui-helpers.js';
import { exportTablesToExcel, exportElementToPdf } from '../lib/export-helpers.js';
import { exportButtonsHtml } from '../reports/report-helpers.js';

// Placeholder document-control values — replace with the real text from
// the paper form once available (image supplied wasn't legible enough).
const FORM_NUMBER = 'TSM-XXX';
const REV_NO = '00';
const EFFECTIVE_DATE = 'XX-XX-XXXX';
const COMPANY_NAME = 'THAVEECHAI FOOD MANUFACTURING CO.,LTD.';
const COMPANY_ADDRESS = '289 Moo.7 T.Kamphaengphet A. Rattapoom, Songkhla 90180  Tel. 074-498719-21';

const MIN_ROWS = 20;

function fmtShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return '';
  const month = d.toLocaleString('en-US', { month: 'short' });
  return `${d.getDate()}-${month}-${String(d.getFullYear()).slice(-2)}`;
}
function fmtMonthOnly(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return '';
  return d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
}
function fmtDayMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()}`;
}
function depositDateText(term, depositDate) {
  if (term === 'Non Deposit') return '0';
  if (term === 'Deposit') return depositDate ? `30% @${fmtDayMonth(depositDate)}` : '30%';
  return '';
}

// carton_label_preps stores independent ready/not_used booleans per item;
// saveCartonLabel() blocks saving both true at once, so only 3 states reach here.
function packagingMark(ready, notUsed) {
  if (ready) return '✓';
  if (notUsed) return '✗';
  return '';
}

function component() {
  return {
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: getLocalDate(),
    loading: false,
    rows: [],
    formNumber: FORM_NUMBER,
    revNo: REV_NO,
    effectiveDate: EFFECTIVE_DATE,
    companyName: COMPANY_NAME,
    companyAddress: COMPANY_ADDRESS,

    async init() {
      await this.search();
    },

    async search() {
      this.loading = true;
      try {
        const { data: soPiRows, error } = await supabase
          .from('so_pi')
          .select(
            'id, doc_no, doc_date, port, destination, agent, etd_on_po, etd_month_only, container_qty, payment_term, deposit_date, so_pi_items(qty, rtd, brands(brand_name), products(product_name))'
          )
          .eq('doc_type', 'SO')
          .gte('doc_date', this.startDate)
          .lte('doc_date', this.endDate)
          .order('doc_date');
        if (error) throw new Error(error.message);

        const soPiIds = (soPiRows || []).map((r) => r.id);
        const idFilter = soPiIds.length ? soPiIds : ['00000000-0000-0000-0000-000000000000'];
        const [{ data: bookings, error: bErr }, { data: cartonLabels, error: cErr }] = await Promise.all([
          supabase.from('booking_confirmations').select('*').in('so_pi_id', idFilter),
          supabase.from('carton_label_preps').select('*').in('so_pi_id', idFilter),
        ]);
        if (bErr) throw new Error(bErr.message);
        if (cErr) throw new Error(cErr.message);

        const bookingBySoPi = {};
        (bookings || []).forEach((b) => (bookingBySoPi[b.so_pi_id] = b));
        const cartonBySoPi = {};
        (cartonLabels || []).forEach((c) => (cartonBySoPi[c.so_pi_id] = c));

        const rows = [];
        (soPiRows || []).forEach((so) => {
          const items = so.so_pi_items && so.so_pi_items.length ? so.so_pi_items : [{ qty: 0, rtd: '', brands: null, products: null }];
          const booking = bookingBySoPi[so.id];
          const carton = cartonBySoPi[so.id];
          items.forEach((it, idx) => {
            const isFirst = idx === 0;
            rows.push({
              doc_no: isFirst ? so.doc_no : '',
              brand: it.brands?.brand_name || '-',
              product: it.products?.product_name || '-',
              normalQty: it.rtd === 'Yes' ? null : Number(it.qty || 0),
              rtdQty: it.rtd === 'Yes' ? Number(it.qty || 0) : null,
              fcl: isFirst ? so.container_qty ?? '' : '',
              portLoading: isFirst ? so.port || '' : '',
              portDischarge: isFirst ? so.destination || '' : '',
              agent: isFirst ? so.agent || '' : '',
              etdOnPo: isFirst ? (so.etd_month_only ? fmtMonthOnly(so.etd_on_po) : fmtShortDate(so.etd_on_po)) : '',
              depositDate: isFirst ? depositDateText(so.payment_term, so.deposit_date) : '',
              loadingDate: isFirst ? fmtShortDate(booking?.loading_date) : '',
              etdOnBooked: isFirst ? fmtShortDate(booking?.etd_on_board) : '',
              cartonMark: packagingMark(carton?.carton_ready, carton?.carton_not_used),
              coverMark: packagingMark(carton?.cover_ready, carton?.cover_not_used),
              basePaperMark: packagingMark(carton?.base_paper_ready, carton?.base_paper_not_used),
              labelMark: packagingMark(carton?.label_ready, carton?.label_not_used),
            });
          });
        });
        this.rows = rows;
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    get paddedRowCount() {
      return Math.max(MIN_ROWS, this.rows.length);
    },
    get emptyRowCount() {
      return this.paddedRowCount - this.rows.length;
    },
    fmt(n) {
      return n === null || n === undefined || n === '' ? '' : toLocale(n);
    },
    reportYear() {
      return this.endDate ? this.endDate.slice(0, 4) : new Date().getFullYear();
    },

    exportExcel() {
      exportTablesToExcel([{ id: 'salesOrderReportTable', sheetName: 'SALES ORDER' }], `SalesOrder_${this.startDate}_${this.endDate}.xlsx`);
    },
    exportPdf() {
      exportElementToPdf('salesOrderReportPrintable', `SalesOrder_${this.startDate}_${this.endDate}.pdf`);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('salesOrderReport', component);
});

registerView('report-sales-order', async (container) => {
  container.innerHTML = `
  <div x-data="salesOrderReport" x-init="init()">
    <div class="card mb-4 no-print">
      <div class="flex flex-wrap gap-3 items-end">
        <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="startDate" class="form-control w-[150px]"></div>
        <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="endDate" class="form-control w-[150px]"></div>
        <button class="btn btn-primary" @click="search()"><i class="fa-solid fa-magnifying-glass"></i> แสดงผลข้อมูล</button>
      </div>
    </div>

    ${exportButtonsHtml()}

    <template x-if="loading"><div class="text-center py-16 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div></template>

    <div id="salesOrderReportPrintable" class="card overflow-x-auto" x-show="!loading">
      <div class="text-[11px] text-gray-500 mb-1">หน้าที่ 1 จาก 1</div>

      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="shrink-0 w-[190px] flex items-start">
          <img src="images/logo.png" class="h-14 w-14 object-contain" alt="TFM Logo">
        </div>
        <div class="flex-1 text-center">
          <div class="font-bold text-sm" x-text="companyName"></div>
          <div class="text-xs text-gray-600" x-text="companyAddress"></div>
        </div>
        <div class="text-[10px] border border-gray-400 rounded shrink-0 w-[190px]">
          <div class="flex justify-between border-b border-gray-400 px-1.5 py-0.5"><span>Form Number :</span><span x-text="formNumber"></span></div>
          <div class="flex justify-between border-b border-gray-400 px-1.5 py-0.5"><span>Rev.No. :</span><span x-text="revNo"></span></div>
          <div class="flex justify-between px-1.5 py-0.5"><span>Effective Date :</span><span x-text="effectiveDate"></span></div>
        </div>
      </div>

      <h3 class="text-center font-bold text-lg mb-2" x-text="'SALES ORDER  ' + reportYear()"></h3>

      <table id="salesOrderReportTable" class="w-full border-collapse text-[11px]">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-400 p-1"></th>
            <th class="border border-gray-400 p-1">SO/PI</th>
            <th class="border border-gray-400 p-1">Brand</th>
            <th class="border border-gray-400 p-1">Description of Goods</th>
            <th class="border border-gray-400 p-1">Normal (Ctn.)</th>
            <th class="border border-gray-400 p-1">RTD (Ctn.)</th>
            <th class="border border-gray-400 p-1">FCL</th>
            <th class="border border-gray-400 p-1">Port of Loading</th>
            <th class="border border-gray-400 p-1">Port of Discharge</th>
            <th class="border border-gray-400 p-1">Agent</th>
            <th class="border border-gray-400 p-1">ETD ON PO</th>
            <th class="border border-gray-400 p-1">Deposit Date</th>
            <th class="border border-gray-400 p-1 bg-yellow-200">Loading Date</th>
            <th class="border border-gray-400 p-1 bg-yellow-200">ETD ON BOOKED</th>
            <th class="border border-gray-400 p-1 bg-orange-200 w-12 whitespace-normal">Carton</th>
            <th class="border border-gray-400 p-1 bg-orange-200 w-12 whitespace-normal">Cover</th>
            <th class="border border-gray-400 p-1 bg-orange-200 w-12 whitespace-normal text-[9px]">Base paper</th>
            <th class="border border-gray-400 p-1 bg-orange-200 w-12 whitespace-normal">Label</th>
          </tr>
        </thead>
        <tbody>
          <template x-for="(r, idx) in rows" :key="idx">
            <tr>
              <td class="border border-gray-400 p-1 text-center" x-text="idx+1"></td>
              <td class="border border-gray-400 p-1 font-semibold text-blue-700" x-text="r.doc_no"></td>
              <td class="border border-gray-400 p-1 font-semibold text-blue-700" x-text="r.brand"></td>
              <td class="border border-gray-400 p-1 text-left" x-text="r.product"></td>
              <td class="border border-gray-400 p-1 text-right" x-text="fmt(r.normalQty)"></td>
              <td class="border border-gray-400 p-1 text-right" x-text="fmt(r.rtdQty)"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.fcl"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.portLoading"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.portDischarge"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.agent"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.etdOnPo"></td>
              <td class="border border-gray-400 p-1 text-center" x-text="r.depositDate"></td>
              <td class="border border-gray-400 p-1 text-center bg-yellow-50" x-text="r.loadingDate"></td>
              <td class="border border-gray-400 p-1 text-center bg-yellow-50" x-text="r.etdOnBooked"></td>
              <td class="border border-gray-400 p-1 text-center bg-orange-50 w-12" x-text="r.cartonMark"></td>
              <td class="border border-gray-400 p-1 text-center bg-orange-50 w-12" x-text="r.coverMark"></td>
              <td class="border border-gray-400 p-1 text-center bg-orange-50 w-12" x-text="r.basePaperMark"></td>
              <td class="border border-gray-400 p-1 text-center bg-orange-50 w-12" x-text="r.labelMark"></td>
            </tr>
          </template>
          <template x-for="n in emptyRowCount" :key="'empty-'+n">
            <tr>
              <td class="border border-gray-400 p-1 text-center" x-text="rows.length + n"></td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-yellow-100">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-yellow-100">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-orange-100">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-orange-100">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-orange-100">&nbsp;</td>
              <td class="border border-gray-400 p-1 bg-orange-100">&nbsp;</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>`;
});
