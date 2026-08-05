import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const STATUS_OPTIONS = ['ลูกค้า', 'CONSIGNEE', 'BUYER', 'NOTIFY PARTY'];

const resource = createCrudResource({
  table: 'customers',
  orderBy: 'customer_code',
  searchPredicate: (item, q) =>
    (item.customer_code || '').toLowerCase().includes(q) || (item.customer_name || '').toLowerCase().includes(q),
  emptyForm: () => ({
    id: null,
    customer_code: '',
    customer_name: '',
    business_name: '',
    address: '',
    phone: '',
    status: [],
  }),
  toForm: (item) => ({
    id: item.id,
    customer_code: item.customer_code,
    customer_name: item.customer_name,
    business_name: item.business_name || '',
    address: item.address || '',
    phone: item.phone || '',
    status: item.status || [],
  }),
  validate: (form) => (!form.customer_code || !form.customer_name ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({
    customer_code: form.customer_code.trim(),
    customer_name: form.customer_name.trim(),
    business_name: form.business_name.trim() || null,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    status: form.status,
  }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('customersCrud', resource);
});

registerView('settings-customer', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'customersCrud',
    title: 'จัดการข้อมูลลูกค้า',
    searchPlaceholder: 'ค้นหา รหัส หรือ ชื่อลูกค้า...',
    theadHtml: `<th class="px-3 py-2">รหัสลูกค้า</th><th class="px-3 py-2">ชื่อลูกค้า</th><th class="px-3 py-2">ชื่อกิจการ</th><th class="px-3 py-2">เบอร์โทร</th><th class="px-3 py-2">สถานะ</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.customer_code"></td>
      <td class="px-3 py-2" x-text="item.customer_name"></td>
      <td class="px-3 py-2" x-text="item.business_name || '-'"></td>
      <td class="px-3 py-2 whitespace-nowrap" x-text="item.phone || '-'"></td>
      <td class="px-3 py-2">
        <div class="flex flex-wrap gap-1">
          <template x-for="s in (item.status || [])" :key="s">
            <span class="badge bg-primary-light text-primary" x-text="s"></span>
          </template>
          <template x-if="!(item.status || []).length"><span class="text-gray-400">-</span></template>
        </div>
      </td>
    `,
    colCount: 6,
    modalTitleAdd: 'เพิ่มลูกค้า',
    modalTitleEdit: 'แก้ไขข้อมูลลูกค้า',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัสลูกค้า (Customer ID)</label>
        <template x-if="!isEdit"><input type="text" x-model="form.customer_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.customer_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อลูกค้า (Customer Name)</label>
        <input type="text" x-model="form.customer_name" required class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ชื่อกิจการ (Business Name)</label>
        <input type="text" x-model="form.business_name" class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ที่อยู่ (Address)</label>
        <textarea x-model="form.address" rows="2" class="form-control" data-no-flatpickr></textarea>
      </div>
      <div>
        <label class="form-label">เบอร์โทร (Phone)</label>
        <input type="text" x-model="form.phone" class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">สถานะ (เลือกได้มากกว่า 1)</label>
        <div class="flex flex-wrap gap-x-4 gap-y-2">
          <template x-for='opt in ${JSON.stringify(STATUS_OPTIONS)}' :key="opt">
            <label class="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
              <input type="checkbox" :value="opt" x-model="form.status">
              <span x-text="opt"></span>
            </label>
          </template>
        </div>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
