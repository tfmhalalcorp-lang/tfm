// Shared Excel (SheetJS) / PDF (html2pdf.js) export helpers used by all 5
// report views. Ported from the legacy app's per-report duplicated export
// functions into one reusable pair.

/**
 * Export one or more <table> elements to a single .xlsx workbook.
 * @param {Array<{ id: string, sheetName: string }>} tables
 * @param {string} filename
 */
export function exportTablesToExcel(tables, filename) {
  if (!window.XLSX) {
    window.Swal?.fire('Error', 'ไม่พบไลบรารี Excel export (XLSX)', 'error');
    return;
  }
  try {
    const wb = XLSX.utils.book_new();
    tables.forEach(({ id, sheetName }) => {
      const tableEl = document.getElementById(id);
      if (!tableEl) return;
      const ws = XLSX.utils.table_to_sheet(tableEl);
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    });
    XLSX.writeFile(wb, filename);
    window.Swal?.fire({ icon: 'success', title: 'ส่งออก Excel สำเร็จ', timer: 2000, showConfirmButton: false });
  } catch (err) {
    window.Swal?.fire('Error', err.message || 'ส่งออก Excel ไม่สำเร็จ', 'error');
  }
}

/**
 * Export a printable DOM element to a PDF file.
 * @param {string} elementId
 * @param {string} filename
 */
export function exportElementToPdf(elementId, filename) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (!window.html2pdf) {
    window.Swal?.fire('Error', 'ไม่พบไลบรารี PDF export (html2pdf)', 'error');
    return;
  }
  window.Swal?.fire({ title: 'กำลังสร้าง PDF...', allowOutsideClick: false, didOpen: () => window.Swal.showLoading() });
  window
    .html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(el)
    .save()
    .then(() => {
      window.Swal?.fire({ icon: 'success', title: 'ส่งออก PDF สำเร็จ', timer: 2000, showConfirmButton: false });
    })
    .catch((err) => {
      window.Swal?.fire('Error', err.message || 'ส่งออก PDF ไม่สำเร็จ', 'error');
    });
}

/** Pads a report's data rows up to a fixed row count with visually-empty rows, so exports/prints have a consistent minimum height. */
export function padRows(rows, columnCount, minCount = 10) {
  const padded = rows.slice();
  while (padded.length < minCount) {
    padded.push({ __empty: true, __cols: columnCount });
  }
  return padded;
}
