/* The Humidor · v2.0 "cigar knowledge" chart (plan 38, RAY 24 Nov). It stands in for the 3D cigar on
   the landing step of humidor-roll.html only (step 0, "How well do you know cigars?"); steps 1 to 8 keep
   the cigar (plan 38 CORRECTION). Neon line art drawn here, in code: RAY's posters were reference only, so nothing
   is traced or copied from them. Facts only: the size names, lengths and rings are the SAMPLE shelf in
   humidor-shelf.js; the wrapper shade names and the leaf tiers are the trade's standard names.
   Six panels on one track: Sizes · Shapes · Wrapper · Filler · Anatomy · Burn time.
   Overview only: it auto-scrolls across the panels, pauses while the pointer is over it, and lights and
   zooms an item on rollover, focus or tap. Swipe on touch; the dots jump to a panel.
   API: const c = HumidorChart.mount(el, { sizes, onHover }); c.show(true | false) starts or stops it.
   Every panel's viewBox is its pixel size, so SVG text sits at the true --fs-* token size. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f = n => (+n).toFixed(1);

  // Shape profile, ported from humidor-cigar3d.js (window.HumidorCigarProfile, same maths) so this page
  // needs no three.js. A flat side-on silhouette as an SVG path, head on the left, foot flat on the right.
  const Z = { hR: 0, hIn: 0, hL: 0, tip: 0, k: 0, footT: 0, flat: 0 };
  const SH = { Parejo: { hR: 0.7 }, Belicoso: { hIn: 0.9, tip: 0.5, k: 0.8 }, Torpedo: { hIn: 1.6, tip: 0.42, k: 0.9 }, Pyramid: { hL: 0.8, tip: 0.42, k: 1 }, Perfecto: { hIn: 1.5, tip: 0.5, k: 0.5, footT: 1 }, Chisel: { hIn: 1.5, tip: 1, k: 1, flat: 1 } };
  function profile(shape, W, H) {
    const c0 = Object.assign({}, Z, SH[shape] || SH.Parejo), L = 6, R = 0.45, h = Math.min(c0.hR * R + c0.hIn + c0.hL * L, L * 0.86), c = c0.tip * R * 0.5 * (1 - c0.flat * 0.75), N = 60, pts = [];
    for (let i = 0; i <= N; i++) {
      const d = i / N * L; let rr;
      if (d >= h) rr = 1; else if (d < c) { const q = d / c; rr = c0.tip * Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))); } else { const q = (d - c) / Math.max(h - c, 1e-4), dome = Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))); rr = c0.tip + (1 - c0.tip) * (dome * (1 - c0.k) + q * c0.k); }
      if (c0.footT > 0.001 && d > L - 1.2) { const q = (L - d) / 1.2; rr *= 1 - c0.footT * 0.55 * (1 - q * q * (3 - 2 * q)); }
      const spn = d < h ? 1 - d / h : 0; pts.push([d / L * (W - 2) + 1, rr * (1 - 0.1 * c0.flat * spn) * (H / 2 - 1)]);
    }
    return 'M' + pts.map(p => f(p[0]) + ' ' + f(H / 2 - p[1])).join('L') + 'L' + pts.slice().reverse().map(p => f(p[0]) + ' ' + f(H / 2 + p[1])).join('L') + 'Z';
  }
  if (!window.HumidorCigarProfile) window.HumidorCigarProfile = profile;   // the shape options' silhouettes use it

  // ---- Content (our own words) ----
  const PANELS = [
    { t: 'Sizes', cap: 'Every size on the shelf, shortest to longest. Roll over one.' },
    { t: 'Shapes', cap: 'The head and foot change how the smoke reaches you.' },
    { t: 'Wrapper', cap: 'The outside leaf, from light to dark.' },
    { t: 'Filler', cap: 'Where the leaf grows sets the strength.' },
    { t: 'Anatomy', cap: 'The parts of a cigar, and the flavours you may find.' },
    { t: 'Burn time', cap: 'Every size by how long it lasts.' }
  ];
  const SHAPES = [['Parejo', 'straight sides and a rounded head'], ['Belicoso', 'a short taper at the head'], ['Torpedo', 'a long pointed head'], ['Pyramid', 'narrows all the way from foot to head'], ['Perfecto', 'tapered at both ends, fat in the middle'], ['Chisel', 'a flattened wedge at the head']];
  const SHMAP = { parejo: 'Parejo', belicoso: 'Belicoso', torpedo: 'Torpedo', pyramid: 'Pyramid', perfecto: 'Perfecto', chisel: 'Chisel', culebra: 'Parejo' };
  // Seven shades. The five leaf tones are humidor-cigar3d.js's TONE; Candela and Colorado Claro are added stops.
  const WRAPS = [['Double Claro (Candela)', '#7f8f4e', 'Light', 'green, picked early and dried fast'], ['Claro', '#d8b07a', 'Light', 'pale tan'], ['Colorado Claro', '#c4965f', 'Light', 'light reddish tan'],
    ['Colorado', '#b07c48', 'Medium', 'reddish brown'], ['Colorado Maduro', '#7a4c2a', 'Medium', 'dark reddish brown'], ['Maduro', '#4a2c18', 'Dark', 'dark brown, aged longer'], ['Oscuro', '#2c1a10', 'Dark', 'near black, aged longest']];
  const LEAVES = [['Ligero', 'top', 'full', 'the top leaves get the most sun: thick, oily, the strongest'], ['Seco', 'middle', 'medium', 'the middle leaves: lighter, carry most of the aroma'], ['Volado', 'bottom', 'mild', 'the bottom leaves: thin and mild, they help it burn']];
  const LAYERS = { wrapper: 'Wrapper · the outside leaf: most of the flavour and the look', binder: 'Binder · holds the filler together under the wrapper', filler: 'Filler · the bunched leaves inside: the body and the strength' };
  const PARTS = { cap: 'Cap · a small round of leaf over the head. Cut it before you light', head: 'Head · the end you smoke from', shoulder: 'Shoulder · where the head curves into the body', band: 'Band · the maker\'s ring. Slide it off once the cigar warms, or leave it on', body: 'Body · the length between head and foot', foot: 'Foot · the open end you light' };
  const FLAVS = [['Creamy', 'often in a light leaf'], ['Nutty', 'often in a medium leaf'], ['Woody', 'often in a medium leaf'], ['Spicy', 'often in a fuller blend'], ['Sweet', 'often in a dark leaf'], ['Earthy', 'often in a dark, full blend']];
  const BANDS = [['Half an hour', '½ hr', 0, 40], ['About an hour', '1 hr', 40, 65], ['An hour and a half', '1½ hr', 65, 95], ['All night', 'All night', 95, Infinity]];   // the page's time rule: mins ≤ 40, ≤ 65, ≤ 95, more
  const frac = n => { const w = Math.floor(n), r = Math.round((n - w) * 8); return w + (['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][r] || ''); };

  function mount(el, opt) {
    opt = opt || {};
    const sizes = (opt.sizes || []).slice().sort((a, b) => a.len - b.len || a.ring - b.ring);
    const RM = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    el.innerHTML = `<div class="hc"><div class="hc-view"><div class="hc-track">${PANELS.map((p, i) => `<div class="hc-p" data-p="${i}"><svg class="hc-svg" role="group" aria-label="${esc(p.t)}"></svg></div>`).join('')}</div></div>
      <div class="hc-bar"><div class="hc-detail" aria-live="polite"></div><div class="hc-dots">${PANELS.map((p, i) => `<button type="button" class="hc-dot" data-p="${i}" aria-label="${esc(p.t)}"></button>`).join('')}</div></div></div>`;
    const root = el.firstElementChild, view = root.querySelector('.hc-view'), track = root.querySelector('.hc-track'), detail = root.querySelector('.hc-detail');
    const panels = [...root.querySelectorAll('.hc-p')], dots = [...root.querySelectorAll('.hc-dot')];
    const FACTS = {};
    const S = { on: null, pin: null };
    let cur = 0, live = false, paused = false, ovT = 0, W0 = 0, H0 = 0;

    // ---- Drawing ----
    const item = (id, facts, inner, o) => { o = o || {}; FACTS[id] = facts;
      return `<g class="hc-it${o.nz ? ' nz' : ''}" data-id="${esc(id)}"${o.size ? ` data-size="${esc(o.size)}"` : ''} tabindex="-1" role="img" aria-label="${esc(facts)}">${o.hit || ''}<g class="hc-z">${inner}</g></g>`; };
    const txt = (x, y, s, cls, anchor, extra) => `<text class="${cls || 'hc-t'}" x="${f(x)}" y="${f(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}${extra || ''}>${esc(s)}</text>`;
    const pad = 12, top = 32;
    const upright = (c, cx, yb, s) => { const lp = c.len * s, rp = Math.max(1.5, c.ring / 64 * s);
      return `<g transform="translate(${f(cx + rp / 2)} ${f(yb - lp)}) rotate(90)"><path class="hc-ln" d="${profile(SHMAP[c.shape] || 'Parejo', lp, rp)}"/></g>`; };
    const sizeFacts = c => `${c.size} · ${frac(c.len)}″ × ${c.ring} · ${c.shape === 'culebra' ? 'Culebra' : SHMAP[c.shape] || c.shape} · about ${c.mins} min`;

    function pSizes(W, H) {
      const n = sizes.length || 1, cw = (W - pad * 2) / n, labH = Math.min(160, H * 0.45), area = Math.max(20, H - top - labH - 8);
      const s = Math.max(2, Math.min(area / 9.25, cw * 0.9 / (60 / 64))), yb = top + area, fine = cw < 14;
      return sizes.map((c, i) => { const cx = pad + cw * (i + 0.5);
        return item('size:' + c.size, sizeFacts(c), upright(c, cx, yb, s) + `<text class="hc-t${fine ? ' hc-tf' : ''}" dominant-baseline="middle" transform="translate(${f(cx)} ${f(yb + 6)}) rotate(90)">${esc(c.size)} ${frac(c.len)}″ × ${c.ring}</text>`,
          { size: c.size, hit: `<rect class="hc-hit" x="${f(cx - cw / 2)}" y="${top}" width="${f(cw)}" height="${f(H - top)}"/>` }); }).join('');
    }
    function pShapes(W, H) {
      const cols = W >= 520 ? 3 : 2, rows = 6 / cols, cellW = (W - pad * 2) / cols, cellH = (H - top - 6) / rows;
      const pw = cellW * 0.78, ph = Math.max(8, Math.min(cellH * 0.34, pw * 0.17));
      return SHAPES.map(([nm, d], i) => { const cx = pad + cellW * (i % cols + 0.5), cy = top + cellH * (Math.floor(i / cols) + 0.42);
        return item('shape:' + nm, nm + ' · ' + d, `<g transform="translate(${f(cx - pw / 2)} ${f(cy - ph / 2)})"><path class="hc-ln" d="${profile(nm, pw, ph)}"/></g>` + txt(cx, cy + ph / 2 + 16, nm, 'hc-t hc-tb', 'middle'),
          { hit: `<rect class="hc-hit" x="${f(cx - cellW / 2)}" y="${f(cy - cellH * 0.42)}" width="${f(cellW)}" height="${f(cellH)}"/>` }); }).join('');
    }
    function pWrapper(W, H) {
      const n = WRAPS.length, slot = (W - pad * 2) / n, bw = slot - Math.min(10, slot * 0.18), y0 = top + 34, bh = Math.max(24, Math.min(90, (H - y0) * 0.45)), fine = slot < 60;
      const x = i => pad + slot * i + (slot - bw) / 2;
      const groups = ['Light', 'Medium', 'Dark'].map(g => { const ix = WRAPS.map((w, i) => w[2] === g ? i : -1).filter(i => i >= 0), a = x(ix[0]), b = x(ix[ix.length - 1]) + bw, yb = top + 20;
        return item('wgrp:' + g, g + ' leaf · ' + ix.map(i => WRAPS[i][0]).join(', '), `<path class="hc-ln" d="M${f(a)} ${f(yb + 6)}V${f(yb)}H${f(b)}V${f(yb + 6)}"/>` + txt((a + b) / 2, yb - 4, g, 'hc-t hc-tb', 'middle'), { nz: true }); }).join('');
      return groups + WRAPS.map(([nm, hex, g, d], i) => item('wrap:' + i, nm + ' · ' + d + ' · in our ' + g.toLowerCase() + ' answer',
        `<rect class="hc-sw" x="${f(x(i))}" y="${f(y0)}" width="${f(bw)}" height="${f(bh)}" rx="4" fill="${hex}"/>` + nm.split(' ').map((w, k) => txt(x(i) + bw / 2, y0 + bh + 14 + k * 13, w, 'hc-t' + (fine ? ' hc-tf' : ''), 'middle')).join(''))).join('');
    }
    function pFiller(W, H) {
      const lw = Math.min(W * 0.55, Math.max(W * 0.45, 190)), sx = pad + lw * 0.3, pt = top + 8, pb = H - 10, span = pb - pt;
      let out = `<path class="hc-ln" d="M${f(sx)} ${f(pb)}C${f(sx - 3)} ${f(pt + span * 0.6)} ${f(sx + 3)} ${f(pt + span * 0.3)} ${f(sx)} ${f(pt)}"/>`;   // stalk
      const leaf = (x, y, dx, len, h) => { const tx = x + dx * len, ty = y - len * 0.3;
        return `<path class="hc-ln" d="M${f(x)} ${f(y)}Q${f(x + dx * len * 0.45)} ${f(ty - h)} ${f(tx)} ${f(ty)}Q${f(x + dx * len * 0.55)} ${f(y + h * 0.5)} ${f(x)} ${f(y)}Z"/><path class="hc-ln hc-thin" d="M${f(x)} ${f(y)}Q${f(x + dx * len * 0.5)} ${f(ty - h * 0.2)} ${f(tx)} ${f(ty)}"/>`; };
      out += LEAVES.map(([nm, where, st, d], i) => { const y = pt + span * (0.24 + i * 0.28), len = Math.min(lw * (0.24 + i * 0.04), span * 0.4), h = len * 0.3;
        return item('leaf:' + nm, nm + ' · ' + where + ' of the plant · ' + st + ' · ' + d, leaf(sx, y, -1, len * 0.9, h * 0.9) + leaf(sx, y, 1, len, h) + txt(sx + len + 8, y - 8, nm, 'hc-t hc-tb') + txt(sx + len + 8, y + 6, where + ' · ' + st, 'hc-t hc-tf')); }).join('');
      // Cut-away cigar: filler, then binder, then the wrapper peeled back over them.
      const x0 = pad + lw + 16, len = Math.max(60, W - pad - x0), t = Math.max(12, Math.min((H - top) * 0.2, len * 0.2, 40)), cy = top + (H - top) * 0.45;
      const fl = [-0.3, -0.1, 0.1, 0.3].map(k => `<path class="hc-ln" d="M${f(x0 + len * 0.78)} ${f(cy + k * t)}Q${f(x0 + len * 0.9)} ${f(cy + k * t - 2)} ${f(x0 + len)} ${f(cy + k * t + 1)}"/>`).join('');
      out += item('layer:filler', LAYERS.filler, fl + `<path class="hc-ln hc-thin" d="M${f(x0 + len * 0.95)} ${f(cy + t * 0.4)}V${f(cy + t / 2 + 14)}"/>` + txt(x0 + len, cy + t / 2 + 26, 'Filler', 'hc-t hc-tb', 'end'));
      out += item('layer:binder', LAYERS.binder, `<rect class="hc-ln hc-occ" x="${f(x0 + len * 0.5)}" y="${f(cy - t * 0.43)}" width="${f(len * 0.32)}" height="${f(t * 0.86)}" rx="2"/><path class="hc-ln hc-thin" d="M${f(x0 + len * 0.74)} ${f(cy - t * 0.43)}V${f(cy - t / 2 - 14)}"/>` + txt(x0 + len * 0.74, cy - t / 2 - 18, 'Binder', 'hc-t hc-tb', 'middle'));
      out += item('layer:wrapper', LAYERS.wrapper, `<g transform="translate(${f(x0)} ${f(cy - t / 2)})"><path class="hc-ln hc-occ" d="${profile('Parejo', len * 0.66, t)}"/></g><path class="hc-ln hc-thin" d="M${f(x0 + len * 0.3)} ${f(cy + t / 2)}V${f(cy + t / 2 + 14)}"/>` + txt(x0 + len * 0.3, cy + t / 2 + 26, 'Wrapper', 'hc-t hc-tb', 'middle'));
      return out;
    }
    function pAnatomy(W, H) {
      const len = Math.min(W - pad * 2 - 24, 560), x0 = (W - len) / 2, t = Math.max(12, Math.min((H - top) * 0.18, len * 0.14, 46)), cy = top + (H - top) * 0.4;
      const up1 = cy - t / 2 - 14, up2 = cy - t / 2 - 30, dn = cy + t / 2 + 24;
      const call = (x, y0, y1, ty, s, anchor) => `<path class="hc-ln hc-thin" d="M${f(x)} ${f(y0)}V${f(y1)}"/>` + txt(x, ty, s, 'hc-t hc-tb', anchor);
      let out = `<g transform="translate(${f(x0)} ${f(cy - t / 2)})"><path class="hc-ln" d="${profile('Parejo', len, t)}"/></g>`;
      out += item('part:cap', PARTS.cap, `<path class="hc-ln" d="M${f(x0 + len * 0.012)} ${f(cy - t * 0.22)}Q${f(x0 - 1)} ${f(cy)} ${f(x0 + len * 0.012)} ${f(cy + t * 0.22)}"/>` + call(x0 + 3, cy - t * 0.3, up2 + 4, up2, 'Cap', 'end'));
      out += item('part:shoulder', PARTS.shoulder, call(x0 + len * 0.055, cy - t / 2, up1 + 4, up1, 'Shoulder', 'start'));
      out += item('part:head', PARTS.head, call(x0 + len * 0.025, cy + t / 2 - 1, dn - 12, dn, 'Head', 'start'));
      out += item('part:band', PARTS.band, `<rect class="hc-ln hc-occ" x="${f(x0 + len * 0.16)}" y="${f(cy - t / 2 - 2)}" width="${f(len * 0.07)}" height="${f(t + 4)}" rx="2"/><path class="hc-ln hc-thin" d="M${f(x0 + len * 0.17)} ${f(cy)}H${f(x0 + len * 0.22)}"/>` + call(x0 + len * 0.195, cy - t / 2 - 2, up2 + 4, up2, 'Band', 'middle'));
      out += item('part:body', PARTS.body, `<path class="hc-ln hc-thin" d="M${f(x0 + len * 0.3)} ${f(cy + t / 2 + 6)}H${f(x0 + len * 0.9)}"/>` + call(x0 + len * 0.6, cy + t / 2 + 6, dn - 12, dn, 'Body', 'middle'));
      out += item('part:foot', PARTS.foot, `<ellipse class="hc-ln" cx="${f(x0 + len - 1)}" cy="${f(cy)}" rx="${f(t * 0.16)}" ry="${f(t / 2 - 1)}"/>` + call(x0 + len - 1, cy - t / 2, up1 + 4, up1, 'Foot', 'end'));
      const per = W >= 520 ? 6 : 3, pw = 64, ph = 20, g = 6, rowW = per * pw + (per - 1) * g, tx0 = Math.max(pad, Math.min(x0 + len - rowW, W - pad - rowW)), ty0 = dn + 16;
      out += FLAVS.map(([nm, d], i) => { const x = tx0 + (i % per) * (pw + g), y = ty0 + Math.floor(i / per) * (ph + 6);
        return item('flav:' + nm, nm + ' · ' + d, `<rect class="hc-ln" x="${f(x)}" y="${f(y)}" width="${pw}" height="${ph}" rx="10"/>` + txt(x + pw / 2, y + ph / 2, nm, 'hc-t', 'middle', ' dominant-baseline="middle"')); }).join('');
      return out;
    }
    function pBurn(W, H) {
      const max = Math.max(120, ...sizes.map(c => c.mins)) + 10, ax = H - 22, bt = top + 4, bb = ax - 6, X = m => pad + (W - pad * 2) * Math.min(m, max) / max;
      let out = `<path class="hc-ln hc-thin" d="M${f(pad)} ${f(ax)}H${f(W - pad)}"/>`;
      for (let m = 30; m < max; m += 30) out += `<path class="hc-ln hc-thin" d="M${f(X(m))} ${f(ax)}v4"/>` + txt(X(m), ax + 15, m + (m + 30 >= max ? ' min' : ''), 'hc-t hc-tf', 'middle');
      const s = Math.max(2, (bb - bt - 40) / 9.25);
      out += BANDS.map(([nm, sh, a, b]) => { const n = sizes.filter(c => c.mins > a && c.mins <= b).length, x1 = X(a) + 1.5, x2 = X(b) - 1.5, lab = (x2 - x1) > nm.length * 6.5 ? nm : sh;
        return item('burn:' + nm, nm + ' · ' + (b === Infinity ? 'over ' + a : (a ? a + 1 : 0) + '–' + b) + ' min · ' + n + (n === 1 ? ' size' : ' sizes'),
          `<rect class="hc-ln hc-band" x="${f(x1)}" y="${f(bt)}" width="${f(Math.max(4, x2 - x1))}" height="${f(bb - bt)}" rx="6"/>` + txt((x1 + x2) / 2, bt + 16, lab, 'hc-t hc-tb', 'middle') + txt((x1 + x2) / 2, bt + 29, n + (n === 1 ? ' size' : ' sizes'), 'hc-t hc-tf', 'middle'), { nz: true }); }).join('');
      const seen = {};
      out += sizes.map(c => { const k = seen[c.mins] = (seen[c.mins] || 0) + 1, rp = Math.max(1.5, c.ring / 64 * s), cx = X(c.mins) + (k % 2 ? 1 : -1) * Math.ceil((k - 1) / 2) * (rp + 2);   // same burn time: fan out left and right
        return item('bsize:' + c.size, sizeFacts(c), upright(c, cx, bb - 2, s), { size: c.size, hit: `<rect class="hc-hit" x="${f(cx - Math.max(4, rp))}" y="${f(bb - 2 - c.len * s)}" width="${f(Math.max(8, rp * 2))}" height="${f(c.len * s)}"/>` }); }).join('');
      return out;
    }
    const DRAW = [pSizes, pShapes, pWrapper, pFiller, pAnatomy, pBurn];

    function build() {
      const W = Math.round(view.clientWidth), H = Math.round(view.clientHeight);
      if (W < 60 || H < 60 || (W === W0 && H === H0)) return; W0 = W; H0 = H;
      panels.forEach((p, i) => { const svg = p.firstElementChild; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = txt(pad, 20, PANELS[i].t.toUpperCase(), 'hc-title') + DRAW[i](W, H); });
      apply(); go(cur, true);
    }

    // ---- State onto the drawing ----
    function apply() {
      root.querySelectorAll('.hc-it').forEach(g => g.classList.toggle('on', g.dataset.id === S.on));
      panels.forEach(p => p.classList.toggle('hov', !!p.querySelector('.hc-it.on')));
      detail.textContent = S.on && FACTS[S.on] ? FACTS[S.on] : PANELS[cur].cap;
    }
    function go(i, instant) {
      cur = Math.max(0, Math.min(PANELS.length - 1, i));
      if (instant) track.classList.add('drag');
      track.style.transform = `translateX(${f(-cur * 100 / PANELS.length)}%)`;
      if (instant) { void track.offsetWidth; track.classList.remove('drag'); }
      panels.forEach((p, k) => { p.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); p.querySelectorAll('.hc-it').forEach(g => g.setAttribute('tabindex', k === cur ? '0' : '-1')); });
      dots.forEach((d, k) => { d.classList.toggle('cur', k === cur); d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      if (!S.on) detail.textContent = PANELS[cur].cap;
    }
    const setOn = id => { if (id === S.on) return; S.on = id; apply(); if (opt.onHover) opt.onHover(id); };

    // ---- Motion: the overview loop, one panel every 3.2s (none under reduced motion) ----
    function tickOv() { clearTimeout(ovT); if (!live || RM()) return; ovT = setTimeout(() => { if (live && !paused && !S.on) go((cur + 1) % PANELS.length); tickOv(); }, 3200); }
    const stopOv = () => clearTimeout(ovT), armIdle = tickOv;   // a swipe or dot click restarts the wait

    // ---- Pointer, focus, touch ----
    const itemOf = t => { const g = t && t.closest && t.closest('.hc-it'); return g && root.contains(g) ? g : null; };
    root.addEventListener('pointerenter', () => { paused = true; });
    root.addEventListener('pointerleave', () => { paused = false; });
    track.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const g = itemOf(e.target); if (!g || g.dataset.id === S.on) return; if (g.parentNode.lastElementChild !== g) g.parentNode.appendChild(g); setOn(g.dataset.id); });
    track.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse') return; const a = itemOf(e.target), b = itemOf(e.relatedTarget); if (a && a !== b && !b) setOn(S.pin); });
    track.addEventListener('focusin', e => { const g = itemOf(e.target); if (g) setOn(g.dataset.id); paused = true; });
    track.addEventListener('focusout', e => { if (!itemOf(e.relatedTarget)) { setOn(S.pin); paused = false; } });
    let drag = null, swallow = false;
    view.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false }; });
    view.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.moved = true; stopOv(); track.classList.add('drag'); }
      if (drag.moved) { drag.dx = dx; track.style.transform = `translateX(calc(${f(-cur * 100 / PANELS.length)}% + ${f(dx)}px))`; } });
    const endDrag = () => { if (!drag) return; const d = drag; drag = null; if (!d.moved) return; track.classList.remove('drag'); swallow = true; setTimeout(() => { swallow = false; }, 50);
      go(cur + (d.dx < -40 ? 1 : d.dx > 40 ? -1 : 0)); armIdle(); };
    view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', e => { if (swallow) return; const g = itemOf(e.target), id = g ? g.dataset.id : null; S.pin = id && S.pin !== id ? id : null; setOn(S.pin); });
    track.addEventListener('keydown', e => { const g = itemOf(e.target); if (!g || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); S.pin = S.pin === g.dataset.id ? null : g.dataset.id; setOn(S.pin || g.dataset.id); });
    root.querySelector('.hc-dots').addEventListener('click', e => { const d = e.target.closest('.hc-dot'); if (!d) return; stopOv(); go(+d.dataset.p); armIdle(); });

    root.classList.toggle('rm', RM());
    if (window.ResizeObserver) new ResizeObserver(build).observe(view); else window.addEventListener('resize', build);
    build();

    return {
      show(on) { on = !!on; if (on === live) return; live = on;
        if (on) { build(); tickOv(); } else { stopOv(); S.pin = null; S.on = null; paused = false; apply(); } }
    };
  }

  window.HumidorChart = { mount };
})();
