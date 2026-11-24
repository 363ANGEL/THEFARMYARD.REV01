/* The Humidor · Roll your own v2.0 (RAY, 24 Nov). Vanilla port of the Claude Design handoff
   "Humidor Concept C - Roll your own.dc.html" (Concept 2a): one question at a time, a live 3D cigar
   (humidor-cigar3d.js) and a size counter over the 38 SAMPLE sizes in humidor-shelf.js. On the landing
   step the cigar gives way to the "cigar knowledge" chart (humidor-chart.js, plan 38).
   The logic class, its tables and every line of copy are the design's, verbatim (qs, STEER, SUITS, REC,
   LFIT, SIZE). What changed in the port:
   - React/<sc-if>/<sc-for> became one render() that writes each region; the option buttons are rebuilt
     only when their content changes, so hovering never replaces the button under the pointer.
   - style-hover/style-focus became CSS :hover / :focus-visible (humidor-roll.html).
   - DS Button/NeonButton became the site's .btn.btn-ghost and .neon-btn (:disabled = the design's "off").
   - "Round 4 · Your taste" is "Your taste" only: this page has no live round (plan 36 idiotcheck 3).
   - Submit writes nothing. Step 8 shows Hank and a "not saved yet" line (plan 36 decision 3). */
(function () {
  const H = window.HumidorShelf;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = o => Object.entries(o).map(([k, v]) => k + ':' + v).join(';');

  // ---- Design tables, verbatim ----
  const SIZE = { 'Half an hour': [4.2, 42], 'About an hour': [5, 50], 'An hour and a half': [6.2, 52], 'All night': [7.6, 49] };
  const REC = { 'Beginner': { budget: 'Up to £10', time: 'About an hour', shape: 'Parejo', strength: 'Mild', wrapper: 'Light' }, 'Fairly new': { budget: 'Up to £18', time: 'About an hour', shape: 'Parejo', strength: 'Mild', wrapper: 'Medium' }, 'Some experience': { budget: 'Up to £18', time: 'An hour and a half', shape: 'Torpedo', strength: 'Medium', wrapper: 'Dark' }, 'Knowledgeable': { budget: 'Up to £30', time: 'All night', shape: 'Perfecto', strength: 'Full', wrapper: 'Dark' } };
  const STEER = { 'Beginner': 'Start short and wide. A thicker cigar burns cooler and is easier to keep lit. Go mild, in a light leaf. No need to spend big yet.', 'Fairly new': 'Stay mild and on the shorter, wider side. Try a medium leaf for more flavour without more kick. A parejo is still the safe shape.', 'Some experience': 'Medium strength will suit. Try a darker leaf, or a pointed head for a tighter, more focused smoke.', 'Knowledgeable': 'You know what you like. Hank marks the bolder end of each choice, but everything is open.' };
  const LFIT = { 'Beginner': c => c.len <= 5.7 && c.ring >= 46 && (c.shape === 'parejo' || c.shape === 'belicoso'), 'Fairly new': c => c.len <= 6.2 && c.ring >= 42 && (c.shape === 'parejo' || c.shape === 'belicoso'), 'Some experience': c => c.len <= 7.3 && c.ring >= 38 && c.shape !== 'culebra' };
  const LEVELS = ['Beginner', 'Fairly new', 'Some experience', 'Knowledgeable'];
  // Landing-step display words (RAY, 24 Nov); the stored answers keep the design's values.
  const LEVEL_SHOW = { 'Beginner': 'BEGINNER', 'Fairly new': 'NOVICE', 'Some experience': 'EXPERIENCED', 'Knowledgeable': 'EXPERT' };
  const SUITS = {
    'Beginner': { budget: ['Up to £10'], time: ['Half an hour', 'About an hour'], shape: ['Parejo'], strength: ['Mild'], wrapper: ['Light'] },
    'Fairly new': { budget: ['Up to £10', 'Up to £18'], time: ['About an hour'], shape: ['Parejo', 'Belicoso'], strength: ['Mild', 'Medium'], wrapper: ['Light', 'Medium'] },
    'Some experience': { budget: ['Up to £18', 'Up to £30'], time: ['About an hour', 'An hour and a half'], shape: ['Belicoso', 'Torpedo', 'Pyramid'], strength: ['Medium'], wrapper: ['Medium', 'Dark'] },
    'Knowledgeable': { budget: ['Up to £30', 'No ceiling'], time: ['An hour and a half', 'All night'], shape: ['Torpedo', 'Pyramid', 'Perfecto', 'Chisel'], strength: ['Full'], wrapper: ['Dark'] }
  };
  const TONES = [['var(--art-cream)', 'rgba(241,233,210,.5)'], ['var(--neon-green)', 'rgba(10,158,67,.6)'],   // Beginner ivory (--art-cream), Fairly new dark green (RAY, 24 Nov)
    ['var(--neon-amber)', 'rgba(255,154,31,.6)'], ['var(--neon-red-tube)', 'rgba(232,38,58,.6)']];   // Some experience amber, Knowledgeable red (RAY, 24 Nov)
  const NOTE_POS = { Creamy: [14, 18], Nutty: [70, 10], Woody: [84, 46], Spicy: [8, 58], Sweet: [56, 80], Earthy: [24, 86] };

  let _sz, _qs, small = false;
  const sizes = () => _sz || (_sz = H.sizesOf(H.CIGARS));
  const qs = () => { if (!_qs) { const none = { v: 'No preference', sub: 'Hank decides' }; const from = c => 2 + c.len * c.ring * 0.03 + (c.shape === 'parejo' ? 0 : 3); _qs = [
    { key: 'level', short: 'You', kind: 'you', q: 'How well do you know cigars?', tip: 'No wrong answer. Hank uses it to point out what is likely to suit you. You can ignore him.',
      options: [ { v: 'Beginner', sub: 'First few' }, { v: 'Fairly new', sub: 'Had a handful' }, { v: 'Some experience', sub: 'Know what I like' }, { v: 'Knowledgeable', sub: 'No steer needed' } ] },
    { key: 'budget', short: 'Budget', kind: 'limit', q: "What's the most you'll spend on one?", tip: 'A ceiling, per cigar. Hank looks at or under it, never over. Bigger cigars hold more leaf and cost more, so a low ceiling rules out the long, fat ones.',
      options: [ { v: 'Up to £10', t: c => from(c) <= 10 }, { v: 'Up to £18', t: c => from(c) <= 18 }, { v: 'Up to £30', t: c => from(c) <= 30 }, { v: 'No ceiling', t: c => true } ] },
    { key: 'time', short: 'Burn time', kind: 'limit', q: 'How long have you got?', tip: 'Length sets the time, thickness slows it down. Sizes that burn longer or shorter than this are out.',
      options: [
        { v: 'Half an hour', t: c => c.mins <= 40, heat: [3, 5], draw: [2, 2], heatNote: 'warm, then hot', drawNote: 'small, steady', does: 'Short and slim. Little leaf to cool the smoke, so it starts warm and runs hot by the end. Small, quick draws.' },
        { v: 'About an hour', t: c => c.mins > 40 && c.mins <= 65, heat: [2, 4], draw: [4, 3], heatNote: 'cool, warms late', drawNote: 'full, tightens a little', does: 'Thick enough to burn cool. A full, easy draw that warms up in the last third.' },
        { v: 'An hour and a half', t: c => c.mins > 65 && c.mins <= 95, heat: [1, 4], draw: [5, 4], heatNote: 'cool, builds slowly', drawNote: 'big, eases off', does: 'Long and thick. Big, cool draws through the first half. Flavour and heat build as it burns down.' },
        { v: 'All night', t: c => c.mins > 95, heat: [1, 3], draw: [4, 3], heatNote: 'coolest start', drawNote: 'full, slow', does: 'The longest burn. The smoke travels furthest, so it starts coolest. Heat and strength build slowly the whole way.' } ] },
    { key: 'shape', short: 'Shape', kind: 'limit', q: 'What shape?', tip: 'The shape of the head and foot changes how the smoke reaches you. Roll over each one and watch the lines at the head as it burns.',
      options: [
        { v: 'Parejo', focus: 0.12, t: c => c.shape === 'parejo', does: 'Straight sides, open foot. Burns evenly and draws easy and steady. The one to start on.' },
        { v: 'Belicoso', focus: 0.5, t: c => c.shape === 'belicoso', does: 'A short, quick taper at the head. A touch more focus than a parejo, with the same easy burn.' },
        { v: 'Torpedo', focus: 0.8, t: c => c.shape === 'torpedo', does: 'A long pointed head. Squeezes the smoke into a tighter stream, so the flavour lands harder. Cut less for a tighter draw.' },
        { v: 'Pyramid', focus: 0.9, t: c => c.shape === 'pyramid', does: 'Wide foot, narrowing all the way to the head. A lot of leaf burning, funnelled to a point. Rich and concentrated.' },
        { v: 'Perfecto', focus: 0.6, t: c => c.shape === 'perfecto', does: 'Tapered at both ends, fat in the middle. Lights small, opens up as it burns to the bulge, then tightens. The flavour shifts as you go.' },
        { v: 'Chisel', focus: 0.85, t: c => c.shape === 'chisel', does: 'A flattened wedge head. Sits flat in the mouth and gives a tight, cool draw.' },
        { v: 'Any shape', focus: 0.12, t: c => true, does: 'No limit. Hank picks from every shape.' } ] },
    { key: 'strength', short: 'Strength', kind: 'pref', q: 'How strong would you like it?', tip: 'A preference, not a rule. Strength is the nicotine kick, not the taste. New to it? Start mild.',
      options: [ { v: 'Mild', sub: 'Easy going' }, { v: 'Medium', sub: 'Some backbone' }, { v: 'Full', sub: 'Sit down first' }, none ] },
    { key: 'wrapper', short: 'Wrapper', kind: 'pref', q: 'Light, medium or dark leaf?', tip: 'A preference, not a rule. The wrapper gives most of the flavour. Darker is sweeter, not stronger.',
      options: [ { v: 'Light', sub: 'Creamy, grassy' }, { v: 'Medium', sub: 'Nutty, woody' }, { v: 'Dark', sub: 'Sweet, rich' }, none ] },
    { key: 'flavour', short: 'Flavour', kind: 'pref', q: 'Any flavour you like?', optional: true, multi: 2, tip: 'Optional. Pick up to two. Hank uses it to break a tie.', options: H.FLAV.map(v => ({ v })) }
  ]; } return _qs; };
  const filt = (a, upto) => { let list = sizes(); qs().slice(0, upto == null ? 7 : upto).forEach(q => { const o = a[q.key] && q.options.find(x => x.v === a[q.key]); if (o && o.t) list = list.filter(o.t); }); return list; };

  // ---- Emblems (level rings), as HTML ----
  const emblem = (i, mine) => { const c = TONES[i] || TONES[0], sm = small;
    const bars = [0, 1, 2, 3].map(b => `<span style="${css({ width: sm ? '2px' : '3px', height: (sm ? 4 + b * 2 : 6 + b * 3) + 'px', 'border-radius': '1.5px', background: b <= i ? c[0] : 'rgba(255,255,255,.14)' })}"></span>`).join('');
    return `<span title="${esc(LEVEL_SHOW[LEVELS[i]] || LEVELS[i])}" class="hr-emb" style="${css({ width: sm ? '22px' : '32px', height: sm ? '22px' : '32px', border: '2px solid ' + c[0], 'box-shadow': mine ? '0 0 4px ' + c[1] + ', 0 0 12px ' + c[1] : 'none', opacity: mine ? 1 : 0.5, 'padding-bottom': sm ? '4px' : '6px' })}">${bars}</span>`; };
  const levelsFor = (q, v) => LEVELS.filter(l => ((SUITS[l] || {})[q.key] || []).includes(v));
  const suits = (q, qi, v, level) => qi > 0 && levelsFor(q, v).includes(level);
  const marks = (q, qi, v, level) => qi === 0 ? [emblem(LEVELS.indexOf(v), level === v)] : levelsFor(q, v).map(l => emblem(LEVELS.indexOf(l), l === level));

  // ---- State ----
  const S = { step: 0, answers: {}, flav: [], hover: null, stage: undefined, shown: null };
  let target = null, raf = 0, reach = 0, nextOff = true, opts = [], root, chart = null, wheel = null;
  // flavour step answers → the wheel notes they match (RAY, 24 Nov)
  const FLAV_WHEEL = [['Creamy', ['Cream']], ['Nutty', ['Nuts', 'Almond']], ['Woody', ['Cedar', 'Toast']], ['Spicy', ['Spice', 'Black pepper']], ['Sweet', ['Honey', 'Molasses', 'Dried fruit', 'Cocoa', 'Dark chocolate']], ['Earthy', ['Earth', 'Leather', 'Charcoal', 'Grass', 'Green tea', 'Hay', 'Coffee', 'Espresso']]];   // every wheel note belongs to one of the six
  const noteCat = w => (FLAV_WHEEL.find(([, v]) => v.includes(w)) || [])[0];
  const set = p => { Object.assign(S, typeof p === 'function' ? p(S) : p); render(); };
  const prefill = n => {
    const a = {};
    qs().slice(0, Math.min(n, 6)).forEach((q, i) => { const before = filt(a, i); let best = q.options[1], bc = -1; if (q.options[0].t) q.options.forEach(o => { if (/^Any/.test(o.v)) return; const c = before.filter(o.t).length; if (c > bc) { bc = c; best = o; } }); a[q.key] = best.v; });
    set({ answers: a, step: n, flav: n > 6 ? ['Nutty'] : [], hover: null });
  };
  const pick = (q, v, i) => {
    if (q.multi) { set(s => { const has = s.flav.includes(v); let f = has ? s.flav.filter(x => x !== v) : s.flav.concat(v); if (f.length > q.multi) f = f.slice(-q.multi); return { flav: f }; }); return; }
    if (q.key === 'level') { set(s => ({ answers: Object.assign({}, s.answers, { level: v }) })); return; }
    const a = {};
    qs().slice(0, i).forEach(x => { if (S.answers[x.key]) a[x.key] = S.answers[x.key]; });
    a[q.key] = v;
    set({ answers: a });
  };

  // Write a region only when its markup changed (keeps hover, focus and running animations intact).
  const put = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };

  function render() {
    const vw = window.innerWidth, vh = window.innerHeight, pw = root.clientWidth || vw;
    const mob = pw < 700;                                   // the panel, not the window: the sidebar takes 232px
    // Two columns at every panel width of 700px and up, whatever the height (RAY via PLAN, 24 Nov; the
    // design tied the grid to wide AND short windows). The compact sizes still follow the design's
    // wide-and-short rule: smaller headline, labels and emblems only when the window is short.
    const twoCol = !mob && vw / vh > 1.4 && vh < 760;   // the design's rule again (RAY, 24 Nov): tall screens stack, question top centre, cigar centred between
    const wideShort = !mob && vw / vh > 1.4 && vh < 760;
    small = wideShort;
    root.classList.toggle('mob', mob); root.classList.toggle('ws', wideShort); root.classList.toggle('s0', S.step === 0); root.dataset.step = S.step;   // per-step titles over the answers (RAY, 24 Nov)
    const { step, answers, flav } = S, Q = qs(), total = sizes().length;
    const qi = Math.min(step, 6), q = Q[qi];
    const before = filt(answers, qi), now = filt(answers);
    const sz = SIZE[answers.time];
    const np = v => !v ? '' : /^No /.test(v) ? 'Medium' : v;
    const hv = S.hover, pv = hv && hv.step === step && step < 7 && !q.multi, A0 = pv ? Object.assign({}, answers, { [q.key]: hv.v }) : answers, A = step === 0 && REC[A0.level] ? Object.assign({}, REC[A0.level], answers) : A0, szP = SIZE[A.time];
    const to = step === 2 && A.time ? Q[2].options.find(o => o.v === A.time) : null;
    const tt = A.time ? Q[2].options.find(o => o.v === A.time) : null;
    const pips = (r, col) => [0, 1, 2, 3, 4].map(i => i < Math.min(r[0], r[1]) ? { bg: col, bd: col } : i < Math.max(r[0], r[1]) ? { bg: 'transparent', bd: col } : { bg: 'rgba(255,255,255,.14)', bd: 'transparent' });
    const so = step === 3 && A.shape ? Q[3].options.find(o => o.v === A.shape) : null;
    const lfit = LFIT[A0.level], suited = lfit ? now.filter(lfit) : now; target = suited.length;
    const who = { 'Beginner': 'a beginner', 'Fairly new': 'someone fairly new', 'Some experience': 'someone with some experience' }[A0.level];
    const fShow = flav.concat(q.key === 'flavour' && hv && hv.step === step && !flav.includes(hv.v) ? [hv.v] : []);
    window.__cigarSpec = { vertical: q.key === 'strength', plant: q.key === 'strength' ? ((hv && hv.step === step ? hv.v : answers.strength) || '') : null, unwrap: q.key === 'wrapper', progress: (Q.slice(1, 6).filter(x => answers[x.key]).length + (flav.length ? 1 : 0)) / 6, flavour: fShow, profile: q.key === 'shape', preview: !!pv, lines: step === 3, heatR: tt ? tt.heat : null, drawR: tt ? tt.draw : null, burn: step === 2 && A.time ? ({ 'Half an hour': 2.2, 'About an hour': 3.6, 'An hour and a half': 5.5, 'All night': 8 }[A.time] || 0) : step === 3 && answers.shape ? 5 : 0, burnKey: step === 3 ? answers.shape || null : null, draw: 0, focus: 0, len: szP && szP[0], ring: szP && szP[1], budget: A.budget ? Q[1].options.findIndex(o => o.v === A.budget) : -1, shape: A.shape || '', wrapper: np(A.wrapper), strength: np(A.strength), spin: true, smoke: true };
    const firstOpen = Q.findIndex((x, i) => i < 6 && !answers[x.key]); reach = firstOpen === -1 ? 7 : firstOpen;

    // Header: step progress (RAY, 24 Nov): short, and it moves with the steps. 7 questions, then last look and done.
    $('hr-round').textContent = mob ? '' : step >= 8 ? 'Done' : step === 7 ? 'Last look' : (step + 1) + ' of 7';
    put($('hr-pips'), [0, 1, 2, 3, 4, 5, 6].map(i => `<span style="${css({ background: i === step ? 'var(--neon-pink-tube)' : i < step ? 'var(--neon-teal)' : 'rgba(95,211,207,.2)', 'box-shadow': i === step ? 'var(--glow-pink)' : 'none' })}"></span>`).join(''));

    // Question block
    $('hr-inner').style.display = twoCol ? 'grid' : 'flex';
    put($('hr-hank'), step === 8 ? hankHTML(mob) : '');
    $('hr-kicker').textContent = step < 7 ? (qi === 0 ? 'Before you start' : 'Step ' + qi + ' of 6 · ' + (q.kind === 'limit' ? 'Hard limit' : 'Preference')) : step === 7 ? 'Last look' : 'Taste in';
    const head = step < 7 ? q.q : step === 7 ? "That's your smoke." : 'Hank has it.';
    put($('hr-headline'), `<h1 class="hr-h1">${esc(head)}</h1>`);   // a new h1 per step replays the rise
    const cardOn = !!so || !!to || (step === 0 && !!A0.level), cardText = to ? to.does : so ? so.does : (STEER[A0.level] || '');
    const tipTitle = cardOn ? (to ? to.v + ' · how it smokes' : so ? so.v + ' · what it does' + (before.filter(so.t).length ? '' : ' · none fit your limits') : A0.level + " · Hank's steer") : '';
    const tip = cardOn ? cardText : step < 7 ? q.tip : step === 7 ? now.length + (now.length === 1 ? ' size fits' : ' sizes fit') + ' your limits. Hank finds three inside them, as close to your preferences as he can.' : 'Next he picks three from what the yard wants. You rank them when they are up.';
    const tipEl = $('hr-tip');
    tipEl.style.height = step === 2 ? (mob ? '11.875rem' : '6.25rem') : step === 0 || step === 3 ? (mob ? '9.375rem' : '4.125rem') : 'auto';
    const meters = to ? [{ label: 'Heat', pips: pips(to.heat, 'rgb(255,8,13)'), note: to.heatNote }, { label: 'Draw', pips: pips(to.draw, 'var(--neon-teal)'), note: to.drawNote }] : [];
    put(tipEl, (step === 0 || step === 2 || step === 3 ? `<div class="hr-tiptitle">${esc(tipTitle)}</div>` : '')
      + `<p class="hr-tiptext" style="color:var(--neon-teal)">${esc(tip)}</p>`
      + (meters.length ? `<div class="hr-meters">${meters.map(m => `<div class="hr-meter"><span class="hr-cap">${esc(m.label)}</span><span class="hr-mpips">${m.pips.map(p => `<span style="background:${p.bg};border:1.5px solid ${p.bd}"></span>`).join('')}</span><span class="hr-mnote">${esc(m.note)}</span></div>`).join('')}</div>` : '')
      + (step === 8 ? '<p class="hr-unsaved">Preview: your picks aren\'t saved yet.</p>' : ''));

    // Cigar region
    const gap = $('hr-gap');
    // Landing step only: the knowledge chart stands in for the cigar (plan 38 CORRECTION, RAY 24 Nov). The
    // cigar is hidden, not torn down, so its three.js scene is ready when step 1 opens.
    const landing = step === 0;
    gap.style.minHeight = landing ? (twoCol ? '240px' : mob ? '200px' : '220px') : twoCol ? '0px' : step === 2 || step === 3 ? '150px' : '60px';
    gap.querySelector('.hr-canvas').hidden = landing; $('hr-notes').hidden = landing; $('hr-chart').hidden = !landing;
    if (chart) chart.show(landing);
    { const fl = S.step === 6, w = $('hr-wheel'); if (w) w.hidden = !fl; if (wheel) { wheel.show(fl); if (fl) wheel.mark(FLAV_WHEEL.flatMap(([k, v]) => (S.flav || []).includes(k) ? v : [])); } }
    drawNotes(q.key === 'flavour' ? fShow : [], flav);
    // Strength step (plan 40): what each lit floor does, in the Filler slide's words. Hover previews, click commits.
    { const HS = window.HumidorStrength, sn = $('hr-strnote'), lit = HS && q.key === 'strength' ? HS.LIT[window.__cigarSpec.plant || ''] : null;
      if (mob ? sn.parentNode === gap : sn.parentNode !== gap) { if (mob) gap.after(sn); else gap.insertBefore(sn, $('hr-spec')); }   // phones: under the stage, in flow, clear of the plant
      sn.hidden = !lit; put(sn, lit ? lit.map(k => { const f = HS.FLOORS.find(x => x.key === k); return `<p><b style="color:${f.text}">${esc(f.key)}</b> · ${esc(f.does)}</p>`; }).join('') : ''); }
    const spec = [];
    if (sz) spec.push(String(sz[0]).replace('.2', '⅛').replace('.6', '⅝') + '" × ' + sz[1] + ' ring');
    if (answers.shape && !/^Any/.test(answers.shape)) spec.push(answers.shape.toLowerCase());
    if (answers.strength && !/^No /.test(answers.strength)) spec.push(answers.strength.toLowerCase());
    if (answers.wrapper && !/^No /.test(answers.wrapper)) spec.push(answers.wrapper.toLowerCase() + ' leaf');
    if (answers.budget) spec.push(answers.budget);
    $('hr-spec').textContent = step !== 3 ? spec.join(' · ') : '';

    // Draw-lines key (step 3)
    const key = $('hr-key');
    key.hidden = step !== 3;
    if (step === 3) {
      key.style.alignSelf = twoCol ? 'start' : 'center'; key.style.height = twoCol ? '0px' : 'auto';   // in the grid the key floats over the cigar's top-left
      const stages = (wideShort ? ['Start', 'Middle', 'End'] : ['First third', 'Middle', 'Last third']).map((l, i) => ({ l, col: i === S.stage ? 'var(--fy-text)' : 'var(--fy-text-label)', bg: i === S.stage ? 'var(--neon-teal)' : 'rgba(95,211,207,.2)' }));
      // symbolic draw scales (RAY, 24 Nov): n trail lines fanning from a point on the left, ±s px at the open end
      const fan = (n, s) => `<svg class="hr-fan" viewBox="0 0 18 12" width="18" height="12" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<line x1="1" y1="6" x2="17" y2="${(6 + (n === 1 ? 0 : -s + 2 * s * i / (n - 1))).toFixed(2)}"/>`).join('')}</svg>`;
      const swW = wideShort ? '10px' : '20px', sw =(rgb, l) => `<span class="hr-sw"><span style="width:${swW};background:${rgb};box-shadow:0 0 6px ${rgb}"></span><span style="color:var(--fy-text-secondary)">${l}</span></span>`;
      put(key, `<div role="group" aria-label="Draw lines key" class="hr-keybox" style="flex-direction:${wideShort ? 'column' : 'row'};padding:${wideShort ? '6px 8px' : '6px 10px'}">
        <span class="hr-cap" style="display:${wideShort ? 'none' : 'block'}">Draw lines</span>
        <span style="display:flex;gap:6px">${stages.map(g => `<span style="display:flex;flex-direction:column;gap:3px"><span style="height:3px;border-radius:2px;background:${g.bg}"></span><span style="font-size:var(--fs-xs);white-space:nowrap;color:${g.col}">${g.l}</span></span>`).join('')}</span>
        <span style="display:flex;flex-wrap:wrap;justify-content:flex-start;gap:${wideShort ? '4px 8px' : '4px 14px'}">${sw('rgb(64,224,128)', 'Cool')}${sw('rgb(255,217,74)', 'Warm')}${sw('rgb(255,8,13)', 'Hot')}</span>
        <span class="hr-kscale"><span>${fan(2, 3)}LIGHT ⟷ FULL${fan(6, 5)}</span><span>${fan(4, 0.8)}TIGHT ⟷ OPEN${fan(4, 5.5)}</span></span>
      </div>`);
    }

    // Size counter: 38 persistent ticks so their heights transition
    const inSet = {}; now.forEach(c => inSet[c.id] = 1); suited.forEach(c => inSet[c.id] = 2);
    const ticks = $('hr-ticks');
    if (ticks.children.length !== total) ticks.innerHTML = sizes().map(() => '<span></span>').join('');
    sizes().forEach((c, i) => { const t = ticks.children[i], k = inSet[c.id]; t.style.height = k === 2 ? '14px' : k ? '8px' : '3px'; t.style.background = k === 2 ? 'var(--neon-teal)' : k ? 'rgba(95,211,207,.45)' : 'rgba(95,211,207,.18)'; t.style.transitionDelay = (i % 19) * 18 + 'ms'; });
    $('hr-shown').textContent = S.shown == null ? suited.length : S.shown;
    $('hr-cnote').textContent = who ? 'of ' + total + ' sizes suit you · ' + now.length + ' fit your limits' : 'of ' + total + ' sizes fit your limits';

    // Options (steps 0 to 6)
    opts = step < 7 ? q.options.map(o => {
      const c = o.t ? before.filter(o.t).length : -1, sel = q.multi ? flav.includes(o.v) : answers[q.key] === o.v, dis = c === 0;
      return { o, sel, dis, c, mk: marks(q, qi, o.v, answers.level), rec: suits(q, qi, o.v, answers.level) && !wideShort ? 'Suits you' : '',
        sil: q.key === 'shape' && !/^Any/.test(o.v) && window.HumidorCigarProfile ? window.HumidorCigarProfile(o.v, 96, 22) : '' };
    }) : [];
    const anyMark = opts.some(x => x.mk.length);
    const optBox = $('hr-opts');
    optBox.style.display = step < 7 ? (twoCol ? 'grid' : 'flex') : 'none';
    optBox.style.gridTemplateColumns = 'repeat(' + (opts.length === 7 ? 4 : opts.length === 6 ? 3 : opts.length) + ', minmax(0,1fr))';
    optBox.style.gap = wideShort ? '6px 10px' : '6px clamp(14px,3vw,44px)';
    put(optBox, opts.map((x, i) => {
      const o = x.o, count = x.c < 0 ? (o.sub || ' ') : x.c === 0 ? 'none fit' : 'keeps ' + x.c + (x.c === 1 ? ' size' : ' sizes');
      const basis = opts.length === 7 && !mob ? (wideShort ? 'calc(25% - 34px)' : 'calc(25% - 44px)') : 'auto';
      return `<button type="button" class="hr-opt${x.sel ? ' sel' : ''}${x.dis ? ' dis' : ''}" data-i="${i}" aria-pressed="${x.sel}"${x.dis ? ' aria-disabled="true"' : ''} style="flex:0 0 ${basis}">
        <span class="hr-marks" style="min-height:${anyMark ? (wideShort ? '22px' : '32px') : '0px'}">${x.mk.join('')}<span class="hr-cap">${x.rec}</span></span>
        ${x.sil ? `<svg viewBox="0 0 96 22" width="96" height="22" class="hr-sil" aria-hidden="true"><path d="${x.sil}" stroke-width="1.5" stroke-linejoin="round"></path></svg>` : ''}
        <span class="hr-olabel">${esc(qi === 0 ? LEVEL_SHOW[o.v] || o.v : o.v)}</span>
        <span class="hr-oline"></span>
        <span class="hr-ocount">${esc(count)}</span>
      </button>`;
    }).join(''));

    // Footer: Back · rail · NEXT / Change
    $('hr-back').hidden = !(step > 0 && step < 8);
    put($('hr-rail'), Q.map((x, i) => { const cur = i === step, done = i < 6 ? !!answers[x.key] : step >= 7;
      return `<button type="button" class="hr-rstep" data-i="${i}" style="${css({ cursor: i <= reach ? 'pointer' : 'default', 'margin-left': i === 1 || i === 4 ? (mob ? '8px' : '20px') : '0', 'min-width': mob ? '44px' : '0px', 'min-height': mob ? '44px' : '0px' })}"${cur ? ' aria-current="step"' : ''} aria-label="${esc(x.short)}">
        <span class="hr-rdot" style="${css({ border: '1.5px solid ' + (cur ? 'var(--neon-pink-tube)' : done ? 'var(--neon-teal)' : 'rgba(95,211,207,.4)'), background: cur ? 'var(--neon-pink-tube)' : done ? 'var(--neon-teal)' : 'transparent', 'box-shadow': cur ? 'var(--glow-pink)' : 'none' })}"></span>
        ${mob ? '' : `<span class="hr-cap" style="color:${cur ? 'var(--neon-pink-text)' : done ? 'var(--fy-text-secondary)' : 'var(--fy-text-label)'}">${esc(x.short)}</span>`}
      </button>`; }).join(''));
    nextOff = step < 6 && !answers[q.key];
    const nx = $('hr-next');
    nx.hidden = step >= 8; nx.disabled = nextOff;
    nx.textContent = step === 0 ? 'START' : step === 7 ? 'HAND IT TO HANK' : step === 6 && !flav.length ? 'SKIP' : 'NEXT';
    $('hr-change').hidden = step !== 8;

    window.dispatchEvent(new Event('cigar-spec'));
    // The size count eases toward its target, as the design's componentDidUpdate did.
    if (target != null && S.shown !== target && !raf) {
      const tick = () => { raf = 0; const s = S.shown == null ? target : S.shown, d = target - s; if (!d) return; S.shown = Math.abs(d) < 2 ? target : Math.round(s + d * 0.22); $('hr-shown').textContent = S.shown; if (S.shown !== target) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
  }

  // Flavour notes float over the cigar; each note keeps its own element so only new ones rise in.
  function drawNotes(show, picked) {
    const box = $('hr-notes'), have = {};
    [...box.children].forEach(n => { if (!show.includes(n.dataset.v)) n.remove(); else have[n.dataset.v] = n; });
    show.forEach(v => {
      let n = have[v];
      if (!n) { const p = NOTE_POS[v] || [50, 50]; n = document.createElement('span'); n.dataset.v = v; n.textContent = v; n.className = 'hr-note'; n.style.left = p[0] + '%'; n.style.top = p[1] + '%'; n.style.animation = 'hcRise .5s ease-out both, flNote ' + (5 + (v.length % 3)) + 's ease-in-out .5s infinite'; box.appendChild(n); }
      n.classList.toggle('on', picked.includes(v));
    });
  }

  // Photo window (plan 39): a size picked in the chart opens its catalogue photo. Photos are in the
  // private 'cigars' bucket, read through a signed URL (humidor-photos.js). A native <dialog> opened with
  // showModal(): the page behind is inert, Esc closes, a tap on the backdrop closes. The chart's overview
  // loop holds while it is open.
  const SHAPE_COL = { parejo: 'var(--neon-teal)', belicoso: 'var(--neon-green-tube)', torpedo: 'var(--neon-amber)', pyramid: 'var(--neon-red-tube)', perfecto: 'var(--art-cream)', chisel: 'var(--color-accent-2,#a7a1db)', culebra: 'var(--neon-teal)' };   // the chart's shape colours
  const inch = n => { const w = Math.floor(n), r = Math.round((n - w) * 8); return w + (['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][r] || ''); };
  let photoSeq = 0;
  // A time band from the chart's Burn time panel (RAY, 24 Nov): its sizes, plus how ring and length change the smoke.
  function openBand(B) {
    const d = $('hr-dlg'); if (!d || !B) return;
    ++photoSeq;
    const rows = B.rows || [], span = B.hi === Infinity ? 'over ' + B.lo + ' min' : (B.lo ? B.lo + 1 : 0) + '–' + B.hi + ' min';
    const nm = c => c.shape[0].toUpperCase() + c.shape.slice(1);
    $('hr-dlg-h').textContent = B.name;
    $('hr-dlg-f').textContent = rows.length + (rows.length === 1 ? ' size' : ' sizes') + ' · ' + span;
    $('hr-dlg-n').hidden = true; $('hr-dlg-c').hidden = true;
    $('hr-dlg-img').innerHTML = `<div class="hr-bandwrap"><table class="hr-band"><thead><tr><th>Size</th><th>Length</th><th>Ring</th><th>Shape</th><th>Time</th></tr></thead><tbody>${rows.map(c =>
        `<tr><td>${esc(c.size)}</td><td>${inch(c.len)}″</td><td>${c.ring}</td><td style="color:${SHAPE_COL[c.shape] || 'inherit'}">${esc(nm(c))}</td><td>${c.mins} min</td></tr>`).join('')}</tbody></table></div>
      <div class="hr-bandnotes">
        <p><strong>Ring gauge and the draw.</strong> Ring gauge is the width in 64ths of an inch. A wider ring packs in more filler, so it draws looser, burns cooler and lasts longer. A narrow ring draws tighter and hotter, and lets the wrapper's flavour lead.</p>
        <p><strong>Length and strength, by shape.</strong> Length mostly buys time. On a straight parejo the smoke stays much the same from foot to head. On a tapered head (belicoso, torpedo, pyramid) the smoke concentrates as you near the head, so the last third tastes stronger, and a longer one gives that build more time. A perfecto starts narrow and mild, opens up in the middle, then narrows again. A chisel's flat wedge keeps the draw open to the end.</p>
      </div>`;
    if (!d.open) d.showModal();
    if (chart) chart.hold(true);
  }
  async function openPhoto(c) {
    const d = $('hr-dlg'), P = window.HumidorPhotos; if (!d || !c) return;
    const seq = ++photoSeq, box = $('hr-dlg-img'), near = P && P.NEAR[c.size];
    $('hr-dlg-h').textContent = c.size;
    $('hr-dlg-f').innerHTML = `${inch(c.len)}″ × ${c.ring} · <span style="color:${SHAPE_COL[c.shape] || 'inherit'}">${esc(c.shape[0].toUpperCase() + c.shape.slice(1))}</span> · about ${c.mins} min`;
    $('hr-dlg-n').textContent = near || ''; $('hr-dlg-n').hidden = !near;
    $('hr-dlg-c').hidden = true; box.textContent = 'Loading…';
    if (!d.open) d.showModal();
    if (chart) chart.hold(true);
    const u = P ? await P.url(c.size).catch(() => null) : null;
    if (seq !== photoSeq || !d.open) return;
    if (!u) { box.textContent = 'No photo yet.'; return; }
    const img = new Image(); img.alt = c.size + ' cigar';
    img.onload = () => { if (seq !== photoSeq) return; box.replaceChildren(img); $('hr-dlg-c').hidden = false; };
    img.onerror = () => { if (seq === photoSeq) box.textContent = 'No photo yet.'; };
    img.src = u;
  }
  function wirePhoto() {
    const d = $('hr-dlg'); if (!d) return;
    $('hr-dlg-x').addEventListener('click', () => d.close());
    d.addEventListener('click', e => { if (e.target === d) d.close(); });   // the backdrop: outside the box
    d.addEventListener('close', () => { photoSeq++; if (chart) chart.release(); });
  }

  // Hank smoking (step 8): the PNG with the design's CSS overlay cigar.
  function hankHTML(mob) {
    const puffs = [0, 1, 2, 3, 4, 5].map(i => `<span class="hr-puff" style="--dx:${i % 2 ? 14 : -6}px;animation-delay:${i * 0.6}s"></span>`).join('');
    return `<div class="hr-hank" role="img" aria-label="Hank, smoking a cigar" style="width:${mob ? 120 : 160}px">
      <img src="assets/hank-oink.png" alt="">
      <div class="hr-hcigar"><div class="hr-hband"></div><div class="hr-hember"></div><div class="hr-hsmoke">${puffs}</div></div>
    </div>`;
  }

  function wire() {
    const optBox = $('hr-opts');
    const hoverTo = v => { const h = v == null ? null : { step: S.step, v }; if ((S.hover && S.hover.v) !== (h && h.v) || (S.hover && S.hover.step) !== (h && h.step)) set({ hover: h }); };
    const optOf = el => { const b = el && el.closest && el.closest('.hr-opt'); return b && optBox.contains(b) ? opts[+b.dataset.i] : null; };
    optBox.addEventListener('mouseover', e => { const x = optOf(e.target); if (x) hoverTo(x.o.v); });
    optBox.addEventListener('mouseout', e => { const a = optOf(e.target), b = optOf(e.relatedTarget); if (a && a !== b) hoverTo(b ? b.o.v : null); });
    optBox.addEventListener('focusin', e => { const x = optOf(e.target); if (x) hoverTo(x.o.v); });
    optBox.addEventListener('focusout', e => { if (!optOf(e.relatedTarget)) hoverTo(null); });
    // A greyed-out answer explains itself instead of doing nothing (RAY, 24 Nov): a small bubble above it for ~2s,
    // gone on the next click. Enter on the button fires the same click. The bubble is an aria-live region.
    const disTip = $('hr-distip'); let disT = 0;
    const hideDis = () => { clearTimeout(disT); disTip.classList.remove('on'); };
    document.addEventListener('click', hideDis, true);   // capture: any next click clears it before a new one shows
    const showDis = btn => { disTip.textContent = 'Outside your current preferences'; disTip.classList.add('on'); const r = btn.getBoundingClientRect(), w = disTip.offsetWidth;
      disTip.style.left = Math.max(w / 2 + 6, Math.min(innerWidth - w / 2 - 6, r.left + r.width / 2)) + 'px'; disTip.style.top = (r.top - 6) + 'px'; disT = setTimeout(hideDis, 2000); };
    optBox.addEventListener('click', e => { const x = optOf(e.target); if (x && x.dis) { showDis(e.target.closest('.hr-opt')); return; } if (x && S.step < 7) pick(qs()[Math.min(S.step, 6)], x.o.v, Math.min(S.step, 6)); });
    $('hr-rail').addEventListener('click', e => { const b = e.target.closest('.hr-rstep'); if (!b) return; const i = +b.dataset.i; if (i <= reach) set({ step: i, hover: null }); });
    $('hr-back').addEventListener('click', () => set(s => ({ step: Math.max(0, s.step - 1), hover: null })));
    $('hr-next').addEventListener('click', () => { if (!nextOff) set(s => ({ step: s.step + 1, hover: null })); });
    $('hr-change').addEventListener('click', e => { e.preventDefault(); set({ step: 7, hover: null }); });
    window.addEventListener('cigar-stage', e => { if (e.detail !== S.stage) set({ stage: e.detail }); });
    window.addEventListener('cigar-profile-ready', () => { $('hr-opts')._h = null; render(); });
    window.addEventListener('resize', render);
    // The panel's width changes when the sidebar collapses; only a width change re-renders (height
    // changes are caused by render itself and would loop).
    let lastW = root.clientWidth;
    if (window.ResizeObserver) new ResizeObserver(() => { if (root.clientWidth !== lastW) { lastW = root.clientWidth; render(); } }).observe(root);
    window.addEventListener('hashchange', () => { const m = /step=(\d)/.exec(location.hash); if (m) prefill(+m[1]); });
  }

  window.HumidorRoll = {
    mount(main) {
      main.innerHTML = document.getElementById('hr-tpl').innerHTML;
      root = main.querySelector('#hr');
      if (window.HumidorChart) chart = window.HumidorChart.mount($('hr-chart'), { sizes: sizes(), onPick: openPhoto, onBand: openBand, tag: false, titleX: 0 });   // landing: no tagline, title flush left under the sign (RAY, 24 Nov)
      if (window.HumidorChart && $('hr-wheel')) wheel = window.HumidorChart.mount($('hr-wheel'), { sizes: sizes(), only: 4, onNote: w => { const c = noteCat(w); if (c && S.step === 6) pick(qs()[6], c, 6); } });   // the overview's flavour wheel beside the cigar on the flavour step (RAY, 24 Nov)
      wire(); wirePhoto();
      const m = /step=(\d)/.exec(location.hash);
      if (m) prefill(+m[1]); else render();
    }
  };
})();
