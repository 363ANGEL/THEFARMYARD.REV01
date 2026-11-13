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
    /* Sidebar-footer avatar: the member's face, 44px, same ring as the yard strip (.fy-face). */
    faceDot(m) { return FY.faceRing(m, 44, 'Your character'); },
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
      const rows = data || [];
      // About the yard and Admin are Home sub-items; synthesised until rooms-visibility.sql adds the rows.
      [{ id: 'about', label: 'About the yard', path: 'about.html', icon: 'ph ph-question', sort: 13 },
       { id: 'admin', label: 'Admin', path: 'admin.html', icon: 'ph ph-gear-six', sort: 14 }].forEach(x => {
        if (!rows.some(r => r.id === x.id)) rows.push({ ...x, status: 'ship', grp: 'home', parent_id: 'dashboard' });
      });
      rows.sort((a, b) => (a.sort || 0) - (b.sort || 0));
      return (Barn._rooms = rows);
    },

    /* Launch scope: members see only Home and Poker. The registry's visibility column ('admin' |
       'members') decides; until rooms-visibility.sql has run, only those two ids are 'members'.
       Profile and set-up are never gated. */
    vis(id, row) {
      if (id === 'profile' || id === 'setup') return 'members';
      if (row && row.visibility) return row.visibility;
      return id === 'dashboard' || id === 'poker' ? 'members' : 'admin';
    },
    /* View as, top-right of every page's header, leaders only (never rendered for members).
       Member preview swaps it for a dashed banner carrying Back to admin. Pages overwrite #main,
       so the bar re-seats itself at the top whenever they do. */
    viewBar(main, preview, whoName) {
      const bar = document.createElement('div');
      bar.id = 'fy-viewbar';
      bar.style.cssText = 'flex:none; display:flex; align-items:center; justify-content:flex-end; gap:10px; margin:-6px 0 -4px;';
      if (preview) {
        const who = (whoName ? ' as ' + FY.esc(whoName) : ' as a member');
        bar.innerHTML = `<div style="flex:1; display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:6px 12px; border:1px dashed var(--neon-teal); border-radius:8px; color:var(--neon-teal); text-shadow:0 0 6px rgba(95,211,207,.5);">
          <i class="ph ph-user-circle-gear" style="font-size:var(--ic-md)" aria-hidden="true"></i>
          <span style="flex:1; font-size:var(--fs-sm); letter-spacing:.04em;">Previewing${who} · nothing here saves</span>
          <button type="button" id="fy-back" class="btn btn-teal" style="min-height:32px; font-size:var(--fs-xs);">Back to admin</button></div>`;
        bar.querySelector('#fy-back').addEventListener('click', () => Barn.setPreview(false));
      } else {
        bar.innerHTML = `<label style="display:flex; align-items:center; gap:8px; color:var(--neon-teal);">
          <i class="ph ph-user-circle-gear" style="font-size:var(--ic-md)" aria-hidden="true"></i>
          <span class="kicker">View as</span>
          <select id="fy-viewas" class="input" aria-label="View as" style="width:auto; min-height:32px; padding:2px 8px; font-size:var(--fs-sm);"><option value="admin" selected>Admin</option><option value="member">Member</option></select></label>`;
        const sel = bar.querySelector('#fy-viewas');
        // Every member is an option, claimed or not: that is how a leader tests pages
        // for someone who has never signed in.
        FY.q('member').select('id,nickname').order('nickname').then(({ data }) => {
          (data || []).forEach(m => { const o = document.createElement('option'); o.value = 'member:' + m.id; o.textContent = m.nickname; sel.appendChild(o); });
        }).catch(() => {});
        sel.addEventListener('change', e => {
          const v = e.target.value;
          if (v === 'member') Barn.setPreview(true);
          else if (v.startsWith('member:')) Barn.setPreview(v.slice(7));
        });
      }
      const seat = () => { if (!main.contains(bar)) main.prepend(bar); };
      seat();
      new MutationObserver(seat).observe(main, { childList: true });
    },

    /* View as: a UI-only preview for leaders. It never touches the real role or any RPC.
       'member' previews a generic member; 'member:<uuid>' previews that member's own pages,
       so a leader can walk the site as someone who has never signed in (RAY, 12 Nov).
       Nothing saves while it is on: FY.rpc refuses writes (app.js). */
    _viewAs() { try { return sessionStorage.getItem('fy.viewAs') || ''; } catch (e) { return ''; } },
    previewing() { return /^member(:|$)/.test(Barn._viewAs()); },
    previewMemberId() { const v = Barn._viewAs(); return v.startsWith('member:') ? v.slice(7) : null; },
    setPreview(on) {
      try {
        if (!on) sessionStorage.removeItem('fy.viewAs');
        else sessionStorage.setItem('fy.viewAs', on === true ? 'member' : 'member:' + on);
      } catch (e) { /* private mode */ }
      location.reload();
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
      let rooms = [];
      try { rooms = await Barn.rooms(); } catch (e) { /* sidebar renders without registry rows */ }
      // me.role can be missing on a stale fy.me(); the server's own check settles it.
      const realLeader = me.role === 'leader' || !!me.is_admin || (!me.role && await FY.rpc('is_leader').then(Boolean).catch(() => false));
      const preview = realLeader && Barn.previewing();
      const leader = realLeader && !preview;
      if (!leader && Barn.vis(page, rooms.find(r => r.id === page)) !== 'members') {
        // Admin-only page: members go to the Dashboard (a leader's own member preview too).
        const ok = !preview && await FY.rpc('is_leader').then(Boolean).catch(() => false);
        if (!ok) { location.replace('dashboard.html'); return null; }
      }
      // page UI keys off role; previewing a named member stands their whole row in for yours
      let meView = preview ? { ...me, role: 'member', is_admin: false } : me;
      let previewName = null;
      if (preview) {
        const pid = Barn.previewMemberId();
        if (pid) {
          const { data } = await FY.q('member').select('*').eq('id', pid).limit(1);
          if (data && data[0]) { meView = { ...data[0], role: 'member', is_admin: false }; previewName = data[0].nickname; }
          else { Barn.setPreview(false); return null; }   // that member has gone: drop back to admin
        }
      }
      Barn.responsive();
      root.innerHTML = `
        <div style="width:100%; min-height:100vh; box-sizing:border-box; padding:16px; overflow-x:auto;">
          <div class="fy-frame" style="min-height:calc(100vh - 32px); display:grid; grid-template-columns:232px minmax(0,1fr); align-items:start; min-width:860px;">
            <nav class="fy-side fy-sidebar" id="side" aria-label="The Barn" style="position:sticky; top:16px; height:calc(100vh - 32px); box-sizing:border-box; overflow-y:auto;"></nav>
            <div class="main" id="main" style="padding:18px 22px; display:flex; flex-direction:column; gap:14px; min-width:0; min-height:calc(100vh - 34px); box-sizing:border-box;"></div>
          </div>
        </div>`;
      Barn.sidebar(document.getElementById('side'), page, meView, rooms, { leader });
      if (realLeader) Barn.viewBar(document.getElementById('main'), preview, previewName);
      return { me: meView, realMe: me, leader, preview, session, main: document.getElementById('main'), root };
    },

    /* A stub row always lands on the Room Template with its room name, never a 404, whatever
       path the registry row carries. Sub-stubs (football-results) use the parent's room copy. */
    stubPath(r) {
      if (r.status !== 'stub' || /^room\.html\?room=/.test(r.path || '')) return r.path;
      return 'room.html?room=' + encodeURIComponent(r.parent_id || r.id);
    },

    /* One registry row as a nav row. Parents are .fy-nav-item, children .nav-sub. */
    _navRow(r, current, openParent, tag) {
      const sub = !!r.parent_id;
      const on = current === r.id;
      const cls = sub ? 'nav-sub' : 'fy-nav-item';
      const open = sub && openParent === r.parent_id ? ' data-open="true"' : '';
      return `<a class="${cls}" href="${esc(Barn.stubPath(r))}" ${on ? 'aria-current="page"' : ''}${open} style="text-decoration:none">
        <i class="${esc(r.icon)}" aria-hidden="true"></i><span style="flex:1">${esc(r.label)}</span>${tag && sub && Barn.vis(r.id, r) !== 'members' ? '<span style="font-size:var(--fs-xs); letter-spacing:.08em; text-transform:uppercase; color:var(--neon-pink-text); text-shadow:none; opacity:.8;">admin</span>' : ''}</a>`;
    },

    sidebar(side, page, me, rooms, opts) {
      rooms = rooms || [];
      const leader = !!(opts && opts.leader);
      const shown = r => r.status !== 'hidden' && r.status !== 'later' && r.id !== 'humidor-admin' && (leader || Barn.vis(r.id, r) === 'members');
      // The page id marks the current row; a current child also lights its parent's group open.
      const byId = Object.fromEntries(rooms.map(r => [r.id, r]));
      const current = byId[page] ? page : ({ yard: 'dashboard' }[page] || page);
      const openParent = byId[current] ? (byId[current].parent_id || current) : null;
      const group = (grp) => {
        const parents = rooms.filter(r => r.grp === grp && !r.parent_id && shown(r));
        return parents.map(p => Barn._navRow(p, current, openParent, leader)
          + rooms.filter(c => c.parent_id === p.id && shown(c))
                 .map(c => Barn._navRow(c, current, openParent, leader)).join('')).join('');
      };
      const sep = '<div style="margin:8px 6px 0; border-top:1px solid color-mix(in srgb, var(--neon-teal) 35%, transparent);"></div>';
      const v = voice.get();
      side.innerHTML = `
        <a class="fy-brand" href="dashboard.html" style="text-decoration:none; color:inherit;"><img src="assets/hank-oink.png" alt="Farmyard"><span>The Farmyard</span></a>
        ${group('home')}
        <div class="fy-nav-group">Leagues</div>
        ${group('leagues')}
        ${leader ? `<div class="fy-nav-group">In beta-testing</div>${group('beta')}` : ''}
        ${leader ? `<a class="fy-nav-item" href="whats-next.html" ${current === 'whats-next' ? 'aria-current="page"' : ''} style="text-decoration:none"><i class="ph ph-thought-bubble" aria-hidden="true"></i><span style="flex:1">What's Next?</span></a>` : ''}
        ${sep}
        <div style="display:flex; align-items:baseline; justify-content:space-between; padding:10px 6px 4px; font-size:var(--fs-xs); letter-spacing:.08em; text-transform:uppercase; color:var(--color-neutral-400);"><span>In the yard</span><span id="fy-online-n" style="color:var(--neon-teal); text-shadow:0 0 6px var(--neon-teal);"></span></div>
        <div id="fy-online" style="flex:1; display:flex; flex-direction:column; gap:2px; overflow-y:auto; min-height:48px;"></div>
        ${sep}
        <div class="fy-voice-head" id="vc">Voice channel</div>
        <button type="button" class="fy-voice fy-voice-live ${v === 'lounge' ? 'is-on' : ''}" data-voice="lounge"><i class="ph ph-speaker-high" style="font-size:var(--ic-sm)"></i><span style="flex:1">LIVE CHANNEL<small>Voice via Discord</small></span><span id="fy-vc-live" style="font-size:var(--fs-xs); font-weight:400; letter-spacing:0; color:var(--color-neutral-400); text-shadow:none;">OFF AIR</span></button>
        <button type="button" class="fy-voice fy-voice-muted ${v === 'parked' ? 'is-on' : ''}" data-voice="parked"><i class="ph ph-speaker-slash" style="font-size:var(--ic-sm)"></i><span style="flex:1">MUTED CHANNEL<small>Idle voice</small></span><span id="fy-vc-muted" style="font-size:var(--fs-xs); font-weight:400; letter-spacing:0; color:var(--color-neutral-400); text-shadow:none;">0</span></button>
        <div id="vtip"></div>
        ${sep}
        <div id="fy-footer-row" style="display:flex; gap:8px; align-items:stretch; margin-top:8px;">
        <a href="profile.html" ${current === 'profile' ? 'aria-current="page"' : ''} style="flex:1; min-width:0; display:flex; gap:10px; align-items:center; padding:6px 10px 6px 8px; border-radius:8px; font-size:var(--fs-sm); font-weight:600; color:var(--color-text); text-decoration:none; border:1px solid var(--neon-teal); box-shadow:${current === 'profile' ? 'inset 0 0 0 1.5px var(--neon-teal), 0 0 10px rgba(95,211,207,.55)' : 'none'};">
          ${Barn.faceDot(me)}
          <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(me.nickname)}</span>
          <i class="ph ph-gear" style="color:var(--color-neutral-400); font-size:var(--ic-lg)"></i></a>
        </div>`;
      Barn.voiceCounts(side);
      side.querySelectorAll('[data-voice]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.voice; voice.set(k);
        side.querySelectorAll('[data-voice]').forEach(x => x.classList.toggle('is-on', x === b));
        const tip = side.querySelector('#vtip'); tip.innerHTML = '<div style="margin:6px 6px 0; padding:8px 10px; border:1px solid #9eeae6; border-radius:6px; box-shadow:0 0 4px var(--neon-teal), 0 0 10px rgba(95,211,207,.4); font-size:var(--fs-xs); line-height:1.4; color:#c8f4f2; text-shadow:0 0 4px rgba(95,211,207,.5); animation:payDrop .25s ease-out;">Click <strong>Join Voice</strong> in Discord to confirm.</div>';
        clearTimeout(Barn._tipT); Barn._tipT = setTimeout(() => { tip.innerHTML = ''; }, 6000);
        if (window.Presence && Presence.setVoice) Presence.setVoice(true);
        window.open(`https://discord.com/channels/${DISCORD.guild}/${DISCORD[k]}`, '_blank', 'noopener');
      }));
    },

    /* Voice counts from the Discord widget JSON. Never blocks render: the buttons paint in their
       OFF AIR / 0 state at once, the last result (sessionStorage) paints immediately on a revisit,
       and the fetch runs after first paint and only updates the numbers when it returns. */
    voiceCounts(side) {
      const KEY = 'fy.widget';
      const paint = d => {
        if (!d) return;
        const live = side.querySelector('#fy-vc-live'), muted = side.querySelector('#fy-vc-muted');
        if (live) live.textContent = d.lounge > 0 ? d.lounge + ' in' : 'OFF AIR';
        if (muted) muted.textContent = String(d.parked || 0);
      };
      try { paint(JSON.parse(sessionStorage.getItem(KEY))); } catch (e) { /* no cache yet */ }
      setTimeout(async () => {
        try {
          const r = await fetch(`https://discord.com/api/guilds/${DISCORD.guild}/widget.json`);
          if (!r.ok) return;                       // widget disabled or rate-limited: keep what's painted
          const j = await r.json();
          const inCh = id => (j.members || []).filter(m => m.channel_id === id).length;
          const d = { lounge: inCh(DISCORD.lounge), parked: inCh(DISCORD.parked), t: Date.now() };
          try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* private mode */ }
          paint(d);
        } catch (e) { /* offline: counts stay as painted */ }
      }, 0);
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
