// Sidebar menu configuration + role visibility. This is a UX convenience
// only — the real security boundary is Postgres Row Level Security
// (see supabase/schema.sql). View keys below match the legacy app's
// navigateTo() switch cases exactly, so the router/view-registry design
// stays a 1:1 port.

const ALL_ROLES = ['admin', 'prod', 'wh', 'qc', 'ma', 'rpt'];

export const MENU_SECTIONS = [
  { type: 'link', view: 'dashboard', icon: 'fa-chart-line', label: 'Dashboard', roles: ALL_ROLES },
  { type: 'link', view: 'dashboard-waste', icon: 'fa-recycle', label: 'สรุปของเสีย', roles: ALL_ROLES },
  { type: 'link', view: 'dashboard-rm', icon: 'fa-fish', label: 'ประเมินวัตถุดิบ', roles: ALL_ROLES },

  {
    type: 'group', id: 'order', icon: 'fa-file-invoice', label: 'จัดการคำสั่งซื้อ', roles: ['admin'],
    items: [
      { view: 'order-hub', icon: 'fa-table-list', label: 'หน้าจัดการรวม' },
      { view: 'order-so-pi', icon: 'fa-file-signature', label: 'บันทึกคำสั่งซื้อ SO/PI' },
      { view: 'order-plan', icon: 'fa-calendar-days', label: 'แผนการผลิต' },
      { view: 'order-delivery', icon: 'fa-truck-fast', label: 'บันทึกการจัดส่ง/ส่งมอบสินค้า' },
      { view: 'order-accounting', icon: 'fa-sack-dollar', label: 'ส่วนงานบัญชี' },
    ],
  },
  {
    type: 'group', id: 'prod', icon: 'fa-industry', label: 'PRODUCTION', roles: ['admin', 'prod'],
    items: [
      { view: 'prod-batch', icon: 'fa-clipboard-list', label: 'Batch Setup' },
      { view: 'prod-rm', icon: 'fa-fish', label: 'RM Usage' },
      { view: 'prod-can', icon: 'fa-box-open', label: 'Can Usage' },
      { view: 'prod-fillquantity', icon: 'fa-cubes', label: 'Production Quantity' },
      { view: 'waste-pd', icon: 'fa-recycle', label: 'Waste Log (PD)' },
      { view: 'issue-log', icon: 'fa-triangle-exclamation', label: 'แจ้งปัญหา' },
    ],
  },
  {
    type: 'group', id: 'wh', icon: 'fa-warehouse', label: 'WAREHOUSE', roles: ['admin', 'wh'],
    items: [
      { view: 'wh-in', icon: 'fa-dolly', label: 'Stock In' },
      { view: 'wh-load-ready', icon: 'fa-calendar-check', label: 'วันที่พร้อมโหลด' },
      { view: 'waste-wh', icon: 'fa-recycle', label: 'Waste Log (WH)' },
      { view: 'issue-log', icon: 'fa-triangle-exclamation', label: 'แจ้งปัญหา' },
    ],
  },
  {
    type: 'group', id: 'qc', icon: 'fa-clipboard-check', label: 'QC', roles: ['admin', 'qc'],
    items: [
      { view: 'prod-fillweight', icon: 'fa-balance-scale', label: 'Fill Weight' },
      { view: 'qc-can', icon: 'fa-box-open', label: 'Can Usage' },
      { view: 'qc-waste', icon: 'fa-recycle', label: 'Waste Log (QC)' },
      { view: 'issue-log', icon: 'fa-triangle-exclamation', label: 'แจ้งปัญหา' },
    ],
  },
  {
    type: 'group', id: 'ma', icon: 'fa-wrench', label: 'MAINTENANCE', roles: ['admin', 'ma'],
    items: [
      { view: 'ma-log', icon: 'fa-screwdriver-wrench', label: 'Breakdown' },
      { view: 'issue-log', icon: 'fa-triangle-exclamation', label: 'แจ้งปัญหา' },
    ],
  },
  {
    type: 'group', id: 'report', icon: 'fa-file-lines', label: 'รายงาน', roles: ALL_ROLES,
    items: [
      { view: 'report-production', icon: 'fa-industry', label: 'รายงานงานผลิต' },
      { view: 'report-warehouse', icon: 'fa-boxes-stacked', label: 'รายงานรับเข้าคลัง' },
      { view: 'report-fillweight', icon: 'fa-balance-scale', label: 'รายงาน Fill Weight' },
      { view: 'report-qc', icon: 'fa-clipboard-check', label: 'รายงานตรวจสอบคุณภาพ' },
      { view: 'report-maintenance', icon: 'fa-screwdriver-wrench', label: 'รายงานการซ่อมบำรุง' },
      { view: 'report-rm-price', icon: 'fa-money-bill-trend-up', label: 'วิเคราะห์ราคา RM', roles: ['admin'] },
    ],
  },
  {
    type: 'group', id: 'settings', icon: 'fa-gear', label: 'SETTINGS', roles: ['admin'],
    items: [
      { view: 'settings-user', icon: 'fa-user-gear', label: 'Users (ตั้งค่าผู้ใช้งาน)' },
      { view: 'settings-customer', icon: 'fa-users', label: 'Customers' },
      { view: 'settings-brand', icon: 'fa-tag', label: 'Brands' },
      { view: 'settings-supplier', icon: 'fa-truck', label: 'Suppliers' },
      { view: 'settings-cansize', icon: 'fa-ruler-combined', label: 'Can Sizes' },
      { view: 'settings-machine', icon: 'fa-cogs', label: 'Machines' },
      { view: 'settings-product', icon: 'fa-boxes-packing', label: 'Products' },
    ],
  },
];

