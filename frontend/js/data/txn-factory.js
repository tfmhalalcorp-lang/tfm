// Shared logic + markup factory for the 9 transaction entry/list screens
// (Batch Setup, RM Usage, Can Usage, Production Quantity, Fill Weight,
// Warehouse Stock In, Waste Log x3 depts, Maintenance/Breakdown).
// Structurally similar to js/data/crud-factory.js but with a date-range +
// text search bar (instead of a single search box) and support for
// view-specific lookup data (open batches, brands, suppliers, machines)
// via config.loadExtra().
import { supabase } from '../lib/supabaseClient.js';
import { alertError, toastSuccess, confirmDelete, formatDate, syncPickers } from '../lib/ui-helpers.js';

/**
 * @param {object} config
 * @param {string} config.table
 * @param {string} config.dateField        Column used for date-range filtering
 * @param {string} [config.idField]        Default 'id'
 * @param {string} [config.select]         Default '*'
 * @param {(item:object,q:string)=>boolean} [config.searchPredicate]
 * @param {()=>object} config.emptyForm
 * @param {(item:object)=>object} config.toForm
 * @param {(form:object, isEdit:boolean)=>string|null} [config.validate]
 * @param {(form:object)=>object} [config.toPayload]
 * @param {()=>Promise<object[]>} [config.fetchItems]
 * @param {(payload:object)=>Promise<any>} [config.createItem]
 * @param {(id:any,payload:object)=>Promise<any>} [config.updateItem]
 * @param {(id:any)=>Promise<any>} [config.deleteItem]
 * @param {()=>Promise<object>} [config.loadExtra]  Lookup data for dropdowns, exposed as `extra`
 */
