/* Poker room. One shared table per league: the initiator starts it, pastes the PokerNow link, members take seats,
   the initiator files the docket. All state lives in the database (fy.poker_*); this page reads it with
   poker_current / poker_board / poker_debts and writes through the poker_* RPCs.
   Realtime pings trigger a refetch; if Realtime is not live, the page polls every 5 seconds. */
(async function () {
  const main = document.getElementById('main');
  if (!FY.wired) { main.innerHTML = '<p class="muted">Not wired to the database yet.</p>'; return; }
  if (!(await FY.session())) {
    main.innerHTML = '<h1>Poker</h1><p>Sign in to join tonight\'s table.</p><p><button class="pink" id="in">Sign in with Discord</button></p>';
    document.getElementById('in').addEventListener('click', () => FY.signIn()); return;
  }
  const me = await FY.me();
  if (!me) { main.innerHTML = '<h1>No profile yet</h1><p>Ask RAY for your claim link, then open it while signed in.</p>'; return; }

  const GBP = 5;                                   // £ per buy-in (league constant)
  const SEASON = 'Season 1 (Oct - Dec)';           // hard-coded for now, matches fy.poker_board's default window
  const START_URL = 'https://www.pokernow.com/start-game';
  const DISCORD = 'https://discord.com/channels/1490100899920740483/';
  const SEAT_XY = [[62,89],[38,89],[16,76],[10.5,50],[16,24],[38,11],[62,11],[84,24],[89.5,50],[84,76]];
  const AVATARS = ['hen', 'cock', 'pig', 'sheep', 'goat', 'cow'];
  const isLeader = me.role === 'leader';
  const $ = id => document.getElementById(id);
  const esc = FY.esc;
  const avatarUrl = k => `assets/avatars/${AVATARS.includes(k) ? k : 'hen'}.svg`;

  const S = {
    cur: null, board: null, debts: null, boardAt: 0, key: '', seq: 0,
    names: {},                                     // member id -> { nickname, avatar }
    picks: {}, winner: null, stamp: false,         // docket (buy-ins per member id)
    draft: '', pasted: false, pasteHint: false, nickCopied: false, closeArmed: false,
    sel: null, seat: { phase: 'idle', name: '', count: 10, p: null, url: null, blocked: false },
    docketShown: false, docketT: null, shell: ''
  };
  ((await FY.q('v_members_public').select('id,nickname,avatar')).data || []).forEach(m => S.names[m.id] = m);

  // ---- helpers ----------------------------------------------------------------
  const mine = () => !!S.cur && (S.cur.started_by === me.id || isLeader);
  const mySeat = () => S.cur && S.cur.seats.find(s => s.member_id === me.id);
  const nick = id => esc(S.names[id]?.nickname || '?');
  const pounds = n => '£' + n * GBP;
  function copyText(t) {                           // must run inside the click (user gesture)
    let ok = false;
    try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); ok = document.execCommand('copy'); ta.remove(); } catch (e) { ok = false; }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(() => {});
    return ok;
  }
  // Two taps within 5 seconds, like the other irreversible buttons in the app.
  function arm(btn, label) {
    if (btn.dataset.armed === '1') return true;
    const was = btn.textContent; btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(() => { btn.dataset.armed = ''; btn.textContent = was; }, 5000);
    return false;
  }
  function openPokerNow(url) {
    const w = window.open(url, '_blank');
    if (w) { w.opener = null; return true; }
    FY.toast('Pop-up blocked. Use OPEN TABLE.'); return false;
  }

  // ---- shell ------------------------------------------------------------------
  main.innerHTML = `
    <div class="pk-top"><h1>Poker</h1><span class="grow"></span>
      <a class="pk-btn green sm" href="${DISCORD}1527009971999608902" target="_blank" rel="noopener"><i class="ph ph-microphone"></i>LIVE</a>
      <a class="pk-btn red sm" href="${DISCORD}1490100901464248321" target="_blank" rel="noopener"><i class="ph ph-microphone-slash"></i>MUTED</a>
      <span id="cta"></span></div>
    <section class="pk-steps pk-tube" id="steps"></section>
    <div class="pk-row solo" id="tablerow" hidden><div id="tablecol" hidden></div><div class="pk-docketcol" id="docketcol" hidden></div></div>
    <div class="pk-row2">
      <div class="pk-boardwrap"><div class="pk-board" id="board"><p class="pk-empty">Loading the board…</p></div></div>
      <div class="pk-debts" id="debts"></div>
    </div>`;

  // ---- checklist --------------------------------------------------------------
  const FLAME = '<path d="M50 6 C40 24 8 40 8 64 C8 78 19 87 31 87 C39 87 45 83 48 78 C47 89 42 97 34 102 L66 102 C58 97 53 89 52 78 C55 83 61 87 69 87 C81 87 92 78 92 64 C92 40 60 24 50 6 Z" transform="translate(16 18) scale(.68)" vector-effect="non-scaling-stroke"';
  const SIGN = `<div class="pk-sign" data-poker-sign><span class="wire" style="left:26%;transform:translateY(-4px) rotate(-12deg)"></span><span class="wire" style="right:18%;transform:translateY(-4px) rotate(10deg)"></span>
    <div class="plate"><span class="edge" aria-hidden="true"></span>
    <svg viewBox="0 0 100 110" aria-hidden="true">${FLAME} fill="#07090a" stroke="#07090a" stroke-width="15" stroke-linejoin="round"></path>${FLAME} fill="none" stroke="var(--neon-red-tube)" stroke-width="2.6" stroke-linejoin="round" style="filter:drop-shadow(0 0 3px var(--neon-red-tube)) drop-shadow(0 0 8px var(--neon-red))"></path></svg>
    <h2>POKER R<span>O</span>OM</h2></div></div>`;
  let stepsSig = '';
  function renderSteps(force) {
    const c = S.cur, canManage = mine();
    const sig = JSON.stringify([c && c.id, c && c.status, c && c.started_by, canManage, S.nickCopied, S.pasteHint, S.pasted, S.closeArmed, force && Math.random()]);
    if (sig === stepsSig) return; stepsSig = sig;
    const step = (n, text, sub, btns) => `<div class="pk-step"><span class="n">${n}</span><span class="txt"><span>${text}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="btns">${btns || ''}</span></div>`;
    let s1 = '', sub1 = '';
    if (!c) s1 = `<a id="start" class="pk-btn green" href="${START_URL}" target="_blank" rel="noopener">START</a>`;
    else if (canManage) s1 = '<button type="button" id="close" class="pk-btn red">CLOSE</button>';
    else { s1 = '<span class="pk-btn green off">START</span><span class="pk-btn red off">CLOSE</span>'; sub1 = `${nick(c.started_by)} has tonight's table. Take a seat below.`; }
    if (S.nickCopied && canManage) sub1 = `Your yard name "${esc(me.nickname)}" is copied. Paste it into PokerNow's Nickname box.`;
    let s2 = '';
    if (c && canManage) {
      const has = !!(S.draft || '').trim();
      s2 = `${S.pasteHint ? '<span class="hint">Your browser blocked reading the clipboard. Press Ctrl+V (⌘V on Mac) in the box, then ENTER.</span>' : ''}
        <input id="link" type="url" value="${esc(S.draft)}" placeholder="(CLICK, PASTE &amp; ENTER)" autocomplete="off" aria-label="PokerNow game link">
        <button type="button" id="paste" class="pk-btn">${S.pasted ? 'PASTED' : 'PASTE'}</button>
        <button type="button" id="enter" class="pk-btn ${has ? '' : 'off'}">ENTER</button>`;
    }
    const sub2 = c && c.status === 'open' && canManage ? 'Link saved. The table is open.' : '';
    $('steps').innerHTML = SIGN +
      '<span class="pk-kicker pk-tealtext" style="align-self:flex-start">Game checklist</span>' +
      step(1, 'Start a New Table', sub1, s1) +
      step(2, 'Confirm PokerNow Game ID', sub2, s2) +
      step(3, 'Take a Seat and Play', "Click SIT on Tonight's table, then join on PokerNow.") +
      step(4, 'Initiator Files the Docket', 'After the last hand, tick who played, set buy-ins, crown the winner.') +
      step(5, 'Settle Up', 'Losers pay the winner on Revolut from Poker debts.');
  }
  $('steps').addEventListener('click', async ev => {
    const t = ev.target.closest('a,button'); if (!t) return;
    if (t.id === 'start') {                        // the link opens PokerNow in a new tab; here we open the shared table
      copyText(me.nickname); S.nickCopied = true;
      try { await FY.rpc('poker_start'); } catch (e) { FY.toast(e.message); }
      await refresh(true);
    } else if (t.id === 'close') {
      if (!arm(t, 'Tap again to close')) return;
      t.disabled = true;
      try { await FY.rpc('poker_close', { p_table: S.cur.id }); FY.toast('Table closed.'); } catch (e) { FY.toast(e.message); t.disabled = false; }
      await refresh(true);
    } else if (t.id === 'paste') {
      let txt = ''; try { txt = (await navigator.clipboard.readText()) || ''; } catch (e) { /* blocked */ }
      if (txt.trim()) { S.draft = txt.trim(); S.pasted = true; renderSteps(true); setTimeout(() => { S.pasted = false; renderSteps(true); }, 1500); return; }
      S.pasteHint = true; renderSteps(true); const i = $('link'); if (i) { i.focus(); i.select(); }
      setTimeout(() => { S.pasteHint = false; renderSteps(true); }, 3500);
    } else if (t.id === 'enter') enterLink();
  });
  $('steps').addEventListener('input', ev => {
    if (ev.target.id !== 'link') return;
    S.draft = ev.target.value; const b = $('enter'); if (b) b.classList.toggle('off', !S.draft.trim());
  });
  $('steps').addEventListener('keydown', ev => { if (ev.target.id === 'link' && ev.key === 'Enter') { ev.preventDefault(); enterLink(); } });
  async function enterLink() {
    const url = (S.draft || '').trim(); if (!url || !S.cur) return;
    try { await FY.rpc('poker_set_link', { p_table: S.cur.id, p_url: url }); FY.toast('Table open. Take a seat.'); S.draft = ''; }
    catch (e) { FY.toast(e.message); }
    await refresh(true);
  }

  // ---- table ------------------------------------------------------------------
  const tableVisible = () => !!S.cur && (S.cur.status === 'open' || (S.cur.status === 'starting' && mine()));
  function renderCta() {
    const c = S.cur, url = c && c.pokernow_url;
    $('cta').innerHTML = url && (mySeat() || mine()) ? `<a href="${esc(url)}" target="_blank" rel="noopener" class="pk-btn"><i class="ph ph-arrow-square-out"></i>Open the table</a>` : '';
  }
  function renderTable() {
    const col = $('tablecol'), c = S.cur;
    if (!tableVisible()) { col.hidden = true; col.innerHTML = ''; S.shell = ''; $('tablerow').hidden = !S.docketShown; renderRow(); return; }
    $('tablerow').hidden = false; col.hidden = false;
    if (S.shell !== c.id) {
      S.shell = c.id;
      col.innerHTML = `<div class="pk-table"><span class="pk-kicker pk-tealtext">Tonight's table</span>
        <div class="pk-felt" id="felt"><div class="rail"></div><div class="cloth"></div><div class="inner"></div>
          <div class="buyin">1000 Buy-In</div><div class="mid" id="mid"></div><div id="seatsl"></div><div id="seatpop"></div></div></div>`;
      $('seatsl').addEventListener('click', ev => { const b = ev.target.closest('button[data-n]'); if (b) pickSeat(Number(b.dataset.n)); });
    }
    $('mid').innerHTML = `<span class="game">No Limit Texas Hold'em</span>` +
      (c.pokernow_url ? `<a href="${esc(c.pokernow_url)}" target="_blank" rel="noopener" class="pk-btn sm">OPEN TABLE</a>` : '<span class="wait">Paste the PokerNow link in step 2 to open the table.</span>');
    renderSeats(); renderRow();
  }
  function renderSeats() {
    const c = S.cur; if (!c || !$('seatsl')) return;
    const taken = {}; c.seats.forEach(s => taken[s.seat_no - 1] = s);
    const can = c.status === 'open' && !mySeat() && S.seat.phase === 'idle';
    if (S.sel != null && taken[S.sel] && S.seat.phase === 'idle') S.sel = null;       // someone beat me to it
    $('seatsl').innerHTML = SEAT_XY.map(([x, y], n) => {
      const pos = `left:${x}%;top:${y}%`, p = taken[n];
      if (p) return `<div class="pk-seat taken ${p.member_id === me.id ? 'me' : ''}" style="${pos}"><span class="col"><span class="face" role="img" aria-label="${esc(p.nickname)}" style="background-image:url('${avatarUrl(p.avatar)}')"></span><span class="who">${esc(p.table_name)}</span></span></div>`;
      const dash = `<span class="dash"><svg aria-hidden="true" viewBox="0 0 57 57"><circle class="base" cx="28.5" cy="28.5" r="27"></circle><circle class="chase" cx="28.5" cy="28.5" r="27"></circle></svg>${n + 1}</span><span class="sit">SIT</span>`;
      return can ? `<button type="button" class="pk-seat free pick ${S.sel === n ? 'lit' : ''}" style="${pos}" data-n="${n}" aria-label="Take seat ${n + 1}"><span class="col">${dash}</span></button>`
                 : `<div class="pk-seat free ${S.sel === n ? 'lit' : ''}" style="${pos}"><span class="col">${dash}</span></div>`;
    }).join('');
    renderPop();
  }
  function pickSeat(n) { if (S.seat.phase !== 'idle' || mySeat()) return; S.sel = n; renderSeats(); }

  // Take-seat card: name is copied on the click itself, the PokerNow link opens after a 10 second clock.
  function renderPop() {
    const pop = $('seatpop'); if (!pop) return;
    if (S.sel == null || !S.cur || S.cur.status !== 'open') { pop.innerHTML = ''; pop.dataset.sig = ''; return; }
    // Rebuild only when something it shows has changed, so a Realtime refresh never steals focus from the name box.
    const sig = [S.sel, S.seat.phase, S.seat.blocked, S.seat.url, S.cur.pokernow_url].join('|');
    if (pop.dataset.sig === sig && pop.innerHTML) return;
    pop.dataset.sig = sig;
    const [x, y] = SEAT_XY[S.sel], above = y > 40, shift = x <= 12 ? 15 : x <= 20 ? 25 : x >= 88 ? 85 : x >= 80 ? 75 : 50;
    const busy = S.seat.phase !== 'idle';
    const lock = 'font-size:21px';
    const body = busy
      ? `<div class="clock"><span class="face"><span class="dot"></span><i style="width:2.5px;height:15px;margin-left:-1.25px;background:#f2fbfb;animation:handSpin 16s linear infinite"></i><i style="width:1.5px;height:21px;margin-left:-.75px;background:#9eeae6;box-shadow:0 0 4px var(--neon-teal);animation:handSpin 1.6s linear infinite"></i></span><span class="count" id="count">${S.seat.count}</span></div>`
      : `<label>FARMYARD NAME<div class="field locked"><i class="ph-light ph-lock-simple" style="${lock};color:var(--neon-red-tube);text-shadow:var(--text-glow-red)"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(me.nickname)}</span></div></label>
         <label>TABLE NAME<div class="field edit"><i class="ph-light ph-lock-simple-open" style="${lock};color:var(--neon-green-tube);text-shadow:var(--text-glow-green)"></i><input id="tname" value="${esc(S.seat.name)}" maxlength="16" placeholder="${esc(me.nickname)}" autocomplete="off"></div><span class="hint">Try an Alt Tag On? (Just for the table)</span></label>`;
    const note = busy ? `<div class="note">Your table name has been copied to your clipboard.<span style="display:block;height:.8em"></span><span style="display:block;white-space:nowrap;font-size:12px">TAKE <b>SEAT ${S.sel + 1}</b> ON POKERNOW.</span>${S.seat.blocked && S.seat.url ? `<a class="pk-btn green sm" style="margin-top:8px" href="${esc(S.seat.url)}" target="_blank" rel="noopener">OPEN POKERNOW</a>` : ''}</div>` : '';
    pop.innerHTML = `<div class="pk-pop" style="left:${x}%;transform:translateX(-${shift}%);top:${above ? 'auto' : (y + 9) + '%'};bottom:${above ? (100 - y + 9) + '%' : 'auto'}" role="dialog" aria-label="Take seat ${S.sel + 1}">
      ${body}<button type="button" id="take" class="pk-btn green take ${busy ? 'off' : ''}">TAKE THE SEAT</button>${note}
      <span class="arrow" style="left:${shift}%;top:${above ? 'auto' : '-9px'};bottom:${above ? '-9px' : 'auto'};transform:translateX(-50%) rotate(${above ? 45 : 225}deg)"></span></div>`;
  }
  document.addEventListener('input', ev => { if (ev.target.id === 'tname') S.seat.name = ev.target.value; });
  document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('#take')) takeSeat(); });
  function takeSeat() {
    if (S.seat.phase !== 'idle' || S.sel == null || !S.cur) return;
    const name = (S.seat.name || '').trim() || me.nickname, seatNo = S.sel + 1, table = S.cur.id;
    copyText(name);                                // inside the click: browsers only allow it here
    S.seat.phase = 'count'; S.seat.count = 10; S.seat.blocked = false; S.seat.url = S.cur.pokernow_url;
    const p = FY.rpc('poker_take_seat', { p_table: table, p_seat: seatNo, p_table_name: name });
    S.seat.p = p;
    p.then(url => { S.seat.url = url || S.seat.url; refresh(true); }).catch(e => {
      clearInterval(S.seat.tick); S.seat.phase = 'idle'; S.seat.p = null; FY.toast(e.message); refresh(true);
    });
    renderPop(); renderSeats();
    S.seat.tick = setInterval(async () => {
      S.seat.count = Math.max(0, S.seat.count - 1);
      const el = $('count'); if (el) el.textContent = S.seat.count;
      if (S.seat.count > 0) return;
      clearInterval(S.seat.tick);
      let url = null; try { url = await S.seat.p; } catch (e) { return; }
      S.seat.url = url || S.seat.url;
      S.seat.blocked = !(S.seat.url && openPokerNow(S.seat.url));
      if (S.seat.blocked) { S.seat.phase = 'done'; renderPop(); setTimeout(() => { if (S.seat.phase === 'done') endSeatFlow(); }, 30000); return; }
      endSeatFlow();
    }, 1000);
  }
  function endSeatFlow() { S.seat.phase = 'idle'; S.seat.p = null; S.sel = null; S.seat.name = ''; refresh(true); }

  // ---- docket -----------------------------------------------------------------
  const canFile = () => !!S.cur && S.cur.status === 'open' && mine();
  function docketWanted() { return canFile() && S.cur.seats.some(s => s.member_id === S.cur.started_by); }
  function syncDocket() {                          // appears 2s after the initiator takes their seat
    if (docketWanted()) {
      if (!S.docketShown && !S.docketT) S.docketT = setTimeout(() => { S.docketT = null; S.docketShown = true; renderRow(); }, 2000);
    } else { clearTimeout(S.docketT); S.docketT = null; if (S.docketShown) { S.docketShown = false; renderRow(); } }
  }
  function renderRow() {
    const showDocket = S.docketShown && docketWanted();
    $('tablerow').classList.toggle('solo', !showDocket);
    $('tablerow').hidden = !(tableVisible() || showDocket);
    $('docketcol').hidden = !showDocket;
    if (showDocket) renderDocket(); else $('docketcol').innerHTML = '';
  }
  function renderDocket() {
    const c = S.cur, seats = c.seats;
    Object.keys(S.picks).forEach(id => { if (!seats.some(s => s.member_id === id)) delete S.picks[id]; });
    if (S.winner && !(S.picks[S.winner] > 0)) S.winner = null;
    const picked = seats.filter(s => S.picks[s.member_id] > 0);
    const total = picked.reduce((a, s) => a + S.picks[s.member_id], 0);
    const ready = picked.length >= 2 && !!S.winner;
    const losers = picked.filter(s => s.member_id !== S.winner);
    const summary = !picked.length ? 'Tick who played and set their buy-ins.' : !S.winner ? `${picked.length} played · pick the winner`
      : `${esc(S.names[S.winner]?.nickname)} takes ${total} pts (${pounds(total)})${losers.length ? ' · ' + losers.map(s => `${esc(s.nickname)} owes ${pounds(S.picks[s.member_id])}`).join(', ') : ''}`;
    const rows = seats.map(s => {
      const n = S.picks[s.member_id] || 0, win = S.winner === s.member_id && n > 0;
      return `<div class="pk-dgrid pk-drow ${n ? '' : 'off'}"><button type="button" class="who" data-t="${s.member_id}"><span class="box"></span><span>${esc(s.nickname)}</span></button>
        <div class="bi"><button type="button" data-d="${s.member_id}" aria-label="Less">−</button><b>${n}</b><button type="button" data-i="${s.member_id}" aria-label="More">+</button></div>
        <div class="win"><button type="button" class="${win ? 'on' : ''}" data-w="${s.member_id}" aria-label="Winner"><i class="ph-fill ph-crown" style="font-size:15px"></i></button></div></div>`;
    }).join('');
    const no = String(((S.board && S.board.games) || 0) + 1).padStart(3, '0');
    $('docketcol').innerHTML = `<div class="pk-docket"><div class="in">
      <div class="hd"><span class="t">Table Docket</span><span class="no">No. ${no}</span></div>
      <div><div class="pk-dgrid pk-dhead"><span>Who played</span><span>Buy-ins</span><span>Won</span></div>${rows}</div>
      <div class="ft"><span class="sum">${summary}</span><button type="button" class="file" id="file" ${ready ? '' : 'disabled'}>File docket</button></div></div>
      ${S.stamp ? '<span class="pk-stamp">FILED</span>' : ''}</div>`;
  }
  $('docketcol').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const d = b.dataset, set = (id, f) => { S.picks[id] = Math.max(0, f(S.picks[id] || 0)); if (S.picks[id] === 0 && S.winner === id) S.winner = null; renderDocket(); };
    if (d.t) set(d.t, v => v > 0 ? 0 : 1);
    else if (d.d) set(d.d, v => v - 1);
    else if (d.i) set(d.i, v => v + 1);
    else if (d.w) { if (!(S.picks[d.w] > 0)) S.picks[d.w] = 1; S.winner = d.w; renderDocket(); }
    else if (b.id === 'file') {
      const players = S.cur.seats.filter(s => S.picks[s.member_id] > 0).map(s => ({ member_id: s.member_id, buy_ins: S.picks[s.member_id] }));
      if (players.length < 2 || !S.winner) return;
      const pot = players.reduce((a, p) => a + p.buy_ins, 0); b.disabled = true;
      try {
        await FY.rpc('poker_file_docket', { p_table: S.cur.id, p_players: players, p_winner: S.winner });
        FY.toast(`Filed. ${pot} points to ${S.names[S.winner]?.nickname || 'the winner'}. 15 minutes to change it.`);
        S.picks = {}; S.winner = null; S.stamp = true; setTimeout(() => { S.stamp = false; if (S.docketShown) renderDocket(); }, 4000);
      } catch (e) { FY.toast(e.message); }
      await Promise.all([refresh(true), refreshBoard()]);
    }
  });

  // ---- board, debts, just filed ----------------------------------------------
  function renderBoard() {
    const bd = S.board; if (!bd) return;
    const rows = bd.rows.map((r, i) => {
      const mv = r.prev_rank == null ? 0 : r.prev_rank - r.rank, lead = i === 0 && r.won > 0, bal = r.net * GBP;
      const mark = lead ? '<i class="ph-fill ph-crown"></i>' : mv === 0 ? '' : mv > 0 ? '<i class="ph-bold ph-arrow-up up" aria-label="up"></i>' : '<i class="ph-bold ph-arrow-down down" aria-label="down"></i>';
      const balTxt = bal === 0 ? '–' : (bal > 0 ? '+£' : '−£') + Math.abs(bal);
      const balCol = bal > 0 ? 'var(--neon-green-tube)' : bal < 0 ? 'var(--neon-pink-text)' : 'var(--color-neutral-400)';
      return `<div class="pk-lgrid pk-lrow"><span class="pos">${String(r.rank).padStart(2, '0')}</span><span class="pl"><span class="mk">${mark}</span><span class="nm">${esc(r.nickname)}</span></span>
        <span class="c">${r.played}</span><span class="c">${r.won}</span><span class="c">${r.buyins}</span><span class="c bal" style="color:${balCol}">${balTxt}</span></div>`;
    }).join('');
    $('board').innerHTML = `<div class="ttl"><span class="script">Poker League Board</span>
      <span class="meta"><span>${SEASON}</span><span>total games = ${bd.games}</span><span>total buy-ins = ${bd.buyins}</span></span></div>
      <div class="pk-lwrap"><div class="pk-lgrid pk-lhead"><span>Pos</span><span>Player</span><span>Played</span><span>Won</span><span>Buy-ins</span><span>£</span></div>
      ${rows || '<p class="pk-empty">No games filed yet. The first docket starts the board.</p>'}</div>
      <span class="foot">Ranked by buy-ins per win (fewer is better). £ = what you're up or down once the IOUs are settled.</span>`;
  }
  function renderDebts() {
    const ds = S.debts || [];
    const rows = ds.map(d => `<div class="pk-dbgrid pk-dbrow"><span>${esc(d.nickname)}</span><span>${d.to.map(t => esc(t.nickname)).join(', ')}</span><span>${pounds(d.total)}</span></div>`).join('');
    $('debts').innerHTML = `<div class="ttl">Poker <span class="flicker-letter">d</span>ebts</div>
      <div class="pk-dbgrid pk-dbhead"><span>Player</span><span>Owes</span><span>Total</span></div>
      ${rows || '<p class="pk-empty">No debts. Everyone is square.</p>'}
      <a class="pk-settle" href="profile.html#settle"><i class="ph ph-hand-coins"></i>Settle up</a>
      <div id="recent"></div>`;
    renderRecent();
  }
  function renderRecent() {
    const el = $('recent'); if (!el) return;
    const items = ((S.board && S.board.recent) || []).map(r => ({ r, left: r.left_secs - (Date.now() - S.boardAt) / 1000 })).filter(x => x.left > 0);
    el.innerHTML = items.length ? '<span class="pk-kicker" style="display:block;padding-top:12px">Just filed</span>' + items.map(({ r, left }) => {
      const mins = Math.ceil(left / 60);
      return `<div class="pk-recent"><span class="what"><b>${esc(r.winner)}</b> <span>beat</span> ${esc(r.others)} · ${mins <= 1 ? 'Under a minute left to change' : mins + ' min left to change'}</span>
        <button type="button" class="pk-btn ghost sm" data-edit="${r.event_id}">Edit</button><button type="button" class="pk-btn ghost sm" data-undo="${r.event_id}" style="color:var(--neon-pink)">Undo</button></div>`;
    }).join('') : '';
  }
  $('debts').addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b || !(b.dataset.edit || b.dataset.undo)) return;
    const r = S.board.recent.find(x => x.event_id === (b.dataset.edit || b.dataset.undo)); if (!r) return;
    if (b.dataset.undo && !arm(b, 'Tap again to undo')) return;
    b.disabled = true;
    try {
      await FY.rpc('poker_undo_docket', { p_table: r.table_id });
      if (b.dataset.edit) { S.picks = { ...r.picks }; S.winner = r.winner_id; FY.toast('Docket reopened. Change it and file again.'); }
      else FY.toast('Docket undone. Points reversed, IOUs closed.');
    } catch (e) { FY.toast(e.message); b.disabled = false; }
    await Promise.all([refresh(true), refreshBoard()]);
  });
  async function refreshBoard() {
    try { [S.board, S.debts] = await Promise.all([FY.rpc('poker_board'), FY.rpc('poker_debts')]); S.boardAt = Date.now(); }
    catch (e) { console.warn(e); }
    renderBoard(); renderDebts(); if (S.docketShown) renderDocket();
  }

  // ---- data loop: Realtime pings, 5s polling fallback ---------------------------
  async function refresh(force) {
    const my = ++S.seq; let cur;
    try { cur = await FY.rpc('poker_current'); } catch (e) { console.warn(e); return; }
    if (my !== S.seq) return;                      // a newer fetch is already on its way
    const prev = S.cur; S.cur = cur || null;
    const key = cur ? `${cur.id}:${cur.status}:${cur.event_id || ''}` : '';
    if (prev && !cur || (prev && cur && prev.id !== cur.id)) {   // table closed or replaced: drop local state
      Object.assign(S, { sel: null, picks: {}, winner: null, draft: '', nickCopied: false, closeArmed: false, shell: '' });
      clearInterval(S.seat.tick); S.seat = { phase: 'idle', name: '', count: 10, p: null, url: null, blocked: false };
    }
    if (force || JSON.stringify(prev) !== JSON.stringify(S.cur)) {
      renderSteps(); renderCta(); renderTable(); syncDocket();
    }
    if (key !== S.key) { S.key = key; refreshBoard(); }
  }
  let rtLive = false, pollT = null, kickT = null;
  // Not live: poll every 5s. Live: Realtime does the work; a slow poll is only a safety net (e.g. table missing from the publication).
  const setPoll = live => { clearInterval(pollT); pollT = setInterval(refresh, live ? 30000 : 5000); };
  const kick = () => { clearTimeout(kickT); kickT = setTimeout(refresh, 150); };
  try {
    FY.sb.channel('poker-room')
      .on('postgres_changes', { event: '*', schema: 'fy', table: 'poker_table' }, kick)
      .on('postgres_changes', { event: '*', schema: 'fy', table: 'poker_seat' }, kick)
      .subscribe(st => { rtLive = st === 'SUBSCRIBED'; setPoll(rtLive); });
  } catch (e) { console.warn(e); }
  setPoll(false);                                  // 5s until Realtime confirms it is live
  setInterval(renderRecent, 15000);                // "x min left to change"
  setInterval(refreshBoard, 60000);

  renderSteps(); await refresh(true); await refreshBoard();
})().catch(e => FY.toast(e.message));
