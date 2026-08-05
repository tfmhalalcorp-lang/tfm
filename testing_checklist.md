# OrderCenter Testing Checklist (Supabase + Netlify)

## 1. Setup & Installation
- [ ] **Supabase Schema**: `supabase/schema.sql` run successfully on a fresh project (no errors)?
- [ ] **Order Management Migration**: `supabase/migrations/002_order_management.sql` run successfully (no errors)?
- [ ] **Auth Signups Disabled**: Authentication → Providers → Email → "Allow new users to sign up" is OFF?
- [ ] **Bootstrap Admin**: First admin user created via Supabase Dashboard with correct `user_metadata`, and a matching `profiles` row exists (check Table Editor)?
- [ ] **Frontend Config**: `frontend/js/config.js` has the real `SUPABASE_URL` / `SUPABASE_ANON_KEY`?
- [ ] **Netlify Env Vars**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in Netlify site settings (not committed to git)?
- [ ] **Netlify Function Live**: `POST /api/admin-users` reachable (test after deploy, e.g. via the Users screen)?

## 2. Authentication
- [ ] **Login Success**: Can log in with the bootstrap `admin` account?
- [ ] **Login Fail**: Wrong password shows a Thai error message, not a stack trace?
- [ ] **Session Persistence**: Refreshing the page keeps you logged in (session restored from Supabase Auth)?
- [ ] **Session Display**: Logged-in user's full name shows in the top bar?
- [ ] **Logout**: Returns to the login screen and clears the session?
- [ ] **Role-based Menu**: Each role (`admin`, `prod`, `wh`, `qc`, `ma`, `rpt`) sees only its allowed sidebar sections?
- [ ] **RLS enforcement (not just UI)**: Logged in as a non-admin role, attempt a write via the browser console directly against a table you shouldn't be able to write (e.g. `supabase.from('customers').insert(...)` as a `prod` user) — confirm Postgres rejects it, proving RLS is the real boundary and not just a hidden menu item.

## 3. Master Data (Settings, admin only)
- [ ] **Create**: Add a new Customer/Brand/Supplier/Can Size/Machine — appears in Supabase Table Editor?
- [ ] **Read**: List loads and search box filters correctly?
- [ ] **Update**: Edit a record, confirm the change persists after reload?
- [ ] **Delete**: Delete a record, confirm removed from the table (and that deleting a Customer/Brand still referenced elsewhere is blocked by FK constraints where expected)?
- [ ] **Validation**: Empty required fields show a Thai warning and block save?
- [ ] **User Management**: Create a new user via Settings → Users; confirm it can log in with the username you chose; confirm password reset (leave-blank-to-keep behavior) works on edit; confirm `admin` and your own account can't be deleted from the UI.

## 4. Production Transactions
- [ ] **Batch Setup**: Can create a Batch; `batch_id` becomes read-only/immutable once editing an existing batch (DB trigger blocks direct changes too)?
- [ ] **RM Usage**: Can save RM usage against an open batch; selecting a Supplier auto-fills Fish Type (still editable)?
- [ ] **Can Usage**: Works from both the Production menu and QC menu (shared table)?
- [ ] **Production Quantity**: Can save/edit/delete records?
- [ ] **Fill Weight**: Can save under the QC menu?
- [ ] **Warehouse Stock In**: Can save with Brand + SO No. + good/hold quantities?
- [ ] **Waste Log (PD/WH/QC)**: Each department's menu entry only shows its own department's rows; total waste column sums correctly; a `prod` user cannot write a waste row with `department: 'WH'` (RLS)?
- [ ] **Maintenance/Breakdown**: Start/End time auto-computes Downtime (including a run that crosses midnight)?
- [ ] **Issue Log**: New entries default Department/Reporter from the logged-in user's role & name; status badge updates correctly?
- [ ] **Required-field validation**: Every transaction modal blocks submission with a Thai message when required fields are empty?

