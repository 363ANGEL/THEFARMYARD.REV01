/* 2.1b Poker School. The video feed that used to sit at the foot of the Poker Room, now its own
   sub-page under Poker (RAY, 15 Nov) — the room page is for running a game, this is for watching.
   Reads fy.poker_feeds, the same RPC the room used; nothing on the server changed. */
(async function () {
  const B = await Barn.open('poker-school'); if (!B) return;
  const { main } = B;
  const $ = id => document.getElementById(id);
  const esc = FY.esc;

  const S = { feeds: null, order: null, play: false };

  main.innerHTML = `
    <div class="fy-pagehead"><h2 class="t-title-b">Poker School</h2><span class="t-tagline">Start at the top. Four videos and you know enough to sit down.</span></div>
    <div class="pk"><section class="pk-mod pk-thin" id="school"><p class="pk-empty">Loading the school…</p></section></div>`;

  function render() {
    const vids = (S.feeds && S.feeds.videos) || [];
    const head = '<div class="pk-modhead"><span class="pk-title">Poker School</span><span class="pk-sub">Everything you need to play, in order</span></div>';
    if (!vids.length) { $('school').innerHTML = head + '<p class="pk-empty">No videos yet.</p>'; return; }
    const order = S.order && S.order.length === vids.length ? S.order : vids.map((_, i) => i);
    const v = vids[order[0]];
    $('school').innerHTML = head + `
      <div class="pk-player"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtube_id)}${S.play ? '?autoplay=1' : ''}" title="${esc(v.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
      <div class="pk-now"><span class="t">Now playing: ${esc(v.title)}</span>${v.channel ? `<span class="ch">${esc(v.channel)}</span>` : ''}</div>
      <div class="pk-queue">${order.slice(1).map(i => { const q = vids[i]; return `<button type="button" class="pk-vid" data-vid="${i}">
        <span class="th" style="background-image:url('https://i.ytimg.com/vi/${esc(q.youtube_id)}/mqdefault.jpg')"><span class="play" aria-hidden="true"></span></span>
        ${q.tag ? `<span class="tag">${esc(q.tag)}</span>` : ''}<span class="t">${esc(q.title)}</span>${q.channel ? `<span class="ch">${esc(q.channel)}</span>` : ''}</button>`; }).join('')}</div>`;
    S.order = order;
  }

  // Clicking a queued video promotes it to the player and starts it.
  $('school').addEventListener('click', ev => {
    const b = ev.target.closest('[data-vid]'); if (!b) return;
    const i = Number(b.dataset.vid), o = S.order.slice(); o.splice(o.indexOf(i), 1); o.unshift(i);
    S.order = o; S.play = true; render();
  });

  async function refresh() {
    try { S.feeds = await FY.rpc('poker_feeds'); } catch (e) { console.warn(e); }
    render();
  }
  await refresh();
  // The feed is rebuilt once a day, so a check on returning to the tab is plenty.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
