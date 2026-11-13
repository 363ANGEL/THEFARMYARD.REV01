/* In the yard — presence strip (REV C03). Loaded after barn.js on shell pages.
   Presence.join(me) tracks { member_id, status, in_voice } on realtime channel "yard" and renders
   rows into the sidebar's #fy-online slot: voice (pink, LIVE) > online (teal) > away (dimmed).
   Clicking a row opens that member's public profile; your own row opens your profile. */
(function () {
  const esc = s => FY.esc(s);
  const ORDER = { voice: 0, online: 1, away: 2 };

  const Presence = {
    _me: null, _chan: null, _members: null, _inVoice: false, _subs: [],

    async _directory() {
      if (Presence._members) return Presence._members;
      const { data } = await FY.q('member').select('id, nickname, avatar, avatar_url');
      const map = {};
      (data || []).forEach(m => { map[m.id] = m; });
      return (Presence._members = map);
    },

    async join(me) {
      Presence._me = me;
      await Presence._directory();
      const chan = FY.sb.channel('yard', { config: { presence: { key: me.id } } });
      Presence._chan = chan;
      chan.on('presence', { event: 'sync' }, () => { Presence.render(); Presence._fire(); });
      await new Promise(res => chan.subscribe(s => { if (s === 'SUBSCRIBED') res(); }));
      await Presence._track();
      document.addEventListener('visibilitychange', () => Presence._track());
      window.addEventListener('beforeunload', () => { try { chan.untrack(); } catch (e) {} });
      Presence.render();
      Presence._fire();
    },

    /* Other pages (Admin Members) read presence without owning the strip. */
    map() {
      const state = Presence._chan ? Presence._chan.presenceState() : {};
      const out = {};
      for (const key of Object.keys(state)) {
        const metas = state[key], p = metas[metas.length - 1] || {};
        if (!p.member_id) continue;
        out[p.member_id] = p.in_voice ? 'voice' : (p.status === 'away' ? 'away' : 'online');
      }
      return out;
    },

    /* fn(map) runs on every presence sync, and once now if the channel is already up. */
    onSync(fn) {
      Presence._subs.push(fn);
      if (Presence._chan) { try { fn(Presence.map()); } catch (e) {} }
    },

    _fire() { Presence._subs.forEach(f => { try { f(Presence.map()); } catch (e) {} }); },

    _track() {
      if (!Presence._chan) return;
      return Presence._chan.track({
        member_id: Presence._me.id,
        status: document.hidden ? 'away' : 'online',
        in_voice: Presence._inVoice,
      });
    },

    /* The voice pills call this; LIVE shows on your row for the session. */
    setVoice(on) { Presence._inVoice = !!on; Presence._track(); },

    _rows() {
      const state = Presence._chan ? Presence._chan.presenceState() : {};
      const dir = Presence._members || {};
      const rows = [];
      for (const key of Object.keys(state)) {
        const metas = state[key];
        const p = metas[metas.length - 1] || {};
        const m = dir[p.member_id];
        if (!m) continue;                      // stale or unknown member_id: skip the row
        const st = p.in_voice ? 'voice' : (p.status === 'away' ? 'away' : 'online');
        rows.push({ m, st });
      }
      rows.sort((a, b) => (ORDER[a.st] - ORDER[b.st]) || a.m.nickname.localeCompare(b.m.nickname));
      return rows;
    },

    render() {
      const el = document.getElementById('fy-online');
      const nEl = document.getElementById('fy-online-n');
      if (!el) return;
      const rows = Presence._rows();
      if (nEl) nEl.textContent = rows.length || '';
      const L = { voice: 'In voice chat', online: 'Online', away: 'Away' };
      el.innerHTML = rows.map(({ m, st }) => {
        const col = st === 'voice' ? 'var(--neon-pink-text)' : st === 'online' ? '#5fd3cf' : 'var(--color-neutral-400)';
        const dot = st === 'voice' ? 'var(--neon-pink)' : st === 'online' ? 'var(--neon-teal)' : 'var(--color-neutral-600, #55606a)';
        const img = FY.face(m, 36);
        const ini = esc(m.nickname.replace(/^The /, '')[0] || '?');
        const prof = Presence._me && m.id === Presence._me.id ? 'profile.html' : 'profile.html?user=' + encodeURIComponent(m.nickname);
        return `<a href="${prof}" style="text-decoration:none; color:inherit; display:flex; align-items:center; gap:8px; padding:4px 6px; border-radius:6px; min-width:0; opacity:${st === 'away' ? .6 : 1};">
          <span style="position:relative; flex:none; width:36px; height:36px; border-radius:50%; border:1.5px solid ${col}; box-shadow:0 0 6px color-mix(in srgb, ${col} 60%, transparent); display:grid; place-items:center; background:color-mix(in srgb, ${col} 14%, transparent); font-family:var(--font-heading); font-weight:700; font-size:var(--fs-sm); color:${col};">
            <span style="position:absolute; inset:0; padding:2px; box-sizing:border-box; border-radius:50%; overflow:hidden; background:url('${esc(img)}') center / contain no-repeat; background-origin:content-box;"></span>
            <span style="position:relative; display:none;">${ini}</span>
            <span style="position:absolute; right:-2px; bottom:-2px; width:11px; height:11px; border-radius:50%; border:2px solid var(--fy-bg); background:${dot};"></span>
          </span>
          <span style="display:flex; flex-direction:column; min-width:0; flex:1; gap:1px;">
            <span style="font-size:var(--fs-sm); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(m.nickname)}</span>
            <span style="display:flex; gap:6px; font-size:var(--fs-xs); font-variant-numeric:tabular-nums; white-space:nowrap;"><span style="color:${col};">${L[st]}</span></span>
          </span>
          ${st === 'voice' ? '<span title="In voice" style="flex:none; font-size:var(--fs-xs); font-weight:700; letter-spacing:.08em; color:var(--neon-pink-text); text-shadow:var(--text-glow-pink);">LIVE</span>' : ''}
        </a>`;
      }).join('');
    },
  };
  window.Presence = Presence;
})();
