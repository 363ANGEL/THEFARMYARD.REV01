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
      const { data, error } = await sb.rpc('me');
      if (error) throw error;
      return data && data.id ? data : null;
    },
    signIn(redirectTo) {
      return sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: redirectTo || location.href.split('#')[0] } });
    },
    async signOut() { await sb.auth.signOut(); location.reload(); },
    async rpc(name, args) {
      const { data, error } = await sb.rpc(name, args || {});
      if (error) throw new Error(error.message || String(error));
      return data;
    },
    q(table) { return sb.from(table); },
    avatar(key) {
      const k = ['hen', 'cock', 'pig', 'sheep', 'goat', 'cow'].includes(key) ? key : 'hen';
      return `<img class="avatar" src="assets/avatars/${k}.svg" alt="${k}" width="48" height="48">`;
    },
    fmt(n) { return `<span class="num">${Number(n)}</span>`; },
    toast(msg) {
      let t = document.getElementById('toast');
      if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
      t.textContent = msg; t.hidden = false;
      clearTimeout(FY._tt); FY._tt = setTimeout(() => { t.hidden = true; }, 4000);
    },
    async requireLeader() {
      let ok = false; try { ok = wired && await FY.rpc('is_leader'); } catch (e) { ok = false; }
      if (!ok) { document.body.innerHTML = '<main class="wrap"><h1>Leader only</h1><p>Sign in as RAY to use this page.</p><p><a href="tables.html">Back to the tables</a></p></main>'; throw new Error('not leader'); }
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
    });
  }

  // Shared header: sign-in state. Pages include <header id="fy-header"></header>.
  document.addEventListener('DOMContentLoaded', async () => {
    const h = document.getElementById('fy-header');
    if (!h) return;
    if (!wired) { h.innerHTML = '<nav class="bar"><a href="index.html" class="brand">The Farmyard</a><span class="muted">Not wired to the database yet</span></nav>'; return; }
    const me = await FY.me().catch(() => null);
    const s = await FY.session();
    h.innerHTML = `<nav class="bar">
      <a href="index.html" class="brand">The Farmyard</a>
      <a href="tables.html">Tables</a>
      ${s ? `<a href="profile.html">${me ? FY.esc(me.nickname) : 'Profile'}</a>` : ''}
      ${me && me.role === 'leader' ? '<a href="admin.html">Admin</a>' : ''}
      ${s ? '<button id="fy-out" class="ghost">Sign out</button>' : '<button id="fy-in" class="pink">Sign in with Discord</button>'}
    </nav>`;
    document.getElementById('fy-in')?.addEventListener('click', () => FY.signIn());
    document.getElementById('fy-out')?.addEventListener('click', () => FY.signOut());
  });
})();
