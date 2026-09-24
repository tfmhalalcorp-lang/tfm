import { registerView } from '../router.js';
import { createCrudResource, crudListTemplate } from '../data/crud-factory.js';
import { supabase, callFunction } from '../lib/supabaseClient.js';

const ROLE_LABELS = {
  admin: 'Admin (ผู้ดูแลระบบ)',
  pd: 'PD (ฝ่ายผลิต)',
  wh: 'WH (คลังสินค้า)',
  qc: 'QC (ตรวจสอบคุณภาพ)',
  ma: 'MA (ซ่อมบำรุง)',
  sale: 'SALE (ฝ่ายขาย/คำสั่งซื้อ)',
};

const baseResource = createCrudResource({
  table: 'profiles',
  orderBy: 'username',
  searchPredicate: (item, q) =>
    (item.username || '').toLowerCase().includes(q) || (item.fullname || '').toLowerCase().includes(q),
  emptyForm: () => ({ id: null, username: '', password: '', fullname: '', role: 'sale' }),
  toForm: (item) => ({ id: item.id, username: item.username, password: '', fullname: item.fullname, role: item.role }),
  validate: (form, isEdit) => {
    if (!form.fullname) return 'กรุณากรอกข้อมูลให้ครบถ้วน';
    if (!isEdit) {
      if (!form.username || !form.password) return 'กรุณากรอกข้อมูลให้ครบถ้วน';
      if (form.password.length < 6) return 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
    } else if (form.password && form.password.length < 6) {
      return 'Password ต้องมีอย่างน้อย 6 ตัวอักษร';
    }
    return null;
  },
  toPayload: (form) => ({
    username: (form.username || '').trim().toLowerCase(),
    password: form.password,
    fullname: form.fullname.trim(),
    role: form.role,
  }),
  fetchItems: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('username');
    if (error) throw new Error(error.message);
    return data || [];
  },
  createItem: async (payload) => {
    await callFunction('admin-users', {
      action: 'create',
      username: payload.username,
      password: payload.password,
      fullname: payload.fullname,
      role: payload.role,
    });
  },
  updateItem: async (id, payload) => {
    const body = { action: 'update', id, fullname: payload.fullname, role: payload.role };
    if (payload.password) body.password = payload.password;
    await callFunction('admin-users', body);
  },
  deleteItem: async (id) => {
    await callFunction('admin-users', { action: 'delete', id });
  },
});

function usersCrudComponent() {
  return Object.assign(baseResource(), {
    roleLabel(role) {
      return ROLE_LABELS[role] || role;
    },
    roleBadgeClass(role) {
      return role === 'admin' ? 'bg-danger text-white' : 'bg-secondary text-white bg-slate-500';
    },
  });
}

document.addEventListener('alpine:init', () => {
  Alpine.data('usersCrud', usersCrudComponent);
});

registerView('settings-user', async (container) => {
  container.innerHTML = crudListTemplate({
    dataComponent: 'usersCrud',
    title: 'จัดการข้อมูลผู้ใช้งาน',
    searchPlaceholder: 'ค้นหา ชื่อผู้ใช้ หรือ ชื่อจริง...',
    theadHtml: `<th class="px-3 py-2">Username</th><th class="px-3 py-2">ชื่อ-นามสกุล</th><th class="px-3 py-2">สิทธิ์การใช้งาน</th>`,
    rowHtml: `
      <td class="px-3 py-2 font-mono text-xs" x-text="item.username"></td>
      <td class="px-3 py-2" x-text="item.fullname"></td>
      <td class="px-3 py-2"><span class="badge" :class="roleBadgeClass(item.role)" x-text="roleLabel(item.role)"></span></td>
    `,
    colCount: 4,
    hideDeleteExpr: "item.username === 'admin' || item.id === $store.auth.userId",
    modalTitleAdd: 'เพิ่มผู้ใช้งาน',
    modalTitleEdit: 'แก้ไขข้อมูลผู้ใช้งาน',
    modalFieldsHtml: `
      <div>
        <label class="form-label">Username</label>
        <template x-if="!isEdit"><input type="text" x-model="form.username" required class="form-control" autocomplete="off" data-no-flatpickr placeholder="a-z, 0-9, _ . - (3-32 ตัวอักษร)"></template>
        <template x-if="isEdit"><div class="form-control bg-gray-100 text-gray-500" x-text="form.username"></div></template>
      </div>
      <div>
        <label class="form-label">Password <span class="font-normal text-gray-400" x-show="isEdit" x-cloak>(เว้นว่างหากไม่เปลี่ยนรหัสผ่าน)</span></label>
        <input type="password" x-model="form.password" :required="!isEdit" class="form-control" autocomplete="new-password" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">ชื่อ-นามสกุล</label>
        <input type="text" x-model="form.fullname" required class="form-control" data-no-flatpickr>
      </div>
      <div>
        <label class="form-label">สิทธิ์การใช้งาน (Role)</label>
        <select x-model="form.role" required class="form-control" data-no-tom>
          <option value="admin">admin - ดูได้ทุกเมนู</option>
          <option value="pd">pd - PD - Dashboard + Production + Report</option>
          <option value="wh">wh - WH - Warehouse + Report</option>
          <option value="qc">qc - QC - QC + Report</option>
          <option value="ma">ma - MA - Maintenance + Report</option>
          <option value="sale">sale - SALE - จัดการคำสั่งซื้อ + Report</option>
        </select>
      </div>
    `,
    modalWidthClass: 'max-w-md',
  });
});
