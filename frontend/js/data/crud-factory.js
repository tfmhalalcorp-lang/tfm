// Shared logic + markup factory for the 6 master-data CRUD screens
// (Customers, Brands, Suppliers, Can Sizes, Machines, Users). Each screen
// differs only in its columns/fields, so this module provides:
//   1. createCrudResource(config)  -> an Alpine.data() component definition
//   2. crudListTemplate(opts)      -> the shared search/table/modal markup
// Every view module (js/views/master-*.js) just supplies its own
// table/field specifics and imports these two functions.
import { supabase } from '../lib/supabaseClient.js';
import { alertError, toastSuccess, confirmDelete } from '../lib/ui-helpers.js';

/**
 * @param {object} config
 * @param {string} config.table          Supabase table name
 * @param {string} [config.idField]      Primary key column (default 'id')
 * @param {string} [config.select]       Select expression (default '*')
 * @param {string} [config.orderBy]      Column to order results by
 * @param {(item:object,q:string)=>boolean} config.searchPredicate
 * @param {()=>object} config.emptyForm  Blank form object for "Add"
 * @param {(item:object)=>object} config.toForm  Row -> form object for "Edit"
 * @param {(form:object, isEdit:boolean)=>string|null} [config.validate] Return an error message to block save, else null
 * @param {(form:object)=>object} [config.toPayload] form -> DB payload (defaults to the form itself)
 * @param {()=>Promise<object[]>} [config.fetchItems]  Override the default SELECT
 * @param {(payload:object)=>Promise<any>} [config.createItem]
 * @param {(id:any,payload:object)=>Promise<any>} [config.updateItem]
 * @param {(id:any)=>Promise<any>} [config.deleteItem]
 */
export function createCrudResource(config) {
  const idField = config.idField || 'id';

  const defaultFetch = async () => {
    let query = supabase.from(config.table).select(config.select || '*');
    if (config.orderBy) query = query.order(config.orderBy);
    const { data, error } = await query;
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
    loading: false,
    saving: false,
    search: '',
    modalOpen: false,
    isEdit: false,
    form: {},

    get filteredItems() {
      const q = this.search.trim().toLowerCase();
      if (!q) return this.items;
      return this.items.filter((item) => config.searchPredicate(item, q));
    },

    async init() {
      await this.load();
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
    },

    openEdit(item) {
      this.isEdit = true;
      this.form = config.toForm(item);
      this.modalOpen = true;
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
        toastSuccess(this.isEdit ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ');
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

/**
 * Shared search-bar + table + modal markup for a master-data CRUD screen.
 * `theadHtml`/`rowHtml` are raw HTML fragments (written with Alpine x-text
 * bindings by the caller, so they stay XSS-safe even though this function
 * assembles them via string concatenation) — a trailing "จัดการ" actions
 * column is appended automatically.
 */
export function crudListTemplate({
  dataComponent,
  title,
  searchPlaceholder,
  addLabel = 'เพิ่มข้อมูล',
  theadHtml,
  rowHtml,
  modalTitleAdd,
  modalTitleEdit,
  modalFieldsHtml,
  modalWidthClass = 'max-w-lg',
  hideDeleteExpr = 'false',
  colCount = 4,
}) {
  return `
  <div x-data="${dataComponent}" x-init="init()">
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 class="text-lg font-bold text-gray-800">${title}</h2>
        <div class="flex gap-2 w-full sm:w-auto">
          <input type="text" x-model="search" data-no-flatpickr placeholder="${searchPlaceholder}"
                 class="form-control sm:w-64">
          <button class="btn btn-primary shrink-0" @click="openCreate()">
            <i class="fa-solid fa-plus"></i> <span class="hidden sm:inline">${addLabel}</span>
          </button>
        </div>
      </div>

      <div class="overflow-x-auto -mx-1">
        <table class="w-full text-sm border-collapse min-w-[560px]">
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
                  <button class="text-danger hover:text-red-800 px-1.5" x-show="!(${hideDeleteExpr})" @click="remove(item)" title="ลบ">
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
