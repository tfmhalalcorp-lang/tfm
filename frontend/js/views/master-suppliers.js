import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const resource = createCrudResource({
  table: 'suppliers',
  orderBy: 'supplier_code',
  searchPredicate: (item, q) =>
    (item.supplier_code || '').toLowerCase().includes(q) ||
    (item.supplier_name || '').toLowerCase().includes(q) ||
    (item.fish_type || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, supplier_code: '', supplier_name: '', fish_type: '' }),
  toForm: (item) => ({ id: item.id, supplier_code: item.supplier_code, supplier_name: item.supplier_name, fish_type: item.fish_type || '' }),
  validate: (form) => (!form.supplier_code || !form.supplier_name ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({
    supplier_code: form.supplier_code.trim(),
    supplier_name: form.supplier_name.trim(),
    fish_type: (form.fish_type || '').trim(),
  }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('suppliersCrud', resource);
});

registerView('settings-supplier', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'suppliersCrud',
    title: 'จัดการข้อมูลผู้ขาย (Supplier)',
    searchPlaceholder: 'ค้นหา รหัส, ชื่อผู้ขาย หรือ ชนิดปลา...',
    theadHtml: `<th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อผู้ขาย</th><th class="px-3 py-2">ชนิดปลา</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.supplier_code"></td>
      <td class="px-3 py-2" x-text="item.supplier_name"></td>
      <td class="px-3 py-2" x-text="item.fish_type || '-'"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มผู้ขาย',
    modalTitleEdit: 'แก้ไขข้อมูลผู้ขาย',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัส Supplier</label>
        <template x-if="!isEdit"><input type="text" x-model="form.supplier_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.supplier_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อ Supplier</label>
        <input type="text" x-model="form.supplier_name" required class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ชนิดปลา (ถ้ามี)</label>
        <input type="text" x-model="form.fish_type" class="form-control" data-no-flatpickr>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
