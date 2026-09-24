// Shared order-pipeline status/completeness logic — used by order-hub.js
// (per-row action button state), the order-tracking dashboard
// (aggregations.js), and the notifications store, so all three agree on
// exactly one definition of "this order/stage is incomplete" and
// "this order is overdue".

/** Days between two 'YYYY-MM-DD' (or ISO) date strings, b - a, truncated to whole days. */
export function daysBetween(aIso, bIso) {
  const a = new Date(String(aIso).split('T')[0]);
  const b = new Date(String(bIso).split('T')[0]);
  return Math.floor((b - a) / 86400000);
}

/** Today as 'YYYY-MM-DD' in the browser's local timezone (matches ui-helpers.getLocalDate). */
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Confirm-booking status shown on the order-hub Booking modal and reused
 * wherever "is this order's booking confirmed?" needs an answer.
 * PENDING once an agent is assigned but no ETD on board is recorded yet;
 * unset ('-') when neither is present.
 */
export function bookingStatus(agent, etdOnBoard) {
  const hasAgent = !!(agent || '').trim();
  if (etdOnBoard) return { label: 'BOOKING CONFIRM', cls: 'bg-green-100 text-green-700', confirmed: true };
  if (hasAgent) return { label: 'PENDING', cls: 'bg-amber-100 text-amber-700', confirmed: false };
  return { label: '-', cls: 'bg-gray-100 text-gray-500', confirmed: false };
}

const PACKAGING_ITEMS = [
  { key: 'carton', label: 'Carton' },
  { key: 'cover', label: 'Cover' },
  { key: 'base_paper', label: 'Base Paper' },
  { key: 'label', label: 'Label' },
];

/** Which of the 4 packaging items on a carton_label_preps row are still undecided (neither ready nor not_used). */
export function pendingPackagingItems(cartonLabel) {
  if (!cartonLabel) return PACKAGING_ITEMS.map((i) => i.label);
  return PACKAGING_ITEMS.filter((i) => !cartonLabel[`${i.key}_ready`] && !cartonLabel[`${i.key}_not_used`]).map((i) => i.label);
}

/** Counts of ready / not_used / pending across the 4 packaging items — feeds the dashboard's readiness chart. */
export function packagingReadinessCounts(cartonLabel) {
  let ready = 0, notUsed = 0, pending = 0;
  PACKAGING_ITEMS.forEach((i) => {
    if (!cartonLabel) return pending++;
    if (cartonLabel[`${i.key}_ready`]) ready++;
    else if (cartonLabel[`${i.key}_not_used`]) notUsed++;
    else pending++;
  });
  return { ready, notUsed, pending };
}

/**
 * Field-level completeness check for one SO/PI across every pipeline
 * stage, given the (single, latest) related row for each stage — same
 * shape order-hub.js already keys by so_pi_id via keyBySoPi().
 *
 * `related` fields (all optional/nullable — absence means "stage not started"):
 *   plan, cartonLabel, booking, deliveryOrder, delivery, accounting
 *
 * Returns { stageIssues: [{stage, message}], hasIssue, overdue, daysOpen }.
 * `overdue` = not yet shipped (no DO) AND booking not confirmed AND the
 * order is more than 7 days old — the exact rule requested for the
 * order-tracking table's warning column.
 */
export function computeOrderIssues(order, related = {}) {
  const { plan, cartonLabel, booking, deliveryOrder, delivery, accounting } = related;
  const stageIssues = [];

  const missingHeaderFields = [];
  if (!order.customer_id) missingHeaderFields.push('ลูกค้า');
  if (!order.destination) missingHeaderFields.push('ปลายทาง');
  if (!order.port) missingHeaderFields.push('ท่าเรือ');
  if (!order.incoterm) missingHeaderFields.push('Incoterm');
  if (!order.currency) missingHeaderFields.push('สกุลเงิน');
  if (!order.payment_term) missingHeaderFields.push('เงื่อนไขชำระเงิน');
  if (!(order.so_pi_items && order.so_pi_items.length)) missingHeaderFields.push('รายการสินค้า');
  if (missingHeaderFields.length) {
    stageIssues.push({ stage: 'order', message: `ข้อมูลคำสั่งซื้อยังไม่ครบ: ${missingHeaderFields.join(', ')}` });
  }

  if (!plan) {
    stageIssues.push({ stage: 'plan', message: 'ยังไม่ได้วางแผนการผลิต' });
  } else if (!plan.expected_load_date) {
    stageIssues.push({ stage: 'plan', message: 'แผนการผลิตยังไม่ระบุวันที่คาดว่าจะพร้อมโหลด' });
  }

  if (!cartonLabel) {
    stageIssues.push({ stage: 'cartonLabel', message: 'ยังไม่ได้กรอกข้อมูลจัดเตรียม Packaging' });
  } else {
    const pending = pendingPackagingItems(cartonLabel);
    if (pending.length) stageIssues.push({ stage: 'cartonLabel', message: `Packaging ยังไม่ระบุสถานะ: ${pending.join(', ')}` });
  }

  const bStatus = bookingStatus(order.agent, booking?.etd_on_board);
  if (!bStatus.confirmed) {
    stageIssues.push({ stage: 'booking', message: bStatus.label === '-' ? 'ยังไม่ได้ดำเนินการ Booking' : 'Booking ยังไม่ Confirm (PENDING)' });
  }

  if (!deliveryOrder) {
    stageIssues.push({ stage: 'do', message: 'ยังไม่ออก DO' });
  } else if (!deliveryOrder.do_no || !deliveryOrder.do_date) {
    stageIssues.push({ stage: 'do', message: 'ข้อมูล DO ยังไม่ครบ (เลขที่/วันที่)' });
  }

  if (!delivery) {
    stageIssues.push({ stage: 'delivery', message: 'ยังไม่ออก Invoice/เอกสารส่งมอบ' });
  } else {
    const missingDelivery = [];
    if (!delivery.invoice_no) missingDelivery.push('เลขที่ Invoice');
    if (!delivery.invoice_date) missingDelivery.push('วันที่ Invoice');
    if (!delivery.etd) missingDelivery.push('ETD');
    if (!delivery.eta) missingDelivery.push('ETA');
    if (!delivery.bl_drive_file_id) missingDelivery.push('ไฟล์ BL');
    if (missingDelivery.length) stageIssues.push({ stage: 'delivery', message: `ข้อมูลส่งมอบยังไม่ครบ: ${missingDelivery.join(', ')}` });
  }

  if (delivery && !accounting) {
    stageIssues.push({ stage: 'accounting', message: 'ยังไม่ได้บันทึกกำหนดชำระเงิน' });
  }

  const daysOpen = daysBetween(order.doc_date, todayIso());
  const overdue = !deliveryOrder && !bStatus.confirmed && daysOpen > 7;

  return { stageIssues, hasIssue: stageIssues.length > 0, overdue, daysOpen };
}
