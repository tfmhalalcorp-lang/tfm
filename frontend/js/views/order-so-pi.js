// SO/PI screen — bespoke (not crud-factory/txn-factory) because one SO/PI
// document now owns multiple product line items (so_pi_items), edited
// together in one modal: header fields + a repeatable line-items table.
import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { alertError, toastSuccess, formatDate, getLocalDate, syncPickers } from '../lib/ui-helpers.js';

const PACKING_OPTIONS = [24, 48, 50, 100];

function emptyItem() {
  return { product_id: '', brand_id: '', cansize_id: '', packing: '', shrink_pack: '', rtd: '', qty: 0, unit_price: 0 };
}

const INCOTERMS = ['FOB', 'CRF', 'CNF', 'FAS'];
const CURRENCIES = ['USD', 'THB'];

const PARTY_ROLES = [
  { field: 'consignee_id', status: 'CONSIGNEE', label: 'CONSIGNEE' },
  { field: 'buyer_id', status: 'BUYER', label: 'BUYER' },
  { field: 'notify_party_id', status: 'NOTIFY PARTY', label: 'NOTIFY PARTY' },
];

function component() {
  return {
    loading: false,
    saving: false,
    rows: [],
    extra: { customers: [], brands: [], products: [], canSizes: [], destinations: [] },
    searchStart: '',
    searchEnd: '',
    searchText: '',

    modalOpen: false,
    isEdit: false,
    currentId: null,
    form: {},
    items: [],
    fmtDate: formatDate,

    async init() {
      await Promise.all([this.loadExtra(), this.load()]);
    },

    async loadExtra() {
      try {
        const [{ data: customers }, { data: brands }, { data: products }, { data: canSizes }, { data: destRows }] = await Promise.all([
          supabase.from('customers').select('id, customer_code, customer_name, business_name, address, phone, status').order('customer_name'),
          supabase.from('brands').select('id, brand_name').order('brand_name'),
          supabase.from('products').select('id, product_name').order('product_name'),
          supabase.from('can_sizes').select('id, cansize_name').order('cansize_name'),
          supabase.from('so_pi').select('destination').not('destination', 'is', null),
        ]);
        const destinations = [...new Set((destRows || []).map((r) => r.destination).filter(Boolean))].sort();
        this.extra = { customers: customers || [], brands: brands || [], products: products || [], canSizes: canSizes || [], destinations };
      } catch (err) {
        alertError(err);
      }
    },

    customerById(id) {
      return this.extra.customers.find((c) => c.id === id) || null;
    },
    partyOptions(statusValue) {
      return this.extra.customers.filter((c) => (c.status || []).includes(statusValue));
    },

    async load() {
      this.loading = true;
      try {
        const { data, error } = await supabase
          .from('so_pi')
          .select('*, customers!customer_id(customer_name), so_pi_items(id, qty, products(product_name))')
          .order('doc_date', { ascending: false });
        if (error) throw new Error(error.message);
        this.rows = data || [];
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    get filteredRows() {
      return this.rows.filter((row) => {
        const d = String(row.doc_date || '').slice(0, 10);
        if (this.searchStart && d < this.searchStart) return false;
        if (this.searchEnd && d > this.searchEnd) return false;
        const q = this.searchText.trim().toLowerCase();
        if (q && !(row.doc_no || '').toLowerCase().includes(q)) return false;
        return true;
      });
    },

    totalQty(row) {
      return (row.so_pi_items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
    },
    productNames(row) {
      const names = (row.so_pi_items || []).map((it) => it.products?.product_name).filter(Boolean);
      return [...new Set(names)].join(', ') || '-';
    },

    openCreate() {
      this.isEdit = false;
      this.currentId = null;
      this.form = {
        doc_type: 'SO', doc_no: '', doc_date: getLocalDate(), customer_id: '',
        box_qty: '', incoterm_select: '', incoterm_custom: '', container_qty: '',
        port_select: '', port_custom: '',
        destination: '', delivery_due_date: '',
        etd_month_only: false, etd_on_po: '', etd_month_value: '',
        payment_term_select: '', payment_term_custom: '', deposit_date: '',
        consignee_id: '', buyer_id: '', notify_party_id: '',
        discount: '', vat_percent: '', currency_select: '', currency_custom: '',
      };
      this.items = [emptyItem()];
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    async openEdit(row) {
      this.isEdit = true;
      this.currentId = row.id;
      const knownPorts = ['SONGKHLA', 'BKK', 'หน้าโรงงาน'];
      const port = row.port || '';
      const knownTerms = ['Deposit', 'Non Deposit', 'LC'];
      const term = row.payment_term || '';
      const incoterm = row.incoterm || '';
      const currency = row.currency || '';
      this.form = {
        doc_type: row.doc_type, doc_no: row.doc_no, doc_date: row.doc_date, customer_id: row.customer_id || '',
        box_qty: row.box_qty ?? '',
        incoterm_select: incoterm && !INCOTERMS.includes(incoterm) ? '__other__' : incoterm,
        incoterm_custom: incoterm && !INCOTERMS.includes(incoterm) ? incoterm : '',
        container_qty: row.container_qty ?? '',
        port_select: port && !knownPorts.includes(port) ? '__other__' : port,
        port_custom: port && !knownPorts.includes(port) ? port : '',
        destination: row.destination || '', delivery_due_date: row.delivery_due_date || '',
        etd_month_only: !!row.etd_month_only,
        etd_on_po: row.etd_on_po || '',
        etd_month_value: row.etd_on_po ? String(row.etd_on_po).slice(0, 7) : '',
        payment_term_select: term && !knownTerms.includes(term) ? '__other__' : term,
        payment_term_custom: term && !knownTerms.includes(term) ? term : '',
        deposit_date: row.deposit_date || '',
        consignee_id: row.consignee_id || '', buyer_id: row.buyer_id || '', notify_party_id: row.notify_party_id || '',
        discount: row.discount ?? '', vat_percent: row.vat_percent ?? '',
        currency_select: currency && !CURRENCIES.includes(currency) ? '__other__' : currency,
        currency_custom: currency && !CURRENCIES.includes(currency) ? currency : '',
      };
      const { data: fullItems, error: itemsErr } = await supabase
        .from('so_pi_items')
        .select('product_id, brand_id, cansize_id, packing, shrink_pack, rtd, qty, unit_price')
        .eq('so_pi_id', row.id);
      if (itemsErr) {
        alertError(itemsErr);
        return;
      }
      this.items = (fullItems && fullItems.length ? fullItems : [emptyItem()]).map((it) => ({
        product_id: it.product_id || '',
        brand_id: it.brand_id || '',
        cansize_id: it.cansize_id || '',
        packing: it.packing ?? '',
        shrink_pack: it.shrink_pack || '',
        rtd: it.rtd || '',
        qty: it.qty ?? 0,
        unit_price: it.unit_price ?? 0,
      }));
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    closeModal() {
      this.modalOpen = false;
    },

    addItemRow() {
      this.items.push(emptyItem());
    },
    removeItemRow(idx) {
      if (this.items.length <= 1) return;
      this.items.splice(idx, 1);
    },

    lineTotal(item) {
      return Number(item.qty || 0) * Number(item.unit_price || 0);
    },
    get subtotal() {
      return this.items.reduce((s, it) => s + this.lineTotal(it), 0);
    },
    get netTotal() {
      const discounted = this.subtotal - Number(this.form.discount || 0);
      const vat = discounted * (Number(this.form.vat_percent || 0) / 100);
      return discounted + vat;
    },

    async save() {
      if (!this.form.doc_no || !this.form.doc_date || !this.form.doc_type) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอกประเภทเอกสาร, เลขที่ SO/PI และวันที่' });
        return;
      }
      const validItems = this.items.filter((it) => it.product_id || it.qty);
      if (validItems.length === 0) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' });
        return;
      }

      const port = this.form.port_select === '__other__' ? (this.form.port_custom || '').trim() : this.form.port_select;
      const paymentTerm = this.form.payment_term_select === '__other__' ? (this.form.payment_term_custom || '').trim() : this.form.payment_term_select;
      const incoterm = this.form.incoterm_select === '__other__' ? (this.form.incoterm_custom || '').trim() : this.form.incoterm_select;
      const currency = this.form.currency_select === '__other__' ? (this.form.currency_custom || '').trim() : this.form.currency_select;
      const etdOnPo = this.form.etd_month_only ? (this.form.etd_month_value ? `${this.form.etd_month_value}-01` : null) : this.form.etd_on_po || null;

      const headerPayload = {
        doc_type: this.form.doc_type,
        doc_no: this.form.doc_no.trim(),
        doc_date: this.form.doc_date,
        customer_id: this.form.customer_id || null,
        box_qty: this.form.box_qty === '' ? null : Number(this.form.box_qty),
        incoterm: incoterm || null,
        container_qty: this.form.container_qty === '' ? null : Number(this.form.container_qty),
        port: port || null,
        destination: this.form.destination || null,
        delivery_due_date: this.form.delivery_due_date || null,
        etd_month_only: !!this.form.etd_month_only,
        etd_on_po: etdOnPo,
        payment_term: paymentTerm || null,
        deposit_date: this.form.deposit_date || null,
        consignee_id: this.form.consignee_id || null,
        buyer_id: this.form.buyer_id || null,
        notify_party_id: this.form.notify_party_id || null,
        discount: this.form.discount === '' ? null : Number(this.form.discount),
        vat_percent: this.form.vat_percent === '' ? null : Number(this.form.vat_percent),
        currency: currency || null,
      };

      this.saving = true;
      try {
        let soPiId = this.currentId;
        if (this.isEdit) {
          const { error } = await supabase.from('so_pi').update(headerPayload).eq('id', soPiId);
          if (error) throw new Error(error.message);
          const { error: delErr } = await supabase.from('so_pi_items').delete().eq('so_pi_id', soPiId);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { data, error } = await supabase.from('so_pi').insert(headerPayload).select('id').single();
          if (error) throw new Error(error.message);
          soPiId = data.id;
        }

        const itemsPayload = validItems.map((it) => ({
          so_pi_id: soPiId,
          product_id: it.product_id || null,
          brand_id: it.brand_id || null,
          cansize_id: it.cansize_id || null,
          packing: it.packing === '' ? null : Number(it.packing),
          shrink_pack: it.shrink_pack || null,
          rtd: it.rtd || null,
          qty: Number(it.qty || 0),
          unit_price: Number(it.unit_price || 0),
        }));
        const { error: insErr } = await supabase.from('so_pi_items').insert(itemsPayload);
        if (insErr) throw new Error(insErr.message);

        this.modalOpen = false;
        await this.load();
        toastSuccess(this.isEdit ? 'แก้ไขคำสั่งซื้อสำเร็จ' : 'บันทึกคำสั่งซื้อสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    async remove(row) {
      const result = await window.Swal?.fire({
        title: 'ยืนยันการลบ?',
        text: `ลบ ${row.doc_no} และรายการสินค้าทั้งหมดในเอกสารนี้`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'ใช่, ลบเลย',
        cancelButtonText: 'ยกเลิก',
      });
      if (!result || !result.isConfirmed) return;
      try {
        const { error } = await supabase.from('so_pi').delete().eq('id', row.id);
        if (error) throw new Error(error.message);
        await this.load();
        toastSuccess('ลบข้อมูลสำเร็จ');
      } catch (err) {
        alertError(err);
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('soPiEditor', component);
});

const itemRowTemplate = `
  <tr class="border-b border-gray-100">
    <td class="p-1">
      <select x-model="item.brand_id" class="form-control text-xs" data-no-tom>
        <option value="">-- Brand --</option>
        <template x-for="b in extra.brands" :key="b.id"><option :value="b.id" x-text="b.brand_name"></option></template>
      </select>
    </td>
    <td class="p-1">
      <select x-model="item.product_id" class="form-control text-xs" data-no-tom>
        <option value="">-- Description of Goods --</option>
        <template x-for="p in extra.products" :key="p.id"><option :value="p.id" x-text="p.product_name"></option></template>
      </select>
    </td>
    <td class="p-1">
      <select x-model="item.cansize_id" class="form-control text-xs" data-no-tom>
        <option value="">-- Size --</option>
        <template x-for="c in extra.canSizes" :key="c.id"><option :value="c.id" x-text="c.cansize_name"></option></template>
      </select>
    </td>
    <td class="p-1">
      <select x-model.number="item.packing" class="form-control text-xs" data-no-tom>
        <option value="">-</option>
        <template x-for='p in ${JSON.stringify(PACKING_OPTIONS)}' :key="p"><option :value="p" x-text="p"></option></template>
      </select>
    </td>
    <td class="p-1">
      <select x-model="item.shrink_pack" class="form-control text-xs" data-no-tom>
        <option value="">-</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="Other">Other</option>
      </select>
    </td>
    <td class="p-1">
      <select x-model="item.rtd" class="form-control text-xs" data-no-tom>
        <option value="">-</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="Other">Other</option>
      </select>
    </td>
    <td class="p-1"><input type="number" min="0" x-model.number="item.qty" class="form-control text-xs w-20"></td>
    <td class="p-1"><input type="number" step="0.01" min="0" x-model.number="item.unit_price" class="form-control text-xs w-24"></td>
    <td class="p-1 text-right whitespace-nowrap" x-text="lineTotal(item).toLocaleString(undefined,{minimumFractionDigits:2})"></td>
    <td class="p-1 text-center">
      <button type="button" class="text-danger px-1" @click="removeItemRow(idx)" title="ลบรายการ"><i class="fa-solid fa-trash"></i></button>
    </td>
  </tr>`;

registerView('order-so-pi', async (container) => {
  container.innerHTML = `
  <div x-data="soPiEditor" x-init="init()">
    <div class="card">
      <div class="flex flex-nowrap overflow-x-auto items-end justify-between gap-3 mb-4">
        <h2 class="text-lg font-bold text-gray-800 shrink-0">รายการคำสั่งซื้อ SO/PI</h2>
        <div class="flex flex-nowrap gap-2 items-end shrink-0">
          <div><label class="form-label">ตั้งแต่วันที่</label><input type="date" x-model="searchStart" class="form-control w-[150px]"></div>
          <div><label class="form-label">ถึงวันที่</label><input type="date" x-model="searchEnd" class="form-control w-[150px]"></div>
          <input type="text" x-model="searchText" placeholder="ค้นหาเลขที่ SO/PI..." data-no-flatpickr class="form-control w-[160px] self-end">
          <button class="btn btn-primary shrink-0 self-end" @click="openCreate()"><i class="fa-solid fa-plus"></i> เพิ่มข้อมูล</button>
        </div>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead>
            <tr class="bg-gray-50 text-gray-600 text-left">
              <th class="px-3 py-2">เลขที่ SO/PI</th>
              <th class="px-3 py-2">วันที่</th>
              <th class="px-3 py-2">ลูกค้า</th>
              <th class="px-3 py-2">สินค้า</th>
              <th class="px-3 py-2 text-right">จำนวนรวม</th>
              <th class="px-3 py-2 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <template x-if="loading"><tr><td colspan="6" class="text-center py-8 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</td></tr></template>
            <template x-if="!loading && filteredRows.length === 0"><tr><td colspan="6" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr></template>
            <template x-for="row in filteredRows" :key="row.id">
              <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-3 py-2 font-semibold" x-text="row.doc_no"></td>
                <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(row.doc_date)"></td>
                <td class="px-3 py-2" x-text="row.customers?.customer_name || '-'"></td>
                <td class="px-3 py-2 max-w-[260px] truncate" :title="productNames(row)" x-text="productNames(row)"></td>
                <td class="px-3 py-2 text-right" x-text="totalQty(row).toLocaleString()"></td>
                <td class="px-3 py-2 text-center whitespace-nowrap">
                  <button class="text-secondary hover:text-blue-800 px-1.5" @click="openEdit(row)" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                  <button class="text-danger hover:text-red-800 px-1.5" @click="remove(row)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit modal -->
    <div class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" x-show="modalOpen" x-cloak
         @click.self="closeModal()" @keydown.escape.window="closeModal()">
      <div class="modal-panel w-full max-w-6xl">
        <form @submit.prevent="save()">
          <div class="flex items-center justify-between px-5 py-4 border-b">
            <h3 class="font-bold text-gray-800" x-text="isEdit ? 'แก้ไขคำสั่งซื้อ SO/PI' : 'เพิ่มคำสั่งซื้อ SO/PI'"></h3>
            <button type="button" class="text-gray-400 hover:text-gray-700" @click="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div class="overflow-x-auto">
              <div class="grid grid-cols-4 gap-4 min-w-[640px]">
                <div>
                  <label class="form-label">ประเภทเอกสาร</label>
                  <select x-model="form.doc_type" required class="form-control" data-no-tom>
                    <option value="SO">SO (Sales Order)</option>
                    <option value="PI">PI (Proforma Invoice)</option>
                  </select>
                </div>
                <div><label class="form-label">เลขที่ SO/PI</label><input type="text" x-model="form.doc_no" required class="form-control" data-no-flatpickr></div>
                <div><label class="form-label">วันที่ SO</label><input type="date" x-model="form.doc_date" required class="form-control"></div>
                <div>
                  <label class="form-label">ลูกค้า</label>
                  <select x-model="form.customer_id" class="form-control" data-no-tom>
                    <option value="">-- เลือกลูกค้า --</option>
                    <template x-for="c in extra.customers" :key="c.id"><option :value="c.id" x-text="c.customer_name"></option></template>
                  </select>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t">
              <h4 class="text-sm font-semibold text-gray-600 mb-3">รายละเอียดการจัดส่ง (Shipping Details)</h4>
              <div class="overflow-x-auto">
                <div class="grid grid-cols-4 gap-4 mb-4 min-w-[640px]">
                  <div><label class="form-label">จำนวนกล่อง</label><input type="number" min="0" x-model.number="form.box_qty" class="form-control"></div>
                  <div>
                    <label class="form-label">Incoterm</label>
                    <select x-model="form.incoterm_select" class="form-control" data-no-tom>
                      <option value="">-- เลือก Incoterm --</option>
                      <template x-for='t in ${JSON.stringify(INCOTERMS)}' :key="t"><option :value="t" x-text="t"></option></template>
                      <option value="__other__">อื่นๆ (ระบุ)</option>
                    </select>
                    <input type="text" x-show="form.incoterm_select === '__other__'" x-cloak x-model="form.incoterm_custom" placeholder="ระบุ Incoterm" class="form-control mt-2" data-no-flatpickr>
                  </div>
                  <div><label class="form-label">จำนวนตู้ (FCL)</label><input type="number" min="0" x-model.number="form.container_qty" class="form-control"></div>
                  <div><label class="form-label">DUE DATE (วันกำหนดส่งมอบ)</label><input type="date" x-model="form.delivery_due_date" class="form-control"></div>
                </div>
                <div class="grid grid-cols-4 gap-4 mb-4 min-w-[640px]">
                  <div>
                    <label class="form-label">ท่าเรือ (Port of Loading)</label>
                    <select x-model="form.port_select" class="form-control" data-no-tom>
                      <option value="">-- เลือกท่าเรือ --</option>
                      <option value="SONGKHLA">SONGKHLA</option>
                      <option value="BKK">BKK</option>
                      <option value="หน้าโรงงาน">หน้าโรงงาน</option>
                      <option value="__other__">อื่นๆ (ระบุ)</option>
                    </select>
                    <input type="text" x-show="form.port_select === '__other__'" x-cloak x-model="form.port_custom" placeholder="ระบุชื่อท่าเรือ" class="form-control mt-2" data-no-flatpickr>
                  </div>
                  <div>
                    <label class="form-label">ปลายทาง (Port of Discharge)</label>
                    <select x-model="form.destination" class="form-control" data-tom-create="true">
                      <option value="">-- เลือกหรือพิมพ์ปลายทางใหม่ --</option>
                      <template x-for="d in extra.destinations" :key="d"><option :value="d" x-text="d"></option></template>
                    </select>
                  </div>
                  <div>
                    <label class="form-label flex items-center justify-between">
                      <span>ETD ON PO</span>
                      <label class="flex items-center gap-1.5 font-normal text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" x-model="form.etd_month_only"> เดือน/ปี
                      </label>
                    </label>
                    <input type="date" x-show="!form.etd_month_only" x-model="form.etd_on_po" class="form-control">
                    <input type="month" x-show="form.etd_month_only" x-cloak x-model="form.etd_month_value" class="form-control">
                  </div>
                  <div>
                    <label class="form-label">Payment Term</label>
                    <select x-model="form.payment_term_select" class="form-control" data-no-tom>
                      <option value="">-- เลือก Payment Term --</option>
                      <option value="Deposit">Deposit</option>
                      <option value="Non Deposit">Non Deposit</option>
                      <option value="LC">LC</option>
                      <option value="__other__">อื่นๆ (ระบุ)</option>
                    </select>
                    <input type="text" x-show="form.payment_term_select === '__other__'" x-cloak x-model="form.payment_term_custom" placeholder="ระบุ Payment Term" class="form-control mt-2" data-no-flatpickr>
                    <div x-show="form.payment_term_select === 'Deposit'" x-cloak class="mt-2">
                      <label class="form-label text-xs">Deposit Date</label>
                      <input type="date" x-model="form.deposit_date" class="form-control">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t">
              <h4 class="text-sm font-semibold text-gray-600 mb-3">CONSIGNEE / BUYER / NOTIFY PARTY</h4>
              <div class="overflow-x-auto">
                <div class="grid grid-cols-3 gap-4 min-w-[900px]">
                  ${PARTY_ROLES.map(
                    (role) => `
                  <div>
                    <label class="form-label">${role.label}</label>
                    <select x-model="form.${role.field}" class="form-control" data-no-tom>
                      <option value="">-- เลือก ${role.label} --</option>
                      <template x-for="c in partyOptions('${role.status}')" :key="c.id">
                        <option :value="c.id" x-text="(c.customer_code || '') + ' - ' + (c.business_name || c.customer_name)"></option>
                      </template>
                    </select>
                    <div class="mt-2 text-xs bg-gray-50 rounded-md p-2 border border-gray-200 space-y-0.5" x-show="form.${role.field}">
                      <div><span class="text-gray-500">Code:</span> <span x-text="customerById(form.${role.field})?.customer_code || '-'"></span></div>
                      <div><span class="text-gray-500">ชื่อกิจการ:</span> <span x-text="customerById(form.${role.field})?.business_name || '-'"></span></div>
                      <div><span class="text-gray-500">ที่อยู่:</span> <span x-text="customerById(form.${role.field})?.address || '-'"></span></div>
                      <div><span class="text-gray-500">เบอร์โทร:</span> <span x-text="customerById(form.${role.field})?.phone || '-'"></span></div>
                    </div>
                  </div>`
                  ).join('')}
                </div>
              </div>
            </div>

            <div class="pt-3 border-t">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-semibold text-gray-600">รายการสินค้า</h4>
                <button type="button" class="btn btn-secondary btn-sm" @click="addItemRow()"><i class="fa-solid fa-plus"></i> เพิ่มรายการ</button>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-xs border-collapse min-w-[1000px]">
                  <thead>
                    <tr class="bg-gray-50 text-gray-600 text-left">
                      <th class="p-1 w-20">BRAND</th><th class="p-1 w-64">Description of Goods</th><th class="p-1 w-20">CAN SIZE</th>
                      <th class="p-1 w-[77px]">Packing</th><th class="p-1 w-[88px]">Shrink Pack</th><th class="p-1 w-[88px]">RTD</th>
                      <th class="p-1">จำนวน</th><th class="p-1">ราคาต่อหน่วย</th><th class="p-1">ราคารวม</th><th class="p-1"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <template x-for="(item, idx) in items" :key="idx">
                      ${itemRowTemplate}
                    </template>
                  </tbody>
                </table>
              </div>
              <div class="flex justify-end mt-3">
                <div class="w-full max-w-xs space-y-1.5 text-sm">
                  <div class="flex justify-between items-center gap-2">
                    <label class="text-gray-600 shrink-0">สกุลเงิน (Currency)</label>
                    <div class="flex items-center gap-3">
                      <template x-for='c in ${JSON.stringify(CURRENCIES)}' :key="c">
                        <label class="flex items-center gap-1 font-normal cursor-pointer">
                          <input type="radio" name="soPiCurrency" :value="c" x-model="form.currency_select"><span x-text="c"></span>
                        </label>
                      </template>
                      <label class="flex items-center gap-1 font-normal cursor-pointer">
                        <input type="radio" name="soPiCurrency" value="__other__" x-model="form.currency_select"><span>อื่นๆ</span>
                      </label>
                    </div>
                  </div>
                  <input type="text" x-show="form.currency_select === '__other__'" x-cloak x-model="form.currency_custom" placeholder="ระบุสกุลเงิน" class="form-control text-sm" data-no-flatpickr>
                  <div class="flex justify-between items-center"><span class="text-gray-600">Subtotal</span><span class="font-semibold" x-text="subtotal.toLocaleString(undefined,{minimumFractionDigits:2})"></span></div>
                  <div class="flex justify-between items-center gap-2">
                    <label class="text-gray-600 shrink-0">Discount</label>
                    <input type="number" step="0.01" min="0" x-model.number="form.discount" class="form-control text-sm w-28 text-right">
                  </div>
                  <div class="flex justify-between items-center gap-2">
                    <label class="text-gray-600 shrink-0">VAT (%)</label>
                    <input type="number" step="0.01" min="0" x-model.number="form.vat_percent" class="form-control text-sm w-28 text-right">
                  </div>
                  <div class="flex justify-between items-center pt-1.5 border-t"><span class="font-bold text-gray-800">ราคาสุทธิ</span><span class="font-bold text-primary" x-text="netTotal.toLocaleString(undefined,{minimumFractionDigits:2})"></span></div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
            <button type="button" class="btn btn-secondary" @click="closeModal()">ยกเลิก</button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              <i class="fa-solid fa-spinner fa-spin" x-show="saving" x-cloak></i>
              <span x-text="saving ? 'กำลังบันทึก...' : 'บันทึก'"></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
});
