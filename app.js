/* Farmyard Hub shared client. Loaded after supabase-js UMD and config.js. */
(function () {
  const C = window.FY_CONFIG;
  const wired = C && !/REPLACE/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY);
  const sb = wired ? supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { db: { schema: 'fy' } }) : null;

  const FY = {
    sb,
    wired,
    async league() {
      if (FY._league) return FY._league;
      const { data, error } = await sb.from('league').select('*').eq('slug', C.LEAGUE_SLUG).single();
      if (error) throw error;
      return (FY._league = data);
    },
    async session() { const { data } = await sb.auth.getSession(); return data.session; },
    async me() {
      if (!(await FY.session())) return null;
      let { data, error } = await sb.rpc('me');
      if (error) throw error;
      if (!(data && data.id)) {   // not linked yet: bind a row that matches their Discord id or email (fy.link_me), then look again
        await sb.rpc('link_me').catch(() => {});
        ({ data, error } = await sb.rpc('me'));
        if (error) throw error;
      }
      return data && data.id ? data : null;
    },
    signIn(redirectTo) {
      return sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: redirectTo || window.location.origin + '/dashboard.html' } });
    },
    async signOut() { try { sessionStorage.removeItem('fy.voice'); } catch (e) {} await sb.auth.signOut(); location.reload(); },
    /* While a leader is previewing a named member, nothing may be written: the session is still
       theirs, so a save would land on their own row, not the member's. Reads pass through. */
    _writeRpc: /^(set_|admin_|record_|issue_|decide_|settle_|create_|delete_|link_|touch_)/,
    previewingMember() { return !!(window.Barn && Barn.previewMemberId && Barn.previewMemberId()); },
    async rpc(name, args) {
      if (FY._writeRpc.test(name) && FY.previewingMember()) {
        FY.toast('Previewing another member — nothing saves. Go back to admin first.');
        throw new Error('previewing: ' + name + ' not run');
      }
      const { data, error } = await sb.rpc(name, args || {});
      if (error) throw new Error(error.message || String(error));
      return data;
    },
    q(table) {
      const t = sb.from(table);
      if (!FY.previewingMember()) return t;
      const stop = () => { FY.toast('Previewing another member — nothing saves. Go back to admin first.'); return Promise.reject(new Error('previewing: write blocked')); };
      return new Proxy(t, { get: (o, k) => (k === 'update' || k === 'insert' || k === 'upsert' || k === 'delete') ? stop : Reflect.get(o, k).bind(o) });
    },
    // A member's face: their chosen logo (avatar_url) or the full-colour stock animal (avatar key), at every size.
    // Takes a member row or a key; px kept for callers but no longer changes the art (face marks retired, FARMYARD-STYLE.md 28 Oct).
    face(m, px) {
      if (m && typeof m === 'object' && m.avatar_url) return m.avatar_url;
      const key = m && typeof m === 'object' ? m.avatar : m;
      return `assets/avatars/${['hen', 'cock', 'pig', 'sheep', 'goat', 'cow'].includes(key) ? key : 'hen'}.svg`;
    },
    // Ringed member face (see .fy-face in farmyard.css). Returns HTML; pass a member row or key.
    faceRing(m, px, label) {
      const plain = !(m && typeof m === 'object' && m.avatar_url);
      const rw = px <= 40 ? '1.5px' : '2px';
      return `<span class="fy-face${plain ? ' plain' : ''}" style="--s:${px}px;--rw:${rw}" role="img" aria-label="${FY.esc(label || '')}"><img src="${FY.esc(FY.face(m, px))}" alt=""></span>`;
    },
    avatar(m) { return `<img class="avatar" src="${FY.esc(FY.face(m, 48))}" alt="" width="48" height="48">`; },
    fmt(n) { return `<span class="num">${Number(n)}</span>`; },
    toast(msg) {
      let t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false;
      clearTimeout(FY._tt); FY._tt = setTimeout(() => { t.hidden = true; }, 4000);
    },
    async requireLeader() {
      let ok = false; try { ok = wired && await FY.rpc('is_leader'); } catch (e) { ok = false; }
      if (!ok) { document.body.innerHTML = '<main class="wrap"><h1>Admin only</h1><p>Sign in as RAY to use this page.</p><p><a href="tables.html">Back to the tables</a></p></main>'; throw new Error('not leader'); }
    },
    esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  };
  window.FY = FY;

  // Session expiry / sign-out in another tab: reload so the page drops member-only content.
  // Only when a session existed before, so a page that loads signed out can never reload-loop.
  if (sb) {
    let hadSession = false;
    sb.auth.getSession().then(({ data }) => { if (data.session) hadSession = true; });
    sb.auth.onAuthStateChange((ev, session) => {
      if (session) hadSession = true;
      else if (ev === 'SIGNED_OUT' && hadSession) location.reload();
      if (session) stampLogin();
    });
    // last_login (Admin shows it): stamped once per browser session, not per page load.
    // SIGNED_IN on its own is unreliable - the OAuth redirect is often handled before this
    // listener attaches - so any authenticated load stamps if this browser session has not.
    function stampLogin() {
      try { if (sessionStorage.getItem('fy_login_stamped')) return; sessionStorage.setItem('fy_login_stamped', '1'); } catch (e) {}
      sb.rpc('touch_login').catch(() => {});
    }
    sb.auth.getSession().then(({ data }) => { if (data.session) stampLogin(); });
  }

  // Invite round trip: if Discord sent the new login to any other page (for example the Site URL, because the claim URL
  // was not on the redirect allow-list), carry the saved invite token on to claim.html, which binds it.
  if (sb && !/claim\.html$/.test(location.pathname)) {
    let t = null; try { t = localStorage.getItem('fy_claim_token') || sessionStorage.getItem('fy_claim_token'); } catch (e) {}
    if (t && /^[0-9a-f]{32}$/.test(t)) {
      sb.auth.getSession().then(async ({ data }) => {
        if (!data.session) return;
        const m = await FY.me().catch(() => undefined);
        if (m === null) location.replace('claim.html?claim=' + t);
      }).catch(() => {});
    }
  }

  // Shared header: sign-in state. Pages include <header id="fy-header"></header>.
  document.addEventListener('DOMContentLoaded', async () => {
    const h = document.getElementById('fy-header');
    if (!h) return;
    if (!wired) { h.innerHTML = '<nav class="bar"><a href="dashboard.html" class="brand">The Farmyard</a><span class="muted">Not wired to the database yet</span></nav>'; return; }
    const me = await FY.me().catch(() => null);
    const s = await FY.session();
    h.innerHTML = `<nav class="bar">
      <a href="dashboard.html" class="brand">The Farmyard</a>
      <a href="dashboard.html">Dashboard</a>
      <a href="tables.html">Tables</a>
      <a href="poker.html">Poker</a>
      ${s ? `<a href="profile.html">${me ? FY.esc(me.nickname) : 'Profile'}</a>` : ''}
      ${me && me.role === 'leader' ? '<a href="admin.html">Admin</a>' : ''}
      ${s ? '<button id="fy-out" class="ghost">Sign out</button>' : '<button id="fy-in" class="pink">Sign in with Discord</button>'}
    </nav>`;
    document.getElementById('fy-in')?.addEventListener('click', () => FY.signIn());
    document.getElementById('fy-out')?.addEventListener('click', () => FY.signOut());
  });
})();
