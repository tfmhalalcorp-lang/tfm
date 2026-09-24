// One-off script to bulk-create the demo staff accounts requested for
// testing the new role model (see supabase/migrations/022_role_restructure.sql).
//
// Creates, for each entry below, an auth user + matching `profiles` row
// (via the same handle_new_user() trigger the app already relies on) with:
//   - email:    <username>@<AUTH_EMAIL_DOMAIN>   (same scheme as
//               netlify/functions/admin-users.js)
//   - password: <username> + "123"               (meets the 6-char min
//               the app enforces; e.g. pd1 -> "pd1123", admin01 -> "admin01123")
//   - fullname: defaults to the username itself (handle_new_user()'s own
//               fallback) — edit USERS below if you want real names.
//
// Usage (run locally, NOT from the browser — this uses the service-role
// key and must never run client-side):
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   node scripts/create-demo-users.js
//
// Safe to re-run: an already-existing username is reported and skipped.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_EMAIL_DOMAIN = process.env.AUTH_EMAIL_DOMAIN || 'tfm-internal.app';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const USERS = [
  { username: 'pd1', role: 'pd' },
  { username: 'pd2', role: 'pd' },
  { username: 'pd3', role: 'pd' },
  { username: 'wh1', role: 'wh' },
  { username: 'wh2', role: 'wh' },
  { username: 'wh3', role: 'wh' },
  { username: 'qc1', role: 'qc' },
  { username: 'qc2', role: 'qc' },
  { username: 'qc3', role: 'qc' },
  { username: 'ma1', role: 'ma' },
  { username: 'ma2', role: 'ma' },
  { username: 'ma3', role: 'ma' },
  { username: 'admin01', role: 'admin' },
  { username: 'admin02', role: 'admin' },
  { username: 'admin03', role: 'admin' },
];

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  for (const { username, role } of USERS) {
    const password = `${username}123`;
    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, role },
    });
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')) {
        console.log(`SKIP   ${username} (${role}) — already exists`);
      } else {
        console.error(`FAIL   ${username} (${role}) — ${error.message}`);
      }
      continue;
    }
    console.log(`CREATED ${username} (${role}) — password: ${password} — id: ${data.user.id}`);
  }
}

main().then(() => process.exit(0));
