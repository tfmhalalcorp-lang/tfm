// Entry point. Placed before the Alpine CDN <script defer> tag in
// index.html so every Alpine.store()/Alpine.data() registration below
// (directly, or transitively via these imports) runs before Alpine
// dispatches its 'alpine:init' event and calls Alpine.start().
import './lib/auth.js';
import './lib/role-access.js';
import { startUiObserver } from './lib/ui-observer.js';
import './router.js';

// --- View modules: each self-registers with the router via registerView() ---
import './views/master-customers.js';
import './views/master-brands.js';
import './views/master-suppliers.js';
import './views/master-cansizes.js';
import './views/master-machines.js';
import './views/master-users.js';
import './views/master-products.js';

import './views/order-hub.js';
import './views/order-so-pi.js';
import './views/order-plan.js';
import './views/order-delivery.js';
import './views/order-accounting.js';
import './views/wh-load-ready.js';

import './views/txn-batch.js';
import './views/txn-rm.js';
import './views/txn-can.js';
import './views/txn-fillq.js';
import './views/txn-fillw.js';
import './views/txn-whin.js';
import './views/txn-qcwaste.js';
import './views/txn-machinepm.js';
import './views/issue-log.js';

import './views/dashboard-main.js';
import './views/dashboard-waste.js';
import './views/dashboard-rm.js';

import './views/report-production.js';
import './views/report-warehouse.js';
import './views/report-fillweight.js';
import './views/report-qc.js';
import './views/report-maintenance.js';

document.addEventListener('alpine:init', () => {
  Alpine.store('auth')
    .init()
    .then(() => {
      if (Alpine.store('auth').isAuthenticated) {
        window.navigateTo('dashboard');
      }
    });
});

startUiObserver();
