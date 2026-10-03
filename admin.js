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
        const url = `${FY_CONFIG.SITE_URL}/claim.html?t=${tok}`;
        const box = el.querySelector('#linkbox'); box.hidden = false; el.querySelector('#linkout').value = url;
        el.querySelector('#copylink').onclick = () => navigator.clipboard.writeText(url).then(() => FY.toast('Copied.'), () => { el.querySelector('#linkout').select(); });
      } catch (e) { FY.toast(e.message); }
    }));
  };

  await A.reload();
})();
