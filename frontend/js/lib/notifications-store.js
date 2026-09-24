// Alpine.store('notifications') — order-completeness alerts shown in the
// sidebar badge and the header bell. Restricted to admin/sale (mirrors the
// "จัดการคำสั่งซื้อ" menu group's role gate in role-access.js), since only
// those roles can act on these. Computed from the same computeOrderIssues() rules
// used by order-hub.js's row badges and the order-tracking dashboard, so
// all three surfaces always agree.
import { supabase } from './supabaseClient.js';
import { computeOrderIssues } from './order-status.js';

function keyBySoPi(list) {
  const map = {};
  (list || []).forEach((row) => (map[row.so_pi_id] = row));
  return map;
}

document.addEventListener('alpine:init', () => {
  Alpine.store('notifications', {
    items: [],
    orderIssueCount: 0,
    loading: false,

    async refresh() {
      if (!['admin', 'sale'].includes(Alpine.store('auth')?.role)) {
        this.items = [];
        this.orderIssueCount = 0;
        return;
      }
      this.loading = true;
      try {
        const [
          { data: soPi, error: e1 },
          { data: plans, error: e2 },
          { data: bookings, error: e3 },
          { data: cartonLabels, error: e4 },
          { data: dos, error: e5 },
          { data: deliveries, error: e6 },
          { data: accounting, error: e7 },
        ] = await Promise.all([
          supabase.from('so_pi').select('*, so_pi_items(product_id, qty, unit_price)').order('doc_date', { ascending: true }),
          supabase.from('production_plans').select('*').order('plan_date', { ascending: true }),
          supabase.from('booking_confirmations').select('*'),
          supabase.from('carton_label_preps').select('*'),
          supabase.from('delivery_orders').select('*').order('do_date', { ascending: true, nullsFirst: true }),
          supabase.from('deliveries').select('*'),
          supabase.from('accounting_entries').select('*, deliveries!delivery_id(so_pi_id)'),
        ]);
        if (e1 || e2 || e3 || e4 || e5 || e6 || e7) throw new Error((e1 || e2 || e3 || e4 || e5 || e6 || e7).message);

        const plansBySoPi = keyBySoPi(plans);
        const bookingsBySoPi = keyBySoPi(bookings);
        const cartonLabelsBySoPi = keyBySoPi(cartonLabels);
        const doBySoPi = keyBySoPi(dos);
        const deliveriesBySoPi = keyBySoPi(deliveries);
        const accountingBySoPi = {};
        (accounting || []).forEach((row) => {
          const soPiId = row.deliveries?.so_pi_id;
          if (soPiId) accountingBySoPi[soPiId] = row;
        });

        const items = [];
        let orderIssueCount = 0;
        (soPi || []).forEach((order) => {
          const issues = computeOrderIssues(order, {
            plan: plansBySoPi[order.id],
            cartonLabel: cartonLabelsBySoPi[order.id],
            booking: bookingsBySoPi[order.id],
            deliveryOrder: doBySoPi[order.id],
            delivery: deliveriesBySoPi[order.id],
            accounting: accountingBySoPi[order.id],
          });
          if (!issues.hasIssue) return;
          orderIssueCount++;
          issues.stageIssues.forEach((issue) => {
            items.push({ so_pi_id: order.id, doc_no: order.doc_no, message: issue.message, overdue: issues.overdue });
          });
        });
        items.sort((a, b) => (b.overdue === a.overdue ? 0 : b.overdue ? 1 : -1));
        this.items = items;
        this.orderIssueCount = orderIssueCount;
      } catch (err) {
        // Silent — the notification bell is a convenience, not a critical path.
      } finally {
        this.loading = false;
      }
    },
  });
});
