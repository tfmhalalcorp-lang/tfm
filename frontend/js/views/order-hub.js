// หน้าจัดการรวม (Order Hub) — one table of every SO/PI with quick-action
// buttons into each downstream stage. Unlike the other views, this one is
// bespoke rather than crud-factory/txn-factory-based: each action button
// opens the SAME modal shell scoped to a different table (production_plans /
// deliveries / accounting_entries) depending on which button was clicked.
import { registerView } from '../router.js';
import { supabase } from '../lib/supabaseClient.js';
import { alertError, toastSuccess, formatDate, getLocalDate } from '../lib/ui-helpers.js';

function component() {
  return {
    loading: false,
    rows: [],
    plansBySoPi: {},
    deliveriesBySoPi: {},

    modalOpen: false,
    modalType: '', // 'plan' | 'delivery' | 'accounting'
    modalTitle: '',
    saving: false,
    form: {},
    currentSoPi: null,
    currentDelivery: null,
    fmtDate: formatDate,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      try {
        const [{ data: soPi, error: e1 }, { data: plans, error: e2 }, { data: deliveries, error: e3 }] = await Promise.all([
          supabase.from('so_pi').select('*, customers!customer_id(customer_name), so_pi_items(qty, products(product_name))').order('doc_date', { ascending: false }),
          supabase.from('production_plans').select('*'),
          supabase.from('deliveries').select('*'),
        ]);
        if (e1) throw new Error(e1.message);
        if (e2) throw new Error(e2.message);
        if (e3) throw new Error(e3.message);
        this.rows = soPi || [];
        this.plansBySoPi = {};
        (plans || []).forEach((p) => (this.plansBySoPi[p.so_pi_id] = p));
        this.deliveriesBySoPi = {};
        (deliveries || []).forEach((d) => (this.deliveriesBySoPi[d.so_pi_id] = d));
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    hasPlan(id) {
      return !!this.plansBySoPi[id];
    },
    hasDelivery(id) {
      return !!this.deliveriesBySoPi[id];
    },
    totalQty(row) {
      return (row.so_pi_items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
    },
    productNames(row) {
      const names = (row.so_pi_items || []).map((it) => it.products?.product_name).filter(Boolean);
      return [...new Set(names)].join(', ') || '-';
    },

    openPlaceholder() {
      window.Swal?.fire({ icon: 'info', title: 'อยู่ระหว่างการพัฒนา', text: 'เมนูนี้จะเปิดใช้งานในระยะถัดไป' });
    },

    openPlan(row) {
      this.currentSoPi = row;
      const existing = this.plansBySoPi[row.id];
      this.form = existing
        ? {
            id: existing.id,
            plan_no: existing.plan_no,
            plan_date: existing.plan_date,
            qty: existing.qty,
            expected_load_date: existing.expected_load_date || '',
          }
        : { id: null, plan_no: '', plan_date: getLocalDate(), qty: this.totalQty(row), expected_load_date: '' };
      this.modalType = 'plan';
      this.modalTitle = 'แผนการผลิต — ' + row.doc_no;
      this.modalOpen = true;
    },

    async savePlan() {
      if (!this.form.plan_no || !this.form.plan_date) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอกหมายเลขแผนผลิตและวันที่ผลิต' });
        return;
      }
      this.saving = true;
      try {
        const payload = {
          plan_no: this.form.plan_no.trim(),
          so_pi_id: this.currentSoPi.id,
          plan_date: this.form.plan_date,
          product_id: null,
          qty: Number(this.form.qty || 0),
          expected_load_date: this.form.expected_load_date || null,
        };
        const { error } = this.form.id
          ? await supabase.from('production_plans').update(payload).eq('id', this.form.id)
          : await supabase.from('production_plans').insert(payload);
        if (error) throw new Error(error.message);
        this.modalOpen = false;
        await this.load();
        toastSuccess('บันทึกแผนการผลิตสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    openDelivery(row) {
      this.currentSoPi = row;
      const existing = this.deliveriesBySoPi[row.id];
      this.form = existing
        ? { id: existing.id, bill_of_load_date: existing.bill_of_load_date, iv_no: existing.iv_no }
        : { id: null, bill_of_load_date: getLocalDate(), iv_no: '' };
      this.modalType = 'delivery';
      this.modalTitle = 'บันทึกการจัดส่ง — ' + row.doc_no;
      this.modalOpen = true;
    },

    async saveDelivery() {
      if (!this.form.bill_of_load_date || !this.form.iv_no) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอก Bill of Load Date และ IV No.' });
        return;
      }
      this.saving = true;
      try {
        const payload = {
          so_pi_id: this.currentSoPi.id,
          bill_of_load_date: this.form.bill_of_load_date,
          iv_no: this.form.iv_no.trim(),
        };
        const { error } = this.form.id
          ? await supabase.from('deliveries').update(payload).eq('id', this.form.id)
          : await supabase.from('deliveries').insert(payload);
        if (error) throw new Error(error.message);
        this.modalOpen = false;
        await this.load();
        toastSuccess('บันทึกการจัดส่งสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    async openAccounting(row) {
      const delivery = this.deliveriesBySoPi[row.id];
      if (!delivery) {
        window.Swal?.fire({
          icon: 'info',
          title: 'ยังไม่มีข้อมูลจัดส่ง',
          text: 'กรุณาบันทึกการจัดส่ง (IV No.) ก่อนบันทึกข้อมูลบัญชีสำหรับ SO/PI นี้',
        });
        return;
      }
      this.currentSoPi = row;
      this.currentDelivery = delivery;
      try {
        const { data: existing, error } = await supabase
          .from('accounting_entries')
          .select('*')
          .eq('delivery_id', delivery.id)
          .maybeSingle();
        if (error) throw new Error(error.message);
        this.form = existing
          ? { id: existing.id, due_date: existing.due_date, amount: existing.amount }
          : { id: null, due_date: getLocalDate(), amount: 0 };
      } catch (err) {
        alertError(err);
        return;
      }
      this.modalType = 'accounting';
      this.modalTitle = 'ส่วนงานบัญชี — IV ' + delivery.iv_no;
      this.modalOpen = true;
    },

    async saveAccounting() {
      if (!this.form.due_date) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอกวันที่กำหนดชำระ' });
        return;
      }
      this.saving = true;
      try {
        const payload = {
          delivery_id: this.currentDelivery.id,
          due_date: this.form.due_date,
          amount: Number(this.form.amount || 0),
        };
        const { error } = this.form.id
          ? await supabase.from('accounting_entries').update(payload).eq('id', this.form.id)
          : await supabase.from('accounting_entries').insert(payload);
        if (error) throw new Error(error.message);
        this.modalOpen = false;
        toastSuccess('บันทึกข้อมูลบัญชีสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    save() {
      if (this.modalType === 'plan') return this.savePlan();
      if (this.modalType === 'delivery') return this.saveDelivery();
      if (this.modalType === 'accounting') return this.saveAccounting();
    },

    closeModal() {
      this.modalOpen = false;
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('orderHub', component);
});

registerView('order-hub', async (container) => {
  container.innerHTML = `
  <div x-data="orderHub" x-init="init()">
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-gray-800">หน้าจัดการรวม — SO/PI ทั้งหมด</h2>
        <button class="btn btn-secondary btn-sm" @click="load()"><i class="fa-solid fa-arrows-rotate"></i> รีเฟรช</button>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr class="bg-gray-50 text-gray-600 text-left">
              <th class="px-3 py-2">ประเภท</th>
              <th class="px-3 py-2">เลขที่ SO/PI</th>
              <th class="px-3 py-2">วันที่</th>
              <th class="px-3 py-2">ลูกค้า</th>
              <th class="px-3 py-2">สินค้า</th>
              <th class="px-3 py-2 text-right">จำนวน</th>
              <th class="px-3 py-2 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <template x-if="loading">
              <tr><td colspan="7" class="text-center py-8 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</td></tr>
            </template>
            <template x-if="!loading && rows.length === 0">
              <tr><td colspan="7" class="text-center py-8 text-gray-400">ยังไม่มีรายการ SO/PI</td></tr>
            </template>
            <template x-for="row in rows" :key="row.id">
              <tr class="border-b border-gray-100 hover:bg-gray-50 align-top">
                <td class="px-3 py-2">
                  <span class="badge" :class="row.doc_type === 'SO' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'" x-text="row.doc_type"></span>
                </td>
                <td class="px-3 py-2 font-semibold" x-text="row.doc_no"></td>
                <td class="px-3 py-2 whitespace-nowrap" x-text="fmtDate(row.doc_date)"></td>
                <td class="px-3 py-2" x-text="row.customers?.customer_name || '-'"></td>
                <td class="px-3 py-2 max-w-[220px] truncate" :title="productNames(row)" x-text="productNames(row)"></td>
                <td class="px-3 py-2 text-right" x-text="totalQty(row).toLocaleString()"></td>
                <td class="px-3 py-2">
                  <div class="flex flex-wrap gap-1.5 justify-center">
                    <button class="btn btn-sm" :class="hasPlan(row.id) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'btn-secondary'"
                            @click="openPlan(row)" title="แผนการผลิต">
                      <i class="fa-solid fa-calendar-days"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="openPlaceholder()" title="จัดเตรียม">
                      <i class="fa-solid fa-boxes-packing"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="openPlaceholder()" title="ผลิต/คลัง">
                      <i class="fa-solid fa-industry"></i>
                    </button>
                    <button class="btn btn-sm" :class="hasDelivery(row.id) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'btn-secondary'"
                            @click="openDelivery(row)" title="ส่งมอบ">
                      <i class="fa-solid fa-truck-fast"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" @click="openAccounting(row)" title="บัญชี">
                      <i class="fa-solid fa-sack-dollar"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Shared quick-action modal -->
    <div class="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50" x-show="modalOpen" x-cloak
         @click.self="closeModal()" @keydown.escape.window="closeModal()">
      <div class="modal-panel w-full max-w-md">
        <form @submit.prevent="save()">
          <div class="flex items-center justify-between px-5 py-4 border-b">
            <h3 class="font-bold text-gray-800" x-text="modalTitle"></h3>
            <button type="button" class="text-gray-400 hover:text-gray-700" @click="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
          <div class="px-5 py-4 space-y-4">
            <template x-if="modalType === 'plan'">
              <div class="space-y-4">
                <div><label class="form-label">หมายเลขแผนผลิต</label><input type="text" x-model="form.plan_no" required class="form-control" data-no-flatpickr></div>
                <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.plan_date" required class="form-control"></div>
                <div><label class="form-label">จำนวน</label><input type="number" min="0" x-model.number="form.qty" class="form-control"></div>
                <div><label class="form-label">วันที่คาดว่าจะโหลด</label><input type="date" x-model="form.expected_load_date" class="form-control"></div>
              </div>
            </template>
            <template x-if="modalType === 'delivery'">
              <div class="space-y-4">
                <div><label class="form-label">Bill of Load Date</label><input type="date" x-model="form.bill_of_load_date" required class="form-control"></div>
                <div><label class="form-label">IV No.</label><input type="text" x-model="form.iv_no" required class="form-control" data-no-flatpickr></div>
              </div>
            </template>
            <template x-if="modalType === 'accounting'">
              <div class="space-y-4">
                <div><label class="form-label">วันที่กำหนดชำระ</label><input type="date" x-model="form.due_date" required class="form-control"></div>
                <div><label class="form-label">ยอดเงิน</label><input type="number" step="0.01" min="0" x-model.number="form.amount" class="form-control"></div>
              </div>
            </template>
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
