import { supabase } from './supabaseClient.js';

const AUTH_EMAIL_DOMAIN = 'tfm-internal.app';
const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

export function usernameToEmail(rawUsername) {
  const normalized = String(rawUsername || '').trim().toLowerCase();
  if (!USERNAME_RE.test(normalized)) {
    throw new Error('Username ไม่ถูกต้อง (ใช้ได้เฉพาะ a-z, 0-9, _ . - และยาว 3-32 ตัวอักษร)');
  }
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}

document.addEventListener('alpine:init', () => {
  Alpine.store('auth', {
    session: null,
    profile: null,
    ready: false,
    isAuthenticated: false,

    get role() {
      return this.profile ? this.profile.role : null;
    },
    get fullname() {
      return this.profile ? this.profile.fullname : '';
    },
    get username() {
      return this.profile ? this.profile.username : '';
    },
    get userId() {
      return this.session && this.session.user ? this.session.user.id : null;
    },

    async init() {
      const { data } = await supabase.auth.getSession();
      await this._applySession(data.session);
      this.ready = true;

      supabase.auth.onAuthStateChange(async (_event, session) => {
        await this._applySession(session);
      });
    },

    async _applySession(session) {
      if (session && session.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          this.session = null;
          this.profile = null;
          this.isAuthenticated = false;
        } else {
          this.session = session;
          this.profile = profile;
          this.isAuthenticated = true;
        }
      } else {
        this.session = null;
        this.profile = null;
        this.isAuthenticated = false;
      }
    },

    async login(username, password) {
      if (!username || !password) throw new Error('กรุณากรอก Username และ Password');
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Username หรือ Password ไม่ถูกต้อง');
      await this._applySession(data.session);
      if (!this.profile) {
        await supabase.auth.signOut();
        throw new Error('ไม่พบข้อมูลผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
      }
    },

    async logout() {
      await supabase.auth.signOut();
      this.session = null;
      this.profile = null;
      this.isAuthenticated = false;
    },
  });

  Alpine.data('loginForm', () => ({
    username: '',
    password: '',
    loading: false,

    async submit() {
      this.loading = true;
      try {
        await Alpine.store('auth').login(this.username, this.password);
        this.password = '';
        if (window.navigateTo) window.navigateTo('dashboard');
      } catch (err) {
        window.Swal?.fire({ icon: 'error', title: 'เข้าสู่ระบบไม่สำเร็จ', text: err.message });
      } finally {
        this.loading = false;
      }
    },
  }));
});
