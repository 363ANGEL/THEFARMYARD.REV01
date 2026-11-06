/* 0.9 Admin Dashboard (REV C03). Tabs: Members · Humidor · Poker · League · Tokens & IOUs · Site.
   Leader only (checked here AND in every RPC). Edits save instantly; every change is written to
   fy.admin_edit by the fy.admin_* functions. Docket amounts are buy-ins (1 buy-in = 5 tk). */
(async function () {
  const B = await Barn.open('admin'); if (!B) return;
  const { me, main } = B, esc = FY.esc;
  Presence.join(me).catch(() => {});
  if (me.role !== 'leader') {
    main.innerHTML = `<div class="acard"><span class="kicker">Leader only</span>
      <p style="margin:0">This is Hank's office. Nothing for you in here.</p>
      <a href="dashboard.html" style="color:var(--neon-pink-link)">Back to the Dashboard</a></div>`;
    return;
  }

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
    : `<span style="color:var(--fy-text-label)">Invited · ${m.invite_email ? 'matches on email' : m.discord_username ? 'matches on Discord username' : 'no contact — cannot sign in'}</span>`;
  async function tabMembers() {
    await loadMembers();
    const contactCell = m => m.user_id
      ? `<span style="font-size:var(--fs-xs);color:var(--fy-text-label)">${esc(m.invite_email || m.discord_username || '')}</span>`
      : `<span style="display:flex;gap:6px;flex-wrap:wrap">
          <input class="input" data-inv="invite_email" data-m="${m.id}" type="email" placeholder="Invite email" maxlength="254" value="${esc(m.invite_email || '')}" style="width:12em;min-height:34px;font-size:12px">
          <input class="input" data-inv="discord_username" data-m="${m.id}" placeholder="Discord username" maxlength="40" value="${esc(m.discord_username || '')}" style="width:10em;min-height:34px;font-size:12px">
          <input class="input" data-inv="mobile" data-m="${m.id}" type="tel" placeholder="Mobile" maxlength="20" value="${esc(m.mobile || '')}" style="width:8em;min-height:34px;font-size:12px"></span>`;
    pane.innerHTML = `<div class="acard"><span class="t-module">Members</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Click a row to open their profile in admin view. Invite contacts save as you leave each box; keep an email or a Discord username on every invited row — it is how Hank matches their sign-in.</span>
      <table><thead><tr><th>Member</th><th>Status</th><th>Invite contact</th><th>Claim link</th></tr></thead><tbody>
      ${A.members.map(m => `<tr class="clickable" data-open="${esc(m.nickname)}"><td style="display:flex;align-items:center;gap:8px"><span style="width:28px;height:28px;border-radius:50%;border:1px solid var(--neon-teal);background:url('${esc(FY.face(m, 28))}') center/contain no-repeat"></span>${esc(m.nickname)}${m.role === 'leader' ? ' <span style="color:var(--fy-text-label)">(leader)</span>' : ''}</td>
        <td data-st="${m.id}">${invStatus(m)}</td>
        <td>${contactCell(m)}</td>
        <td style="white-space:nowrap">${m.user_id ? '' : `<button class="rowbtn" data-link="${m.id}">New link</button>`}</td></tr>`).join('')}
      </tbody></table>
      <form id="newmember" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="input" id="nm-nick" placeholder="Nickname" required maxlength="24" style="min-height:40px">
        <select class="input" id="nm-av" style="min-height:40px">${['hen', 'cock', 'pig', 'sheep', 'goat', 'cow'].map(a => `<option>${a}</option>`).join('')}</select>
        <input class="input" id="nm-email" type="email" placeholder="Invite email" maxlength="254" style="min-height:40px">
        <input class="input" id="nm-disc" placeholder="Discord username" maxlength="40" style="min-height:40px">
        <input class="input" id="nm-mob" type="tel" placeholder="Mobile (contact only)" maxlength="20" style="min-height:40px">
        <button class="btn btn-primary" style="min-height:40px">Add member</button></form>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Invite-only: email and Discord username are each optional, but one is needed — Hank matches their Discord sign-in against it at the door. Mobile is contact only, never used for login.</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">A claim link works once and expires after 14 days. Send it on Discord.</span>
      <div id="linkbox" hidden style="display:flex;gap:8px"><input class="input" id="linkout" readonly style="flex:1;min-height:40px"><button class="rowbtn" id="copylink">Copy</button></div></div>
      <div class="acard"><span class="t-module">Icon palette</span>
      <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Eight pre-made logos per member (New User Set-up and Profile pick from these). Upload art to Storage, paste the public URLs.</span>
      <div style="display:flex;gap:8px;align-items:center"><label for="lg-m">Member</label><select class="input" id="lg-m" style="min-height:40px">${opts(A._logoMember)}</select></div>
      <form id="lg-f" style="display:flex;flex-direction:column;gap:8px"></form></div>`;
    pane.addEventListener('click', ev => {
      const tr = ev.target.closest('tr[data-open]');
      if (tr && !ev.target.closest('button,input')) location.href = 'profile.html?view=admin&user=' + encodeURIComponent(tr.dataset.open);
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
        if (f !== 'mobile' && !v && !(f === 'invite_email' ? m.discord_username : m.invite_email)) {
          FY.toast('Keep an email or a Discord username — it is how they sign in.'); box.value = m[f] || ''; return;
        }
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
      if (!email && !disc) { FY.toast('Give an invite email or a Discord username (at least one).'); return; }
      try {
        await FY.rpc('create_member', {
          p_nickname: pane.querySelector('#nm-nick').value.trim(), p_avatar: pane.querySelector('#nm-av').value,
          p_invite_email: email || null, p_discord_username: disc || null, p_mobile: pane.querySelector('#nm-mob').value.trim() || null,
        });
        FY.toast('Added.'); draw();
      } catch (e) { FY.toast(e.message); }
    });
    pane.querySelectorAll('button[data-link]').forEach(b => b.addEventListener('click', async () => {
      try {
        const tok = await FY.rpc('issue_claim_link', { p_member_id: b.dataset.link });
        const url = `${location.origin}/claim.html?t=${tok}`;
        pane.querySelector('#linkbox').hidden = false; pane.querySelector('#linkout').value = url;
        pane.querySelector('#copylink').onclick = () => navigator.clipboard.writeText(url).then(() => FY.toast('Copied.'), () => pane.querySelector('#linkout').select());
      } catch (e) { FY.toast(e.message); }
    }));
    const drawLogos = async () => {
      const sel = A._logoMember || (A.members[0] && A.members[0].id); A._logoMember = sel;
      const rows = sel ? ((await FY.q('member_logo').select('slot,name,url').eq('member_id', sel).order('slot')).data || []) : [];
      const bySlot = {}; rows.forEach(r => bySlot[r.slot] = r);
      pane.querySelector('#lg-f').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `<div style="display:flex;gap:8px;align-items:center"><span style="width:1.5em;color:var(--fy-text-label)">${n}</span><input class="input" data-ln="${n}" placeholder="Name" maxlength="24" value="${esc(bySlot[n]?.name || '')}" style="width:9em;min-height:38px"><input class="input" data-lu="${n}" type="url" placeholder="https://…/logo.png" value="${esc(bySlot[n]?.url || '')}" style="flex:1;min-height:38px">${bySlot[n] ? `<img src="${esc(bySlot[n].url)}" alt="" width="32" height="32" style="border-radius:50%;object-fit:contain">` : ''}</div>`).join('')
        + '<div><button class="btn btn-primary" style="min-height:40px">Save logos</button></div>';
    };
    await drawLogos();
    pane.querySelector('#lg-m').value = A._logoMember;
    pane.querySelector('#lg-m').addEventListener('change', ev => { A._logoMember = ev.target.value; drawLogos(); });
    pane.querySelector('#lg-f').addEventListener('submit', async ev => {
      ev.preventDefault();
      const logos = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ slot: n, name: pane.querySelector(`[data-ln="${n}"]`).value.trim(), url: pane.querySelector(`[data-lu="${n}"]`).value.trim() })).filter(l => l.url);
      if (logos.some(l => !l.name)) return FY.toast('Every logo with a URL needs a name.');
      try { await FY.rpc('set_member_logos', { p_member: A._logoMember, p_logos: logos }); FY.toast('Logos saved.'); drawLogos(); }
      catch (e) { FY.toast(e.message); }
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
