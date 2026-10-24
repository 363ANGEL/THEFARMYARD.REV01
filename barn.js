/* The Barn shell. Loaded after app.js on every member page (dashboard, poker, profile, set-up).
   Barn.open(page) draws the door for a signed-out visitor, the "no profile" door for a stranger, sends a
   first-timer to New User Set-up, and otherwise draws the sidebar + main frame and hands back { me, main }.
   Voice: LIVE / MUTED pills deep-link to Discord; the last channel clicked stays lit for the session. */
(function () {
  const esc = s => FY.esc(s);
  const DISCORD = { guild: '1490100899920740483', lounge: '1527009971999608902', parked: '1490100901464248321' };
  const PAGES = { yard: 'dashboard.html', poker: 'poker.html', football: 'football.html', calendar: 'calendar.html', humidor: 'humidor.html', profile: 'profile.html' };
  const VOICE_KEY = 'fy.voice';
  const voice = {
    get() { try { return sessionStorage.getItem(VOICE_KEY); } catch (e) { return null; } },
    set(k) { try { k ? sessionStorage.setItem(VOICE_KEY, k) : sessionStorage.removeItem(VOICE_KEY); } catch (e) { /* private mode */ } }
  };

  const Barn = {
    DISCORD, PAGES, voice,
    face: (m, px) => FY.face(m, px),
    discordName(session) {
      const u = (session && session.user && session.user.user_metadata) || {};
      return u.custom_claims?.global_name || u.full_name || u.name || u.preferred_username || u.user_name || 'you';
    },
    async signOut() { voice.set(null); await FY.sb.auth.signOut(); location.href = 'dashboard.html'; },

    /* Logged-out door (1.0 / 2.1 / 3.0 designs, loggedOut state). */
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
    noProfile(root) {
      root.innerHTML = `<main class="door">
        <img class="hank" src="assets/hank-oink.png" alt="Hank">
        <div class="centre"><span class="kicker">Hank doesn't know you yet</span><h1>No profile here</h1>
          <p>You're signed in, but this Discord has no yard profile. Ask RAY for your invite link, then open it while signed in.</p></div>
        <div class="card thin"><button type="button" id="barn-out" class="btn btn-ghost" style="min-height:44px;width:100%">Sign out and switch</button></div></main>`;
      root.querySelector('#barn-out').addEventListener('click', () => Barn.signOut());
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
      root.innerHTML = `<div class="barn-wrap"><div class="barn">
        <nav class="side" id="side" aria-label="The Barn"></nav>
        <div class="main" id="main"></div>
      </div></div>`;
      Barn.sidebar(document.getElementById('side'), page, me);
      return { me, session, main: document.getElementById('main'), root };
    },

    sidebar(side, page, me) {
      const link = (k, icon, name, n) => `<a class="nav ${page === k ? 'on' : ''}" href="${PAGES[k]}" ${page === k ? 'aria-current="page"' : ''}><i class="${icon}"></i><span>${name}</span>${n != null ? `<span class="n">${n}</span>` : ''}</a>`;
      const v = voice.get();
      const pill = (k, cls, icon, label, sub, tail) => `<button type="button" class="voice ${cls} ${v === k ? 'on' : ''}" data-voice="${k}"><i class="ph ph-speaker-${k === 'lounge' ? 'high' : 'slash'} ch"></i><span class="l">${label}<small>${sub}</small></span>${tail}</button>`;
      side.innerHTML = `
        <a class="brand" href="dashboard.html"><img src="assets/hank-oink.png" alt=""><span>The Farmyard</span></a>
        <div class="sep"></div>
        ${link('yard', 'ph ph-squares-four', 'Dashboard')}
        <div class="label">Sections</div>
        ${link('poker', 'ph ph-club', 'Poker')}
        ${link('football', 'ph ph-soccer-ball', 'Football : League')}
        <div class="label">Core</div>
        ${link('calendar', 'ph ph-calendar-blank', 'Calendar')}
        <div class="label">Cigars</div>
        ${link('humidor', 'ph ph-cigarette', 'The Humidor')}
        <div class="grow"></div>
        <div class="sep" style="margin:0 6px"></div>
        <div class="vc ${v ? '' : 'breathe'}" id="vc">${[...'Voice channel'].map(c => `<span>${c}</span>`).join('')}</div>
        ${pill('lounge', 'live', 'high', 'LIVE', 'via Discord', '<i class="ph ph-phone-x"></i>')}
        ${pill('parked', 'muted', 'slash', 'MUTED', 'on Discord', '<span class="n">0</span>')}
        <div id="vtip"></div>
        <div class="sep2"></div>
        <a class="me-btn ${page === 'profile' ? 'on' : ''}" href="profile.html"><span class="face" role="img" aria-label="Your character" style="background-image:url('${esc(Barn.face(me, 32))}')"></span><span>${esc(me.nickname)}</span><i class="ph ph-gear"></i></a>`;
      side.querySelectorAll('[data-voice]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.voice; voice.set(k);
        side.querySelectorAll('[data-voice]').forEach(x => x.classList.toggle('on', x === b));
        side.querySelector('#vc').classList.remove('breathe');
        const tip = side.querySelector('#vtip'); tip.innerHTML = '<div class="tip">Click <strong>Join Voice</strong> in Discord to confirm.</div>';
        clearTimeout(Barn._tipT); Barn._tipT = setTimeout(() => { tip.innerHTML = ''; }, 6000);
        window.open(`https://discord.com/channels/${DISCORD.guild}/${DISCORD[k]}`, '_blank', 'noopener');
      }));
      Barn.flicker(side.querySelector('#vc'));
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
