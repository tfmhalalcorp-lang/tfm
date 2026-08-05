import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';

const resource = createCrudResource({
  table: 'machines',
  orderBy: 'machine_code',
  searchPredicate: (item, q) =>
    (item.machine_code || '').toLowerCase().includes(q) ||
    (item.machine_name || '').toLowerCase().includes(q) ||
    (item.ma_type || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, machine_code: '', machine_name: '', ma_type: '' }),
  toForm: (item) => ({ id: item.id, machine_code: item.machine_code, machine_name: item.machine_name, ma_type: item.ma_type || '' }),
  validate: (form) => (!form.machine_code || !form.machine_name ? 'กรุณากรอกข้อมูลให้ครบ' : null),
  toPayload: (form) => ({
    machine_code: form.machine_code.trim(),
    machine_name: form.machine_name.trim(),
    ma_type: (form.ma_type || '').trim(),
  }),
});

document.addEventListener('alpine:init', () => {
  Alpine.data('machinesCrud', resource);
});

registerView('settings-machine', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'machinesCrud',
    title: 'จัดการข้อมูลเครื่องจักร',
    searchPlaceholder: 'ค้นหา รหัส หรือ ชื่อเครื่องจักร...',
    theadHtml: `<th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อเครื่องจักร</th><th class="px-3 py-2">ประเภทซ่อม</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.machine_code"></td>
      <td class="px-3 py-2" x-text="item.machine_name"></td>
      <td class="px-3 py-2" x-text="item.ma_type || '-'"></td>
    `,
    colCount: 4,
    modalTitleAdd: 'เพิ่มเครื่องจักร',
    modalTitleEdit: 'แก้ไขข้อมูลเครื่องจักร',
    modalFieldsHtml: `
      <div>
        <label class="form-label">รหัส</label>
        <template x-if="!isEdit"><input type="text" x-model="form.machine_code" required class="form-control" data-no-flatpickr></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.machine_code"></div></template>
      </div>
      <div>
        <label class="form-label">ชื่อเครื่องจักร</label>
        <input type="text" x-model="form.machine_name" required class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ประเภทซ่อม</label>
        <input type="text" x-model="form.ma_type" class="form-control" data-no-flatpickr>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
