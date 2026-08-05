import { formatDate, toLocale, getLocalDate } from '../lib/ui-helpers.js';

export { formatDate, toLocale, getLocalDate };

/** Printable report header block: "OrderCenter" + Thai title + date-range subtitle. */
export function reportHeaderHtml(title, startDate, endDate) {
  const range = startDate || endDate ? `${formatDate(startDate) || '...'} - ${formatDate(endDate) || '...'}` : 'ทั้งหมด';
  return `
    <div class="text-center mb-4">
      <div class="font-bold text-lg">OrderCenter</div>
      <div class="font-semibold text-primary">${title}</div>
      <div class="text-xs text-gray-500">ช่วงวันที่: ${range}</div>
    </div>`;
}

/** Pads a table body up to `minRows` with visually-empty rows so exports/prints keep a consistent minimum height. */
export function emptyRowsHtml(currentCount, colCount, minRows = 10) {
  const missing = Math.max(0, minRows - currentCount);
  if (missing === 0) return '';
  const cells = '<td>&nbsp;</td>'.repeat(colCount);
  return `<tr class="empty-row">${cells}</tr>`.repeat(missing);
}

export function exportButtonsHtml() {
  return `
    <div class="export-btn-group no-print flex flex-wrap gap-2 mb-4">
      <button class="export-btn export-btn-excel text-white text-sm" @click="exportExcel()"><i class="fa-solid fa-file-excel"></i> Excel</button>
      <button class="export-btn export-btn-pdf text-white text-sm" @click="exportPdf()"><i class="fa-solid fa-file-pdf"></i> PDF</button>
    </div>`;
}
