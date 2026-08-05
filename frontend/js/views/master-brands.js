import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';
import { supabase } from '../lib/supabaseClient.js';
import { alertError } from '../lib/ui-helpers.js';

const baseResource = createCrudResource({
  table: 'brands',
  select: '*, customers(customer_name)',
  orderBy: 'brand_code',
  searchPredicate: (item, q) =>
    (item.brand_code || '').toLowerCase().includes(q) ||
    (item.brand_name || '').toLowerCase().includes(q) ||
    (item.customers?.customer_name || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, brand_code: '', brand_name: '', customer_id: '' }),
  toForm: (item) => ({ id: item.id, brand_code: item.brand_code, brand_name: item.brand_name, customer_id: item.customer_id || '' }),
  validate: (form) => (!form.brand_code || !form.brand_name || !form.customer_id ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({
    brand_code: form.brand_code.trim(),
    brand_name: form.brand_name.trim(),
    customer_id: form.customer_id,
  }),
});

function brandsCrudComponent() {
  return {
    ...baseResource(),
    customerOptions: [],
    async init() {
      await Promise.all([
        this.load(),
        supabase
          .from('customers')
          .select('id, customer_name')
          .order('customer_name')
          .then(({ data }) => {
            this.customerOptions = data || [];
          })
          .catch((err) => alertError(err)),
      ]);
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('brandsCrud', brandsCrudComponent);
});

registerView('settings-brand', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'brandsCrud',
    title: 'จัดการข้อมูล Brand',
    searchPlaceholder: 'ค้นหา รหัส, ชื่อ Brand หรือ ลูกค้า...',
    theadHtml: `<th class="px-3 py-2">รหัส Brand</th><th class="px-3 py-2">ชื่อ Brand</th><th class="px-3 py-2">ลูกค้า</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.brand_code"></td>
      <td class="px-3 py-2" x-text="item.brand_name"></td>
      <td class="px-3 py-2" x-text="item.customers?.customer_name || item.customer_id || '-'"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่ม Brand',
    modalTitleEdit: 'แก้ไขข้อมูล Brand',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัส Brand</label>
        <template x-if="!isEdit"><input type="text" x-model="form.brand_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.brand_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อ Brand</label>
        <input type="text" x-model="form.brand_name" required class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ลูกค้า</label>
        <select x-model="form.customer_id" required class="form-control" data-no-tom>
          <option value="">-- เลือกลูกค้า --</option>
          <template x-for="c in customerOptions" :key="c.id">
            <option :value="c.id" x-text="c.customer_name"></option>
          </template>
        </select>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
