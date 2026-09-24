// Privileged user-management endpoint. Runs only in Netlify's serverless
// runtime — the service role key used here is never shipped to the browser.
//
// POST /.netlify/functions/admin-users   (also reachable at /api/admin-users)
// Headers: Authorization: Bearer <caller's current Supabase access_token>
// Body:    { action: 'create'|'update'|'delete', ...payload }
//
//   create: { username, password, fullname, role }
//   update: { id, fullname?, role?, password? }
//   delete: { id }
//
// Every request is verified server-side: the bearer token must belong to a
// real, current session, and that session's profile.role must be 'admin'.
// Listing users does NOT go through this function — the Settings > Users
// screen reads `profiles` directly, which RLS already allows admins to do.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH_EMAIL_DOMAIN = process.env.AUTH_EMAIL_DOMAIN || 'tfm-internal.app';

const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;
const ROLES = ['admin', 'pd', 'wh', 'qc', 'ma', 'sale'];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function usernameToEmail(username) {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Content-Type': 'application/json' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(500, { success: false, error: 'Server misconfigured: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return json(401, { success: false, error: 'Missing authorization token' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { success: false, error: 'Invalid JSON body' });
  }

  const { action } = body;
  if (!['create', 'update', 'delete'].includes(action)) {
    return json(400, { success: false, error: 'Invalid action' });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Verify the caller's token identifies a real, current user.
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return json(401, { success: false, error: 'Invalid or expired session' });
  }
  const callerId = userData.user.id;

  // 2. Verify the caller is an admin (looked up with the service-role
  //    client, so this check itself is not subject to RLS).
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single();
  if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
    return json(403, { success: false, error: 'Forbidden: admin role required' });
  }

  try {
    if (action === 'create') {
      const { username, password, fullname, role } = body;
      if (!username || !password || !fullname || !role) {
        return json(400, { success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
      }
      const normalizedUsername = String(username).trim().toLowerCase();
      if (!USERNAME_RE.test(normalizedUsername)) {
        return json(400, { success: false, error: 'Username ต้องมี 3-32 ตัวอักษร (a-z, 0-9, _ . -)' });
      }
      if (!ROLES.includes(role)) {
        return json(400, { success: false, error: 'Invalid role' });
      }
      if (String(password).length < 6) {
        return json(400, { success: false, error: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' });
      }

      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: usernameToEmail(normalizedUsername),
        password,
        email_confirm: true,
        user_metadata: { username: normalizedUsername, fullname, role },
      });
      if (createErr) {
        const msg = String(createErr.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('duplicate')) {
          return json(409, { success: false, error: 'Username นี้มีอยู่แล้ว' });
        }
        return json(400, { success: false, error: createErr.message });
      }
      return json(200, {
        success: true,
        data: { id: created.user.id, username: normalizedUsername, fullname, role },
      });
    }

    if (action === 'update') {
      const { id, fullname, role, password } = body;
      if (!id) return json(400, { success: false, error: 'Missing id' });
      if (role !== undefined && !ROLES.includes(role)) {
        return json(400, { success: false, error: 'Invalid role' });
      }
      if (password && String(password).length < 6) {
        return json(400, { success: false, error: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' });
      }
      if (id === callerId && role !== undefined && role !== 'admin') {
        return json(400, { success: false, error: 'ไม่สามารถเปลี่ยนสิทธิ์ของตนเองออกจาก admin ได้' });
      }

      const profileUpdate = {};
      if (fullname !== undefined && fullname !== '') profileUpdate.fullname = fullname;
      if (role !== undefined) profileUpdate.role = role;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: updErr } = await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', id);
        if (updErr) return json(400, { success: false, error: updErr.message });
      }

      if (password) {
        const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
        if (pwErr) return json(400, { success: false, error: pwErr.message });
      }

      return json(200, { success: true, data: { id } });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return json(400, { success: false, error: 'Missing id' });
      if (id === callerId) {
        return json(400, { success: false, error: 'ไม่สามารถลบบัญชีของตนเองได้' });
      }
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (delErr) return json(400, { success: false, error: delErr.message });
      return json(200, { success: true, data: { id } });
    }
  } catch (err) {
    return json(500, { success: false, error: (err && err.message) || 'Server error' });
  }

  return json(400, { success: false, error: 'Unhandled action' });
};
