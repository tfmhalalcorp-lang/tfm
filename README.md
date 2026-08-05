# OrderCenter — ระบบบูรณาการคำสั่งซื้อครบวงจร

A Thai-language Single Page Application for managing production, warehouse,
QC, maintenance, and order-fulfillment workflows for Taveechai Food
Manufacturing — from receiving a customer order (SO/PI) through production
planning, warehouse loading, delivery, and accounting.

**Stack**: HTML5 + Tailwind CSS (CDN) + Alpine.js + Supabase JS, deployed as a
static site on Netlify. Database, authentication, and row-level authorization
are all provided by [Supabase](https://supabase.com) (Postgres + Auth + RLS).
One small Netlify serverless Function handles privileged user-account
management (create/update/delete logins) using a service-role key that never
reaches the browser.

> This is a from-scratch rewrite of the original Google Apps Script + Google
> Sheets version. The old `backend/` folder (Apps Script source) is kept only
> for historical reference — it is **not used** by this system anymore and can
> be deleted once you've migrated.

## Folder Structure

```
frontend/                 Static site — this is the Netlify "publish" directory
  index.html               App shell: login screen, sidebar, top bar, view container
  css/style.css             Small overrides (3rd-party widget theming, print styles)
  manifest.json             PWA manifest ("Add to Home Screen")
  js/
    config.js                 <-- EDIT THIS: your Supabase URL + anon key
    tailwind-config.js        Tailwind theme (brand colors, font)
    main.js                   App entry point
    router.js                 View router
    lib/                      Supabase client, auth store, UI helpers, export helpers
    data/                     Reusable CRUD/transaction Alpine.js component factories
    dashboards/                Dashboard aggregation math + data fetchers
    reports/                   Report helpers (printable header, export buttons)
    views/                     One file per screen (master data, transactions, issue log)

supabase/
  schema.sql                Full DB schema: tables, RLS policies, triggers — run once
  migrations/
    002_order_management.sql  Order-to-cash module (SO/PI, plan, delivery, accounting) — run once, after schema.sql

netlify/
  functions/admin-users.js  Privileged user-management endpoint (service role key)

netlify.toml                 Netlify build/redirects/security headers
package.json                 Dependency for the Netlify Function (@supabase/supabase-js)
start-local.bat               Double-click to run locally (Windows, no install needed)
tools/local-server.ps1         The local server start-local.bat runs
```

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates all
   15 tables, Row Level Security policies for every role, and the trigger
   that auto-creates a `profiles` row whenever a login account is created.
3. Run [`supabase/migrations/002_order_management.sql`](supabase/migrations/002_order_management.sql)
   the same way (new query, paste, run) — adds the order-to-cash module
   (Products, SO/PI, Production Plan, Warehouse Load-Ready date, Delivery,
   Accounting) and one new column on `wh_in`. Safe to run once against an
   already-live project; skip it if you haven't reached this feature yet.
4. Go to **Authentication → Providers → Email** and turn **OFF** "Allow new
   users to sign up." Every account in this system is admin-provisioned —
   nobody should be able to self-register.
5. Create the first **admin** account (you need at least one to bootstrap
   everything else): **Authentication → Users → Add user → Create new user**.
   - Email: `admin@tfm-internal.app` (see note on synthetic emails below)
   - Password: your choice — e.g. `1234` is fine for local testing, but use
     something real before this is exposed to real users
   - Auto Confirm User: **Yes**
   - User Metadata (as JSON):
     ```json
     { "username": "admin", "fullname": "System Admin", "role": "admin" }
     ```
   Saving with that metadata makes the database trigger create the matching
   `profiles` row automatically — no extra step needed. This is also how you
   create every other account, or use Settings → Users in the app itself
   once you have one admin (it calls the same underlying mechanism through
   `netlify/functions/admin-users.js`).
6. From **Project Settings → API**, copy the **Project URL** and the
   **anon / public key**. You'll need these in step 2 below. (The anon key is
   safe to publish in the frontend — every table is protected by RLS. Never
   copy the **service_role** key into the frontend; it only goes into the
   Netlify Function's environment variables, step 3.)

### Why "synthetic" emails?

Users log in with a plain **username** (`admin`, `pd_user`, …), matching the
original system. Supabase Auth requires an email internally, so the frontend
deterministically maps `username` → `username@tfm-internal.app` before
calling Supabase Auth — this domain is never actually emailed, it's just a
namespace. You can change the domain by setting `AUTH_EMAIL_DOMAIN` (see
below) — if you do, update it consistently in both the Netlify Function's env
vars and `frontend/js/lib/auth.js`.

## 2. Frontend Configuration

Open [`frontend/js/config.js`](frontend/js/config.js) and fill in the values
from Supabase step 5 above:

```js
export const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';
```

## 3. Netlify Deployment

This app now includes a serverless function (for admin user management), so
use a **git-connected** Netlify site rather than drag-and-drop deploy:

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Netlify: **Add new site → Import an existing project**, pick the repo.
3. Build settings are already defined in [`netlify.toml`](netlify.toml)
   (publish directory `frontend`, functions directory `netlify/functions`) —
   you shouldn't need to change anything in the Netlify UI.
4. Go to **Site configuration → Environment variables** and add:
   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | same Project URL as above |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key from Project Settings → API (secret — never commit this) |
   | `AUTH_EMAIL_DOMAIN` | optional, defaults to `tfm-internal.app` |
5. Deploy. Netlify will install `@supabase/supabase-js` for the function
   automatically (from the root `package.json`).

## 4. First Login & Adding Users

1. Open the deployed site, log in as `admin` with the password you set in
   Supabase step 4.
2. Go to **Settings → Users** to create the rest of your team's accounts
   (`prod`, `wh`, `qc`, `ma`, `rpt` roles) — this calls the Netlify Function,
   which is the only path that can create/edit/delete logins.
3. Set up master data under **Settings** (Customers, Brands, Suppliers, Can
   Sizes, Machines) before recording transactions.

## Security Notes

- **Row Level Security is the real access-control boundary**, not the UI.
  Every table denies all access by default; policies in `supabase/schema.sql`
  grant read access to any authenticated user (dashboards/reports need
  cross-department visibility) and restrict writes per role — see the table
  in the schema file's comments for the exact role → table matrix.
- The **service_role key** lives only in Netlify's environment variables and
  is used only inside `netlify/functions/admin-users.js`, which itself
  verifies the caller is an authenticated admin before doing anything
  privileged. It is never sent to, or reachable from, the browser.
- Passwords are handled entirely by Supabase Auth (hashed, never stored or
  displayed in plaintext) — a deliberate improvement over the legacy system,
  which compared plaintext passwords server-side and even round-tripped a
  user's current password back into the "Edit User" form.
- All content-security-policy / security headers are defined in
  `netlify.toml`.

## Local Development

No build step is required — it's plain ES modules + CDN scripts. But the
frontend uses `<script type="module">`, and browsers refuse to load module
scripts over `file://` (double-clicking `index.html` directly gives a blank
page) — you always need a real `http://` origin, whether that's a local
server or your Netlify deployment.

**Quickest option (Windows, no install):** double-click
[`start-local.bat`](start-local.bat) in the project root. It starts a tiny
local web server (via a PowerShell script using .NET's built-in
`HttpListener` — no Node/Python required) and opens your browser to it
automatically. Keep that window open while you test; close it when you're
done. Edit `frontend/js/config.js` first so it points at your Supabase
project.

**With the Netlify CLI** (needed if you also want to test the `admin-users`
function locally, e.g. creating users from the Users screen):

```bash
npm install
netlify dev
```

Without either, any other static file server pointed at `frontend/` (e.g.
`npx serve frontend`, a VS Code Live Server extension, etc.) works fine too —
just note the `admin-users` function won't be reachable that way, so user
management specifically needs `netlify dev` or an actual Netlify deploy.

## Mobile Use

The layout is fully responsive down to small phone widths (the sidebar
collapses behind a hamburger menu below the `md` breakpoint). Open the
deployed URL in Chrome/Safari on mobile and use "Add to Home Screen" for an
app-like experience (see `frontend/manifest.json`).

## Data Migration from the Old Google Sheets System

Not included in this rewrite (a fresh Supabase database is assumed). If you
need to migrate historical data from Google Sheets, export each sheet to CSV
and write a one-off import script using the Supabase JS client or the
Supabase Dashboard's table CSV import — map each legacy sheet's columns to
the corresponding table in `supabase/schema.sql` (column names are close but
not identical; e.g. legacy `ProdFillQ_Qty` → `prod_fillq.qty`).