// Thai page titles per view key, shown in the top bar. Kept centrally so
// every view module (and the router) can share one source of truth.
export const PAGE_TITLES = {
  'dashboard': 'Dashboard',
  'dashboard-waste': 'สรุปของเสีย (Waste Summary)',
  'dashboard-rm': 'ประเมินวัตถุดิบ (RM Assessment)',
  'report-production': 'รายงานงานผลิต',
  'report-warehouse': 'รายงานรับเข้าคลังสินค้า',
  'report-fillweight': 'รายงาน Fill Weight',
  'report-qc': 'รายงานตรวจสอบคุณภาพ',
  'report-maintenance': 'รายงานการซ่อมบำรุง',
  'settings-user': 'จัดการข้อมูลผู้ใช้งาน',
  'settings-customer': 'จัดการข้อมูลลูกค้า',
  'settings-brand': 'จัดการข้อมูล Brand',
  'settings-supplier': 'จัดการข้อมูลผู้ขาย (Supplier)',
  'settings-cansize': 'จัดการข้อมูลขนาดกระป๋อง',
  'settings-machine': 'จัดการข้อมูลเครื่องจักร',
  'prod-batch': 'Production: Batch Setup',
  'prod-rm': 'Production: RM Usage',
  'prod-can': 'Production: Can Usage',
  'qc-can': 'QC: Can Usage',
  'prod-fillquantity': 'Production: Production Quantity',
  'prod-fillweight': 'QC: Fill Weight',
  'wh-in': 'Warehouse: Stock In',
  'qc-waste': 'QC: Daily Waste Log',
  'waste-pd': 'Production: Daily Waste Log',
  'waste-wh': 'Warehouse: Daily Waste Log',
  'ma-log': 'Maintenance: Breakdown',
  'issue-log': 'แจ้งปัญหาในการผลิต',
  'wh-load-ready': 'Warehouse: วันที่พร้อมโหลด',
  'settings-product': 'จัดการข้อมูลสินค้า (Products)',
  'order-hub': 'หน้าจัดการรวม (Order Hub)',
  'order-so-pi': 'บันทึกคำสั่งซื้อ SO/PI',
  'order-plan': 'แผนการผลิต',
  'order-delivery': 'บันทึกการจัดส่ง/ส่งมอบสินค้า',
  'order-accounting': 'ส่วนงานบัญชี',
  'report-rm-price': 'วิเคราะห์ราคา RM (RM Price Analysis)',
};

// A group item may optionally carry its own `roles` array, narrower than
// the group's — e.g. one admin-only report living inside the otherwise
// all-roles "รายงาน" group. Items without `roles` keep inheriting
// visibility from the group alone (the original, still-default behavior).
export function visibleSections(role) {
  if (!role) return [];
  return MENU_SECTIONS.filter((s) => s.roles.includes(role)).map((s) =>
    s.type === 'group' ? { ...s, items: s.items.filter((it) => !it.roles || it.roles.includes(role)) } : s
  );
}

document.addEventListener('alpine:init', () => {
  Alpine.data('appShell', () => ({
    get visibleMenu() {
      return visibleSections(Alpine.store('auth').role);
    },
  }));
});
