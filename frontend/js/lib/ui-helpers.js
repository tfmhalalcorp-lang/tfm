// Small shared UI utilities used across every view module.

/** 'YYYY-MM-DD' or ISO date -> 'DD/MM/YYYY' for display. */
export function formatDate(isoString) {
  if (!isoString) return '';
  const datePart = String(isoString).split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoString;
}

/** Today's date as a 'YYYY-MM-DD' string in the browser's local timezone. */
export function getLocalDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** HH:mm from a time/datetime-ish value. */
export function formatTimeValue(val) {
  if (!val) return '';
  const s = String(val);
  if (s.includes('T')) return s.split('T')[1].slice(0, 5);
  return s.slice(0, 5);
}

export function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function toLocale(n) {
  return numberOrZero(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Destroy any live Chart.js instances bound to the given canvas ids before re-creating them. */
export function destroyCharts(ids) {
  if (!window.Chart) return;
  Chart.helpers.each(Chart.instances, (instance) => {
    if (ids.includes(instance.canvas.id)) instance.destroy();
  });
}

export function toastSuccess(title = 'สำเร็จ') {
  return window.Swal?.fire({ icon: 'success', title, timer: 1600, showConfirmButton: false });
}

export function alertError(err) {
  const message = err && err.message ? err.message : String(err);
  return window.Swal?.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: message });
}

export async function confirmDelete() {
  const result = await window.Swal?.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'ใช่, ลบเลย',
    cancelButtonText: 'ยกเลิก',
  });
  return !!(result && result.isConfirmed);
}

/** flatpickr for every not-yet-initialized date input in the document. */
export function initDatePickers() {
  if (!window.flatpickr) return;
  document.querySelectorAll('input[type="date"]:not([data-no-flatpickr])').forEach((input) => {
    if (!input._flatpickr) {
      window.flatpickr(input, {
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd/m/Y',
        locale: 'th',
        allowInput: true,
        disableMobile: true,
      });
    }
  });
}

/** Tom Select for every not-yet-initialized <select> in the document. */
export function initSelects() {
  if (!window.TomSelect) return;
  document
    .querySelectorAll('select:not(.swal2-select):not([data-no-tom]):not(.tom-selected)')
    .forEach((el) => {
      new window.TomSelect(el, { create: false, sortField: { field: 'text', direction: 'asc' } });
      el.classList.add('tom-selected');
    });
}
