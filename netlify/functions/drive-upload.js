// Uploads/deletes the customer's BL file in Google Drive, on behalf of the
// "บันทึกการส่งมอบ" (Delivery) screen in js/views/order-hub.js. Runs only
// in Netlify's serverless runtime — the Google service-account key used
// here is never shipped to the browser.
//
// POST /.netlify/functions/drive-upload   (also reachable at /api/drive-upload)
// Headers: Authorization: Bearer <caller's current Supabase access_token>
// Body:
//   { action: 'upload', filename, mimeType, dataBase64 }
//   { action: 'delete', fileId }
//
// Every request is verified server-side: the bearer token must belong to a
// real, current session, and that session's profile.role must be 'admin'
// (same gate as the delivery-docs storage policies this replaces).
//
// Required env vars (Netlify site settings):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  — service account's client_email
//   GOOGLE_PRIVATE_KEY            — service account's private_key (PEM,
//                                   with literal \n escaped as \\n)
//   GOOGLE_DRIVE_FOLDER_ID        — Drive folder ID the files go into,
//                                   shared with the service account as Editor

const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const { Readable } = require('stream');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Comfortably under Netlify's ~10MB function payload cap after base64 overhead (~33%).
const MAX_UPLOAD_BYTES = 7 * 1024 * 1024;

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function driveClient() {
  const auth = new google.auth.JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
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
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_DRIVE_FOLDER_ID) {
    return json(500, {
      success: false,
      error: 'Server misconfigured: missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID env vars',
    });
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
  if (!['upload', 'delete'].includes(action)) {
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

  // 2. Verify the caller is an admin (same gate as the delivery-docs
  //    storage policies this endpoint replaces).
  const { data: callerProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .single();
  if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
    return json(403, { success: false, error: 'Forbidden: admin role required' });
  }

  try {
    const drive = driveClient();

    if (action === 'upload') {
      const { filename, mimeType, dataBase64 } = body;
      if (!filename || !dataBase64) {
        return json(400, { success: false, error: 'Missing filename or file data' });
      }
      const buffer = Buffer.from(dataBase64, 'base64');
      if (buffer.length > MAX_UPLOAD_BYTES) {
        return json(400, { success: false, error: `ไฟล์ใหญ่เกินไป (จำกัดไม่เกิน ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)}MB)` });
      }

      const { data: file } = await drive.files.create({
        requestBody: { name: filename, parents: [GOOGLE_DRIVE_FOLDER_ID] },
        media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
        fields: 'id, webViewLink',
      });

      // "Anyone with the link" can view — the link itself is only ever
      // surfaced to logged-in OrderCenter users, matching the access
      // model of the signed-URL approach this replaces (no expiry, unlike
      // a signed URL, but the file ID is unguessable).
      await drive.permissions.create({
        fileId: file.id,
        requestBody: { role: 'reader', type: 'anyone' },
      });

      return json(200, { success: true, data: { id: file.id, viewUrl: file.webViewLink } });
    }

    if (action === 'delete') {
      const { fileId } = body;
      if (!fileId) return json(400, { success: false, error: 'Missing fileId' });
      await drive.files.delete({ fileId });
      return json(200, { success: true, data: { id: fileId } });
    }
  } catch (err) {
    return json(500, { success: false, error: (err && err.message) || 'Server error' });
  }

  return json(400, { success: false, error: 'Unhandled action' });
};
