/* 0.9 Admin Dashboard (REV C03). Tabs: Members · Humidor · Poker · League · Tokens & IOUs · Site.
   Leader only (checked here AND in every RPC). Edits save instantly; every change is written to
   fy.admin_edit by the fy.admin_* functions. Docket amounts are buy-ins (1 buy-in = 5 tk). */
(async function () {
  const B = await Barn.open('admin'); if (!B) return;
  const { me, main } = B, esc = FY.esc;
  Presence.join(me).catch(() => {});
  // Leader only: the server's fy.is_leader() decides, members go to the Dashboard.
  if (me.role !== 'leader' || !(await FY.rpc('is_leader').then(Boolean).catch(() => false))) { location.replace('dashboard.html'); return; }

  const A = { tab: location.hash.replace('#', '') || 'members', members: [] };
  const TABS = [['members', 'Members'], ['humidor', 'Humidor'], ['poker', 'Poker'], ['league', 'League'], ['tokens', 'Tokens & IOUs'], ['site', 'Site']];
  const loadMembers = async () => { A.members = (await FY.q('member').select('id,nickname,avatar,avatar_url,user_id,role,setup_at,invite_email,discord_username,mobile').order('nickname')).data || []; };
  const nick = id => A.members.find(m => m.id === id)?.nickname || '?';
  const opts = sel => A.members.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.nickname)}</option>`).join('');
  const twoTap = (b, label, fn) => {
    if (b.dataset.armed !== '1') { b.dataset.armed = '1'; const t = b.textContent; b.textContent = 'Tap again'; setTimeout(() => { b.dataset.armed = ''; b.textContent = t; }, 5000); return; }
    b.disabled = true; fn().catch(e => { FY.toast(e.message); b.disabled = false; });
  };

  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;gap:4px;padding:4px 2px 8px"><h2 class="t-title-b">Admin</h2><span class="t-tagline">Hank's office. Edits save as you make them, and everything is logged.</span></div>
    </div>
    <div class="atabs" role="tablist">${TABS.map(([k, l]) => `<button type="button" class="atab" role="tab" data-tab="${k}" aria-selected="${k === A.tab}">${l}</button>`).join('')}</div>
    <div id="pane" style="display:flex;flex-direction:column;gap:14px"></div>`;
  let pane = main.querySelector('#pane');
  main.querySelector('.atabs').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tab]'); if (!b) return;
    A.tab = b.dataset.tab; location.hash = A.tab;
    main.querySelectorAll('.atab').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    draw();
  });

  // ---- Members ----
  // Invite status: which contact the sign-in gate will match this row on.
  const invStatus = m => m.user_id
    ? (m.setup_at ? 'Claimed' : 'Claimed · set-up pending')
    : `<span style="color:var(--fy-text-label)">Invited · ${m.invite_email ? 'matches on email' : m.discord_username ? 'matches on Discord username' : 'invite link'}</span>`;
  // Role is a plain text column; Member and Leader are the two the page offers, any other stored role still shows.
  const roleLabel = r => r ? r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, ' ') : 'Member';
  const roleTag = r => `<span style="font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:999px;border:1px solid ${r === 'leader' ? 'var(--neon-teal)' : 'var(--fy-text-label)'};color:${r === 'leader' ? 'var(--neon-teal)' : 'var(--fy-text-label)'}">${esc(roleLabel(r))}</span>`;
  const roleOpts = cur => [...new Set(['member', 'leader', cur || 'member'])].map(r => `<option value="${esc(r)}" ${r === (cur || 'member') ? 'selected' : ''}>${esc(roleLabel(r))}</option>`).join('');
  async function tabMembers() {
    await loadMembers();
    const contactCell = m => m.user_id
      ? `<span style="font-size:var(--fs-xs);color:var(--fy-text-label)">${esc(m.invite_email || m.discord_username || '')}</span>`
      : `<span style="display:flex;gap:6px;flex-wrap:wrap">
          <input class="input" data-inv="invite_email" data-m="${m.id}" type="email" placeholder="Invite email" maxlength="254" value="${esc(m.invite_email || '')}" style="width:12em;min-height:34px;font-size:12px">
          <input class="input" data-inv="discord_username" data-m="${m.id}" placeholder="Discord username" maxlength="40" value="${esc(m.discord_username || '')}" style="width:10em;min-height:34px;font-size:12px">
          <input class="input" data-inv="mobile" data-m="${m.id}" type="tel" placeholder="Mobile" maxlength="20" value="${esc(m.mobile || '')}" style="width:8em;min-height:34px;font-size:12px"></span>`;
    pane.innerHTML = `<div class="acard"><span class="t-module">Members</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Click a row to open their profile in admin view. Invite contacts save as you leave each box; email is optional: use Copy invite link and send it on Discord.</span>
      <table><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Invite contact</th><th>Claim link</th></tr></thead><tbody>
      ${A.members.map(m => `<tr class="clickable" data-open="${esc(m.nickname)}"><td style="display:flex;align-items:center;gap:8px"><span style="width:28px;height:28px;border-radius:50%;border:1px solid var(--neon-teal);background:url('${esc(FY.face(m, 28))}') center/contain no-repeat"></span>${esc(m.nickname)} ${roleTag(m.role)}</td>
        <td><select class="input" data-role="${m.id}" aria-label="Role for ${esc(m.nickname)}" style="min-height:34px;font-size:12px;width:auto">${roleOpts(m.role)}</select></td>
        <td data-st="${m.id}">${invStatus(m)}</td>
        <td>${contactCell(m)}</td>
        <td style="white-space:nowrap">${m.user_id ? '' : `<button class="rowbtn" data-link="${m.id}">Copy invite link</button> <button class="rowbtn" data-link="${m.id}" data-new="1">New link</button>${m.role === 'leader' ? '' : ` <button class="rowbtn warn" data-del="${m.id}">Delete</button>`}`}</td></tr>`).join('')}
      </tbody></table>
      <form id="newmember" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;max-width:100%"><input class="input" id="nm-nick" placeholder="Nickname" required maxlength="24" style="min-height:40px;flex:1 1 140px;min-width:0;max-width:100%;box-sizing:border-box">
        <select class="input" id="nm-av" style="min-height:40px;flex:1 1 110px;min-width:0;max-width:100%;box-sizing:border-box">${['hen', 'cock', 'pig', 'sheep', 'goat', 'cow'].map(a => `<option>${a}</option>`).join('')}</select>
        <select class="input" id="nm-role" aria-label="Role" style="min-height:40px;flex:1 1 110px;min-width:0;max-width:100%;box-sizing:border-box">${roleOpts('member')}</select>
        <input class="input" id="nm-email" type="email" placeholder="Invite email" maxlength="254" style="min-height:40px;flex:1 1 180px;min-width:0;max-width:100%;box-sizing:border-box">
        <input class="input" id="nm-disc" placeholder="Discord username" maxlength="40" style="min-height:40px;flex:1 1 150px;min-width:0;max-width:100%;box-sizing:border-box">
        <input class="input" id="nm-mob" type="tel" placeholder="Mobile (contact only)" maxlength="20" style="min-height:40px;flex:1 1 150px;min-width:0;max-width:100%;box-sizing:border-box">
        <button class="btn btn-primary" style="min-height:40px">Add member</button></form>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Email and Discord username are optional. Copy the invite link from the member's row and send it on Discord. Mobile is contact only, never used for login.</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">An invite link works once and expires after 7 days. Copy invite link reuses an unused one; New link voids it and makes a fresh one.</span>
      <div id="linkbox" hidden style="display:flex;gap:8px"><input class="input" id="linkout" readonly style="flex:1;min-height:40px"><button class="rowbtn" id="copylink">Copy</button></div></div>
      <div class="acard"><span class="t-module">Icon palette</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Upload an image: it takes the lowest free number (1 to 15). Click a picture to set it as the selected member's icon; the cross removes it for everyone.</span>
      <div style="display:flex;gap:8px;align-items:center"><label for="lg-m">Member</label><select class="input" id="lg-m" style="min-height:40px">${opts(A._logoMember)}</select></div>
      <div id="ip" style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;max-width:100%"></div></div>
      <div class="acard" id="chars"><span class="t-module">Characters</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">One farmyard animal per member. Members pick theirs on their profile. Rename, free a taken animal, or remove one; names are unique.</span>
      <div id="charlist" style="display:flex;flex-direction:column;gap:8px"></div>
      <form id="charadd" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="input" id="char-new" placeholder="New animal" maxlength="24" required style="min-height:40px;flex:1 1 160px;min-width:0"><button class="btn btn-primary" style="min-height:40px">Add animal</button></form></div>`;
    pane.addEventListener('click', ev => {
      const tr = ev.target.closest('tr[data-open]');
      if (tr && !ev.target.closest('button,input,select')) location.href = 'profile.html?view=admin&user=' + encodeURIComponent(tr.dataset.open);
    });
    // Invite contacts save on blur (focusout bubbles; wired once, the pane node survives redraws).
    if (!pane.dataset.invWired) {
      pane.dataset.invWired = '1';
      pane.addEventListener('focusout', async ev => {
        const box = ev.target.closest && ev.target.closest('input[data-inv]'); if (!box) return;
        const m = A.members.find(x => x.id === box.dataset.m); if (!m) return;
        const f = box.dataset.inv;
        let v = box.value.trim(); if (f !== 'mobile') v = v.toLowerCase();
        box.value = v;
        if ((m[f] || '') === v) return;
        try {
          await FY.rpc('admin_set_member', { p_member: m.id, p_field: f, p_value: v });
          m[f] = v || null;
          const st = pane.querySelector(`[data-st="${m.id}"]`); if (st) st.innerHTML = invStatus(m);
          FY.toast('Saved.');
        } catch (e) { FY.toast(e.message); box.value = m[f] || ''; }
      });
    }
    pane.querySelector('#newmember').addEventListener('submit', async ev => {
      ev.preventDefault();
      const email = pane.querySelector('#nm-email').value.trim(), disc = pane.querySelector('#nm-disc').value.trim();
      try {
        await FY.rpc('create_member', {
          p_nickname: pane.querySelector('#nm-nick').value.trim(), p_avatar: pane.querySelector('#nm-av').value,
          p_invite_email: email || null, p_discord_username: disc || null, p_mobile: pane.querySelector('#nm-mob').value.trim() || null,
          p_role: pane.querySelector('#nm-role').value,
        });
        FY.toast('Added.'); draw();
      } catch (e) { FY.toast(e.message); }
    });
    // Role saves the moment it changes; the server (fy.admin_set_member) checks fy.is_leader() and keeps the last leader.
    pane.querySelectorAll('select[data-role]').forEach(sel => sel.addEventListener('change', async () => {
      const m = A.members.find(x => x.id === sel.dataset.role); if (!m) return;
      sel.disabled = true;
      try { await FY.rpc('admin_set_member', { p_member: m.id, p_field: 'role', p_value: sel.value }); m.role = sel.value; FY.toast('Saved.'); draw(); }
      catch (e) { FY.toast(e.message); sel.value = m.role; sel.disabled = false; }
    }));
    // Delete an unclaimed row (never a claimed member or a leader; the RPC also refuses
    // anyone with poker / token / league history and says to keep the row).
    pane.querySelectorAll('button[data-del]').forEach(b => b.addEventListener('click', async () => {
      const m = A.members.find(x => x.id === b.dataset.del); if (!m) return;
      if (!window.confirm(`Remove ${m.nickname}? Their invite and claim link stop working.`)) return;
      b.disabled = true;
      try { await FY.rpc('admin_delete_member', { p_member: m.id }); FY.toast(`${m.nickname} removed.`); draw(); }
      catch (e) { FY.toast(e.message); b.disabled = false; }
    }));
    pane.querySelectorAll('button[data-link]').forEach(b => b.addEventListener('click', async () => {
      try {
        const tok = await FY.rpc('issue_claim_link', { p_member_id: b.dataset.link, p_new: !!b.dataset.new });
        const url = `${location.origin}/claim.html?claim=${tok}`;
        const lab = b.textContent;
        try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; setTimeout(() => { b.textContent = lab; }, 2000); }
        catch (e) { pane.querySelector('#linkbox').hidden = false; pane.querySelector('#linkout').value = url; pane.querySelector('#linkout').select(); }
      } catch (e) { FY.toast(e.message); }
    }));
    // Icon palette: one Upload box beside 15 numbered slots. Slots are global; a click sets the selected member's icon.
    const ICON_BUCKET = 'icons';
    let palette = [];
    const drawIcons = async () => {
      const sel = A._logoMember || (A.members[0] && A.members[0].id); A._logoMember = sel;
      try { palette = (await FY.q('icon_palette').select('slot,url').order('slot')).data || []; } catch (e) { palette = []; }
      const bySlot = {}; palette.forEach(r => bySlot[r.slot] = r);
      const cur = (A.members.find(m => m.id === sel) || {}).avatar_url;
      const full = palette.length >= 15;
      const slot = n => {
        const r = bySlot[n];
        if (!r) return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="width:64px;height:64px;border-radius:50%;border:2px dashed rgba(95,211,207,.35);display:grid;place-items:center;color:var(--fy-text-label);font-size:var(--fs-sm)">${n}</span></div>`;
        const on = cur && cur === r.url;
        return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:4px">
          <button type="button" data-ipick="${n}" aria-label="Set icon ${n}" aria-pressed="${on ? 'true' : 'false'}" style="width:64px;height:64px;border-radius:50%;padding:0;cursor:pointer;border:2px solid ${on ? 'var(--neon-green-tube)' : 'rgba(95,211,207,.45)'};box-shadow:${on ? 'var(--glow-green)' : 'none'};background:#0a1a1a url('${esc(r.url)}') center/cover no-repeat"></button>
          <button type="button" data-irm="${n}" aria-label="Remove icon ${n}" style="position:absolute;top:-4px;right:-4px;width:22px;height:22px;border-radius:50%;padding:0;cursor:pointer;border:1px solid var(--neon-pink-tube);background:#0a1a1a;color:var(--neon-pink-text);font-size:12px;line-height:1">&#10005;</button>
          <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">${n}</span></div>`;
      };
      pane.querySelector('#ip').innerHTML = `<label style="flex:none;width:120px;min-height:120px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:10px;border:2px dashed var(--neon-teal);border-radius:12px;color:var(--fy-text);font-size:var(--fs-sm);cursor:${full ? 'not-allowed' : 'pointer'};opacity:${full ? '.45' : '1'}">
          <span>Upload image</span><span style="font-size:var(--fs-xs);color:var(--fy-text-label)">${full ? 'Palette full' : 'PNG or JPG'}</span>
          <input type="file" id="ip-file" accept="image/*" ${full ? 'disabled' : ''} style="display:none"></label>
        <div style="flex:1 1 320px;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:14px 10px">${Array.from({ length: 15 }, (_, k) => slot(k + 1)).join('')}</div>`;
    };
    await drawIcons();
    // Characters: list, rename, free, remove, add. The server (fy.admin_character_*) is leader-only and keeps names unique per yard.
    const drawChars = async () => {
      const box = pane.querySelector('#charlist');
      const cr = await FY.q('character').select('id,name,img').order('name');
      if (cr.error) { box.innerHTML = '<span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Characters are not set up yet (characters.sql has not been run).</span>'; pane.querySelector('#charadd').hidden = true; return; }
      const chars = cr.data || [], holders = {};
      ((await FY.q('member').select('nickname,character_id').not('character_id', 'is', null)).data || []).forEach(m => { holders[m.character_id] = m.nickname; });
      box.innerHTML = chars.length ? chars.map(c => `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" data-c="${c.id}">
          <span style="width:32px;height:32px;border-radius:50%;border:1px solid var(--neon-teal);background:#0a1a1a ${c.img ? `url('${esc(c.img)}')` : ''} center/contain no-repeat;flex:none"></span>
          <input class="input" data-cname="${c.id}" value="${esc(c.name)}" maxlength="24" aria-label="Animal name" style="min-height:34px;font-size:12px;flex:1 1 120px;min-width:0">
          <button class="rowbtn" data-crename="${c.id}">Rename</button>
          <span style="font-size:var(--fs-xs);color:var(--fy-text-label);flex:1 1 90px">${holders[c.id] ? 'Taken by ' + esc(holders[c.id]) : 'Free'}</span>
          ${holders[c.id] ? `<button class="rowbtn" data-cfree="${c.id}">Free</button>` : ''}
          <button class="rowbtn warn" data-cdel="${c.id}">Remove</button></div>`).join('') : '<span style="font-size:var(--fs-xs);color:var(--fy-text-label)">No animals yet.</span>';
      const byId = id => chars.find(c => String(c.id) === String(id));
      const run = async (fn, ok) => { try { await fn(); FY.toast(ok); drawChars(); } catch (e) { FY.toast(e.message); } };
      box.querySelectorAll('[data-crename]').forEach(b => b.onclick = () => run(() => FY.rpc('admin_character_rename', { p_id: Number(b.dataset.crename), p_name: box.querySelector(`[data-cname="${b.dataset.crename}"]`).value.trim() }), 'Renamed.'));
      box.querySelectorAll('[data-cfree]').forEach(b => b.onclick = () => run(() => FY.rpc('admin_character_free', { p_id: Number(b.dataset.cfree) }), 'Freed.'));
      box.querySelectorAll('[data-cdel]').forEach(b => b.onclick = () => {
        const c = byId(b.dataset.cdel);
        if (!window.confirm(`Remove ${c.name}?${holders[c.id] ? ' ' + holders[c.id] + ' will have no animal.' : ''}`)) return;
        run(() => FY.rpc('admin_character_remove', { p_id: c.id }), 'Removed.');
      });
    };
    pane.querySelector('#charadd').addEventListener('submit', ev => {
      ev.preventDefault();
      const inp = pane.querySelector('#char-new'), name = inp.value.trim(); if (!name) return;
      FY.rpc('admin_character_add', { p_name: name }).then(() => { inp.value = ''; FY.toast('Added.'); drawChars(); }, e => FY.toast(e.message));
    });
    await drawChars();
    pane.querySelector('#lg-m').value = A._logoMember;
    pane.querySelector('#lg-m').addEventListener('change', ev => { A._logoMember = ev.target.value; drawIcons(); });
    // Square-crop to 256px PNG, upload to icons/slot-N.png, then record it (the RPC is leader-only and checks the URL).
    const squarePng = file => new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { const S = 256, m = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = S; c.height = S;
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('Could not read that image.')), 'image/png'); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not an image.')); }; img.src = url;
    });
    pane.querySelector('#ip').addEventListener('change', async ev => {
      if (ev.target.id !== 'ip-file') return;
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
      let n = null;
      try {
        n = await FY.rpc('admin_icon_next');
        const blob = await squarePng(f);
        const { error } = await FY.sb.storage.from(ICON_BUCKET).upload(`slot-${n}.png`, blob, { contentType: 'image/png', upsert: true, cacheControl: '3600' });
        if (error) throw new Error(error.message);
        const url = FY.sb.storage.from(ICON_BUCKET).getPublicUrl(`slot-${n}.png`).data.publicUrl + '?v=' + Date.now();
        await FY.rpc('admin_icon_add', { p_slot: n, p_url: url });
        FY.toast(`Added as icon ${n}.`);
      } catch (e) { FY.toast(e.message); }
      drawIcons();
    });
    pane.querySelector('#ip').addEventListener('click', async ev => {
      const pick = ev.target.closest('[data-ipick]'), rm = ev.target.closest('[data-irm]');
      try {
        if (pick) {
          const m = A.members.find(x => x.id === A._logoMember); if (!m) return;
          await FY.rpc('admin_icon_set', { p_member: m.id, p_slot: Number(pick.dataset.ipick) });
          const r = palette.find(p => p.slot === Number(pick.dataset.ipick)); if (r) m.avatar_url = r.url;
          FY.toast('Icon set.'); drawIcons();
        } else if (rm) {
          const n = Number(rm.dataset.irm);
          if (!window.confirm(`Remove icon ${n}? Members using it go back to their stock animal.`)) return;
          const r = palette.find(p => p.slot === n);
          await FY.rpc('admin_icon_remove', { p_slot: n });
          A.members.forEach(m => { if (r && m.avatar_url === r.url) m.avatar_url = null; });
          const { error } = await FY.sb.storage.from(ICON_BUCKET).remove([`slot-${n}.png`]);
          FY.toast(error ? 'Removed, but the file could not be deleted: ' + error.message : 'Removed.'); drawIcons();
        }
      } catch (e) { FY.toast(e.message); }
    });
  }

  // ---- Humidor ----
  function tabHumidor() {
    pane.innerHTML = `<div class="acard"><span class="t-module">The Humidor</span>
      <p style="margin:0;font-size:var(--fs-sm);color:var(--fy-text-secondary)">The Humidor still runs on its own pages. Slice 2 brings it under the shell.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn-primary" href="humidor-admin.html" style="min-height:44px">Open Humidor admin</a>
        <a class="btn btn-ghost" href="humidor.html" style="min-height:44px">Open the Humidor</a></div></div>`;
  }

  // ---- Poker: file a night + filed dockets (edit buy-ins / winner, delete) ----
  async function tabPoker() {
    await loadMembers();
    const [events, ious, scores] = await Promise.all([
      FY.q('event').select('id,type_key,played_at,note,voided_at').eq('type_key', 'poker').is('voided_at', null).order('played_at', { ascending: false }).limit(25).then(r => r.data || []),
      FY.rpc('my_ious').catch(() => []),
      FY.q('score_entry').select('event_id,member_id,points,reason').eq('reason', 'result').then(r => r.data || []),
    ]);
    const docket = e => {   // players from the event's IOUs + the winner's derived buy-ins
      const rows = (ious || []).filter(i => i.event_id === e.id);
      const win = scores.find(s => s.event_id === e.id);
      if (!win) return null;
      const losers = rows.map(i => ({ member_id: i.payer_id, buy_ins: i.amount }));
      const winBuy = win.points - losers.reduce((s, l) => s + l.buy_ins, 0);
      return { event: e, winner: win.member_id, pot: win.points, players: [...losers, { member_id: win.member_id, buy_ins: winBuy }] };
    };
    const dockets = events.map(docket).filter(Boolean);
    pane.innerHTML = `<div class="acard" id="filed"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <span class="t-module">Filed dockets</span><span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Pot = Σ buy-ins × 5 tk. Edits refile the night and re-cut the IOUs.</span></div>
      ${dockets.map(d => `<div data-docket="${d.event.id}" style="display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid rgba(95,211,207,.22)">
        <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><strong>${new Date(d.event.played_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>
          <span style="font-size:var(--fs-sm);color:var(--fy-text-secondary)">${esc(d.event.note || 'Poker night')}</span><span style="flex:1"></span>
          <span style="font-size:var(--fs-sm);color:#ffd84a">Pot ${d.pot * 5} tk</span></div>
        <table><thead><tr><th>Player</th><th>Buy-ins</th><th>Winner</th></tr></thead><tbody>
          ${d.players.map(p => `<tr><td>${esc(nick(p.member_id))}</td>
            <td><input class="input num" type="number" min="1" value="${p.buy_ins}" data-bi="${p.member_id}" style="min-height:34px"></td>
            <td><input type="radio" name="w-${d.event.id}" value="${p.member_id}" ${p.member_id === d.winner ? 'checked' : ''}></td></tr>`).join('')}
        </tbody></table>
        <div style="display:flex;gap:8px"><button class="rowbtn" data-save="${d.event.id}">Save changes</button><button class="rowbtn warn" data-delete="${d.event.id}">Delete docket</button></div>
      </div>`).join('') || '<span style="font-size:var(--fs-sm);color:var(--fy-text-label);padding-top:6px">No dockets filed yet.</span>'}</div>
      <div class="acard" id="night-card"><span class="t-module">File a night</span><form id="night" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px;align-items:center"><label for="played">Played</label><input class="input" id="played" type="date" value="${new Date().toISOString().slice(0, 10)}" required style="min-height:40px"></div>
        <table><thead><tr><th>Played?</th><th>Member</th><th>Buy-ins</th><th>Winner</th></tr></thead><tbody>
        ${A.members.map(m => `<tr><td><input type="checkbox" class="pl" value="${m.id}" id="pl-${m.id}"></td><td><label for="pl-${m.id}">${esc(m.nickname)}</label></td>
          <td><input class="input num" type="number" data-id="${m.id}" min="1" value="1" style="min-height:34px"></td><td><input type="radio" name="winner" value="${m.id}"></td></tr>`).join('')}
        </tbody></table>
        <div style="display:flex;gap:8px;align-items:center"><label for="nnote">Note</label><input class="input" id="nnote" maxlength="120" placeholder="optional" style="flex:1;min-height:40px"></div>
        <div><button class="btn btn-primary" style="min-height:44px">Record night</button></div>
      </form><span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Winner takes all. Each loser gets an IOU to the winner for their buy-ins.</span></div>`;
    pane.querySelector('#filed').addEventListener('click', ev => {
      const save = ev.target.closest('[data-save]'), del = ev.target.closest('[data-delete]');
      if (save) {
        const box = save.closest('[data-docket]');
        const players = [...box.querySelectorAll('[data-bi]')].map(i => ({ member_id: i.dataset.bi, buy_ins: Number(i.value) }));
        const winner = box.querySelector('input[type=radio]:checked')?.value;
        if (!winner) return FY.toast('Pick the winner.');
        twoTap(save, 'save', async () => { await FY.rpc('admin_edit_docket', { p_event: box.dataset.docket, p_players: players, p_winner: winner }); FY.toast('Refiled. IOUs re-cut.'); draw(); });
      }
      if (del) twoTap(del, 'delete', async () => { await FY.rpc('admin_delete_docket', { p_event: del.closest('[data-docket]').dataset.docket }); FY.toast('Docket voided.'); draw(); });
    });
    pane.querySelector('#night').addEventListener('submit', async ev => {
      ev.preventDefault();
      const players = [...pane.querySelectorAll('.pl:checked')].map(c => ({ member_id: c.value, buy_ins: Number(pane.querySelector(`.num[data-id="${c.value}"]`).value) }));
      const winner = pane.querySelector('input[name=winner]:checked')?.value;
      if (players.length < 2) return FY.toast('Tick at least two players.');
      if (!winner || !players.some(p => p.member_id === winner)) return FY.toast('Pick the winner from the players.');
      try { await FY.rpc('record_poker_result', { p_players: players, p_winner: winner, p_played_at: new Date(pane.querySelector('#played').value + 'T12:00:00').toISOString(), p_note: pane.querySelector('#nnote').value || null }); FY.toast('Recorded.'); draw(); }
      catch (e) { FY.toast(e.message); }
    });
  }

  // ---- League: football pools ----
  async function tabLeague() {
    await loadMembers();
    const pools = (await FY.q('pool').select('*').order('kickoff', { ascending: false }).limit(25)).data || [];
    const calls = (await FY.q('pool_call').select('*')).data || [];
    pane.innerHTML = `<div class="acard"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <span class="t-module">Football pools</span><span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Result and payouts save as you type away from the field. The football UI lands in slice 3.</span></div>
      ${pools.map(p => `<div data-pool="${p.id}" style="display:flex;flex-direction:column;gap:8px;padding:10px 0;border-top:1px solid rgba(95,211,207,.22)">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><strong>${esc(p.fixture)}</strong>
          <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">${new Date(p.kickoff).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span><span style="flex:1"></span>
          <label style="font-size:var(--fs-xs)">Full-time <input class="input" data-result value="${esc(p.result || '')}" placeholder="e.g. 2-1" style="width:6em;min-height:34px"></label>
          <button class="rowbtn warn" data-delpool>Delete</button></div>
        ${calls.filter(c => c.pool_id === p.id).map(c => `<div style="display:flex;gap:10px;align-items:center;font-size:var(--fs-sm)"><span style="flex:1">${esc(nick(c.member_id))} · called ${esc(c.call)} · stake ${c.stake} tk</span>
          <label style="font-size:var(--fs-xs)">Payout <input class="input num" type="number" min="0" data-payout="${c.member_id}" value="${c.payout}" style="min-height:34px"></label></div>`).join('')}
      </div>`).join('') || '<span style="font-size:var(--fs-sm);color:var(--fy-text-label);padding-top:6px">No pools yet. They arrive with Football in slice 3.</span>'}</div>`;
    pane.addEventListener('change', async ev => {
      const box = ev.target.closest('[data-pool]'); if (!box) return;
      try {
        if (ev.target.matches('[data-result]')) { await FY.rpc('admin_set_pool', { p_pool: box.dataset.pool, p_result: ev.target.value.trim() || null }); FY.toast('Result saved.'); }
        if (ev.target.matches('[data-payout]')) { await FY.rpc('admin_set_payout', { p_pool: box.dataset.pool, p_member: ev.target.dataset.payout, p_payout: Number(ev.target.value) }); FY.toast('Payout saved.'); }
      } catch (e) { FY.toast(e.message); }
    });
    pane.addEventListener('click', ev => {
      const del = ev.target.closest('[data-delpool]'); if (!del) return;
      twoTap(del, 'delete', async () => { await FY.rpc('admin_delete_pool', { p_pool: del.closest('[data-pool]').dataset.pool }); FY.toast('Pool deleted.'); draw(); });
    });
  }

  // ---- Tokens & IOUs ----
  async function tabTokens() {
    await loadMembers();
    const [net, ious, claims] = await Promise.all([
      FY.rpc('netting').catch(() => []),
      FY.rpc('my_ious').catch(() => []),
      FY.q('claim').select('*').eq('state', 'pending').order('created_at').then(r => r.data || []),
    ]);
    const live = (ious || []).filter(i => ['open', 'marked_paid', 'disputed'].includes(i.state));
    pane.innerHTML = `
      <div class="acard"><span class="t-module">Net positions</span>
      ${(net || []).filter(n => n.net !== 0).map(n => { const [a, b] = n.net > 0 ? [n.member_a, n.member_b] : [n.member_b, n.member_a];
        return `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid rgba(95,211,207,.22);font-size:var(--fs-sm)"><span style="flex:1">${esc(nick(a))} owes ${esc(nick(b))} <strong>${Math.abs(n.net)}</strong> net</span>
        <button class="rowbtn" data-square-a="${a}" data-square-b="${b}">Squared up</button></div>`; }).join('') || '<span style="font-size:var(--fs-sm);color:var(--fy-text-label)">Everyone is square.</span>'}</div>
      <div class="acard"><span class="t-module">IOU entries</span>
      <table><thead><tr><th>From</th><th>To</th><th>Amount (buy-ins on poker nights, tk otherwise)</th><th>State</th><th></th></tr></thead><tbody>
      ${live.map(i => `<tr data-iou="${i.id}"><td>${esc(nick(i.payer_id))}</td><td>${esc(nick(i.payee_id))}</td>
        <td><span style="display:inline-flex;gap:6px;align-items:center"><button class="rowbtn" data-step="-1">−</button><strong style="min-width:2.5em;text-align:center">${i.amount}</strong><button class="rowbtn" data-step="1">+</button></span></td>
        <td style="color:var(--fy-text-label)">${esc(i.state)}</td>
        <td><button class="rowbtn warn" data-deliou>Delete</button></td></tr>`).join('')}
      </tbody></table>
      <form id="addiou" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:8px">
        <select class="input" id="ai-payer" style="min-height:40px">${opts()}</select><span>owes</span>
        <select class="input" id="ai-payee" style="min-height:40px">${opts()}</select>
        <input class="input num" id="ai-tk" type="number" min="1" value="1" style="min-height:40px"><span>tk</span>
        <input class="input" id="ai-note" placeholder="why" style="min-height:40px">
        <button class="btn btn-primary" style="min-height:40px">Add IOU</button></form></div>
      <div class="acard"><span class="t-module">Claims waiting</span>
      ${claims.map(c => { const p = c.payload; const what = p.type === 'points' ? `${Number(p.points)} ${esc(p.type_key)} points` : `${esc(nick(p.payer_id))} owes ${esc(nick(p.payee_id))} ${Number(p.amount)}`;
        return `<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-top:1px solid rgba(95,211,207,.22);font-size:var(--fs-sm)"><span style="flex:1"><strong>${esc(nick(c.member_id))}</strong> asks for ${what}<br><span style="color:var(--fy-text-label)">${esc(p.note || '')}</span></span>
        <button class="rowbtn" data-claim="${c.id}" data-ok="1">Approve</button><button class="rowbtn warn" data-claim="${c.id}" data-ok="0">Reject</button></div>`; }).join('') || '<span style="font-size:var(--fs-sm);color:var(--fy-text-label)">Nothing waiting.</span>'}</div>`;
    pane.addEventListener('click', async ev => {
      const sq = ev.target.closest('[data-square-a]'), step = ev.target.closest('[data-step]'),
            del = ev.target.closest('[data-deliou]'), cl = ev.target.closest('[data-claim]');
      try {
        if (sq) return twoTap(sq, 'square', async () => { await FY.rpc('settle_pair', { p_a: sq.dataset.squareA, p_b: sq.dataset.squareB }); FY.toast('Squared. Their IOUs are closed.'); draw(); });
        if (step) { const tr = step.closest('[data-iou]'); const cur = Number(tr.querySelector('strong').textContent); const next = cur + Number(step.dataset.step);
          if (next < 1) return FY.toast('Use Delete to remove it.');
          await FY.rpc('admin_set_iou', { p_iou: tr.dataset.iou, p_tk: next }); FY.toast('Adjusted. Logged.'); draw(); return; }
        if (del) return twoTap(del, 'delete', async () => { await FY.rpc('admin_delete_iou', { p_iou: del.closest('[data-iou]').dataset.iou }); FY.toast('Deleted. Logged.'); draw(); });
        if (cl) { cl.disabled = true; await FY.rpc('decide_claim', { p_claim: cl.dataset.claim, p_approve: cl.dataset.ok === '1' }); FY.toast(cl.dataset.ok === '1' ? 'Approved.' : 'Rejected.'); draw(); }
      } catch (e) { FY.toast(e.message); }
    });
    pane.querySelector('#addiou').addEventListener('submit', async ev => {
      ev.preventDefault();
      const payer = pane.querySelector('#ai-payer').value, payee = pane.querySelector('#ai-payee').value;
      if (payer === payee) return FY.toast('Pick two different people.');
      try { await FY.rpc('admin_add_iou', { p_payer: payer, p_payee: payee, p_tk: Number(pane.querySelector('#ai-tk').value), p_note: pane.querySelector('#ai-note').value || null }); FY.toast('Added. Logged.'); draw(); }
      catch (e) { FY.toast(e.message); }
    });
  }

  // ---- Site: rooms registry + league settings ----
  async function tabSite() {
    const rooms = (await FY.q('room').select('*').order('sort')).data || [];
    const league = (await FY.q('league').select('*').eq('slug', FY_CONFIG.LEAGUE_SLUG).single()).data;
    pane.innerHTML = `<div class="acard"><span class="t-module">Rooms</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">The registry drives the sidebar. stub mounts the Room Template; live links its own page.</span>
      <table><thead><tr><th>Room</th><th>Path</th><th>Status</th></tr></thead><tbody>
      ${rooms.map(r => `<tr><td>${r.parent_id ? '<span style="color:var(--fy-text-label)">↳</span> ' : ''}${esc(r.label)}</td><td style="color:var(--fy-text-label)">${esc(r.path)}</td>
        <td><select class="input" data-room="${esc(r.id)}" style="min-height:34px">${['ship', 'stub', 'later', 'live', 'hidden'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}
      </tbody></table></div>
      <div class="acard"><span class="t-module">League</span>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pb" ${league.public_badges ? 'checked' : ''}> Show owes / owed badges to the yard</label>
      <div style="display:flex;gap:8px;align-items:center"><label for="acd">Auto-confirm IOUs after</label><input class="input num" id="acd" type="number" min="1" max="60" value="${league.auto_confirm_days}" style="min-height:38px"><span>days</span><button class="rowbtn" id="saveleague">Save</button></div></div>`;
    pane.addEventListener('change', async ev => {
      const sel = ev.target.closest('select[data-room]'); if (!sel) return;
      try { await FY.rpc('admin_set_room', { p_room: sel.dataset.room, p_status: sel.value }); FY.toast('Saved. Logged.'); }
      catch (e) { FY.toast(e.message); }
    });
    pane.querySelector('#saveleague').addEventListener('click', async () => {
      const days = Number(pane.querySelector('#acd').value);
      if (!Number.isInteger(days) || days < 1 || days > 60) return FY.toast('Days must be 1 to 60');
      try { await FY.rpc('set_league', { p_public_badges: pane.querySelector('#pb').checked, p_auto_confirm_days: days }); FY.toast('Saved.'); }
      catch (e) { FY.toast(e.message); }
    });
  }

  const RENDER = { members: tabMembers, humidor: tabHumidor, poker: tabPoker, league: tabLeague, tokens: tabTokens, site: tabSite };
  async function draw() {
    // A fresh pane node per draw, so each tab's listeners die with it.
    const fresh = pane.cloneNode(false);
    pane.replaceWith(fresh);
    pane = fresh;
    pane.innerHTML = '<p class="muted">Loading…</p>';
    try { await (RENDER[A.tab] || tabMembers)(); }
    catch (e) { FY.toast(e.message); }
  }
  await draw();
})().catch(e => FY.toast(e.message));
