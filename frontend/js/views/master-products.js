import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const resource = createCrudResource({
  table: 'products',
  orderBy: 'product_code',
  searchPredicate: (item, q) =>
    (item.product_code || '').toLowerCase().includes(q) || (item.product_name || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, product_code: '', product_name: '' }),
  toForm: (item) => ({ id: item.id, product_code: item.product_code, product_name: item.product_name }),
  validate: (form) => (!form.product_code || !form.product_name ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({ product_code: form.product_code.trim(), product_name: form.product_name.trim() }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('productsCrud', resource);
});

registerView('settings-product', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'productsCrud',
    title: 'จัดการข้อมูลสินค้า (Products)',
    searchPlaceholder: 'ค้นหา รหัส หรือ ชื่อสินค้า...',
    theadHtml: `<th class="px-3 py-2">รหัสสินค้า</th><th class="px-3 py-2">ชื่อสินค้า</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.product_code"></td>
      <td class="px-3 py-2" x-text="item.product_name"></td>
    `,
    colCount: 3,
    modalTitleAdd: 'เพิ่มสินค้า',
    modalTitleEdit: 'แก้ไขข้อมูลสินค้า',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัสสินค้า (Product ID)</label>
        <template x-if="!isEdit"><input type="text" x-model="form.product_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.product_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อสินค้า (Product Name)</label>
        <input type="text" x-model="form.product_name" required class="form-control" data-no-flatpickr>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