export function createTxnResource(config) {
  const idField = config.idField || 'id';

  const defaultFetch = async () => {
    const { data, error } = await supabase
      .from(config.table)
      .select(config.select || '*')
      .order(config.dateField, { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  };
  const defaultCreate = async (payload) => {
    const { error } = await supabase.from(config.table).insert(payload);
    if (error) throw new Error(error.message);
  };
  const defaultUpdate = async (id, payload) => {
    const { error } = await supabase.from(config.table).update(payload).eq(idField, id);
    if (error) throw new Error(error.message);
  };
  const defaultDelete = async (id) => {
    const { error } = await supabase.from(config.table).delete().eq(idField, id);
    if (error) throw new Error(error.message);
  };

  return () => ({
    items: [],
    extra: {},
    loading: false,
    saving: false,
    searchStart: '',
    searchEnd: '',
    searchText: '',
    modalOpen: false,
    isEdit: false,
    form: {},
    fmtDate: formatDate,

    get filteredItems() {
      return this.items.filter((item) => {
        const d = String(item[config.dateField] || '').slice(0, 10);
        if (this.searchStart && d < this.searchStart) return false;
        if (this.searchEnd && d > this.searchEnd) return false;
        const q = this.searchText.trim().toLowerCase();
        if (q && config.searchPredicate && !config.searchPredicate(item, q)) return false;
        return true;
      });
    },

    async init() {
      await Promise.all([
        this.load(),
        (async () => {
          if (!config.loadExtra) return;
          try {
            this.extra = await config.loadExtra();
          } catch (err) {
            alertError(err);
          }
        })(),
      ]);
    },

    async load() {
      this.loading = true;
      try {
        this.items = await (config.fetchItems ? config.fetchItems() : defaultFetch());
      } catch (err) {
        alertError(err);
      } finally {
        this.loading = false;
      }
    },

    openCreate() {
      this.isEdit = false;
      this.form = config.emptyForm();
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    openEdit(item) {
      this.isEdit = true;
      this.form = config.toForm(item);
      this.modalOpen = true;
      this.$nextTick(() => syncPickers(this.$root));
    },

    closeModal() {
      this.modalOpen = false;
    },

    async save() {
      const errMsg = config.validate ? config.validate(this.form, this.isEdit) : null;
      if (errMsg) {
        window.Swal?.fire({ icon: 'warning', title: 'กรุณาตรวจสอบข้อมูล', text: errMsg });
        return;
      }
      this.saving = true;
      try {
        const payload = config.toPayload ? config.toPayload(this.form) : this.form;
        if (this.isEdit) {
          await (config.updateItem
            ? config.updateItem(this.form[idField], payload)
            : defaultUpdate(this.form[idField], payload));
        } else {
          await (config.createItem ? config.createItem(payload) : defaultCreate(payload));
        }
        this.modalOpen = false;
        await this.load();
        toastSuccess(this.isEdit ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
      } catch (err) {
        alertError(err);
      } finally {
        this.saving = false;
      }
    },

    async remove(item) {
      const ok = await confirmDelete();
      if (!ok) return;
      try {
        await (config.deleteItem ? config.deleteItem(item[idField]) : defaultDelete(item[idField]));
        await this.load();
        toastSuccess('ลบข้อมูลสำเร็จ');
      } catch (err) {
        alertError(err);
      }
    },
  });
}

export function txnListTemplate({
  dataExpr,
  title,
  theadHtml,
  rowHtml,
  modalTitleAdd,
  modalTitleEdit,
  modalFieldsHtml,
  modalWidthClass = 'max-w-lg',
  colCount = 5,
  // Order-management screens only: lock the toolbar to its desktop, single-row
  // shape (no wrap-to-multiple-lines on narrow viewports) and scroll it
  // horizontally instead. Every other screen leaves this off and keeps its
  // normal mobile-responsive toolbar.
  desktopOnly = false,
}) {
  return `
  <div x-data="${dataExpr}" x-init="init()">
    <div class="card">
      <div class="flex ${desktopOnly ? 'flex-nowrap overflow-x-auto' : 'flex-wrap'} items-end justify-between gap-3 mb-4">
        <h2 class="text-lg font-bold text-gray-800 shrink-0">${title}</h2>
        <div class="flex ${desktopOnly ? 'flex-nowrap' : 'flex-wrap'} gap-2 items-end shrink-0">
          <div>
            <label class="form-label">ตั้งแต่วันที่</label>
            <input type="date" x-model="searchStart" class="form-control w-[150px]">
          </div>
          <div>
            <label class="form-label">ถึงวันที่</label>
            <input type="date" x-model="searchEnd" class="form-control w-[150px]">
          </div>
          <input type="text" x-model="searchText" placeholder="ค้นหา..." data-no-flatpickr class="form-control w-[150px] self-end">
          <button class="btn btn-primary shrink-0 self-end" @click="openCreate()">
            <i class="fa-solid fa-plus"></i> <span class="${desktopOnly ? '' : 'hidden sm:inline'}">เพิ่มข้อมูล</span>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr class="bg-gray-50 text-gray-600 text-left">
              ${theadHtml}
              <th class="px-3 py-2 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            <template x-if="loading">
              <tr><td colspan="${colCount}" class="text-center py-8 text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด...</td></tr>
            </template>
            <template x-if="!loading && filteredItems.length === 0">
              <tr><td colspan="${colCount}" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
            </template>
            <template x-for="item in filteredItems" :key="item.id">
              <tr class="border-b border-gray-100 hover:bg-gray-50">
                ${rowHtml}
                <td class="px-3 py-2 text-center whitespace-nowrap">
                  <button class="text-secondary hover:text-blue-800 px-1.5" @click="openEdit(item)" title="แก้ไข">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="text-danger hover:text-red-800 px-1.5" @click="remove(item)" title="ลบ">
                    <i class="fa-solid fa-trash"></i>
                  </button>
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
      <div class="modal-panel w-full ${modalWidthClass}">
        <form @submit.prevent="save()">
          <div class="flex items-center justify-between px-5 py-4 border-b">
            <h3 class="font-bold text-gray-800" x-text="isEdit ? '${modalTitleEdit}' : '${modalTitleAdd}'"></h3>
            <button type="button" class="text-gray-400 hover:text-gray-700" @click="closeModal()">
              <i class="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>
          <div class="px-5 py-4 space-y-4">
            ${modalFieldsHtml}
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
}
