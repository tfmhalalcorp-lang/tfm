// หน้าจัดการรวม (Order Hub) — one table of every SO/PI with quick-action
// buttons into each downstream stage. Unlike the other views, this one is
// bespoke rather than crud-factory/txn-factory-based: each action button
// opens the SAME modal shell scoped to a different table (production_plans /
// booking_confirmations / carton_label_preps / delivery_orders / deliveries /
// accounting_entries) depending on which button was clicked.
import { registerView } from '../router.js';
import { supabase, callFunction } from '../lib/supabaseClient.js';
import { alertError, toastSuccess, confirmDelete, formatDate, getLocalDate, syncPickers } from '../lib/ui-helpers.js';
import { exportElementToPdf } from '../lib/export-helpers.js';

// Fixed bank details printed on every Commercial Invoice's TERMS OF
// PAYMENT box — same account on every invoice, confirmed with the user.
const BANK_ACCOUNT_NAME = 'THAVEECHAI FOOD MANUFACTURING CO.,LTD.';
const BANK_ACCOUNT_NO = '4203042215';
const BANK_NAME = 'BANGKOK BANK PUBLIC CO.,LTD.';
const BANK_SWIFT_NO = 'BKKBTHBK';

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function threeDigitsToWords(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' HUNDRED ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) str += ONES[n] + ' ';
  return str.trim();
}

function integerToWords(num) {
  num = Math.round(num);
  if (num === 0) return 'ZERO';
  const groups = ['', ' THOUSAND', ' MILLION', ' BILLION'];
  let str = '';
  let groupIdx = 0;
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk) str = threeDigitsToWords(chunk) + groups[groupIdx] + ' ' + str;
    num = Math.floor(num / 1000);
    groupIdx++;
  }
  return str.trim();
}

function qtyToWords(qty) {
  return integerToWords(qty) + ' CARTONS ONLY';
}

function keyBySoPi(list) {
  const map = {};
  (list || []).forEach((row) => (map[row.so_pi_id] = row));
  return map;
}

