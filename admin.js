/* Admin page. Each section is a renderer in A.sections; A.reload() redraws them all. */
(async function () {
  if (!FY.wired) { document.querySelector('main').innerHTML = '<p class="muted">Not wired to the database yet.</p>'; return; }
  await FY.requireLeader();
  const A = window.A = { sections: {}, _members: null };
  A.members = async (fresh) => {
    if (!A._members || fresh) A._members = (await FY.q('member').select('id,nickname,avatar,user_id,role,chesscom_username').order('nickname')).data || [];  // discord_id is not readable through the API (column grant)
    return A._members;
  };
  A.reload = async () => { await A.members(true); for (const k in A.sections) await A.sections[k](); };
  A.opts = (ms, sel) => ms.map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${FY.esc(m.nickname)}</option>`).join('');

  A.sections.members = async () => {
    const el = document.getElementById('members'); const ms = await A.members();
    el.innerHTML = `<h2>Members</h2>
      <div class="tablewrap"><table class="table"><thead><tr><th>Member</th><th>Status</th><th>Claim link</th></tr></thead><tbody>
      ${ms.map(m => `<tr><td>${FY.avatar(m.avatar)}${FY.esc(m.nickname)}${m.role === 'leader' ? ' <span class="muted">(leader)</span>' : ''}</td>
        <td>${m.user_id ? 'Claimed' : '<span class="muted">Unclaimed</span>'}</td>
        <td>${m.user_id ? '' : `<button class="teal" data-link="${m.id}">New link</button>`}</td></tr>`).join('')}
      </tbody></table></div>
      <form id="newmember" class="row"><input id="nm-nick" placeholder="Nickname" required maxlength="24">
        <select id="nm-av">${['hen','cock','pig','sheep','goat','cow'].map(a => `<option>${a}</option>`).join('')}</select>
        <button class="pink">Add member</button></form>
      <p class="muted">A claim link works once. Send it on Discord; when they open it and sign in, the profile is theirs.</p>
      <div id="linkbox" hidden class="row"><input id="linkout" readonly style="flex:1"><button class="teal" id="copylink">Copy</button></div>`;
    el.querySelector('#newmember').addEventListener('submit', async ev => {
      ev.preventDefault();
      try { await FY.rpc('create_member', { p_nickname: el.querySelector('#nm-nick').value.trim(), p_avatar: el.querySelector('#nm-av').value }); FY.toast('Added.'); await A.reload(); }
      catch (e) { FY.toast(e.message); }
    });
    el.querySelectorAll('button[data-link]').forEach(b => b.addEventListener('click', async () => {
      try {
        const tok = await FY.rpc('issue_claim_link', { p_member_id: b.dataset.link });
        const url = `${location.origin}/claim.html?t=${tok}`;
        const box = el.querySelector('#linkbox'); box.hidden = false; el.querySelector('#linkout').value = url;
        el.querySelector('#copylink').onclick = () => navigator.clipboard.writeText(url).then(() => FY.toast('Copied.'), () => { el.querySelector('#linkout').select(); });
      } catch (e) { FY.toast(e.message); }
    }));
  };

  A.sections.result = async () => {
    const el = document.getElementById('result'); const ms = await A.members();
    el.innerHTML = `<h2>Enter a poker night</h2>
      <form id="night" class="stack">
        <div class="field"><label for="played">Played</label><input id="played" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
        <div class="tablewrap"><table class="table"><thead><tr><th>Played?</th><th>Member</th><th>Buy-ins</th><th>Winner</th></tr></thead><tbody>
        ${ms.map(m => `<tr><td><input type="checkbox" class="pl" value="${m.id}" id="pl-${m.id}"></td><td><label for="pl-${m.id}">${FY.avatar(m.avatar)}${FY.esc(m.nickname)}</label></td>
          <td><input type="number" class="bi" data-id="${m.id}" min="1" value="1" style="width:5em"></td><td><input type="radio" name="winner" value="${m.id}"></td></tr>`).join('')}
        </tbody></table></div>
        <div class="field"><label for="note">Note</label><input id="note" maxlength="120" placeholder="optional"></div>
        <button class="pink">Record night</button>
      </form><p class="muted">Winner takes all. Points = buy-ins collected. Each loser gets an IOU to the winner for their buy-ins.</p>
      <h3>Recent nights</h3><div id="recent" class="stack"></div>`;
    const recent = await FY.rpc('recent_events', { p_limit: 8 });
    el.querySelector('#recent').innerHTML = recent.length ? recent.map(e => `<div class="row card"><span>${new Date(e.played_at).toLocaleDateString('en-GB')} · ${FY.esc(e.type_key)}${e.note ? ' · ' + FY.esc(e.voided_at ? e.note.replace(/(^| · )voided.*$/, '') : e.note) : ''}${e.voided_at ? ' · <strong>voided</strong>' : ''}</span>
      ${e.voided_at ? '' : `<button class="ghost" data-void="${e.id}">Void</button>`}</div>`).join('') : '<p class="muted">No nights yet.</p>';
    el.querySelectorAll('button[data-void]').forEach(b => b.addEventListener('click', async () => {
      // No confirm() in some viewers: two taps within 5 seconds.
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'Tap again to void'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Void'; }, 5000); return; }
      b.disabled = true;
      try { await FY.rpc('void_event', { p_event: b.dataset.void, p_note: null }); FY.toast('Night voided. Points reversed, IOUs closed.'); await A.reload(); }
      catch (e) { FY.toast(e.message); b.disabled = false; }
    }));
    el.querySelector('#night').addEventListener('submit', async ev => {
      ev.preventDefault();
      const players = [...el.querySelectorAll('.pl:checked')].map(c => ({ member_id: c.value, buy_ins: Number(el.querySelector(`.bi[data-id="${c.value}"]`).value) }));
      const winner = el.querySelector('input[name=winner]:checked')?.value;
      if (players.length < 2) return FY.toast('Tick at least two players.');
      if (!winner || !players.some(p => p.member_id === winner)) return FY.toast('Pick the winner from the players.');
      const btn = ev.submitter || ev.target.querySelector('button'); btn.disabled = true;
      try {
        await FY.rpc('record_poker_result', { p_players: players, p_winner: winner, p_played_at: new Date(el.querySelector('#played').value + 'T12:00:00').toISOString(), p_note: el.querySelector('#note').value || null });
        FY.toast(`Recorded. ${players.reduce((s, p) => s + p.buy_ins, 0)} points to the winner.`); await A.reload();
      } catch (e) { FY.toast(e.message); }
      finally { btn.disabled = false; }
    });
  };

  A.sections.claims = async () => {
    const el = document.getElementById('claims'); const ms = await A.members(); const name = id => FY.esc(ms.find(m => m.id === id)?.nickname || '?');
    const cs = (await FY.q('claim').select('*').eq('state', 'pending').order('created_at')).data || [];
    el.innerHTML = `<h2>Claims waiting</h2>${cs.length ? cs.map(c => {
      const p = c.payload; const what = p.type === 'points' ? `${Number(p.points)} ${FY.esc(p.type_key)} points` : `${name(p.payer_id)} owes ${name(p.payee_id)} ${Number(p.amount)}`;
      return `<div class="row card"><span><strong>${name(c.member_id)}</strong> asks for ${what}<br><span class="muted">${FY.esc(p.note || '')}</span></span>
        <button class="pink" data-c="${c.id}" data-ok="1">Approve</button><button class="ghost" data-c="${c.id}" data-ok="0">Reject</button></div>`; }).join('')
      : '<p class="muted">Nothing waiting.</p>'}`;
    el.querySelectorAll('button[data-c]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await FY.rpc('decide_claim', { p_claim: b.dataset.c, p_approve: b.dataset.ok === '1' }); FY.toast(b.dataset.ok === '1' ? 'Approved.' : 'Rejected.'); await A.reload(); }
      catch (e) { FY.toast(e.message); b.disabled = false; }
    }));
  };

  A.sections.disputes = async () => {
    const el = document.getElementById('disputes'); const ms = await A.members(); const name = id => FY.esc(ms.find(m => m.id === id)?.nickname || '?');
    const rows = (await FY.rpc('my_ious')).filter(i => i.state === 'disputed');
    el.innerHTML = `<h2>Disputed IOUs</h2>${rows.length ? rows.map(i => `<div class="row card"><span>${name(i.payer_id)} → ${name(i.payee_id)} <strong class="num">${Number(i.amount)}</strong> · disputed</span>
      <button class="pink" data-d="${i.id}" data-to="confirmed">Rule paid</button><button class="ghost" data-d="${i.id}" data-to="open">Rule unpaid</button></div>`).join('') : '<p class="muted">No disputes.</p>'}`;
    el.querySelectorAll('button[data-d]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await FY.rpc('iou_transition', { p_iou: b.dataset.d, p_to: b.dataset.to }); FY.toast(b.dataset.to === 'confirmed' ? 'Ruled paid.' : 'Ruled unpaid. Back to open.'); await A.reload(); }
      catch (e) { FY.toast(e.message); b.disabled = false; }
    }));
  };

  A.sections.settle = async () => {
    const el = document.getElementById('settle'); const ms = await A.members(); const name = id => FY.esc(ms.find(m => m.id === id)?.nickname || '?');
    const net = await FY.rpc('netting');
    el.innerHTML = `<h2>Square up</h2><p class="muted">Net position between each pair. Squaring up closes every live IOU between them.</p>
      ${net.length ? net.map(n => { const [a, b] = n.net > 0 ? [n.member_a, n.member_b] : [n.member_b, n.member_a];
        const txt = n.net === 0 ? `<span>${name(a)} and ${name(b)} are even, but have live IOUs</span>` : `<span>${name(a)} owes ${name(b)} <strong class="num">${Math.abs(n.net)}</strong> net</span>`;
        return `<div class="row card">${txt}<button class="teal" data-a="${a}" data-b="${b}">Squared up</button></div>`; }).join('')
      : '<p class="muted">Everyone is square.</p>'}`;
    el.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await FY.rpc('settle_pair', { p_a: b.dataset.a, p_b: b.dataset.b }); FY.toast('Squared. Their IOUs are closed.'); await A.reload(); }
      catch (e) { FY.toast(e.message); b.disabled = false; }
    }));
  };

  A.sections.settings = async () => {
    const el = document.getElementById('settings');
    const league = (await FY.q('league').select('*').eq('slug', FY_CONFIG.LEAGUE_SLUG).single()).data;
    const types = (await FY.q('event_type').select('key,label,overall_weight').order('key')).data || [];
    el.innerHTML = `<h2>Settings</h2>
      <div class="row"><label><input type="checkbox" id="pb" ${league.public_badges ? 'checked' : ''}> Show owes / owed badges on the tables</label></div>
      <div class="row"><label for="acd">Auto-confirm after</label><input id="acd" type="number" min="1" max="60" value="${league.auto_confirm_days}" style="width:5em"><span>days</span><button class="teal" id="saveleague">Save</button></div>
      <h3>Overall table weights</h3>
      ${types.map(t => `<div class="row"><span style="min-width:7em">${FY.esc(t.label)}</span><input type="number" step="0.5" min="0" value="${t.overall_weight}" data-w="${FY.esc(t.key)}" style="width:5em"><button class="ghost" data-savew="${FY.esc(t.key)}">Save</button></div>`).join('')}`;
    el.querySelector('#saveleague').addEventListener('click', async () => {
      const days = Number(el.querySelector('#acd').value);
      if (!Number.isInteger(days) || days < 1 || days > 60) return FY.toast('Days must be 1 to 60');
      try { await FY.rpc('set_league', { p_public_badges: el.querySelector('#pb').checked, p_auto_confirm_days: days }); FY.toast('Saved.'); } catch (e) { FY.toast(e.message); }
    });
    el.querySelectorAll('button[data-savew]').forEach(b => b.addEventListener('click', async () => {
      const w = Number(el.querySelector(`input[data-w="${b.dataset.savew}"]`).value);
      if (!Number.isFinite(w) || w < 0) return FY.toast('Weight must be 0 or more');
      try { await FY.rpc('set_weight', { p_key: b.dataset.savew, p_weight: w }); FY.toast('Saved.'); } catch (e) { FY.toast(e.message); }
    }));
  };

  await A.reload();
})().catch(e => { if (e.message !== 'not leader') FY.toast(e.message); });
