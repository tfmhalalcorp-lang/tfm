import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'tfm-spis-auth',
  },
});

/** Current user's access token, for calling netlify/functions/* with Authorization: Bearer <token>. */
export async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.access_token : null;
}

/** POST helper for the privileged Netlify Functions (e.g. admin-users). Throws on error. */
export async function callFunction(name, payload) {
  const token = await getAccessToken();
  if (!token) throw new Error('ไม่ได้เข้าสู่ระบบ');
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({ success: false, error: 'Invalid server response' }));
  if (!res.ok || !json.success) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data;
}
