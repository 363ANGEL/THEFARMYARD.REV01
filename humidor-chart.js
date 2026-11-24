/* The Humidor · v2.0 "cigar knowledge" chart (plan 38, RAY 24 Nov). It stands in for the 3D cigar on
   the landing step of humidor-roll.html only (step 0, "How well do you know cigars?"); steps 1 to 8 keep
   the cigar (plan 38 CORRECTION). Neon line art drawn here, in code: RAY's posters were reference only, so nothing
   is traced or copied from them. Facts only: the size names, lengths and rings are the SAMPLE shelf in
   humidor-shelf.js; the wrapper shade names and the leaf tiers are the trade's standard names.
   Six panels on one track: Sizes · Shapes · Wrapper · Filler · Anatomy · Burn time.
   Overview only: it auto-scrolls across the panels, pauses while the pointer is over it, and lights and
   zooms an item on rollover, focus or tap. Swipe on touch; the dots jump to a panel.
   API: const c = HumidorChart.mount(el, { sizes, onHover, onPick }); c.show(true | false) starts or stops it;
        c.hold(true | false) holds the loop (photo window open). onPick(sizeRow) fires on a size's click, tap or Enter.
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
  // Panel order (RAY, 24 Nov): sizes, shapes, burn time, filler, wrapper, anatomy.
  const PANELS = [
    { t: 'Sizes', cap: 'Every size on the shelf, shortest to longest. Roll over one.' },
    { t: 'Shapes', cap: 'The head and foot change how the smoke reaches you.' },
    { t: 'Burn time', cap: 'Every size by how long it lasts.' },
    { t: 'Filler', cap: 'One plant, four floors. The higher the leaf, the more sun it got and the harder it hits. Roll over a leaf.' },
    { t: 'Wrapper', cap: 'The outside leaf, from light to dark.' },
    { t: 'Anatomy', cap: 'The parts of a cigar, how it is measured, and how the head is cut.' }
  ];
  const SHAPES = [['Parejo', 'straight sides and a rounded head'], ['Belicoso', 'a short taper at the head'], ['Torpedo', 'a long pointed head'], ['Pyramid', 'narrows all the way from foot to head'], ['Perfecto', 'tapered at both ends, fat in the middle'], ['Chisel', 'a flattened wedge at the head']];
  const SHMAP = { parejo: 'Parejo', belicoso: 'Belicoso', torpedo: 'Torpedo', pyramid: 'Pyramid', perfecto: 'Perfecto', chisel: 'Chisel', culebra: 'Parejo' };
  // Seven shades. The five leaf tones are humidor-cigar3d.js's TONE; Candela and Colorado Claro are added stops.
  // Flavours each wrapper shade is commonly known for (RAY, 24 Nov). General guidance for the club to check.
  const WFLAV = {
    'Double Claro (Candela)': ['Grass', 'Green tea', 'Hay'],
    'Claro': ['Cream', 'Cedar', 'Almond'],
    'Colorado Claro': ['Nuts', 'Toast', 'Honey'],
    'Colorado': ['Cedar', 'Leather', 'Spice'],
    'Colorado Maduro': ['Cocoa', 'Coffee', 'Dried fruit'],
    'Maduro': ['Dark chocolate', 'Molasses', 'Espresso'],
    'Oscuro': ['Black pepper', 'Earth', 'Charcoal']
  };
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
    el.innerHTML = `<div class="hc"><div class="hc-view"><div class="hc-track">${PANELS.map((p, i) => `<div class="hc-p" data-p="${i}"><svg class="hc-svg" role="group" aria-label="${esc(p.t)}"></svg><div class="hc-detail" aria-live="polite">${esc(p.cap)}</div></div>`).join('')}</div><div class="hc-tip" hidden></div></div>
      <div class="hc-bar"><div class="hc-dots">${PANELS.map((p, i) => `<button type="button" class="hc-dot" data-p="${i}" aria-label="${esc(p.t)}"></button>`).join('')}</div></div></div>`;
    const root = el.firstElementChild, tipEl = root.querySelector('.hc-tip'), view = root.querySelector('.hc-view'), track = root.querySelector('.hc-track'), details = [...root.querySelectorAll('.hc-detail')], setDetail = () => details.forEach((d, k) => { d.textContent = k === cur && S.on && FACTS[S.on] ? FACTS[S.on] : PANELS[k].cap; });   // each panel carries its own tagline, so it slides with the title
    const panels = [...root.querySelectorAll('.hc-p')], dots = [...root.querySelectorAll('.hc-dot')];
    const FACTS = {};
    const S = { on: null, pin: null };
    let cur = 0, live = false, paused = false, hold = false, ovT = 0, W0 = 0, H0 = 0;   // hold: the photo window is open

    // ---- Drawing ----
    const item = (id, facts, inner, o) => { o = o || {}; FACTS[id] = facts;
      return `<g class="hc-it${o.nz ? ' nz' : ''}${o.cls ? ' ' + o.cls : ''}"${o.style ? ` style="${o.style}"` : ''} data-id="${esc(id)}"${o.size ? ` data-size="${esc(o.size)}"` : ''} tabindex="-1" role="img" aria-label="${esc(facts)}">${o.hit || ''}<g class="hc-z">${inner}</g></g>`; };
    const txt = (x, y, s, cls, anchor, extra) => `<text class="${cls || 'hc-t'}" x="${f(x)}" y="${f(y)}"${anchor ? ` text-anchor="${anchor}"` : ''}${extra || ''}>${esc(s)}</text>`;
    const pad = 12, top = 32, TAG = 22;
    const upright = (c, cx, yb, s) => { const lp = c.len * s, rp = Math.max(1.5, c.ring / 64 * s);
      return `<g transform="translate(${f(cx + rp / 2)} ${f(yb - lp)}) rotate(90)"><path class="hc-ln" d="${profile(SHMAP[c.shape] || 'Parejo', lp, rp)}"/></g>`; };
    const shc = c => 'sh-' + (SHMAP[c.shape] || 'Parejo').toLowerCase();   // shape colour group (RAY, 24 Nov)
    const sizeFacts = c => `${c.size} · ${frac(c.len)}″ × ${c.ring} · ${c.shape === 'culebra' ? 'Culebra' : SHMAP[c.shape] || c.shape} · about ${c.mins} min`;

    function pSizes(W, H) {
      const n = sizes.length || 1, cw = (W - pad * 2) / n, labH = Math.min(160, H * 0.45), area = Math.max(20, H - top - labH - 26);
      const s = Math.max(2, Math.min(area / 9.25, cw * 0.9 / (60 / 64))), yb = top + area, fine = cw < 14;
      const leg = W >= 520 ? SHAPES.map(([nm], i) => `<text class="hc-t hc-leg sh-${nm.toLowerCase()}" x="${f(W / 2 + (i - (SHAPES.length - 1) / 2) * 74)}" y="${f(H - 6)}" text-anchor="middle">${esc(nm)}</text>`).join('') : '';
      return leg + sizes.map((c, i) => { const cx = pad + cw * (i + 0.5);
        return item('size:' + c.size, sizeFacts(c), upright(c, cx, yb, s) + `<text class="hc-t${fine ? ' hc-tf' : ''}" dominant-baseline="middle" transform="translate(${f(cx)} ${f(yb + 6)}) rotate(90)">${esc(c.size)} ${frac(c.len)}″ × ${c.ring}</text>`,
          { size: c.size, cls: shc(c), hit: `<rect class="hc-hit" x="${f(cx - cw / 2)}" y="${top}" width="${f(cw)}" height="${f(H - top)}"/>` }); }).join('');
    }
    function pShapes(W, H) {
      const cols = W >= 520 ? 3 : 2, rows = 6 / cols, cellW = (W - pad * 2) / cols, cellH = (H - top - 6) / rows;
      const pw = cellW * 0.78, ph = Math.max(8, Math.min(cellH * 0.34, pw * 0.17));
      return SHAPES.map(([nm, d], i) => { const cx = pad + cellW * (i % cols + 0.5), cy = top + cellH * (Math.floor(i / cols) + 0.42);
        return item('shape:' + nm, nm + ' · ' + d, `<g transform="translate(${f(cx - pw / 2)} ${f(cy - ph / 2)})"><path class="hc-ln" d="${profile(nm, pw, ph)}"/></g>` + txt(cx, cy + ph / 2 + 16, nm, 'hc-t hc-tb', 'middle'),
          { nz: true, cls: 'sh-' + nm.toLowerCase(), hit: `<rect class="hc-hit" x="${f(cx - cellW / 2)}" y="${f(cy - cellH * 0.42)}" width="${f(cellW)}" height="${f(cellH)}"/>` }); }).join('');
    }
    function pWrapper(W, H) {   // a wheel (RAY, 24 Nov): inner ring Light / Medium / Dark, outer ring the seven wrapper shades
      const cx = W / 2, R2 = Math.max(40, Math.min(W / 2 - pad, (H - top - 10) / 2)), cy = top + 4 + R2, R = R2 * 0.66, r0 = R2 * 0.18, r1 = R2 * 0.38, n = WRAPS.length, step = 2 * Math.PI / n, A0 = -Math.PI / 2;
      const pt = (r, a) => f(cx + r * Math.cos(a)) + ' ' + f(cy + r * Math.sin(a));
      const wedge = (ri, ro, a0, a1) => { const big = a1 - a0 > Math.PI ? 1 : 0; return `M${pt(ri, a0)}L${pt(ro, a0)}A${f(ro)} ${f(ro)} 0 ${big} 1 ${pt(ro, a1)}L${pt(ri, a1)}A${f(ri)} ${f(ri)} 0 ${big} 0 ${pt(ri, a0)}Z`; };
      const lab = (r, a, s, cls) => { let deg = a * 180 / Math.PI; const flip = Math.cos(a) < 0; if (flip) deg += 180;
        return `<text class="${cls}" text-anchor="middle" dominant-baseline="middle" transform="translate(${pt(r, a)}) rotate(${f(deg)})">${esc(s)}</text>`; };
      const push = a => `--dx:${f(Math.cos(a) * R2 * 0.04)}px;--dy:${f(Math.sin(a) * R2 * 0.04)}px`;
      const radial = (r, a, s2, cls) => { let deg = a * 180 / Math.PI; if (Math.cos(a) < 0) deg += 180; return `<text class="${cls}" text-anchor="middle" dominant-baseline="middle" transform="translate(${pt(r, a)}) rotate(${f(deg)})">${esc(s2)}</text>`; };
      const fine = R < 110 ? ' hc-tf' : '';
      let k = 0;
      const groups = ['Light', 'Medium', 'Dark'].map(g => { const ix = WRAPS.map((w, i) => w[2] === g ? i : -1).filter(i => i >= 0), a0 = A0 + step * ix[0], a1 = A0 + step * (ix[ix.length - 1] + 1), am = (a0 + a1) / 2;
        return item('wgrp:' + g, g + ' leaf · ' + ix.map(i => WRAPS[i][0]).join(', '), `<path class="hc-ln hc-band" d="${wedge(r0, r1, a0, a1)}"/>` + lab((r0 + r1) / 2, am, g.toUpperCase(), 'hc-t hc-tb' + fine), { cls: 'wedge', style: push(am) }); }).join('');
      const shades = WRAPS.map(([nm, hex, g, d], i) => { const a0 = A0 + step * i, a1 = a0 + step, am = (a0 + a1) / 2, short = nm.replace(' (Candela)', '');
        return item('wrap:' + i, nm + ' · ' + d + ' · in our ' + g.toLowerCase() + ' answer', `<path class="hc-sw" d="${wedge(r1, R, a0, a1)}" fill="${hex}"/>` + lab((r1 + R) / 2, am, short, 'hc-t hc-wl' + fine), { cls: 'wedge', style: push(am) }); }).join('');
      // Outer ring (RAY, 24 Nov): the flavours each shade is known for, like a flavour wheel. General guidance, not a promise.
      const notes = WRAPS.map(([nm, hex], i) => { const list = WFLAV[nm] || [], a0 = A0 + step * i, sub = step / Math.max(1, list.length);
        return list.map((fl, k) => { const b0 = a0 + sub * k, b1 = b0 + sub, bm = (b0 + b1) / 2;
          return item('wflav:' + i + ':' + k, nm + ' · ' + fl, `<path class="hc-sw hc-fl" d="${wedge(R, R2, b0, b1)}" fill="${hex}"/>` + radial((R + R2) / 2, bm, fl, 'hc-t hc-fll' + (R2 - R < 70 ? ' hc-tf' : '')), { cls: 'wedge flv flv-' + fl.toLowerCase().replace(/[^a-z]+/g, '-'), style: push(bm) }); }).join(''); }).join('');
      return groups + shades + notes + `<circle class="hc-ln" cx="${f(cx)}" cy="${f(cy)}" r="${f(r0)}"/>` + txt(cx, cy, 'LEAF', 'hc-title', 'middle', ' dominant-baseline="middle"');
    }
    // Filler (RAY, 24 Nov): the same picture and details as the original Humidor's "Pick your strength":
    // the plant photo with its four floors, the upright cigar showing where each leaf sits, the key and the note.
    function pFiller(W, H) {
      const FL = [
        ['Ligero', 'Top of the plant · most sun', 'Thick, oily, slow-burning. The punch. A little goes in the middle of the filler.', 6, 20, 'Sits in the core of the filler', 'var(--neon-red-tube)', '232,38,58', 'var(--neon-red-text)', [50]],
        ['Viso', 'Upper middle', 'Flavour and some strength. The bit that makes it taste of something.', 26, 20, 'Filler, around the ligero', 'var(--color-accent-2,#a7a1db)', '167,161,219', '#cfcbee', [38, 62]],
        ['Seco', 'Lower middle · shade', 'Mild, aromatic, burns easily. Most of a mild cigar is seco.', 46, 24, 'Filler and binder', 'var(--neon-green-tube)', '63,224,127', 'var(--neon-green-text)', [25, 75]],
        ['Volado', 'Bottom · least sun', 'Barely any strength. It is there to make the thing burn.', 70, 24, 'Outer filler and binder', 'var(--medal-silver,#e4ecf0)', '228,236,240', '#e4ecf0', [14, 86]]
      ];
      const ah = H - top - 6, ih = ah, iw = Math.min(ih * 0.59, W * 0.32), ix = pad, iy = top, lblW = W < 560 ? 104 : W < 720 ? 124 : 140, lx = ix + iw + 10;
      const cw = Math.max(26, Math.min(46, ah * 0.12)), ch = Math.min(ah * 0.86, 340), cxl = lx + lblW, cyt = top + (ah - ch) / 2, r = cw / 2;
      const kx = cxl + cw + 10, fx = kx + (W < 720 ? 68 : 88), fw = W - pad - fx, box = fw >= 120;
      const outline = `M${f(cxl)} ${f(cyt + ch)}V${f(cyt + r)}A${f(r)} ${f(r)} 0 0 1 ${f(cxl + cw)} ${f(cyt + r)}V${f(cyt + ch)}Z`;
      const rowY = k => cyt + 8 + (ch - 16) * k / 8;
      const keyRow = (k, label, col, line) => (line ? `<path d="M${f(kx)} ${f(rowY(k))}h12" stroke="${col}" stroke-width="2"/>` : '') + `<text class="hc-t hc-tf hc-key" x="${f(kx + (line ? 18 : 0))}" y="${f(rowY(k))}" dominant-baseline="middle"${line ? '' : ` style="fill:${col}"`}>${esc(label.toUpperCase())}</text>`;
      let out = `<defs><linearGradient id="hc-fadeg"><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="hc-fadem"><rect x="${f(ix)}" y="${f(iy)}" width="${f(iw)}" height="${f(ih)}" fill="url(#hc-fadeg)"/></mask><clipPath id="hc-cgc"><path d="${outline}"/></clipPath></defs>`;
      out += `<image href="assets/humidor/plant-primings.jpg" x="${f(ix)}" y="${f(iy)}" width="${f(iw)}" height="${f(ih)}" preserveAspectRatio="xMinYMid slice" mask="url(#hc-fadem)" style="filter:saturate(.85) contrast(1.05)"/>`;
      // the cigar: outline, dashed binder, cap line and band
      out += `<path d="${outline}" fill="var(--fy-surface)" stroke="var(--fy-text)" stroke-opacity=".7" stroke-width="2"/><path d="M${f(cxl + 5)} ${f(cyt + ch)}V${f(cyt + r)}A${f(r - 5)} ${f(r - 5)} 0 0 1 ${f(cxl + cw - 5)} ${f(cyt + r)}V${f(cyt + ch)}" fill="none" stroke="var(--neon-teal)" stroke-opacity=".55" stroke-dasharray="3 3"/>`;
      out += FL.map(([nm, pos, d, tp, hp, use, col, rgb, tx, xs], i) => {
        const by = top + ah * tp / 100, bh = ah * hp / 100, my = by + bh / 2;
        const lines = xs.map(x => `<path class="hc-lf" d="M${f(cxl + cw * x / 100)} ${f(cyt + ch * 0.09)}V${f(cyt + ch * 0.99)}" stroke="${col}" stroke-width="2" clip-path="url(#hc-cgc)"/>`).join('');
        const info = box ? `<foreignObject class="hc-info${i === 2 ? ' def' : ''}" x="${f(fx)}" y="${f(top + ah / 2 - 90)}" width="${f(fw)}" height="220"><div xmlns="http://www.w3.org/1999/xhtml" class="hc-infobox"><span class="hc-infoh">${esc(nm)}</span><p>${esc(d)}</p><p class="hc-infou">${esc(use)}</p></div></foreignObject>` : '';
        return item('leaf:' + nm, nm + ' · ' + pos + ' · ' + d + ' ' + use + '.',
          `<rect class="hc-lband" x="${f(ix)}" y="${f(by)}" width="${f(iw)}" height="${f(bh)}" fill="rgb(${rgb})"/><path d="M${f(ix)} ${f(by)}H${f(ix + iw)}" stroke="${col}" stroke-opacity=".6" stroke-dasharray="4 3" fill="none"/>`
          + `<path class="hc-lf" d="M${f(lx)} ${f(my)}h18" stroke="${col}" stroke-width="2"/>` + txt(lx + 24, my - 2, nm, 'hc-t hc-tb hc-lname') + txt(lx + 24, my + 12, pos, 'hc-t hc-tf')
          + lines + keyRow(2 + i, nm, col, true) + info,
          { nz: true, cls: 'leaf', style: `--lc:${tx}`, hit: `<rect class="hc-hit" x="${f(ix)}" y="${f(by)}" width="${f(cxl - ix - 6)}" height="${f(bh)}"/>` }); }).join('');
      out += `<g clip-path="url(#hc-cgc)"><path d="M${f(cxl)} ${f(cyt + ch * 0.05)}h${f(cw)}" stroke="var(--neon-amber-tube)"/><rect x="${f(cxl)}" y="${f(cyt + ch * 0.16)}" width="${f(cw)}" height="7" fill="var(--fy-text)"/></g>`;
      out += keyRow(0, 'Cap', 'var(--neon-amber-tube)') + keyRow(1, 'Band', 'var(--fy-text)') + keyRow(6, 'Binder', 'var(--neon-teal)', true) + keyRow(7, 'Wrapper', 'var(--fy-text)', true) + keyRow(8, 'Foot', 'var(--fy-text-label)');
      return out;
    }
    function pAnatomy(W, H) {
      const len = Math.min(W - pad * 2 - 70, 560), x0 = Math.max(pad + 12, (W - len) / 2 - 20), t = Math.max(12, Math.min((H - top) * 0.18, len * 0.14, 46)), cy = top + (H - top) * 0.3;
      const up1 = cy - t / 2 - 14, up2 = cy - t / 2 - 30, dn = cy + t / 2 + 24;
      const call = (x, y0, y1, ty, s, anchor) => `<path class="hc-ln hc-thin" d="M${f(x)} ${f(y0)}V${f(y1)}"/>` + txt(x, ty, s, 'hc-t hc-tb', anchor);
      let out = `<g transform="translate(${f(x0)} ${f(cy - t / 2)})"><path class="hc-ln" d="${profile('Parejo', len, t)}"/></g>`;
      out += item('part:cap', PARTS.cap, `<path class="hc-ln" d="M${f(x0 + len * 0.012)} ${f(cy - t * 0.22)}Q${f(x0 - 1)} ${f(cy)} ${f(x0 + len * 0.012)} ${f(cy + t * 0.22)}"/>` + call(x0 + 3, cy - t * 0.3, up2 + 4, up2, 'Cap', 'end'));
      out += item('part:shoulder', PARTS.shoulder, call(x0 + len * 0.055, cy - t / 2, up1 + 4, up1, 'Shoulder', 'start'));
      out += item('part:head', PARTS.head, call(x0 + len * 0.025, cy + t / 2 - 1, dn - 12, dn, 'Head', 'start'));
      out += item('part:band', PARTS.band, `<rect class="hc-ln hc-occ" x="${f(x0 + len * 0.16)}" y="${f(cy - t / 2 - 2)}" width="${f(len * 0.07)}" height="${f(t + 4)}" rx="2"/><path class="hc-ln hc-thin" d="M${f(x0 + len * 0.17)} ${f(cy)}H${f(x0 + len * 0.22)}"/>` + call(x0 + len * 0.195, cy - t / 2 - 2, up2 + 4, up2, 'Band', 'middle'));
      out += item('part:body', PARTS.body, `<path class="hc-ln hc-thin" d="M${f(x0 + len * 0.3)} ${f(cy + t / 2 + 6)}H${f(x0 + len * 0.9)}"/>` + call(x0 + len * 0.6, cy + t / 2 + 6, dn - 12, dn, 'Body', 'middle'));
      out += item('part:foot', PARTS.foot, `<ellipse class="hc-ln" cx="${f(x0 + len - 1)}" cy="${f(cy)}" rx="${f(t * 0.16)}" ry="${f(t / 2 - 1)}"/>` + call(x0 + len - 1, cy - t / 2, up1 + 4, up1, 'Foot', 'end'));
      // Measurements and cuts (RAY, 24 Nov), in place of the flavour tags.
      const rx = x0 + len + 16, ly = dn + 20;
      out += item('dim:ring', 'Ring gauge · the thickness, in 64ths of an inch. A 50 ring is 50/64″, about 20 mm across. Wider draws looser and cooler',
        `<path class="hc-ln hc-thin" d="M${f(rx)} ${f(cy - t / 2)}V${f(cy + t / 2)}M${f(rx - 4)} ${f(cy - t / 2)}h8M${f(rx - 4)} ${f(cy + t / 2)}h8"/>` + `<text class="hc-t hc-tb" text-anchor="middle" transform="translate(${f(rx + 14)} ${f(cy)}) rotate(90)">Ring gauge</text>`,
        { nz: true, hit: `<rect class="hc-hit" x="${f(rx - 8)}" y="${f(cy - t / 2 - 30)}" width="34" height="${f(t + 60)}"/>` });
      out += item('dim:length', 'Length · measured in inches, head to foot. Most sit between 4″ and 7½″. Longer means a longer smoke',
        `<path class="hc-ln hc-thin" d="M${f(x0)} ${f(ly)}H${f(x0 + len)}M${f(x0)} ${f(ly - 4)}v8M${f(x0 + len)} ${f(ly - 4)}v8"/>` + txt(x0 + len / 2, ly + 14, 'Length', 'hc-t hc-tb', 'middle'),
        { nz: true, hit: `<rect class="hc-hit" x="${f(x0)}" y="${f(ly - 8)}" width="${f(len)}" height="28"/>` });
      const CUTS = [
        ['Straight cut', 'the whole cap comes off with a guillotine. Draw: the most open and easy, with plenty of smoke. Suits: every shape, and the only cut for a torpedo, pyramid or perfecto', 'Draw: open and easy', 'Suits: every shape', r0 => `<circle class="hc-ln" cx="0" cy="0" r="${f(r0 * 0.72)}"/>`],
        ['V-cut', 'a wedge notched across the cap. Draw: focused and concentrated, a little firmer. Suits: parejos and belicosos, best on a 46 ring or wider; too deep for thin or sharply pointed heads', 'Draw: focused, a little firmer', 'Suits: parejo, belicoso · 46 ring up', r0 => `<path class="hc-ln" d="M${f(-r0 * 0.8)} 0Q0 ${f(-r0 * 0.5)} ${f(r0 * 0.8)} 0Q0 ${f(r0 * 0.5)} ${f(-r0 * 0.8)} 0Z"/>`],
        ['Punch', 'a small round hole in the cap. Draw: the tightest and slowest, cooler smoke, can build tar. Suits: round-headed parejos of 48 ring or wider; not for torpedo, pyramid, belicoso or perfecto heads', 'Draw: tight, slow and cool', 'Suits: round heads · 48 ring up', r0 => `<circle class="hc-ln" cx="0" cy="0" r="${f(r0 * 0.32)}"/>`]
      ];
      const cyq = ly + 34, avail = H - cyq - 52, cr = Math.max(9, Math.min(20, avail / 2)), cyc = cyq + cr + 4, cell = Math.min(200, (W - pad * 2) / 3), cx0 = W / 2 - cell;
      out += txt(pad, cyq - 6, 'CUTS · HOW THE HEAD IS OPENED, AND WHAT IT DOES TO THE DRAW', 'hc-title');
      out += CUTS.map(([nm, d, l1, l2, draw], i) => { const cx = cx0 + cell * i;
        return item('cut:' + nm, nm + ' · ' + d, `<g transform="translate(${f(cx)} ${f(cyc)})"><circle class="hc-ln hc-thin" cx="0" cy="0" r="${f(cr)}"/>${draw(cr)}</g>` + txt(cx, cyc + cr + 14, nm, 'hc-t hc-tb', 'middle') + txt(cx, cyc + cr + 27, l1, 'hc-t hc-tf', 'middle') + txt(cx, cyc + cr + 39, l2, 'hc-t hc-tf', 'middle'),
          { nz: true, hit: `<rect class="hc-hit" x="${f(cx - cell / 2)}" y="${f(cyc - cr - 4)}" width="${f(cell)}" height="${f(cr * 2 + 48)}"/>` }); }).join('');
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
        return `<g class="hc-deco ${shc(c)}">${upright(c, cx, bb - 2, s)}</g>`; }).join('');   // burn-time cigars are drawing only; the time bands are what you pick (RAY, 24 Nov)
      return out;
    }
    const DRAW = [pSizes, pShapes, pBurn, pFiller, pWrapper, pAnatomy];

    function build() {
      const W = Math.round(view.clientWidth), H = Math.round(view.clientHeight);
      if (W < 60 || H < 60 || (W === W0 && H === H0)) return; W0 = W; H0 = H;
      panels.forEach((p, i) => { const svg = p.firstElementChild; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.innerHTML = txt(pad, 20, PANELS[i].t.toUpperCase(), 'hc-title') + `<g transform="translate(0 ${TAG})">` + DRAW[i](W, H - TAG) + '</g>'; });   // room under the title for the tagline (RAY, 24 Nov)
      apply(); go(cur, true);
    }

    // ---- State onto the drawing ----
    // Shape tooltip (RAY, 24 Nov): the cigar side-on with dimension lines, and what each third does to draw and strength.
    const THIRDS = {
      Parejo: ['Foot · lights easily, opens mild', 'Middle · steady draw, the body settles', 'Head · straight sides, so it only warms a little as it shortens'],
      Belicoso: ['Foot · full open draw, a gentle start', 'Middle · steady, the body builds', 'Head · the short taper focuses the smoke: richer in the last inch'],
      Torpedo: ['Foot · open draw, a gentle start', 'Middle · body builds as the leaf heats', 'Head · the long point concentrates the smoke: the strongest third'],
      Pyramid: ['Foot · widest end, loose and cool', 'Middle · narrows all the way, flavour tightens', 'Head · narrowest: the tightest draw and the most intense finish'],
      Perfecto: ['Foot · narrow tip lights fast: a quick, mild start', 'Middle · the fat belly gives the fullest, coolest draw', 'Head · narrows again: focused and stronger to the end'],
      Chisel: ['Foot · ordinary open draw', 'Middle · steady body', 'Head · the flat wedge keeps the draw open while the smoke focuses']
    };
    const rep = nm => { const k = nm.toLowerCase(), list = sizes.filter(c => (SHMAP[c.shape] || 'Parejo') === nm).sort((a, b) => a.len - b.len); return list[Math.floor(list.length / 2)] || { len: 6, ring: 50, size: nm }; };
    function shapeTip(nm) {
      const c = rep(nm), w = 340, h = Math.max(18, Math.min(46, w * c.ring / 64 / c.len)), x0 = 20, y0 = 26, col = `sh-${nm.toLowerCase()}`;
      const third = [0, 1, 2].map(i => `<path class="hc-ln hc-thin" d="M${f(x0 + w * i / 3)} ${f(y0 - 6)}V${f(y0 + h + 6)}"/>` + txt(x0 + w * (i + 0.5) / 3, y0 - 10, ['FOOT', 'MIDDLE', 'HEAD'][i], 'hc-t hc-tf', 'middle')).join('');
      const dims = `<path class="hc-ln hc-thin" d="M${f(x0)} ${f(y0 + h + 16)}H${f(x0 + w)}M${f(x0)} ${f(y0 + h + 12)}v8M${f(x0 + w)} ${f(y0 + h + 12)}v8"/>` + txt(x0 + w / 2, y0 + h + 30, frac(c.len) + '″ long', 'hc-t', 'middle')
        + `<path class="hc-ln hc-thin" d="M${f(x0 - 10)} ${f(y0)}V${f(y0 + h)}M${f(x0 - 14)} ${f(y0)}h8M${f(x0 - 14)} ${f(y0 + h)}h8"/>` + `<text class="hc-t" text-anchor="middle" transform="translate(${f(x0 - 15)} ${f(y0 + h / 2)}) rotate(-90)">${c.ring} ring</text>`;
      // drawn foot on the left, head on the right: the profile path has its head at x=0, so mirror it
      const body = `<g class="${col}" transform="translate(${f(x0 + w)} ${f(y0)}) scale(-1 1)"><path class="hc-ln" d="${profile(nm, w, h)}"/></g>`;
      tipEl.innerHTML = `<div class="hc-tiph">${esc(nm)} · ${esc(c.size)} ${frac(c.len)}″ × ${c.ring}</div><svg viewBox="0 0 ${w + 30} ${f(y0 + h + 40)}" class="hc-tipsvg">${third}${body}${dims}</svg>`
        + `<ul class="hc-tipl">${THIRDS[nm].map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
      tipEl.hidden = false;
    }
    function apply() {
      root.querySelectorAll('.hc-it').forEach(g => g.classList.toggle('on', g.dataset.id === S.on));
      panels.forEach(p => p.classList.toggle('hov', !!p.querySelector('.hc-it.on')));
      setDetail();
      if (S.on && S.on.indexOf('shape:') === 0) shapeTip(S.on.slice(6)); else tipEl.hidden = true;
    }
    function go(i, instant) {
      cur = Math.max(0, Math.min(PANELS.length - 1, i));
      if (instant) track.classList.add('drag');
      track.style.transform = `translateX(${f(-cur * 100 / PANELS.length)}%)`;
      if (instant) { void track.offsetWidth; track.classList.remove('drag'); }
      panels.forEach((p, k) => { p.setAttribute('aria-hidden', k === cur ? 'false' : 'true'); p.querySelectorAll('.hc-it').forEach(g => g.setAttribute('tabindex', k === cur ? '0' : '-1')); });
      dots.forEach((d, k) => { d.classList.toggle('cur', k === cur); d.setAttribute('aria-current', k === cur ? 'true' : 'false'); });
      if (S.on && !panels[cur].querySelector(`[data-id="${CSS.escape(S.on)}"]`)) { S.on = null; S.pin = null; apply(); }   // a lit item on another panel must not caption this one
      if (!S.on) setDetail();
    }
    const setOn = id => { if (id === S.on) return; S.on = id; apply(); if (opt.onHover) opt.onHover(id); };

    // ---- Motion: the overview loop. Hold: Sizes 4s, every other panel 8s (RAY, 24 Nov); none under reduced motion ----
    function tickOv() { clearTimeout(ovT); if (!live || RM() || opt.only != null) return; /* a single-panel copy never pans */ ovT = setTimeout(() => { if (live && !paused && !hold && !(S.on && S.on !== S.pin)) go((cur + 1) % PANELS.length); tickOv(); }, cur === 0 ? 4000 : 8000); }   // a pinned item no longer stops the loop (RAY, 24 Nov)
    const stopOv = () => clearTimeout(ovT), armIdle = tickOv;   // a swipe or dot click restarts the wait

    // ---- Pointer, focus, touch ----
    const itemOf = t => { const g = t && t.closest && t.closest('.hc-it'); return g && root.contains(g) ? g : null; };
    root.addEventListener('pointerenter', () => { paused = true; });
    root.addEventListener('pointerleave', () => { paused = false; });
    track.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const g = itemOf(e.target); if (!g || g.dataset.id === S.on) return; if (g.parentNode.lastElementChild !== g) g.parentNode.appendChild(g); setOn(g.dataset.id); });
    track.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse') return; const a = itemOf(e.target), b = itemOf(e.relatedTarget); if (a && a !== b && !b) setOn(S.pin); });
    track.addEventListener('focusin', e => { const g = itemOf(e.target); if (!g || !g.matches(':focus-visible')) return; setOn(g.dataset.id); paused = true; });   // keyboard focus only: focus handed back by the photo window must not freeze the loop
    track.addEventListener('focusout', e => { if (!itemOf(e.relatedTarget)) { setOn(S.pin); paused = false; } });
    let drag = null, swallow = false;
    view.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false }; });
    view.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.moved = true; stopOv(); track.classList.add('drag'); }
      if (drag.moved) { drag.dx = dx; track.style.transform = `translateX(calc(${f(-cur * 100 / PANELS.length)}% + ${f(dx)}px))`; } });
    const endDrag = () => { if (!drag) return; const d = drag; drag = null; if (!d.moved) return; track.classList.remove('drag'); swallow = true; setTimeout(() => { swallow = false; }, 50);
      go(cur + (d.dx < -40 ? 1 : d.dx > 40 ? -1 : 0)); armIdle(); };
    view.addEventListener('pointerup', endDrag); view.addEventListener('pointercancel', endDrag);
    // A size (Sizes or Burn panel) also hands its row to opt.onPick: the photo window (plan 39).
    const pick = g => { const sz = g && g.dataset.size, row = sz && sizes.find(c => c.size === sz); if (row && opt.onPick) opt.onPick(row); };
    const pickBand = g => { const id = g && g.dataset.id; if (!id || id.indexOf('burn:') !== 0 || !opt.onBand) return;   // a time band opens its sizes (RAY, 24 Nov)
      const B = BANDS.find(b => 'burn:' + b[0] === id); if (!B) return;
      opt.onBand({ name: B[0], lo: B[2], hi: B[3], rows: sizes.filter(c => c.mins > B[2] && c.mins <= B[3]).sort((x, y) => x.len - y.len || x.ring - y.ring) }); };
    track.addEventListener('click', e => { if (swallow) return; const g = itemOf(e.target), id = g ? g.dataset.id : null; S.pin = id && S.pin !== id ? id : null; setOn(S.pin); pick(g); pickBand(g); });
    track.addEventListener('keydown', e => { const g = itemOf(e.target); if (!g || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); S.pin = S.pin === g.dataset.id ? null : g.dataset.id; setOn(S.pin || g.dataset.id); pick(g); pickBand(g); });
    root.querySelector('.hc-dots').addEventListener('click', e => { const d = e.target.closest('.hc-dot'); if (!d) return; stopOv(); go(+d.dataset.p); armIdle(); });

    root.classList.toggle('rm', RM()); if (opt.only != null) root.classList.add('only');
    if (window.ResizeObserver) new ResizeObserver(build).observe(view); else window.addEventListener('resize', build);
    build();

    return {
      hold(on) { hold = !!on; },
      mark(words) { const set = new Set((words || []).map(w => w.toLowerCase().replace(/[^a-z]+/g, '-'))); root.querySelectorAll('.flv').forEach(g => g.classList.toggle('lit', [...g.classList].some(c => c.indexOf('flv-') === 0 && set.has(c.slice(4))))); root.classList.toggle('marking', set.size > 0); },   // light the wheel notes that match the picks (RAY, 24 Nov)
      release() { S.pin = null; S.on = null; paused = false; hold = false; const a = document.activeElement; if (a && root.contains(a)) a.blur(); apply(); tickOv(); },   // after the photo window: resume the loop
      show(on) { on = !!on; if (on === live) return; live = on;
        if (on) { build(); if (opt.only != null) go(opt.only, true); tickOv(); } else { stopOv(); S.pin = null; S.on = null; paused = false; apply(); } }
    };
  }

  window.HumidorChart = { mount };
})();
