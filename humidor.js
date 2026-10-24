/* The Humidor shared layer. Loaded after barn.js on the five humidor*.html pages.
   Humidor.start(tab) opens the Barn, draws the Humidor header (title, round chip, tabs) and loads the round.
   Humidor.poll(onChange) re-fetches humidor_current() every 5 s while the tab is visible (R7); pages redraw only
   other members' state in onChange and never a form (R8). brief() and prompt() are ported from the design's
   humidor-club.js and stay client-side (R9). Stage pin: fy.league.humidor_stage, null follows the round (R6). */
(function () {
  const esc = s => FY.esc(s);
  const TABS = [
    ['home', 'humidor.html', 'Home'],
    ['vote', 'humidor-vote.html', 'Vote'],
    ['results', 'humidor-results.html', 'Results'],
    ['archive', 'humidor-archive.html', 'Archive'],
    ['admin', 'humidor-admin.html', 'Admin<small>· leader</small>']
  ];
  const TITLES = { home: 'The Humidor', vote: 'Vote', results: 'Results', archive: 'Archive', admin: 'Humidor admin' };
  const STAGES = ['Submit your taste', 'Hank finds three', 'Rank the three', 'One gets picked', 'Pay your share'];   // the designs' S[] titles (Home), so Home and Admin agree
  const TL = ['30 min', '45 min', '60 min', '90 min', '120 min', '2 hours+'];
  // Size photos in assets/humidor/cigars/ (no directory listing on GitHub Pages). Same list as the designs' PH[].
  const PH = ['belicoso-belicoso-grande.jpg', 'belicoso-belicoso.jpg', 'belicoso-campana.png', 'belicoso-mini-belicoso.png', 'belicoso-petit-belicoso.jpg', 'chisel-big-chisel.png', 'chisel-chisel.png', 'culebra-culebra.png', 'parejo-carlota.png', 'parejo-churchill.png', 'parejo-corona-gorda.png', 'parejo-corona-grande.png', 'parejo-corona.png', 'parejo-double-corona.png', 'parejo-gordo.jpg', 'parejo-gran-corona.jpg', 'parejo-laguito-no-2.png', 'parejo-laguito-no-3.png', 'parejo-lancero.png', 'parejo-mini-cigarillo.jpg', 'parejo-perla.png', 'parejo-petit-corona.png', 'parejo-petit-edmundo.png', 'parejo-petit-robusto.png', 'parejo-presidente.png', 'parejo-robusto.png', 'parejo-rothschild.jpg', 'parejo-toro.jpg', 'perfecto-diadema.jpg', 'perfecto-exquisito.png', 'perfecto-favorito.png', 'perfecto-generoso.png', 'perfecto-petit-bouquet.png', 'perfecto-romeo.png', 'perfecto-salomo-n.png', 'pyramid-pira-mide.png', 'torpedo-long-torpedo.jpg', 'torpedo-torpedo.png'];
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  let keys = null;

  // humidor-club.js mode(): most common non-empty value, first seen wins a tie. Total over any input: only non-empty
  // strings and finite numbers count, and the tally has no prototype, so "constructor" or "__proto__" count like any value.
  const scalar = x => typeof x === 'string' || (typeof x === 'number' && isFinite(x));
  const mode = arr => { if (!Array.isArray(arr)) return null; const c = Object.create(null); arr.forEach(x => { if (x && scalar(x)) c[x] = (c[x] || 0) + 1; }); let best = null, n = 0; for (const x in c) if (c[x] > n) { best = x; n = c[x]; } return best ? { value: best, count: n } : null; };
  // A member's taste cut to the shape the Vote tab writes. The server takes any JSON object, so a field of the wrong
  // type counts as absent: scalars are strings or numbers, flavour and wr arrays of strings (wr a pair), sizePrefs an
  // object, maxT an index into TL. Well-formed prefs come through unchanged, so brief() matches humidor-club.js.
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const strs = x => Array.isArray(x) && x.every(s => typeof s === 'string') ? x : null;
  const sc = x => scalar(x) ? x : null;
  const taste = p => {
    p = isObj(p) ? p : {};
    const sp = isObj(p.sizePrefs) ? p.sizePrefs : null, wr = strs(p.wr);
    const maxT = sp && scalar(sp.maxT) && Object.prototype.hasOwnProperty.call(TL, sp.maxT) && typeof TL[sp.maxT] === 'string' ? sp.maxT : null;
    return { time: sc(p.time), size: sc(p.size), strength: sc(p.strength), wr: wr && wr.length >= 2 ? wr : null, flavour: strs(p.flavour) || [],
      origin: sc(p.origin), budget: sc(p.budget), sizePrefs: sp && { minR: sc(sp.minR), maxR: sc(sp.maxR), maxT, shape: sc(sp.shape) } };
  };
  const autoStage = r => !r ? -1 : r.status === 'collecting' ? 0 : r.status === 'ranking' ? 2 : r.status === 'paying' ? 4 : -1;

  let last = null, onChange = null, head = null, pollT = null, wired = false, inflight = null, queued = null;
  const next = () => { queued = null; return Humidor.refresh(); };
  const quiet = () => { Humidor.refresh().catch(() => {}); };   // poll ticks: onChange errors are already logged
  const fetchCurrent = () => FY.rpc('humidor_current');
  const drawChip = d => { const c = head && head.querySelector('.hm-chip'); if (c) c.textContent = Humidor.chip(d); };

  const Humidor = {
    STAGES, TL, mode, autoStage,

    // Round chip text, as the designs' barnChip.
    chip(d) {
      const r = d && d.round;
      return !r ? 'No round open' : 'Round ' + r.n + ' · ' + ({ collecting: 'collecting', ranking: 'ranking', paying: 'paying up' }[r.status] || r.status);
    },

    // 0-4, or -1 when nothing is lit. A pinned league stage wins; null follows the round (R6).
    stage(d) {
      if (!d) return -1;
      return (d.stage === 0 || d.stage > 0) ? d.stage : autoStage(d.round);
    },

    // Paying up: counts against this round's voters (members with prefs). No pay row = not paid.
    // A prefs row that is not an object is skipped, as in brief().
    payState(d) {
      const r = d && d.round;
      const voters = new Set((r && Array.isArray(r.prefs) ? r.prefs : []).filter(isObj).map(p => p.member_id));
      const pays = ((r && r.pays) || []).filter(p => voters.has(p.member_id));
      const confirmed = pays.filter(p => p.state === 'confirmed').length;
      const pending = pays.filter(p => p.state === 'pending').length;
      return { confirmed, pending, voters: voters.size, full: voters.size > 0 && confirmed === voters.size };
    },

    // Ported from humidor-club.js brief(r); takes humidor_current().round.prefs rows ({ member_id, nickname, ..., prefs }).
    // Never throws: a row that is not an object is skipped, and each taste goes through taste() first.
    brief(rows) {
      const V = Array.isArray(rows) ? rows.filter(isObj) : []; const P = V.map(v => taste(v.prefs)); const n = V.length;
      const flC = Object.create(null); P.forEach(p => (p.flavour || []).forEach(f => flC[f] = (flC[f] || 0) + 1));
      const top = (c, n2) => Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n2).map(([value, count]) => ({ value, count }));
      return { n, time: mode(P.map(p => p.time)), size: mode(P.map(p => p.size)), strength: mode(P.map(p => p.strength)), wrapper: mode(P.map(p => p.wr ? (p.wr[0] === p.wr[1] ? p.wr[0] : p.wr[0] + ' to ' + p.wr[1]) : null)), flavour: top(flC, 2), origin: mode(P.map(p => p.origin)), budget: mode(P.map(p => p.budget)), minR: mode(P.map(p => p.sizePrefs && p.sizePrefs.minR != null ? String(p.sizePrefs.minR) : null)), maxR: mode(P.map(p => p.sizePrefs && p.sizePrefs.maxR != null ? String(p.sizePrefs.maxR) : null)), maxT: mode(P.map(p => p.sizePrefs && p.sizePrefs.maxT != null ? TL[p.sizePrefs.maxT] : null)), shape: mode(P.map(p => p.sizePrefs && p.sizePrefs.shape)) };
    },

    // Ported from humidor-club.js prompt(b). With likely (the admin's Likely selection: { name, spec, fit:'Fits X of N',
    // alts:['Name (f/N)', ...] }) it splices in the buyer count and the weighted best fit, as ADMIN.dc.html does.
    prompt(b, memberCount, likely) {
      const L = []; const v = x => x ? x.value : null;
      L.push('Find 3 hand-rolled cigars I can buy online in the UK for a small members\' cigar club. Most of us are fairly new to cigars.');
      L.push(''); L.push('What the group voted for (' + b.n + (b.n === 1 ? ' member' : ' members') + '):');
      if (v(b.time)) L.push('- Smoking time: about ' + v(b.time) + (v(b.size) ? ' (sizes like a ' + v(b.size) + ')' : ''));
      if (v(b.shape)) L.push('- Shape: ' + v(b.shape));
      if (v(b.minR) || v(b.maxR)) L.push('- Ring gauge: ' + (v(b.minR) && v(b.maxR) ? v(b.minR) + ' to ' + v(b.maxR) : v(b.minR) ? v(b.minR) + ' or thicker' : 'up to ' + v(b.maxR)));
      if (v(b.maxT)) L.push('- Smoking time: no longer than ' + v(b.maxT));
      if (v(b.strength)) L.push('- Strength: ' + v(b.strength));
      if (v(b.wrapper)) L.push('- Wrapper colour: ' + v(b.wrapper));
      if (v(b.budget)) L.push('- Budget: ' + v(b.budget) + ' per cigar (single sticks)');
      const nice = []; if (b.flavour.length) nice.push('flavours like ' + b.flavour.map(f => f.value.toLowerCase()).join(' and ')); if (v(b.origin)) nice.push('made in ' + v(b.origin));
      if (nice.length) L.push('- Nice to have, not essential: ' + nice.join('; '));
      L.push(''); L.push('For each cigar give: name and size (length x ring gauge), country, wrapper, strength, typical tasting notes, UK price for a single, and two UK shops that stock it with links.');
      L.push('Make the three options different from each other, and say in one line why each one fits the brief.');
      if (likely && likely.name) {
        const N = memberCount != null ? memberCount : b.n; const alts = likely.alts || [];
        L[0] = 'Find 3 hand-rolled cigars I can buy online in the UK for a small members\' cigar club. ' + N + (N === 1 ? ' member is' : ' members are') + ' buying, one cigar each, so I need ' + N + ' of whichever we pick. Most of us are fairly new to cigars.';
        const k = L.findIndex(l => /^For each cigar give/.test(l)); const add = ['', 'Weighted best fit for the group: ' + likely.name + ' (' + likely.spec + '). It fits ' + String(likely.fit || '').replace(/^Fits /, '') + ' voters\' size, shape, ring gauge and time limits.' + (alts.length ? ' Close alternatives: ' + alts.map(x => x.replace(/ \((\d+)\/(\d+)\)$/, ' ($1 of $2)')).join(', ') + '.' : ''), 'Search for this size first. At least two of the three options should be a ' + likely.name + ' or the nearest equivalent the brand makes.'];
        if (k > 0) L.splice(k - 1, 0, ...add); else L.push(...add);
      }
      return L.join('\n');
    },

    // Size photo for a cigar: pass size + ' ' + name. Longest vitola key found in the text wins (ARCHIVE.dc.html photoFor).
    sizePhoto(name) {
      if (!keys) keys = PH.map(f => ({ k: norm(f.replace(/\.(png|jpg)$/, '').split('-').slice(1).join('')), f })).sort((a, b) => b.k.length - a.k.length);
      const txt = norm(name);
      if (!txt) return null;
      const hit = keys.find(x => txt.includes(x.k)) || keys.find(x => txt.includes(x.k.replace(/no\d$/, '')));
      return hit ? 'assets/humidor/cigars/size-photo-' + hit.f : null;
    },

    // Opens the Barn on the Humidor, draws the header, loads the round and the yard's members.
    // Returns null when the Barn drew a door instead, or the load failed. main is the content area under the header.
    // Every result carries leader (role says leader AND is_leader() agrees). On 'admin' a non-leader gets the
    // shell, the header and a leader-only message in main, and { me, main, leader:false } with no data.
    async start(tab) {
      const B = await Barn.open('humidor'); if (!B) return null;
      const { me } = B;
      const leader = me.role === 'leader' && !!(await FY.rpc('is_leader').catch(() => false));
      B.main.innerHTML = `<header class="hm-head">
          <div class="hm-titlerow"><h2 class="hd2">${esc(TITLES[tab] || TITLES.home)}</h2><span class="tag tag-neutral hm-chip"></span></div>
          ${tab === 'home' ? '<p class="hm-tagline">A cigar club with a vote to suit your budget.</p>' : ''}
          <nav class="switcher hm-tabs" aria-label="Humidor pages">${TABS.filter(t => t[0] !== 'admin' || me.role === 'leader').map(t =>
            `<a class="tab" href="${t[1]}"${t[0] === tab ? ' aria-selected="true" aria-current="page"' : ''}>${t[2]}</a>`).join('')}</nav>
        </header><div class="hm-body" id="hm-body"></div>`;
      head = B.main.querySelector('.hm-head');
      const main = B.main.querySelector('#hm-body');
      if (tab === 'admin' && !leader) {
        main.innerHTML = '<div class="box-teal"><span class="kicker">Leader only</span><p style="margin:0">Only Hank can run the Humidor admin.</p></div>';
        return { me, main, leader: false };
      }
      let data, members;
      try {
        let q = FY.q('v_members_public').select('id,nickname,avatar,avatar_url').order('nickname');
        if (me.league_id) q = q.eq('league_id', me.league_id);
        const [d, m] = await Promise.all([fetchCurrent(), q]);
        if (m.error) throw new Error(m.error.message || String(m.error));
        data = d || { stage: null, round: null }; members = m.data || [];
      } catch (e) {
        main.innerHTML = `<p class="muted">Couldn't load the Humidor: ${esc(e.message)}</p>`;
        return null;
      }
      last = JSON.stringify(data);
      drawChip(data);
      return { me, main, data, members, leader };
    },

    // Fetch now; redraws the chip and calls the poll's onChange only if the round changed. Resolves to the data.
    // A call made while a fetch is in flight waits for it, then runs one more fetch (so it sees the caller's own
    // write); calls in that window share that one extra fetch. A network failure resolves to the last data seen.
    // If onChange throws, the error is logged and the promise rejects; the data is not marked as delivered, so the
    // next refresh delivers it again.
    refresh() {
      if (inflight) return queued || (queued = inflight.then(next, next));
      inflight = (async () => {
        let d;
        try { d = (await fetchCurrent()) || { stage: null, round: null }; }
        catch (e) { return JSON.parse(last || 'null'); }
        finally { inflight = null; }
        const j = JSON.stringify(d);
        if (j !== last) {
          drawChip(d);
          if (onChange) { try { onChange(d); } catch (e) { console.error(e); throw e; } }
          last = j;
        }
        return d;
      })();
      return inflight;
    },

    // Every 5 s while visible; a hidden tab skips the poll and refetches the moment it is shown again (poker.js).
    // Returns a stop function. One poll per page: a second call replaces the first's onChange.
    poll(fn) {
      onChange = fn;
      const startPoll = () => { clearInterval(pollT); pollT = setInterval(() => { if (!document.hidden) quiet(); }, 5000); };
      if (!wired) {
        wired = true;
        const wake = () => { if (document.hidden || !onChange) return; quiet(); startPoll(); };
        document.addEventListener('visibilitychange', wake);
        window.addEventListener('pageshow', ev => { if (ev.persisted) wake(); });   // restored from the back-forward cache
        window.addEventListener('online', wake);
      }
      startPoll();
      return () => { clearInterval(pollT); pollT = null; onChange = null; };
    }
  };
  window.Humidor = Humidor;
})();
