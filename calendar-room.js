/* The Calendar (RAY, 18 Nov): a month grid with an icon on every day that has something scheduled.
   Sources: filed poker nights, member birthdays, football fixtures, members' own events (calendar-events.sql).
   Moved out of room.html onto the Yard wall (RAY, 23 Nov): FY_RENDER_CALENDAR(B, card) draws into card
   and puts the Create event box right after it. B is what Barn.open returned. */
window.FY_RENDER_CALENDAR = async function (B, card) {
  if (!card) return;
  const esc = FY.esc;
  let events = [], members = [], pools = [], mine = [];
  const load = async () => {
    [events, members, pools, mine] = await Promise.all([
      FY.q('event').select('type_key,played_at').is('voided_at', null).then(r => r.data || []).catch(() => []),
      FY.q('member').select('nickname,birth_day,birth_month,avatar,avatar_url').then(r => r.data || []).catch(() => []),
      FY.q('pool').select('fixture,kickoff').then(r => r.data || []).catch(() => []),
      FY.q('cal_event').select('id,created_by,title,event_date,event_time,note,icon').then(r => r.data || []).catch(() => []),
    ]);
  };
  await load();
  const KIND = { poker: { icon: 'ph ph-club', label: 'Poker night' }, birthday: { icon: 'ph ph-cake', label: 'Birthday' }, football: { icon: 'ph ph-soccer-ball', label: 'Football' }, other: { icon: 'ph ph-star', label: 'Other' } };
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const itemsFor = (year, month) => {
    const out = {}; const add = (k, kind, text, extra) => (out[k] = out[k] || []).push({ kind, text, ...(extra || {}) });
    events.filter(e => e.type_key === 'poker').forEach(e => { const d = new Date(e.played_at); if (d.getFullYear() === year && d.getMonth() === month) add(dayKey(d), 'poker', 'Poker night'); });
    pools.forEach(p => { const d = new Date(p.kickoff); if (d.getFullYear() === year && d.getMonth() === month) add(dayKey(d), 'football', p.fixture); });
    members.forEach(m => { if (m.birth_day && m.birth_month && m.birth_month - 1 === month) add(dayKey(new Date(year, month, m.birth_day)), 'birthday', m.nickname + "'s birthday", { m }); });
    mine.forEach(e => { const [ey, em] = e.event_date.split('-').map(Number); if (ey === year && em - 1 === month) add(e.event_date, KIND[e.icon] ? e.icon : 'other', e.title, { ev: e }); });
    Object.values(out).forEach(list => list.sort((a, b) => (b.kind === 'birthday') - (a.kind === 'birthday') || ((a.ev && a.ev.event_time) || '').localeCompare((b.ev && b.ev.event_time) || '')));   // birthday first: its cake sits top left
    return out;
  };
  const now = new Date(); let y = now.getFullYear(), mo = now.getMonth(), picked = null, editing = null;
  if (!document.getElementById('cal-css')) {
    const st = document.createElement('style'); st.id = 'cal-css';
    st.textContent = `.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:.2rem}
      .cal-dow{text-align:center;font-size:var(--fs-xs);letter-spacing:.04em;text-transform:uppercase;color:var(--fy-text-label);padding:.25rem 0}
      .cal-day{position:relative;min-height:2.5rem;box-sizing:border-box;padding:.15rem .2rem;border:1px solid var(--rule-teal);border-radius:8px;background:transparent;color:var(--fy-text-secondary);font:inherit;font-size:var(--fs-xs);text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:.1rem}
      .cal-day.out{opacity:.35;cursor:default}.cal-day.has{border-color:var(--neon-teal)}.cal-day.today{border-color:var(--neon-pink-tube);box-shadow:var(--glow-pink)}.cal-day.sel{background:rgba(95,211,207,.12)}
      .cal-ic{display:flex;flex-wrap:wrap;gap:.1rem;font-size:.8rem;line-height:1}
      .cal-day.bday{overflow:hidden}.cal-day .cal-bimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none}
      .cal-day.bday>span{position:relative;z-index:1;color:#fff;text-shadow:0 0 3px #000,0 0 6px #000}
      .cal-day.bday .cal-ic{position:absolute;top:.15rem;left:.2rem}.cal-day.bday>span:not(.cal-ic){align-self:flex-end}
      .cal-ic .poker,.cal-lg .poker{color:var(--neon-pink-text)}.cal-ic .birthday,.cal-lg .birthday{color:#ffd84a}.cal-ic .football,.cal-lg .football{color:var(--neon-green-text)}.cal-ic .party,.cal-lg .party{color:#c9a7ff}.cal-ic .other,.cal-lg .other,.cal-row .other{color:var(--neon-teal);background:none;width:auto;height:auto}   /* a site-wide .other rule paints a teal square otherwise */
      /* Month card at half size (RAY, 23 Nov): cells about 40px, text no smaller than --fs-xs. */
      .cal-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:var(--fs-body)}.cal-row .rowbtn{min-height:2rem}
      #cal-form{display:flex;flex-direction:column;gap:12px}#cal-form .two{display:flex;gap:10px;flex-wrap:wrap}#cal-form .two>*{flex:1 1 9rem}
      .cal-nav{min-height:2rem;min-width:2rem;padding:0 .4rem}
      /* Wide screens: month card left, Create event right (RAY, 23 Nov). The container is the outer wrapper, not a
         sized box (a box that is both ignores its own width); media query as the fallback. Stacked below 46rem. */
      .cal-cols-wrap{container-type:inline-size;width:100%;min-width:0}
      .cal-cols{display:flex;flex-direction:column;gap:14px;min-width:0}
      @container (min-width: 46rem){.cal-cols{display:grid;grid-template-columns:minmax(17rem,360px) minmax(0,1fr);align-items:start}}
      @supports not (container-type:inline-size){@media (min-width:1000px){.cal-cols{display:grid;grid-template-columns:minmax(17rem,360px) minmax(0,1fr);align-items:start}}}`;
    document.head.appendChild(st);
  }
  const draw = () => {
    const items = itemsFor(y, mo), first = new Date(y, mo, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-day out" aria-hidden="true"></span>');
    for (let d = 1; d <= days; d++) {
      const k = dayKey(new Date(y, mo, d)), it = items[k] || [], today = k === dayKey(now);
      const bd = it.find(x => x.kind === 'birthday');   // a member's birthday: their icon fills the cell (RAY, 24 Nov)
      cells.push(`<button type="button" class="cal-day${it.length ? ' has' : ''}${bd ? ' bday' : ''}${today ? ' today' : ''}${picked === k ? ' sel' : ''}" data-day="${k}" aria-label="${d} ${first.toLocaleString('en-GB', { month: 'long' })}${it.length ? ', ' + it.map(x => x.text).join(', ') : ''}">
        ${bd ? `<img class="cal-bimg" src="${esc(FY.face(bd.m, 48))}" alt="">` : ''}<span>${d}</span><span class="cal-ic">${it.slice(0, 3).map(x => `<i class="${KIND[x.kind].icon} ${x.kind}" title="${esc(x.text)}"></i>`).join('')}${it.length > 3 ? `<span style="font-size:var(--fs-xs)">+${it.length - 3}</span>` : ''}</span></button>`);
    }
    // Real session: the creator, or an admin. Previewing a named member: only that member's own events. Previewing a
    // generic member: nobody's (the preview wears your id, so it must not inherit your edit rights).
    const canEdit = x => x.ev && (B.preview ? (Barn.previewMemberId() ? x.ev.created_by === Barn.previewMemberId() : false) : (x.ev.created_by === B.me.id || B.leader));
    const hhmm = t => (t || '').slice(0, 5);
    const detail = picked ? `<div style="border-top:1px solid var(--rule-teal);padding-top:10px;display:flex;flex-direction:column;gap:6px">
      <span style="font-size:var(--fs-xs);letter-spacing:.1em;text-transform:uppercase;color:var(--fy-text-label)">${new Date(picked + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      ${(items[picked] || []).map(x => `<div class="cal-row"><i class="${KIND[x.kind].icon} ${x.kind}" style="font-size:1.2rem"></i><span style="flex:1;min-width:8rem"><strong>${esc(x.text)}</strong>${x.ev && x.ev.event_time ? ` <span style="color:var(--fy-text-label)">${hhmm(x.ev.event_time)}</span>` : ''}${x.ev && x.ev.note ? `<br><span style="color:var(--fy-text-secondary);font-size:var(--fs-sm)">${esc(x.ev.note)}</span>` : ''}</span>
        ${canEdit(x) ? `<button type="button" class="rowbtn" data-edit="${x.ev.id}">Edit</button><button type="button" class="rowbtn warn" data-del="${x.ev.id}">Delete</button>` : ''}</div>`).join('') || '<span style="font-size:var(--fs-sm);color:var(--fy-text-label)">Nothing on this day. Use Create event below.</span>'}</div>` : '';
    card.style.maxWidth = 'none';   // stacked: fills the page width; two columns: the grid track caps it at 360px (RAY, 24 Nov)
    card.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="btn btn-ghost cal-nav" data-nav="-1" aria-label="Previous month"><span aria-hidden="true" style="font-size:1.25rem;line-height:1">&#8249;</span></button>
        <span class="t-module" style="flex:1;text-align:center">${first.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button type="button" class="btn btn-ghost cal-nav" data-nav="1" aria-label="Next month"><span aria-hidden="true" style="font-size:1.25rem;line-height:1">&#8250;</span></button></div>
      <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(n => `<span class="cal-dow">${n}</span>`).join('')}${cells.join('')}</div>
      ${detail}
      <div class="cal-lg" style="display:flex;gap:14px;flex-wrap:wrap;font-size:var(--fs-xs);color:var(--fy-text-label)">${Object.entries(KIND).map(([k, v]) => `<span><i class="${v.icon} ${k}" style="margin-right:.3rem;font-size:1rem;vertical-align:-2px"></i>${v.label}</span>`).join('')}</div>`;
  };

  // ---- Create / edit event (any member; their own only, admins any) ----
  const boxCss = card.getAttribute('style');
  const form = document.createElement('div'); form.id = 'cal-form-card'; form.setAttribute('style', boxCss); form.style.maxWidth = 'none';
  // Card and form share one two-column grid on wide screens (stacked when narrow).
  const wrap = document.createElement('div'); wrap.className = 'cal-cols-wrap';
  const cols = document.createElement('div'); cols.className = 'cal-cols'; wrap.appendChild(cols);
  card.before(wrap); cols.append(card, form);
  const drawForm = () => {
    const e = editing && mine.find(x => x.id === editing);
    form.innerHTML = `<span class="t-module">${e ? 'Edit event' : 'Create event'}</span>
      <form id="cal-form" autocomplete="off">
        <div class="field"><label for="ce-title">Title</label><input class="input" id="ce-title" required maxlength="80" placeholder="e.g. Friday poker night" value="${e ? esc(e.title) : ''}"></div>
        <div class="two"><div class="field"><label for="ce-date">Date</label><input class="input" id="ce-date" type="date" required value="${e ? e.event_date : (picked || dayKey(now))}"></div>
          <div class="field"><label for="ce-time">Time (optional)</label><input class="input" id="ce-time" type="time" value="${e && e.event_time ? e.event_time.slice(0, 5) : ''}"></div>
          <div class="field"><label for="ce-icon">Icon</label><select class="input" id="ce-icon">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${e && (KIND[e.icon] ? e.icon : 'other') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></div></div>
        <div class="field"><label for="ce-note">Note (optional)</label><input class="input" id="ce-note" maxlength="280" placeholder="Where, who, what to bring" value="${e && e.note ? esc(e.note) : ''}"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" style="min-height:2.5rem">${e ? 'Save changes' : 'Add to the Calendar'}</button>${e ? '<button type="button" class="btn btn-ghost" id="ce-cancel" style="min-height:2.5rem">Cancel</button>' : ''}</div>
        <span style="font-size:var(--fs-xs);color:var(--fy-text-label)">Everyone in the yard sees it and gets a notice on their profile.</span>
      </form>`;
    form.querySelector('#cal-form').addEventListener('submit', async ev => {
      ev.preventDefault();
      const args = { p_title: form.querySelector('#ce-title').value, p_date: form.querySelector('#ce-date').value, p_time: form.querySelector('#ce-time').value || null, p_note: form.querySelector('#ce-note').value || null, p_icon: form.querySelector('#ce-icon').value };
      const btn = ev.submitter || ev.target.querySelector('button'); btn.disabled = true;
      try {
        if (editing) await FY.rpc('cal_update', { p_id: editing, ...args }); else await FY.rpc('cal_create', args);
        FY.toast(editing ? 'Event updated.' : 'Event added.');
        const [yy, mm] = args.p_date.split('-').map(Number); y = yy; mo = mm - 1; picked = args.p_date; editing = null;
        await load(); draw(); drawForm();
      } catch (er) { FY.toast(er.message); btn.disabled = false; }
    });
    const cancel = form.querySelector('#ce-cancel'); if (cancel) cancel.addEventListener('click', () => { editing = null; drawForm(); });
  };

  card.addEventListener('click', async ev => {
    const nav = ev.target.closest('[data-nav]'), day = ev.target.closest('[data-day]'), ed = ev.target.closest('[data-edit]'), del = ev.target.closest('[data-del]');
    if (nav) { mo += Number(nav.dataset.nav); if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; } picked = null; draw(); }
    else if (ed) { editing = ed.dataset.edit; drawForm(); form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    else if (del) {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete'; setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = 'Delete'; } }, 4000); return; }
      del.disabled = true;
      try { await FY.rpc('cal_delete', { p_id: del.dataset.del }); FY.toast('Event deleted.'); if (editing === del.dataset.del) editing = null; await load(); draw(); drawForm(); }
      catch (er) { FY.toast(er.message); del.disabled = false; }
    }
    else if (day) { picked = picked === day.dataset.day ? null : day.dataset.day; draw(); if (!editing) { const dt = form.querySelector('#ce-date'); if (dt && picked) dt.value = picked; } }
  });
  draw(); drawForm();
};