/** FileReader wrapped in a promise, base64 payload only (strips the data: URL prefix). */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function component() {
  return {
    loading: false,
    rows: [],
    plansBySoPi: {},
    bookingsBySoPi: {},
    cartonLabelsBySoPi: {},
    doBySoPi: {},
    deliveriesBySoPi: {},
    doView: 'list', // 'list' | 'form' — a SO/PI can have multiple DOs, so the 'do' modal is a mini list+form
    doList: [],
    loadingDoList: false,
    planView: 'list', // 'list' | 'form' — a SO/PI can have multiple production plans too
    planList: [],
    loadingPlanList: false,

    modalOpen: false,
    modalType: '', // 'plan' | 'booking' | 'cartonLabel' | 'do' | 'delivery' | 'accounting'
    modalTitle: '',
    saving: false,
    uploadingBl: false,
    form: {},
    currentSoPi: null,
    currentDelivery: null,
    fmtDate: formatDate,
    invoicePreviewOpen: false,
    invoiceData: null,
    bankAccountName: BANK_ACCOUNT_NAME,
    bankAccountNo: BANK_ACCOUNT_NO,
    bankName: BANK_NAME,
    bankSwiftNo: BANK_SWIFT_NO,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      try {
        const [
          { data: soPi, error: e1 },
          { data: plans, error: e2 },
          { data: bookings, error: e3 },
          { data: cartonLabels, error: e4 },
          { data: dos, error: e5 },
          { data: deliveries, error: e6 },
        ] = await Promise.all([
          supabase.from('so_pi').select('*, customers!customer_id(customer_name), so_pi_items(product_id, qty, products(product_name))').order('doc_date', { ascending: false }),
          supabase.from('production_plans').select('*'),
          supabase.from('booking_confirmations').select('*'),
          supabase.from('carton_label_preps').select('*'),
          supabase.from('delivery_orders').select('*'),
          supabase.from('deliveries').select('*'),
        ]);
        if (e1) throw new Error(e1.message);
        if (e2) throw new Error(e2.message);
        if (e3) throw new Error(e3.message);
        if (e4) throw new Error(e4.message);
        if (e5) throw new Error(e5.message);
        if (e6) throw new Error(e6.message);
        this.rows = soPi || [];
        this.plansBySoPi = keyBySoPi(plans);
        this.bookingsBySoPi = keyBySoPi(bookings);
        this.cartonLabelsBySoPi = keyBySoPi(cartonLabels);
        this.doBySoPi = keyBySoPi(dos);
        this.deliveriesBySoPi = keyBySoPi(deliveries);
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    hasPlan(id) {
      return !!this.plansBySoPi[id];
    },
    hasBooking(id) {
      return !!this.bookingsBySoPi[id];
    },
    hasCartonLabel(id) {
      return !!this.cartonLabelsBySoPi[id];
    },
    hasDO(id) {
      return !!this.doBySoPi[id];
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

    async openPlan(row) {
      this.currentSoPi = row;
      this.modalType = 'plan';
      this.planView = 'list';
      this.modalTitle = 'แผนการผลิต — ' + row.doc_no;
      this.modalOpen = true;
      await this.loadPlanList();
    },

    async loadPlanList() {
      this.loadingPlanList = true;
      try {
        const { data, error } = await supabase
          .from('production_plans')
          .select('id, plan_no, plan_date, expected_load_date, production_plan_items(qty)')
          .eq('so_pi_id', this.currentSoPi.id)
          .order('plan_date', { ascending: false });
        if (error) throw new Error(error.message);
        this.planList = data || [];
      } catch (err) {
        alertError(err);
      } finally {
        this.loadingPlanList = false;
      }
    },

    async openPlanForm(existing) {
      let items = [{ product_id: '', qty: 0 }];
      if (existing) {
        const { data: itemRows, error } = await supabase
          .from('production_plan_items')
          .select('product_id, qty')
          .eq('plan_id', existing.id)
          .order('created_at');
        if (error) {
          alertError(error);
          return;
        }
        items = itemRows && itemRows.length ? itemRows.map((it) => ({ product_id: it.product_id || '', qty: it.qty ?? 0 })) : [{ product_id: '', qty: 0 }];
      }
      this.form = {
        id: existing ? existing.id : null,
        plan_no: existing?.plan_no || '',
        plan_date: existing?.plan_date || getLocalDate(),
        expected_load_date: existing?.expected_load_date || '',
        items,
      };
      this.planView = 'form';
      this.$nextTick(() => syncPickers(this.$root));
    },

    backToPlanList() {
      this.planView = 'list';
    },

    async deletePlan(planRecord) {
      const ok = await confirmDelete();
      if (!ok) return;
      try {
        const { error } = await supabase.from('production_plans').delete().eq('id', planRecord.id);
        if (error) throw new Error(error.message);
        await this.loadPlanList();
        await this.load();
        toastSuccess('ลบแผนการผลิตสำเร็จ');
      } catch (err) {
        alertError(err);
      }
    },

    addPlanItemRow() {
      this.form.items.push({ product_id: '', qty: 0 });
    },
    removePlanItemRow(idx) {
      if (this.form.items.length <= 1) return;
      this.form.items.splice(idx, 1);
    },

    async savePlan() {
      if (!this.form.plan_no || !this.form.plan_date) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอกหมายเลขแผนผลิตและวันที่ผลิต' });
        return;
      }
      const validItems = this.form.items.filter((it) => it.product_id);
      if (validItems.length === 0) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' });
        return;
      }
      this.saving = true;
      try {
        const totalQty = validItems.reduce((s, it) => s + Number(it.qty || 0), 0);
        const headerPayload = {
          plan_no: this.form.plan_no.trim(),
          so_pi_id: this.currentSoPi.id,
          plan_date: this.form.plan_date,
          product_id: null,
          qty: totalQty,
          expected_load_date: this.form.expected_load_date || null,
        };
        let planId = this.form.id;
        if (planId) {
          const { error: updErr } = await supabase.from('production_plans').update(headerPayload).eq('id', planId);
          if (updErr) throw new Error(updErr.message);
          const { error: delErr } = await supabase.from('production_plan_items').delete().eq('plan_id', planId);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { data, error } = await supabase.from('production_plans').insert(headerPayload).select('id').single();
          if (error) throw new Error(error.message);
          planId = data.id;
        }
        const { error: insErr } = await supabase
          .from('production_plan_items')
          .insert(validItems.map((it) => ({ plan_id: planId, product_id: it.product_id, qty: Number(it.qty || 0) })));
        if (insErr) throw new Error(insErr.message);
        await this.loadPlanList();
        await this.load();
        this.planView = 'list';
        toastSuccess('บันทึกแผนการผลิตสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    openBooking(row) {
      this.currentSoPi = row;
      const existing = this.bookingsBySoPi[row.id];
      this.form = existing
        ? {
            id: existing.id,
            agent: row.agent || '',
            loading_date: existing.loading_date || '',
            etd_on_board: existing.etd_on_board || '',
          }
        : { id: null, agent: row.agent || '', loading_date: '', etd_on_board: '' };
      this.modalType = 'booking';
      this.modalTitle = 'Status Booking — ' + row.doc_no;
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    bookingStatus() {
      const agent = (this.form.agent || '').trim();
      if (!agent) return { label: '-', cls: 'bg-gray-100 text-gray-500' };
      return this.form.etd_on_board ? { label: 'BOOKING CONFIRM', cls: 'bg-green-100 text-green-700' } : { label: 'PENDING', cls: 'bg-amber-100 text-amber-700' };
    },

    async saveBooking() {
      this.saving = true;
      try {
        const payload = {
          so_pi_id: this.currentSoPi.id,
          loading_date: this.form.loading_date || null,
          etd_on_board: this.form.etd_on_board || null,
        };
        const { error } = this.form.id
          ? await supabase.from('booking_confirmations').update(payload).eq('id', this.form.id)
          : await supabase.from('booking_confirmations').insert(payload);
        if (error) throw new Error(error.message);
        const { error: agentErr } = await supabase.from('so_pi').update({ agent: this.form.agent || null }).eq('id', this.currentSoPi.id);
        if (agentErr) throw new Error(agentErr.message);
        this.modalOpen = false;
        await this.load();
        toastSuccess('บันทึก Status Booking สำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    openCartonLabel(row) {
      this.currentSoPi = row;
      const existing = this.cartonLabelsBySoPi[row.id];
      this.form = existing
        ? {
            id: existing.id,
            carton_ready: !!existing.carton_ready,
            carton_not_used: !!existing.carton_not_used,
            cover_ready: !!existing.cover_ready,
            cover_not_used: !!existing.cover_not_used,
            base_paper_ready: !!existing.base_paper_ready,
            base_paper_not_used: !!existing.base_paper_not_used,
            label_ready: !!existing.label_ready,
            label_not_used: !!existing.label_not_used,
          }
        : {
            id: null,
            carton_ready: false,
            carton_not_used: false,
            cover_ready: false,
            cover_not_used: false,
            base_paper_ready: false,
            base_paper_not_used: false,
            label_ready: false,
            label_not_used: false,
          };
      this.modalType = 'cartonLabel';
      this.modalTitle = 'จัดเตรียม Packaging — ' + row.doc_no;
      this.modalOpen = true;
    },

    async saveCartonLabel() {
      const conflicts = [
        ['carton_ready', 'carton_not_used', 'Carton'],
        ['cover_ready', 'cover_not_used', 'Cover'],
        ['base_paper_ready', 'base_paper_not_used', 'Base paper'],
        ['label_ready', 'label_not_used', 'Label'],
      ].filter(([readyKey, notUsedKey]) => this.form[readyKey] && this.form[notUsedKey]);
      if (conflicts.length) {
        window.Swal?.fire({
          icon: 'warning',
          title: 'กรุณาตรวจสอบข้อมูล',
          text: `ติ๊กทั้ง "พร้อม" และ "ไม่ใช้" พร้อมกันไม่ได้: ${conflicts.map((c) => c[2]).join(', ')}`,
        });
        return;
      }
      this.saving = true;
      try {
        const payload = {
          so_pi_id: this.currentSoPi.id,
          carton_ready: !!this.form.carton_ready,
          carton_not_used: !!this.form.carton_not_used,
          cover_ready: !!this.form.cover_ready,
          cover_not_used: !!this.form.cover_not_used,
          base_paper_ready: !!this.form.base_paper_ready,
          base_paper_not_used: !!this.form.base_paper_not_used,
          label_ready: !!this.form.label_ready,
          label_not_used: !!this.form.label_not_used,
        };
        const { error } = this.form.id
          ? await supabase.from('carton_label_preps').update(payload).eq('id', this.form.id)
          : await supabase.from('carton_label_preps').insert(payload);
        if (error) throw new Error(error.message);
        this.modalOpen = false;
        await this.load();
        toastSuccess('บันทึกข้อมูล Packaging สำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    get soProductOptions() {
      const map = {};
      (this.currentSoPi?.so_pi_items || []).forEach((it) => {
        if (it.product_id) map[it.product_id] = it.products?.product_name || '(ไม่ระบุชื่อ)';
      });
      return Object.entries(map).map(([id, name]) => ({ id, name }));
    },

    async openDO(row) {
      this.currentSoPi = row;
      this.modalType = 'do';
      this.doView = 'list';
      this.modalTitle = 'ใบสั่งปล่อยสินค้า (DO) — ' + row.doc_no;
      this.modalOpen = true;
      await this.loadDOList();
    },

    async loadDOList() {
      this.loadingDoList = true;
      try {
        const { data, error } = await supabase
          .from('delivery_orders')
          .select('id, do_no, do_date, delivery_order_containers(container_no)')
          .eq('so_pi_id', this.currentSoPi.id)
          .order('do_date', { ascending: false });
        if (error) throw new Error(error.message);
        this.doList = data || [];
      } catch (err) {
        alertError(err);
      } finally {
        this.loadingDoList = false;
      }
    },

    async openDOForm(existing) {
      let containers = [''];
      let items = [{ product_id: '', qty: 0 }];
      if (existing) {
        const [{ data: containerRows, error: cErr }, { data: itemRows, error: iErr }] = await Promise.all([
          supabase.from('delivery_order_containers').select('container_no').eq('delivery_order_id', existing.id).order('created_at'),
          supabase.from('delivery_order_items').select('product_id, qty').eq('delivery_order_id', existing.id).order('created_at'),
        ]);
        if (cErr) {
          alertError(cErr);
          return;
        }
        if (iErr) {
          alertError(iErr);
          return;
        }
        containers = containerRows && containerRows.length ? containerRows.map((c) => c.container_no) : [''];
        items = itemRows && itemRows.length ? itemRows.map((it) => ({ product_id: it.product_id || '', qty: it.qty ?? 0 })) : [{ product_id: '', qty: 0 }];
      }
      this.form = {
        id: existing ? existing.id : null,
        do_no: existing?.do_no || '',
        do_date: existing?.do_date || getLocalDate(),
        containers,
        items,
      };
      this.doView = 'form';
      this.$nextTick(() => syncPickers(this.$root));
    },

    backToDoList() {
      this.doView = 'list';
    },

    async deleteDO(doRecord) {
      const ok = await confirmDelete();
      if (!ok) return;
      try {
        const { error } = await supabase.from('delivery_orders').delete().eq('id', doRecord.id);
        if (error) throw new Error(error.message);
        await this.loadDOList();
        await this.load();
        toastSuccess('ลบข้อมูล DO สำเร็จ');
      } catch (err) {
        alertError(err);
      }
    },

    addContainerRow() {
      this.form.containers.push('');
    },
    removeContainerRow(idx) {
      if (this.form.containers.length <= 1) return;
      this.form.containers.splice(idx, 1);
    },

    addDoItemRow() {
      this.form.items.push({ product_id: '', qty: 0 });
    },
    removeDoItemRow(idx) {
      if (this.form.items.length <= 1) return;
      this.form.items.splice(idx, 1);
    },

    async saveDO() {
      if (!this.form.do_no || !this.form.do_date) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอก DO No. และ DO Date' });
        return;
      }
      const containerNos = this.form.containers.map((c) => (c || '').trim()).filter(Boolean);
      if (containerNos.length === 0) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอกหมายเลขตู้อย่างน้อย 1 ตู้' });
        return;
      }
      const validItems = this.form.items.filter((it) => it.product_id);
      if (validItems.length === 0) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ' });
        return;
      }
      this.saving = true;
      try {
        const headerPayload = { so_pi_id: this.currentSoPi.id, do_no: this.form.do_no.trim(), do_date: this.form.do_date };
        let doId = this.form.id;
        if (doId) {
          const { error: updErr } = await supabase.from('delivery_orders').update(headerPayload).eq('id', doId);
          if (updErr) throw new Error(updErr.message);
          const { error: delContErr } = await supabase.from('delivery_order_containers').delete().eq('delivery_order_id', doId);
          if (delContErr) throw new Error(delContErr.message);
          const { error: delItemErr } = await supabase.from('delivery_order_items').delete().eq('delivery_order_id', doId);
          if (delItemErr) throw new Error(delItemErr.message);
        } else {
          const { data, error } = await supabase.from('delivery_orders').insert(headerPayload).select('id').single();
          if (error) throw new Error(error.message);
          doId = data.id;
        }
        const { error: insContErr } = await supabase
          .from('delivery_order_containers')
          .insert(containerNos.map((container_no) => ({ delivery_order_id: doId, container_no })));
        if (insContErr) throw new Error(insContErr.message);
        const { error: insItemErr } = await supabase
          .from('delivery_order_items')
          .insert(validItems.map((it) => ({ delivery_order_id: doId, product_id: it.product_id, qty: Number(it.qty || 0) })));
        if (insItemErr) throw new Error(insItemErr.message);
        await this.loadDOList();
        await this.load();
        this.doView = 'list';
        toastSuccess('บันทึกข้อมูล DO สำเร็จ');
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
        ? {
            id: existing.id,
            invoice_no: existing.invoice_no,
            invoice_date: existing.invoice_date || '',
            etd: existing.etd || '',
            eta: existing.eta || '',
            bl_drive_file_id: existing.bl_drive_file_id || null,
            bl_drive_view_url: existing.bl_drive_view_url || null,
            terms_of_payment_text: existing.terms_of_payment_text || '',
            total_amount_words: existing.total_amount_words || '',
            merchandise_text: existing.merchandise_text || '',
          }
        : {
            id: null,
            invoice_no: '',
            invoice_date: '',
            etd: '',
            eta: '',
            bl_drive_file_id: null,
            bl_drive_view_url: null,
            terms_of_payment_text: '',
            total_amount_words: '',
            merchandise_text: '',
          };
      this.modalType = 'delivery';
      this.modalTitle = 'บันทึกการส่งมอบ — ' + row.doc_no;
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    async saveDelivery() {
      if (!this.form.invoice_no) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: 'กรุณากรอก Invoice No.' });
        return;
      }
      this.saving = true;
      try {
        const payload = {
          so_pi_id: this.currentSoPi.id,
          invoice_no: this.form.invoice_no.trim(),
          invoice_date: this.form.invoice_date || null,
          etd: this.form.etd || null,
          eta: this.form.eta || null,
          terms_of_payment_text: this.form.terms_of_payment_text || null,
          total_amount_words: this.form.total_amount_words || null,
          merchandise_text: this.form.merchandise_text || null,
        };
        const { error } = this.form.id
          ? await supabase.from('deliveries').update(payload).eq('id', this.form.id)
          : await supabase.from('deliveries').insert(payload);
        if (error) throw new Error(error.message);
        this.modalOpen = false;
        await this.load();
        toastSuccess('บันทึกการส่งมอบสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    async uploadBlFile(event) {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      if (!this.form.id) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาบันทึกข้อมูลก่อน', text: 'กรุณาบันทึก Invoice No. ก่อนอัพโหลดไฟล์ BL' });
        return;
      }
      this.uploadingBl = true;
      try {
        const dataBase64 = await fileToBase64(file);
        const result = await callFunction('drive-upload', { action: 'upload', filename: file.name, mimeType: file.type, dataBase64 });
        const oldFileId = this.form.bl_drive_file_id;
        const { error: updErr } = await supabase
          .from('deliveries')
          .update({ bl_drive_file_id: result.id, bl_drive_view_url: result.viewUrl })
          .eq('id', this.form.id);
        if (updErr) throw new Error(updErr.message);
        if (oldFileId) await callFunction('drive-upload', { action: 'delete', fileId: oldFileId }).catch(() => {});
        this.form.bl_drive_file_id = result.id;
        this.form.bl_drive_view_url = result.viewUrl;
        this.deliveriesBySoPi[this.currentSoPi.id] = {
          ...this.deliveriesBySoPi[this.currentSoPi.id],
          bl_drive_file_id: result.id,
          bl_drive_view_url: result.viewUrl,
        };
        toastSuccess('อัพโหลดไฟล์ BL ขึ้น Google Drive สำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.uploadingBl = false;
      }
    },

    viewBlFile() {
      if (!this.form.bl_drive_view_url) return;
      window.open(this.form.bl_drive_view_url, '_blank');
    },

    async removeBlFile() {
      if (!this.form.bl_drive_file_id) return;
      const ok = await confirmDelete();
      if (!ok) return;
      try {
        await callFunction('drive-upload', { action: 'delete', fileId: this.form.bl_drive_file_id });
        const { error: updErr } = await supabase
          .from('deliveries')
          .update({ bl_drive_file_id: null, bl_drive_view_url: null })
          .eq('id', this.form.id);
        if (updErr) throw new Error(updErr.message);
        this.form.bl_drive_file_id = null;
        this.form.bl_drive_view_url = null;
        this.deliveriesBySoPi[this.currentSoPi.id] = {
          ...this.deliveriesBySoPi[this.currentSoPi.id],
          bl_drive_file_id: null,
          bl_drive_view_url: null,
        };
        toastSuccess('ลบไฟล์ BL สำเร็จ');
      } catch (err) {
        alertError(err);
      }
    },

    async openInvoicePrint() {
      if (!this.form.id) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาบันทึกข้อมูลก่อน', text: 'กรุณาบันทึก Invoice No. ก่อนพิมพ์ Invoice' });
        return;
      }
      try {
        const so = this.currentSoPi;
        const partyIds = [so.consignee_id, so.buyer_id, so.notify_party_id].filter(Boolean);
        const [{ data: items, error: itemsErr }, { data: parties, error: partyErr }, { data: doRows, error: doErr }] = await Promise.all([
          supabase.from('so_pi_items').select('qty, unit_price, brands(brand_name)').eq('so_pi_id', so.id),
          partyIds.length
            ? supabase.from('customers').select('id, business_name, address').in('id', partyIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('delivery_orders').select('id, delivery_order_containers(container_no)').eq('so_pi_id', so.id),
        ]);
        if (itemsErr) throw new Error(itemsErr.message);
        if (partyErr) throw new Error(partyErr.message);
        if (doErr) throw new Error(doErr.message);

        const partyById = {};
        (parties || []).forEach((p) => (partyById[p.id] = p));
        const containers = (doRows || []).flatMap((d) => (d.delivery_order_containers || []).map((c) => c.container_no));
        const shippingMarks = [...new Set((items || []).map((it) => it.brands?.brand_name).filter(Boolean))].join(', ');

        const lineItems = (items || []).map((it) => ({
          qty: Number(it.qty || 0),
          unitPrice: Number(it.unit_price || 0),
          amount: Number(it.qty || 0) * Number(it.unit_price || 0),
        }));
        const totalQty = lineItems.reduce((s, it) => s + it.qty, 0);
        const subtotal = lineItems.reduce((s, it) => s + it.amount, 0);
        const discount = Number(so.discount || 0);
        const vatPercent = Number(so.vat_percent || 0);
        const afterDiscount = subtotal - discount;
        const netTotal = afterDiscount + afterDiscount * (vatPercent / 100);

        this.invoiceData = {
          consignee: partyById[so.consignee_id] || null,
          buyer: partyById[so.buyer_id] || null,
          notifyParty: partyById[so.notify_party_id] || null,
          invoiceNo: this.form.invoice_no,
          invoiceDate: this.form.invoice_date,
          etd: this.form.etd,
          portOfDischarge: so.destination || '',
          portOfLoading: so.port ? `${so.port}, THAILAND` : '',
          fobNote: [so.incoterm, so.port].filter(Boolean).join(' '),
          shippingMarks,
          paymentTermsText: this.form.terms_of_payment_text || '',
          merchandiseText: this.form.merchandise_text || '',
          containers,
          lineItems,
          totalQty,
          netTotal,
          qtyWords: qtyToWords(totalQty),
          amountWords: this.form.total_amount_words || '',
        };
        this.invoicePreviewOpen = true;
      } catch (err) {
        alertError(err);
      }
    },

    closeInvoicePreview() {
      this.invoicePreviewOpen = false;
    },

    fmt2(n) {
      return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fmtQty(n) {
      return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
    },

    printInvoice() {
      const printable = document.getElementById('invoicePrintable');
      if (!printable) return;
      const win = window.open('', '_blank', 'width=900,height=1000');
      if (!win) return;
      win.document.write(`<!doctype html><html><head><title>Invoice ${this.invoiceData?.invoiceNo || ''}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #000; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #000; padding: 6px 8px; font-size: 11px; vertical-align: top; }
          .font-semibold { font-weight: 600; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .mt-2 { margin-top: 8px; }
          .mb-3 { margin-bottom: 12px; }
          .whitespace-pre-line { white-space: pre-line; }
          .font-normal { font-weight: 400; }
          h2 { text-align: center; letter-spacing: 1px; }
        </style></head><body>${printable.outerHTML}</body></html>`);
      win.document.close();
      win.focus();
      win.onload = () => win.print();
    },

    exportInvoicePdf() {
      exportElementToPdf('invoicePrintable', `Invoice_${this.invoiceData?.invoiceNo || ''}.pdf`);
    },

    async openAccounting(row) {
      const delivery = this.deliveriesBySoPi[row.id];
      if (!delivery) {
        window.Swal?.fire({
          icon: 'info',
          title: 'ยังไม่มีข้อมูลการส่งมอบ',
          text: 'กรุณาบันทึกการส่งมอบ (Invoice No.) ก่อนบันทึกข้อมูลบัญชีสำหรับ SO/PI นี้',
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
      this.modalTitle = 'ส่วนงานบัญชี — IV ' + delivery.invoice_no;
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
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
      if (this.modalType === 'booking') return this.saveBooking();
      if (this.modalType === 'cartonLabel') return this.saveCartonLabel();
      if (this.modalType === 'do') return this.saveDO();
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
                    <button class="btn btn-sm" :class="hasCartonLabel(row.id) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'btn-secondary'"
                            @click="openCartonLabel(row)" title="จัดเตรียม Packaging">
                      <i class="fa-solid fa-tags"></i>
                    </button>
                    <button class="btn btn-sm" :class="hasBooking(row.id) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'btn-secondary'"
                            @click="openBooking(row)" title="Status Booking">
                      <i class="fa-solid fa-clipboard-check"></i>
                    </button>
                    <button class="btn btn-sm" :class="hasDO(row.id) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'btn-secondary'"
                            @click="openDO(row)" title="DO">
                      <i class="fa-solid fa-dolly"></i>
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
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-gray-50 rounded-md p-2 border border-gray-200"
                 x-show="modalType !== 'plan'">
              <div><span class="text-gray-500">SO/PI:</span> <span class="font-semibold" x-text="currentSoPi?.doc_no"></span></div>
              <div><span class="text-gray-500">วันที่:</span> <span x-text="fmtDate(currentSoPi?.doc_date)"></span></div>
              <div><span class="text-gray-500">ลูกค้า:</span> <span x-text="currentSoPi?.customers?.customer_name || '-'"></span></div>
            </div>

            <template x-if="modalType === 'plan' && planView === 'list'">
              <div class="space-y-3">
                <div class="flex justify-end">
                  <button type="button" class="btn btn-primary btn-sm" @click="openPlanForm(null)"><i class="fa-solid fa-plus"></i> สร้างแผนผลิตใหม่</button>
                </div>
                <template x-if="loadingPlanList">
                  <p class="text-center text-gray-400 py-6"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</p>
                </template>
                <template x-if="!loadingPlanList && planList.length === 0">
                  <p class="text-center text-gray-400 py-6">ยังไม่มีแผนการผลิตสำหรับ SO/PI นี้</p>
                </template>
                <div class="overflow-x-auto" x-show="!loadingPlanList && planList.length">
                  <table class="w-full text-xs border-collapse">
                    <thead>
                      <tr class="bg-gray-50 text-gray-600 text-left">
                        <th class="p-2">เลขที่แผนผลิต</th><th class="p-2">วันที่ผลิต</th><th class="p-2">วันที่คาดว่าจะโหลด</th><th class="p-2 text-right">จำนวนรวม</th><th class="p-2 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template x-for="p in planList" :key="p.id">
                        <tr class="border-b border-gray-100">
                          <td class="p-2 font-semibold" x-text="p.plan_no || '-'"></td>
                          <td class="p-2 whitespace-nowrap" x-text="fmtDate(p.plan_date)"></td>
                          <td class="p-2 whitespace-nowrap" x-text="p.expected_load_date ? fmtDate(p.expected_load_date) : '-'"></td>
                          <td class="p-2 text-right" x-text="(p.production_plan_items || []).reduce((s, it) => s + Number(it.qty || 0), 0).toLocaleString()"></td>
                          <td class="p-2 text-center whitespace-nowrap">
                            <button type="button" class="text-secondary px-1.5" @click="openPlanForm(p)" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="text-danger px-1.5" @click="deletePlan(p)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'plan' && planView === 'form'">
              <div class="space-y-4">
                <button type="button" class="text-secondary text-sm" @click="backToPlanList()"><i class="fa-solid fa-arrow-left"></i> กลับไปรายการแผนผลิต</button>

                <div><label class="form-label">หมายเลขแผนผลิต</label><input type="text" x-model="form.plan_no" required class="form-control" data-no-flatpickr></div>
                <div><label class="form-label">วันที่ผลิต</label><input type="date" x-model="form.plan_date" required class="form-control"></div>
                <div><label class="form-label">วันที่คาดว่าจะโหลด</label><input type="date" x-model="form.expected_load_date" class="form-control"></div>

                <div class="pt-3 border-t">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-semibold text-gray-600">รายการสินค้า</h4>
                    <button type="button" class="btn btn-secondary btn-sm" @click="addPlanItemRow()"><i class="fa-solid fa-plus"></i> เพิ่มรายการ</button>
                  </div>
                  <div class="space-y-2">
                    <template x-for="(it, idx) in form.items" :key="idx">
                      <div class="flex gap-2">
                        <select x-model="it.product_id" class="form-control" data-no-tom>
                          <option value="">-- Description สินค้า --</option>
                          <template x-for="p in soProductOptions" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
                        </select>
                        <input type="number" min="0" x-model.number="it.qty" class="form-control w-28" placeholder="จำนวน">
                        <button type="button" class="text-danger px-2" @click="removePlanItemRow(idx)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'booking'">
              <div class="space-y-4">
                <div><label class="form-label">Agent</label><input type="text" x-model="form.agent" class="form-control" data-no-flatpickr></div>
                <div><label class="form-label">Loading Date (วันที่พร้อมโหลด)</label><input type="date" x-model="form.loading_date" class="form-control"></div>
                <div><label class="form-label">ETD ON BOOKED</label><input type="date" x-model="form.etd_on_board" class="form-control"></div>
                <div class="flex items-center gap-2 pt-1">
                  <span class="text-sm text-gray-500">สถานะ:</span>
                  <span class="badge" :class="bookingStatus().cls" x-text="bookingStatus().label"></span>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'cartonLabel'">
              <div class="space-y-3">
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" x-model="form.carton_ready" class="w-4 h-4"> <span>Carton พร้อม</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-gray-500">
                    <input type="checkbox" x-model="form.carton_not_used" class="w-4 h-4"> <span>ไม่ใช้</span>
                  </label>
                </div>
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" x-model="form.cover_ready" class="w-4 h-4"> <span>Cover พร้อม</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-gray-500">
                    <input type="checkbox" x-model="form.cover_not_used" class="w-4 h-4"> <span>ไม่ใช้</span>
                  </label>
                </div>
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" x-model="form.base_paper_ready" class="w-4 h-4"> <span>Base paper พร้อม</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-gray-500">
                    <input type="checkbox" x-model="form.base_paper_not_used" class="w-4 h-4"> <span>ไม่ใช้</span>
                  </label>
                </div>
                <div class="flex items-center gap-6">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" x-model="form.label_ready" class="w-4 h-4"> <span>Label พร้อม</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-gray-500">
                    <input type="checkbox" x-model="form.label_not_used" class="w-4 h-4"> <span>ไม่ใช้</span>
                  </label>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'do' && doView === 'list'">
              <div class="space-y-3">
                <div class="flex justify-end">
                  <button type="button" class="btn btn-primary btn-sm" @click="openDOForm(null)"><i class="fa-solid fa-plus"></i> สร้าง DO ใหม่</button>
                </div>
                <template x-if="loadingDoList">
                  <p class="text-center text-gray-400 py-6"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</p>
                </template>
                <template x-if="!loadingDoList && doList.length === 0">
                  <p class="text-center text-gray-400 py-6">ยังไม่มี DO สำหรับ SO/PI นี้</p>
                </template>
                <div class="overflow-x-auto" x-show="!loadingDoList && doList.length">
                  <table class="w-full text-xs border-collapse">
                    <thead>
                      <tr class="bg-gray-50 text-gray-600 text-left">
                        <th class="p-2">DO No.</th><th class="p-2">DO Date</th><th class="p-2">หมายเลขตู้</th><th class="p-2 text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template x-for="d in doList" :key="d.id">
                        <tr class="border-b border-gray-100">
                          <td class="p-2 font-semibold" x-text="d.do_no || '-'"></td>
                          <td class="p-2 whitespace-nowrap" x-text="fmtDate(d.do_date)"></td>
                          <td class="p-2" x-text="(d.delivery_order_containers || []).length + ' ตู้'"></td>
                          <td class="p-2 text-center whitespace-nowrap">
                            <button type="button" class="text-secondary px-1.5" @click="openDOForm(d)" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" class="text-danger px-1.5" @click="deleteDO(d)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'do' && doView === 'form'">
              <div class="space-y-4">
                <button type="button" class="text-secondary text-sm" @click="backToDoList()"><i class="fa-solid fa-arrow-left"></i> กลับไปรายการ DO</button>

                <div class="grid grid-cols-2 gap-4">
                  <div><label class="form-label">DO No.</label><input type="text" x-model="form.do_no" required class="form-control" data-no-flatpickr></div>
                  <div><label class="form-label">DO Date</label><input type="date" x-model="form.do_date" required class="form-control"></div>
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="form-label mb-0">หมายเลขตู้</label>
                    <button type="button" class="btn btn-secondary btn-sm" @click="addContainerRow()"><i class="fa-solid fa-plus"></i> เพิ่มตู้</button>
                  </div>
                  <div class="space-y-2">
                    <template x-for="(c, idx) in form.containers" :key="idx">
                      <div class="flex gap-2">
                        <input type="text" x-model="form.containers[idx]" class="form-control" placeholder="หมายเลขตู้" data-no-flatpickr>
                        <button type="button" class="text-danger px-2" @click="removeContainerRow(idx)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                      </div>
                    </template>
                  </div>
                </div>

                <div class="pt-3 border-t">
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-sm font-semibold text-gray-600">รายการสินค้า</h4>
                    <button type="button" class="btn btn-secondary btn-sm" @click="addDoItemRow()"><i class="fa-solid fa-plus"></i> เพิ่มรายการ</button>
                  </div>
                  <div class="space-y-2">
                    <template x-for="(it, idx) in form.items" :key="idx">
                      <div class="flex gap-2">
                        <select x-model="it.product_id" class="form-control" data-no-tom>
                          <option value="">-- Description สินค้า --</option>
                          <template x-for="p in soProductOptions" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
                        </select>
                        <input type="number" min="0" x-model.number="it.qty" class="form-control w-28" placeholder="จำนวน">
                        <button type="button" class="text-danger px-2" @click="removeDoItemRow(idx)" title="ลบ"><i class="fa-solid fa-trash"></i></button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'delivery'">
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="form-label">Invoice No.</label><input type="text" x-model="form.invoice_no" required class="form-control" data-no-flatpickr></div>
                  <div><label class="form-label">Invoice Date</label><input type="date" x-model="form.invoice_date" class="form-control"></div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="form-label">ETD ON BOARD</label><input type="date" x-model="form.etd" class="form-control"></div>
                  <div><label class="form-label">ETA</label><input type="date" x-model="form.eta" class="form-control"></div>
                </div>
                <div class="pt-2 border-t">
                  <label class="form-label mb-2">BL (ไฟล์ของลูกค้า)</label>
                  <div class="flex flex-wrap items-center gap-2">
                    <template x-if="form.bl_drive_view_url">
                      <button type="button" class="btn btn-secondary btn-sm" @click="viewBlFile()"><i class="fa-solid fa-eye"></i> เรียกดู BL</button>
                    </template>
                    <template x-if="form.bl_drive_view_url">
                      <button type="button" class="btn btn-secondary btn-sm text-danger" @click="removeBlFile()"><i class="fa-solid fa-trash"></i> ลบ BL</button>
                    </template>
                    <label class="btn btn-secondary btn-sm cursor-pointer" :class="uploadingBl ? 'opacity-50 pointer-events-none' : ''">
                      <i class="fa-solid fa-upload"></i>
                      <span x-text="uploadingBl ? 'กำลังอัพโหลด...' : (form.bl_drive_view_url ? 'เปลี่ยนไฟล์ BL' : 'อัพโหลด BL')"></span>
                      <input type="file" class="hidden" :disabled="!form.id || uploadingBl" @change="uploadBlFile($event)">
                    </label>
                  </div>
                  <p class="text-xs text-gray-400 mt-1.5" x-show="!form.id">กรุณาบันทึกข้อมูลก่อน จึงจะอัพโหลดไฟล์ BL ได้</p>
                </div>
                <div class="pt-2 border-t space-y-3">
                  <label class="form-label mb-0">รายละเอียดสำหรับพิมพ์ Invoice</label>
                  <div>
                    <label class="form-label text-xs">Terms of Payment (แสดงเหนือข้อมูลธนาคาร)</label>
                    <input type="text" x-model="form.terms_of_payment_text" placeholder="เช่น T/T 90 DAYS FROM ETD (DUE DATE ...)" class="form-control" data-no-flatpickr>
                  </div>
                  <div>
                    <label class="form-label text-xs">Total Amount in Words</label>
                    <input type="text" x-model="form.total_amount_words" class="form-control" data-no-flatpickr>
                  </div>
                  <div>
                    <label class="form-label text-xs">Merchandise</label>
                    <textarea x-model="form.merchandise_text" rows="3" class="form-control" data-no-flatpickr></textarea>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-secondary btn-sm" @click="openInvoicePrint()"><i class="fa-solid fa-file-invoice"></i> พิมพ์ Invoice</button>
                  <button type="button" class="btn btn-secondary btn-sm" @click="openPlaceholder()"><i class="fa-solid fa-boxes-packing"></i> ออกรายงาน Packing List</button>
                </div>
              </div>
            </template>

            <template x-if="modalType === 'accounting'">
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                  <div><label class="form-label">Invoice No.</label><div class="form-control bg-gray-50 text-gray-700" x-text="currentDelivery?.invoice_no || '-'"></div></div>
                  <div><label class="form-label">Invoice Date</label><div class="form-control bg-gray-50 text-gray-700" x-text="fmtDate(currentDelivery?.invoice_date)"></div></div>
                </div>
                <div><label class="form-label">วันที่กำหนดชำระ</label><input type="date" x-model="form.due_date" required class="form-control"></div>
                <div><label class="form-label">ยอดเงิน</label><input type="number" step="0.01" min="0" x-model.number="form.amount" class="form-control"></div>
              </div>
            </template>
          </div>
          <div class="flex justify-end gap-2 px-5 py-4 border-t bg-gray-50 rounded-b-xl">
            <button type="button" class="btn btn-secondary" @click="closeModal()"
                    x-text="(modalType === 'do' && doView === 'list') || (modalType === 'plan' && planView === 'list') ? 'ปิด' : 'ยกเลิก'"></button>
            <button type="submit" class="btn btn-primary" :disabled="saving"
                    x-show="!((modalType === 'do' && doView === 'list') || (modalType === 'plan' && planView === 'list'))">
              <i class="fa-solid fa-spinner fa-spin" x-show="saving" x-cloak></i>
              <span x-text="saving ? 'กำลังบันทึก...' : 'บันทึก'"></span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Invoice print preview -->
    <div class="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-black/50" x-show="invoicePreviewOpen" x-cloak
         @click.self="closeInvoicePreview()" @keydown.escape.window="closeInvoicePreview()">
      <div class="modal-panel w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b no-print">
          <h3 class="font-bold text-gray-800">Invoice — <span x-text="invoiceData?.invoiceNo"></span></h3>
          <div class="flex items-center gap-2">
            <button type="button" class="btn btn-secondary btn-sm" @click="exportInvoicePdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
            <button type="button" class="btn btn-secondary btn-sm" @click="printInvoice()"><i class="fa-solid fa-print"></i> พิมพ์</button>
            <button type="button" class="text-gray-400 hover:text-gray-700" @click="closeInvoicePreview()"><i class="fa-solid fa-xmark text-lg"></i></button>
          </div>
        </div>
        <div class="px-6 py-5 overflow-y-auto" x-show="invoiceData">
          <div id="invoicePrintable" class="bg-white text-black">
            <h2 class="text-center font-bold text-lg mb-3 tracking-wide">COMMERCIAL INVOICE</h2>
            <table class="w-full border-collapse border border-black text-[11px]">
              <tbody>
                <tr>
                  <td class="border border-black p-2 align-top w-1/3" rowspan="2">
                    <div class="font-semibold">CONSIGNEE</div>
                    <div x-text="invoiceData?.consignee?.business_name || ''"></div>
                    <div x-text="invoiceData?.consignee?.address || ''"></div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3">
                    <div class="font-semibold">INVOICE NO.</div>
                    <div x-text="invoiceData?.invoiceNo || ''"></div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3" rowspan="2">
                    <div class="font-semibold">DATE</div>
                    <div x-text="fmtDate(invoiceData?.invoiceDate)"></div>
                    <div class="font-semibold mt-2">ETD (SHIPPED ON BOARD)</div>
                    <div x-text="fmtDate(invoiceData?.etd)"></div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top">
                    <div class="font-semibold">BUYER (IF NOT CONSIGNEE)</div>
                    <div x-text="invoiceData?.buyer?.business_name || ''"></div>
                    <div x-text="invoiceData?.buyer?.address || ''"></div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top" rowspan="3">
                    <div class="font-semibold">NOTIFY PARTY</div>
                    <div x-text="invoiceData?.notifyParty?.business_name || ''"></div>
                    <div x-text="invoiceData?.notifyParty?.address || ''"></div>
                  </td>
                  <td class="border border-black p-2 align-top">
                    <div class="font-semibold">PLACE OF DELIVERY</div>
                  </td>
                  <td class="border border-black p-2 align-top">
                    <div class="font-semibold">PORT OF DISCHARGE</div>
                    <div x-text="invoiceData?.portOfDischarge || ''"></div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top" colspan="2">
                    <div class="font-semibold">PORT OF LOADING</div>
                    <div x-text="invoiceData?.portOfLoading || ''"></div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top" colspan="2">
                    <div class="font-semibold">VESSEL NAME &amp; VOYAGE NO.</div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table class="w-full border-collapse border-l border-r border-b border-black text-[11px]">
              <tr>
                <th class="border border-black p-1 align-top text-left" style="width:14%" :rowspan="(invoiceData?.lineItems?.length || 0) + 3">
                  <div class="font-semibold">SHIPPING MARKS</div>
                  <div class="font-normal whitespace-pre-line mt-1" x-text="invoiceData?.shippingMarks || ''"></div>
                </th>
                <th class="border border-black p-1 align-top text-left" style="width:28%" :rowspan="(invoiceData?.lineItems?.length || 0) + 3">
                  <div class="font-semibold">MERCHANDISE</div>
                  <div class="font-normal whitespace-pre-line mt-1" x-text="invoiceData?.merchandiseText || ''"></div>
                </th>
                <th class="border border-black p-1 font-semibold">QUANTITY<br>CARTONS</th>
                <th class="border border-black p-1 font-semibold">UNIT PRICE<br>USD</th>
                <th class="border border-black p-1 font-semibold">TOTAL AMOUNT<br>USD</th>
              </tr>
              <tr>
                <td class="border border-black p-1"></td>
                <td class="border border-black p-1"></td>
                <td class="border border-black p-1 text-center" x-text="invoiceData?.fobNote || ''"></td>
              </tr>
              <template x-for="(it, idx) in (invoiceData?.lineItems || [])" :key="idx">
                <tr>
                  <td class="border border-black p-1 text-center" x-text="fmtQty(it.qty)"></td>
                  <td class="border border-black p-1 text-center" x-text="fmt2(it.unitPrice)"></td>
                  <td class="border border-black p-1 text-center" x-text="fmt2(it.amount)"></td>
                </tr>
              </template>
              <tr>
                <td class="border border-black p-1 text-center font-semibold" x-text="fmtQty(invoiceData?.totalQty) + ' CARTONS'"></td>
                <td class="border border-black p-1"></td>
                <td class="border border-black p-1 text-center font-semibold" x-text="fmt2(invoiceData?.netTotal)"></td>
              </tr>
            </table>

            <table class="w-full border-collapse border-l border-r border-b border-black text-[11px]">
              <tbody>
                <tr>
                  <td class="border border-black p-2 align-top w-1/3">
                    <div class="font-semibold">GROSS WEIGHT</div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3">
                    <div class="font-semibold">NET WEIGHT</div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3" rowspan="2">
                    <div class="font-semibold">TERMS OF PAYMENT</div>
                    <div class="whitespace-pre-line" x-show="invoiceData?.paymentTermsText" x-text="invoiceData?.paymentTermsText"></div>
                    <div class="mt-2">ACCOUNT NAME: <span x-text="bankAccountName"></span></div>
                    <div>ACCOUNT NO. <span x-text="bankAccountNo"></span></div>
                    <div>BANK NAME: <span x-text="bankName"></span></div>
                    <div>SWIFT NO: <span x-text="bankSwiftNo"></span></div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top">
                    <div class="font-semibold">MEASUREMENT</div>
                  </td>
                  <td class="border border-black p-2 align-top">
                    <div class="font-semibold">CONTAINER NO. / SEAL NO.</div>
                    <div x-text="(invoiceData?.containers || []).join(', ')"></div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table class="w-full border-collapse border-l border-r border-b border-black text-[11px]">
              <tbody>
                <tr>
                  <td class="border border-black p-2 align-top w-1/3">
                    <div class="font-semibold">QUANTITY IN WORDS</div>
                    <div x-text="invoiceData?.qtyWords || ''"></div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3">
                    <div class="font-semibold">COUNTRY OF ORIGIN</div>
                    <div class="text-center mt-2">THAILAND</div>
                  </td>
                  <td class="border border-black p-2 align-top w-1/3" rowspan="2">
                    <div class="font-semibold">FOR AND ON BEHALF OF</div>
                  </td>
                </tr>
                <tr>
                  <td class="border border-black p-2 align-top" colspan="2">
                    <div class="font-semibold">TOTAL AMOUNT IN WORDS.</div>
                    <div>US DOLLARS : <span x-text="invoiceData?.amountWords || ''"></span></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>`;
});