## 5. Dashboards
- [ ] **Main Dashboard**: Scorecards, batch charts, warehouse gauge and brand pie chart all render with real data?
- [ ] **Waste Dashboard**: Department totals and the by-department / by-batch tables match manual totals for a known small dataset?
- [ ] **RM Assessment Dashboard**: Supplier pies, the usage-over-time line chart, and the Batch × Supplier crosstab (with %Yield) look correct?
- [ ] **Date range + Batch filter**: Changing filters and clicking "แสดงผลข้อมูล" updates all charts; "วันนี้" resets to today?
- [ ] **Responsiveness**: Scorecards and charts stack correctly on mobile widths?

## 6. Reports
- [ ] **Production Report**: RM usage table + per-batch Yield% table match expectations; Batch/Brand filters narrow results correctly?
- [ ] **Warehouse Report**: Per-brand subtotal rows and grand total are correct?
- [ ] **Fill Weight Report**: Batch text-search filter works; Total/Average rows correct?
- [ ] **QC Report**: 9-field waste breakdown totals match the Waste Dashboard for the same date range?
- [ ] **Maintenance Report**: Incident count and total downtime scorecards match the table?
- [ ] **Excel Export**: Each report's Excel button downloads a `.xlsx` with the expected Thai filename and sheet name(s)?
- [ ] **PDF Export**: Each report's PDF button downloads a readable PDF of the printable area only (filter bar/export buttons excluded)?

## 6b. Order Management (SO/PI → Plan → Delivery → Accounting)
- [ ] **Products**: Create a product under Settings → Products?
- [ ] **SO/PI**: Create an SO and a PI record, each with customer/brand/product/qty?
- [ ] **Production Plan**: Create a plan referencing an SO/PI; `plan_no` and dates save correctly?
- [ ] **Warehouse Load-Ready**: Create a load-ready-date record referencing an SO/PI?
- [ ] **Stock In references SO/PI**: The existing Warehouse → Stock In form's SO/PI dropdown populates and, once selected, the row's SO No. column shows the chosen doc_no?
- [ ] **Delivery**: Create a delivery (Bill of Load Date + IV No.) referencing an SO/PI?
- [ ] **Accounting**: Create an accounting entry by selecting an IV No.; confirm a second entry for the *same* IV No. is rejected (unique constraint)?
- [ ] **Order Hub**: All SO/PI rows list correctly; the แผนการผลิต and ส่งมอบ buttons turn green once a record exists for that row and re-open the existing record for editing on a second click; the บัญชี button shows "ยังไม่มีข้อมูลจัดส่ง" until a delivery exists, then opens the accounting form; the จัดเตรียม / ผลิต-คลัง buttons show the "coming soon" message?
- [ ] **RLS**: Non-admin roles cannot write to any of the 6 new tables (still readable, e.g. so the Stock-In dropdown works, but insert/update/delete blocked)?

## 7. Mobile Experience
- [ ] **Hamburger Menu**: Opens/closes the sidebar on narrow viewports?
- [ ] **Sidebar Overlay**: Tapping outside the open sidebar closes it?
- [ ] **Tables**: Wide tables (reports, crosstabs) scroll horizontally within their card instead of breaking the page layout?
- [ ] **Modals**: Add/Edit modals are usable (scrollable, legible) on a 375px-wide screen?

## 8. Security & Performance
- [ ] **HTTPS**: Netlify default (should be automatic)?
- [ ] **CSP**: No console CSP violations when using the app normally (check `netlify.toml`'s `Content-Security-Policy` header against browser devtools console)?
- [ ] **Service role key**: Confirm via browser devtools → Network/Sources that `SUPABASE_SERVICE_ROLE_KEY` never appears in any response or bundled JS served to the browser?
- [ ] **Speed**: Dashboard loads within a few seconds for a realistic data volume?
- [ ] **Concurrency**: Two browser tabs saving different transactions at the same time both succeed without clobbering each other (Postgres handles this natively — no more `LockService` needed)?
