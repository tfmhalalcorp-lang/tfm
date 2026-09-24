import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const resource = createCrudResource({
  table: 'sauces',
  orderBy: 'sauce_code',
  searchPredicate: (item, q) =>
    (item.sauce_code || '').toLowerCase().includes(q) || (item.sauce_brand || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, sauce_code: '', sauce_brand: '' }),
  toForm: (item) => ({ id: item.id, sauce_code: item.sauce_code, sauce_brand: item.sauce_brand }),
  validate: (form) => (!form.sauce_code || !form.sauce_brand ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({ sauce_code: form.sauce_code.trim(), sauce_brand: form.sauce_brand.trim() }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('saucesCrud', resource);
});

registerView('settings-sauce', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'saucesCrud',
    title: 'จัดการข้อมูลซอส',
    searchPlaceholder: 'ค้นหา รหัสซอส หรือ แบรนด์ซอส...',
    theadHtml: `<th class="px-3 py-2">รหัสซอส</th><th class="px-3 py-2">แบรนด์ซอส</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.sauce_code"></td>
      <td class="px-3 py-2" x-text="item.sauce_brand"></td>
    `,
    colCount: 3,
    modalTitleAdd: 'เพิ่มข้อมูลซอส',
    modalTitleEdit: 'แก้ไขข้อมูลซอส',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัสซอส</label>
        <template x-if="!isEdit"><input type="text" x-model="form.sauce_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.sauce_code"></div></template>
      </div>
      <div>
        <label class="form-label">แบรนด์ซอส</label>
        <input type="text" x-model="form.sauce_brand" required class="form-control" data-no-flatpickr>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
