/* The Barn shell (REV C03). Loaded after app.js on every member page.
   Barn.open(page) draws the door for a signed-out visitor, the "no profile" door for a stranger,
   sends a first-timer to New User Set-up, and otherwise draws the teal frame + 232px sidebar and
   hands back { me, session, main, root }. The sidebar is driven by the fy.room registry; the
   "In the yard" strip is filled by presence.js into #fy-online. Sub-nav rolldown: sidebar-subs.js. */
(function () {
  const esc = s => FY.esc(s);
  const DISCORD = { guild: '1490100899920740483', lounge: '1527009971999608902', parked: '1490100901464248321' };
  const VOICE_KEY = 'fy.voice';
  const voice = {
    get() { try { return sessionStorage.getItem(VOICE_KEY); } catch (e) { return null; } },
    set(k) { try { k ? sessionStorage.setItem(VOICE_KEY, k) : sessionStorage.removeItem(VOICE_KEY); } catch (e) { /* private mode */ } }
  };

  const Barn = {
    DISCORD, voice,
    face: (m, px) => FY.face(m, px),
    discordName(session) {
      const u = (session && session.user && session.user.user_metadata) || {};
      return u.custom_claims?.global_name || u.full_name || u.name || u.preferred_username || u.user_name || 'you';
    },
    async signOut() { voice.set(null); await FY.sb.auth.signOut(); location.href = 'dashboard.html'; },

    /* Rooms registry, cached for the page's life. Rows: { id, label, path, icon, status, grp, parent_id, sort }. */
    async rooms() {
      if (Barn._rooms) return Barn._rooms;
      const { data, error } = await FY.q('room').select('*').order('sort');
      if (error) throw error;
      return (Barn._rooms = data || []);
    },

    /* Logged-out door (1.0 / 2.0 / 3.0 designs, loggedOut state). */
    door(root) {
      root.innerHTML = `<main class="door">
        <img class="hank" src="assets/hank-oink.png" alt="Hank">
        <div class="centre"><h1>The Farmyard.</h1><p>Members only. Hank checks the door.</p></div>
        <div class="card thin">
          <button type="button" id="barn-in" class="btn btn-primary" style="min-height:44px;width:100%"><i class="ph ph-discord-logo" style="font-size:20px"></i>Sign in with Discord</button>
          <span class="small">Discord is just the key. No passwords. Who you are in the yard is up to you.</span>
          <div class="rule-teal" style="margin:4px 0"></div>
          <span class="small">Not on the list yet? <a href="index.html">Join the waitlist</a></span>
        </div></main>`;
      root.querySelector('#barn-in').addEventListener('click', () => FY.signIn(location.href.split('#')[0]));
    },
    /* Signed in but no members row: the invite door explains it. Never the public holding page. */
    noProfile(root) {
      root.innerHTML = '<main class="door"><p class="muted">One moment…</p></main>';
      location.replace('claim.html');
    },

    /* Viewport classes the design's phone/tablet overrides key off. */
    responsive() {
      const apply = () => {
        const w = window.innerWidth;
        document.body.classList.toggle('fy-phone', w <= 640);
        document.body.classList.toggle('fy-compact', w > 640 && w <= 1024);
      };
      apply();
      window.addEventListener('resize', apply);
    },

    async open(page, opts) {
      opts = opts || {};
      const root = document.getElementById('app') || document.body;
      if (!FY.wired) { root.innerHTML = '<main class="door"><p>Not wired to the database yet.</p></main>'; return null; }
      const session = await FY.session();
      if (!session) { Barn.door(root); return null; }
      const me = await FY.me().catch(() => null);
      if (!me) { Barn.noProfile(root); return null; }
      if (!me.setup_at && page !== 'setup') { location.replace('setup.html'); return null; }
      if (opts.bare) return { me, session, root };
      Barn.responsive();
      root.innerHTML = `
        <div style="width:100%; min-height:100vh; box-sizing:border-box; padding:16px; overflow-x:auto;">
          <div class="fy-frame" style="min-height:calc(100vh - 32px); display:grid; grid-template-columns:232px minmax(0,1fr); align-items:start;">
            <nav class="fy-side fy-sidebar" id="side" aria-label="The Barn" style="position:sticky; top:16px; height:calc(100vh - 32px); box-sizing:border-box;"></nav>
            <div class="main" id="main" style="padding:18px 22px; display:flex; flex-direction:column; gap:14px; min-width:0; min-height:calc(100vh - 34px); box-sizing:border-box;"></div>
          </div>
        </div>`;
      let rooms = [];
      try { rooms = await Barn.rooms(); } catch (e) { /* sidebar renders without registry rows */ }
      Barn.sidebar(document.getElementById('side'), page, me, rooms);
      return { me, session, main: document.getElementById('main'), root };
    },

    /* A stub row always lands on the Room Template with its room name, never a 404, whatever
       path the registry row carries. Sub-stubs (football-results) use the parent's room copy. */
    stubPath(r) {
      if (r.status !== 'stub' || /^room\.html\?room=/.test(r.path || '')) return r.path;
      return 'room.html?room=' + encodeURIComponent(r.parent_id || r.id);
    },

    /* One registry row as a nav row. Parents are .fy-nav-item, children .nav-sub. */
    _navRow(r, current, openParent) {
      const sub = !!r.parent_id;
      const on = current === r.id;
      const cls = sub ? 'nav-sub' : 'fy-nav-item';
      const open = sub && openParent === r.parent_id ? ' data-open="true"' : '';
      return `<a class="${cls}" href="${esc(Barn.stubPath(r))}" ${on ? 'aria-current="page"' : ''}${open} style="text-decoration:none">
        <i class="${esc(r.icon)}" aria-hidden="true"></i><span style="flex:1">${esc(r.label)}</span></a>`;
    },

    sidebar(side, page, me, rooms) {
      rooms = rooms || [];
      // The page id marks the current row; a current child also lights its parent's group open.
      const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
      const current = byId[page] ? page : ({ yard: 'dashboard' }[page] || page);
      const openParent = byId[current] ? (byId[current].parent_id || current) : null;
      const group = (grp) => {
        const parents = rooms.filter(r => r.grp === grp && !r.parent_id && r.status !== 'hidden' && r.status !== 'later');
        return parents.map(p => Barn._navRow(p, current, openParent)
          + rooms.filter(c => c.parent_id === p.id && c.status !== 'hidden' && c.status !== 'later')
                 .map(c => Barn._navRow(c, current, openParent)).join('')).join('');
      };
      const sep = '<div style="margin:8px 6px 0; border-top:1px solid color-mix(in srgb, var(--neon-teal) 35%, transparent);"></div>';
      const v = voice.get();
      side.innerHTML = `
        <a class="fy-brand" href="dashboard.html" style="text-decoration:none; color:inherit;"><img src="assets/hank-oink.png" alt="Farmyard"><span>The Farmyard</span></a>
        ${group('home')}
        <div class="fy-nav-group">Leagues</div>
        ${group('leagues')}
        <div class="fy-nav-group">Beta-Testing</div>
        ${group('beta')}
        <a class="fy-nav-item" href="whats-next.html" ${current === 'whats-next' ? 'aria-current="page"' : ''} style="text-decoration:none"><i class="ph ph-thought-bubble" aria-hidden="true"></i><span style="flex:1">What's Next?</span></a>
        ${sep}
        <div style="display:flex; align-items:baseline; justify-content:space-between; padding:10px 6px 4px; font-size:var(--fs-xs); letter-spacing:.08em; text-transform:uppercase; color:var(--color-neutral-400);"><span>In the yard</span><span id="fy-online-n" style="color:var(--neon-teal); text-shadow:0 0 6px var(--neon-teal);"></span></div>
        <div id="fy-online" style="flex:1; display:flex; flex-direction:column; gap:2px; overflow-y:auto; min-height:48px;"></div>
        ${sep}
        <div class="fy-voice-head" id="vc">${[...'Voice channel'].map(c => `<span>${c}</span>`).join('')}</div>
        <button type="button" class="fy-voice fy-voice-live ${v === 'lounge' ? 'is-on' : ''}" data-voice="lounge"><i class="ph ph-speaker-high" style="font-size:var(--ic-sm)"></i><span style="flex:1">LIVE<small>via Discord</small></span><i class="ph ph-phone-x" style="color:var(--color-neutral-400)"></i></button>
        <button type="button" class="fy-voice fy-voice-muted ${v === 'parked' ? 'is-on' : ''}" data-voice="parked"><i class="ph ph-speaker-slash" style="font-size:var(--ic-sm)"></i><span style="flex:1">MUTED<small>on Discord</small></span><span style="font-size:var(--fs-xs); color:var(--color-neutral-400)">0</span></button>
        <div id="vtip"></div>
        ${sep}
        <div style="display:flex; gap:8px; align-items:stretch; margin-top:8px;">
        <a href="profile.html" ${current === 'profile' ? 'aria-current="page"' : ''} style="flex:1; min-width:0; display:flex; gap:10px; align-items:center; padding:6px 10px 6px 8px; border-radius:8px; font-size:var(--fs-sm); font-weight:600; color:var(--color-text); text-decoration:none; border:1px solid var(--neon-teal); box-shadow:${current === 'profile' ? 'inset 0 0 0 1.5px var(--neon-teal), 0 0 10px rgba(95,211,207,.55)' : 'none'};">
          <span style="width:32px; height:32px; border-radius:50%; border:1.5px solid var(--neon-teal); box-shadow:0 0 6px rgba(95,211,207,.6); overflow:hidden; flex:none;"><span role="img" aria-label="Your character" style="display:block; width:100%; height:100%; background:url('${esc(Barn.face(me, 32))}') center / contain no-repeat;"></span></span>
          <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(me.nickname)}</span>
          <i class="ph ph-gear" style="color:var(--color-neutral-400); font-size:var(--ic-lg)"></i></a>
        ${(me.role === 'leader' || me.is_admin) ? `<a href="admin.html" title="Admin" aria-label="Admin" style="flex:none; display:grid; place-items:center; width:44px; border:1px solid var(--neon-teal); border-radius:8px; color:var(--neon-teal); text-decoration:none; box-sizing:border-box; box-shadow:${current === 'admin' ? 'inset 0 0 0 1.5px var(--neon-teal), 0 0 10px rgba(95,211,207,.55)' : 'none'};"><i class="ph ph-shield-star" style="font-size:var(--ic-lg)" aria-hidden="true"></i></a>` : ''}
        </div>
        <a href="about.html" style="display:block; text-align:center; padding:8px 6px 2px; font-size:var(--fs-xs); letter-spacing:.04em; color:var(--neon-teal); text-shadow:0 0 6px rgba(95,211,207,.5); text-decoration:none;">About the yard</a>`;
      side.querySelectorAll('[data-voice]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.voice; voice.set(k);
        side.querySelectorAll('[data-voice]').forEach(x => x.classList.toggle('is-on', x === b));
        const tip = side.querySelector('#vtip'); tip.innerHTML = '<div style="margin:6px 6px 0; padding:8px 10px; border:1px solid #9eeae6; border-radius:6px; box-shadow:0 0 4px var(--neon-teal), 0 0 10px rgba(95,211,207,.4); font-size:var(--fs-xs); line-height:1.4; color:#c8f4f2; text-shadow:0 0 4px rgba(95,211,207,.5); animation:payDrop .25s ease-out;">Click <strong>Join Voice</strong> in Discord to confirm.</div>';
        clearTimeout(Barn._tipT); Barn._tipT = setTimeout(() => { tip.innerHTML = ''; }, 6000);
        if (window.Presence && Presence.setVoice) Presence.setVoice(true);
        window.open(`https://discord.com/channels/${DISCORD.guild}/${DISCORD[k]}`, '_blank', 'noopener');
      }));
      Barn.flicker(side.querySelector('#vc'));
    },

    /* 2.0 Room Template: hang the UNDER CONSTRUCTION sign off the main content panel.
       .fy-sign is absolute (right:22px, top:-6px, tilted); the zero-height wrapper spans the panel
       edge-to-edge so those offsets measure from the teal frame, and the extra top padding keeps the
       tilted sign fully inside the frame (whose overflow would otherwise cut it off). */
    hangSign(main, html) {
      main.style.position = 'relative';
      main.style.paddingTop = '84px';
      const w = document.createElement('div');
      w.style.cssText = 'position:relative; z-index:3; height:0; margin:0 -22px;';
      w.innerHTML = html;
      main.prepend(w);
    },

    /* One letter blips out now and then; the rest of the sign hums steadily. */
    flicker(target) {
      if (!target) return;
      const go = () => {
        const el = typeof target === 'string' ? document.querySelector(target) : target;   // re-query: the title may have been redrawn
        if (!el) { setTimeout(go, 8000); return; }
        const spans = [...el.querySelectorAll('span')].filter(s => s.textContent.trim());
        const s = spans[Math.floor(Math.random() * spans.length)];
        const seq = [[0, .12], [70, 1], [160, .3], [230, 1], [420, .1], [520, 1]].slice(0, Math.random() < .5 ? 2 : 6);
        seq.forEach(([t, op]) => setTimeout(() => { if (s) s.style.opacity = op; }, t));
        setTimeout(go, 5000 + Math.random() * 11000);
      };
      setTimeout(go, 5000 + Math.random() * 11000);
    }
  };
  window.Barn = Barn;
})();
