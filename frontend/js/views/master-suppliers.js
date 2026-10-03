import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const resource = createCrudResource({
  table: 'suppliers',
  orderBy: 'supplier_code',
  searchPredicate: (item, q) =>
    (item.supplier_code || '').toLowerCase().includes(q) ||
    (item.supplier_name || '').toLowerCase().includes(q) ||
    (item.fish_type || '').toLowerCase().includes(q) ||
    (item.can_type || '').toLowerCase().includes(q),
  tabPredicate: (item, tab) => item.supplier_type === tab,
  emptyForm: () => ({ id: null, supplier_type: 'fish', supplier_code: '', supplier_name: '', fish_type: '', can_type: '' }),
  toForm: (item) => ({
    id: item.id,
    supplier_type: item.supplier_type || 'fish',
    supplier_code: item.supplier_code,
    supplier_name: item.supplier_name,
    fish_type: item.fish_type || '',
    can_type: item.can_type || '',
  }),
  validate: (form) => (!form.supplier_code || !form.supplier_name ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({
    supplier_type: form.supplier_type,
    supplier_code: form.supplier_code.trim(),
    supplier_name: form.supplier_name.trim(),
    // Only the detail field matching the supplier type is kept.
    fish_type: form.supplier_type === 'fish' ? (form.fish_type || '').trim() : '',
    can_type: form.supplier_type === 'can' ? (form.can_type || '').trim() : '',
  }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('suppliersCrud', resource);
});

const tabBtn = (key, label) => `
  <button type="button" @click="tab = '${key}'"
          :class="tab === '${key}' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          class="px-3 py-1.5 rounded-lg text-sm font-medium">
    ${label} <span class="opacity-70" x-text="'(' + ${key === 'all' ? 'items.length' : `items.filter(i => i.supplier_type === '${key}').length`} + ')'"></span>
  </button>`;

registerView('settings-supplier', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'suppliersCrud',
    title: 'จัดการข้อมูลผู้ขาย (Supplier)',
    searchPlaceholder: 'ค้นหา รหัส, ชื่อผู้ขาย, ชนิดปลา หรือกระป๋อง...',
    tabsHtml: `<div class="flex flex-wrap gap-2 mb-4">${tabBtn('all', 'ทั้งหมด')}${tabBtn('fish', 'ผู้ขายปลา')}${tabBtn('can', 'ผู้ขายกระป๋อง')}</div>`,
    theadHtml: `<th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อผู้ขาย</th><th class="px-3 py-2">ประเภท</th><th class="px-3 py-2">ชนิดปลา / ชนิด-ขนาดกระป๋อง</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.supplier_code"></td>
      <td class="px-3 py-2" x-text="item.supplier_name"></td>
      <td class="px-3 py-2" x-text="item.supplier_type === 'can' ? 'ผู้ขายกระป๋อง' : 'ผู้ขายปลา'"></td>
      <td class="px-3 py-2" x-text="(item.supplier_type === 'can' ? item.can_type : item.fish_type) || '-'"></td>
    `,
    colCount: 5,
    modalTitleAdd: 'เพิ่มผู้ขาย',
    modalTitleEdit: 'แก้ไขข้อมูลผู้ขาย',
    modalFieldsHtml: `
      <div>
        <label class="form-label">ประเภทผู้ขาย</label>
        <select x-model="form.supplier_type" class="form-control" data-no-tom>
          <option value="fish">ผู้ขายปลา</option>
          <option value="can">ผู้ขายกระป๋อง</option>
        </select>
      </div>
      <div>
        <label class="form-label">รหัส Supplier</label>
        <template x-if="!isEdit"><input type="text" x-model="form.supplier_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.supplier_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อ Supplier</label>
        <input type="text" x-model="form.supplier_name" required class="form-control" data-no-flatpickr>
      </div>
      <div x-show="form.supplier_type === 'fish'">
        <label class="form-label">ชนิดปลา (ถ้ามี)</label>
        <input type="text" x-model="form.fish_type" class="form-control" data-no-flatpickr>
      </div>
      <div x-show="form.supplier_type === 'can'">
        <label class="form-label">ชนิด/ขนาดกระป๋อง (ถ้ามี)</label>
        <input type="text" x-model="form.can_type" class="form-control" data-no-flatpickr>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
