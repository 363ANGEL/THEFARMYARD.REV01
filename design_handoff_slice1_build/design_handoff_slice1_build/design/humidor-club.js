// Shared club store (prototype: localStorage, one browser). Swap for a real backend later.
(function(){
  const KEY = /demo/.test(location.hash) || sessionStorage.getItem('p15-demo') ? 'p15-club-demo' : 'p15-club-v1';
  const DEFAULT_MEMBERS = ['Hank', 'Dave', 'Gaz', 'Tom', 'Mick', 'Lee'];
  const empty = () => ({ round: null, archive: [], seq: 0, revolut: '', members: DEFAULT_MEMBERS.slice() });
  const load = () => { try { return Object.assign(empty(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return empty(); } };
  const save = d => { localStorage.setItem(KEY, JSON.stringify(d)); window.dispatchEvent(new Event('p15-club')); };
  const subscribe = fn => { const h = () => fn(load()); window.addEventListener('p15-club', h); window.addEventListener('storage', h); return () => { window.removeEventListener('p15-club', h); window.removeEventListener('storage', h); }; };
  const k = s => (s || '').trim().toLowerCase();
  const edit = fn => { const d = load(); fn(d); save(d); return d; };

  // 1 · collecting preferences
  const openRound = () => edit(d => { if (d.round) return; d.seq = (d.seq || 0) + 1; d.round = { n: d.seq, openedAt: Date.now(), status: 'collecting', votes: [], options: [], ballots: [] }; });
  const submitPrefs = (name, prefs) => edit(d => { const r = d.round; if (!r || r.status !== 'collecting') return; r.votes = r.votes.filter(v => k(v.name) !== k(name)); r.votes.push({ name: name.trim(), prefs, at: Date.now() }); });
  const reopenCollect = () => edit(d => { if (d.round) d.round.status = 'collecting'; });

  // 2 · ranking the three (3 / 2 / 1 points)
  const postOptions = options => edit(d => { const r = d.round; if (!r) return; r.options = options; r.status = 'ranking'; r.ballots = []; });
  const isVoter = (r, name) => !!(r && r.votes.find(v => k(v.name) === k(name)));
  const castRanking = (name, rank) => edit(d => { const r = d.round; if (!r || r.status !== 'ranking' || !isVoter(r, name)) return; r.ballots = r.ballots.filter(b => k(b.name) !== k(name)); r.ballots.push({ name: name.trim(), rank, at: Date.now() }); });
  const points = r => { const p = (r.options || []).map(() => 0), firsts = p.slice(); (r.ballots || []).forEach(b => (b.rank || []).forEach((opt, pos) => { if (p[opt] !== undefined) { p[opt] += 3 - pos; if (pos === 0) firsts[opt]++; } })); return { p, firsts }; };
  const leader = r => { const { p, firsts } = points(r); let w = 0; p.forEach((v, i) => { if (v > p[w] || (v === p[w] && firsts[i] > firsts[w])) w = i; }); return w; };

  // 3 · paying up
  const closeRanking = () => edit(d => { const r = d.round; if (!r || r.status !== 'ranking') return; r.winner = leader(r); r.status = 'paying'; const w = r.options[r.winner] || {}; r.pay = { amount: String(w.price || '').replace(/^£/, ''), link: d.revolut || '', due: r.votes.map(v => v.name), paid: {} }; });
  const setPay = (amount, link) => edit(d => { const r = d.round; if (!r || !r.pay) return; r.pay.amount = amount; r.pay.link = link; d.revolut = link; });
  const markPaid = name => edit(d => { const r = d.round; if (!r || !r.pay) return; const m = r.pay.due.find(x => k(x) === k(name)); if (m && r.pay.paid[m] !== 'confirmed') { r.pay.paid[m] = 'pending'; r.pay.sentAt = r.pay.sentAt || {}; r.pay.sentAt[m] = Date.now(); } });
  const confirmPaid = (name, on) => edit(d => { const r = d.round; if (!r || !r.pay) return; if (on) r.pay.paid[name] = 'confirmed'; else delete r.pay.paid[name]; });
  const payState = r => { const due = (r && r.pay && r.pay.due) || []; const paid = (r && r.pay && r.pay.paid) || {}; const confirmed = due.filter(n => paid[n] === 'confirmed').length; const pending = due.filter(n => paid[n] === 'pending').length; return { due, paid, confirmed, pending, total: due.length, full: due.length > 0 && confirmed === due.length }; };
  const placeOrder = () => edit(d => { const r = d.round; if (!r) return; r.status = 'closed'; r.closedAt = Date.now(); r.id = r.id || ('r' + r.n + '-' + r.closedAt); d.archive.unshift(r); d.round = null; });

  // landing page stage (null = follow the round)
  const STAGES = ['Submit your taste','Hank finds three','Rank the three','One gets picked','In or out'];
  const autoStage = r => !r ? -1 : r.status === 'collecting' ? 0 : r.status === 'ranking' ? 2 : r.status === 'paying' ? 4 : -1;
  const stage = d => (d.stage === 0 || d.stage > 0) ? d.stage : autoStage(d.round);
  const setStage = n => edit(d => { d.stage = (n === null || n === undefined) ? null : n; });

  const members = () => { const m = load().members; return (m && m.length ? m : DEFAULT_MEMBERS).slice().sort((a, b) => a.localeCompare(b)); };
  const addMember = name => edit(d => { const n = (name || '').trim(); if (!n) return; d.members = d.members || []; if (!d.members.some(x => k(x) === k(n))) d.members.push(n); });
  const removeMember = name => edit(d => { d.members = (d.members || []).filter(x => k(x) !== k(name)); });
  const mode = arr => { const c = {}; arr.filter(Boolean).forEach(x => c[x] = (c[x] || 0) + 1); let best = null, n = 0; for (const x in c) if (c[x] > n) { best = x; n = c[x]; } return best ? { value: best, count: n } : null; };
  const brief = r => { const V = (r && r.votes) || []; const P = V.map(v => v.prefs || {}); const n = V.length;
    const flC = {}; P.forEach(p => (p.flavour || []).forEach(f => flC[f] = (flC[f] || 0) + 1));
    const top = (c, n2) => Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n2).map(([value, count]) => ({ value, count }));
    return { n, time: mode(P.map(p => p.time)), size: mode(P.map(p => p.size)), strength: mode(P.map(p => p.strength)), wrapper: mode(P.map(p => p.wr ? (p.wr[0] === p.wr[1] ? p.wr[0] : p.wr[0] + ' to ' + p.wr[1]) : null)), flavour: top(flC, 2), origin: mode(P.map(p => p.origin)), budget: mode(P.map(p => p.budget)), minR: mode(P.map(p => p.sizePrefs && p.sizePrefs.minR != null ? String(p.sizePrefs.minR) : null)), maxR: mode(P.map(p => p.sizePrefs && p.sizePrefs.maxR != null ? String(p.sizePrefs.maxR) : null)), maxT: mode(P.map(p => p.sizePrefs && p.sizePrefs.maxT != null ? ["30 min","45 min","60 min","90 min","120 min","2 hours+"][p.sizePrefs.maxT] : null)), shape: mode(P.map(p => p.sizePrefs && p.sizePrefs.shape)) }; };
  const prompt = b => { const L = []; const v = x => x ? x.value : null;
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
    return L.join('\n'); };

  window.HumidorClub = { KEY, STAGES, autoStage, stage, setStage, members, addMember, removeMember, load, save, subscribe, openRound, submitPrefs, reopenCollect, postOptions, isVoter, castRanking, points, leader, closeRanking, setPay, markPaid, confirmPaid, payState, placeOrder, mode, brief, prompt };
})();
