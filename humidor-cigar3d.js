// Humidor 'Roll your own' v2.0: the <cigar-3d> component, ported as-is from the Claude Design handoff (RAY, 24 Nov).
// three.js r184 loads from unpkg (follow-up: bundle it locally).
// <cigar-3d> — a live cigar that morphs to window.__cigarSpec ({len, ring, shape, wrapper, strength, budget, draw, focus, preview, spin, smoke}).
// Starts as a fine teal blueprint; each answer makes more of it real. Listens for the 'cigar-spec' window event.
(function(){
  if (customElements.get('cigar-3d')) return;
  const THREE_URL = 'https://unpkg.com/three@0.184.0/build/three.module.js';
  const LEAF = { Light: 0xc79a62, Medium: 0x8a5a32, Dark: 0x452a1a };
  // mild/sweet → pale claro, heavy/rich → near-black maduro. Wrapper leads, strength nudges.
  const TONE = [0xd8b07a, 0xb07c48, 0x7a4c2a, 0x4a2c18, 0x2c1a10], WT = { Light: 0.1, Medium: 0.5, Dark: 0.9 }, ST = { Mild: 0, Medium: 0.5, Full: 1 };
  const leafTone = (T, w, st) => { const a = WT[w], b = ST[st]; if (a == null && b == null) return null; const t = a == null ? 0.15 + b * 0.7 : b == null ? a : a * 0.7 + b * 0.3; const x = Math.min(0.999, Math.max(0, t)) * (TONE.length - 1), i = Math.floor(x); return new T.Color(TONE[i]).lerp(new T.Color(TONE[i + 1]), x - i); };
  const BANDS = [ ['#efe6cf', '#8f1f2c', 0.5, 0.15], ['#8f1f2c', '#e2b455', 0.6, 0.35], ['#17181f', '#e2b455', 0.7, 0.45], ['#e2b455', '#17181f', 0.8, 0.6] ];
  // each flavour pulls the wrapper 40% toward its hue
  const FLAV_HUE = { Creamy: 0xe2c896, Nutty: 0xa8743e, Woody: 0x8c4f2e, Spicy: 0xa43c22, Sweet: 0xc28838, Earthy: 0x5c5230 };
  const BURN_SLOW = 8 / 1.3; // burn plays ~6× slower (30% quicker than the design's 8×, RAY 24 Nov); 2.5s whole-cigar pause before each loop
  const SMOKE = { '': 0, Mild: 0.35, Medium: 0.65, Full: 1 };
  // head/foot profile per shape: hR (head length in radii) + hIn (inches) + hL (fraction of length), tip radius, k (0 dome → 1 straight cone), footT taper, flat wedge
  const Z = { hR: 0, hIn: 0, hL: 0, tip: 0, k: 0, footT: 0, flat: 0 };
  const SH = { Parejo: { hR: 0.7 }, Belicoso: { hIn: 0.9, tip: 0.5, k: 0.8 }, Torpedo: { hIn: 1.6, tip: 0.42, k: 0.9 }, Pyramid: { hL: 0.8, tip: 0.42, k: 1 }, Perfecto: { hIn: 1.5, tip: 0.5, k: 0.5, footT: 1 }, Chisel: { hIn: 1.5, tip: 1, k: 1, flat: 1 } };
  const M = 64, TAU = Math.PI * 2;
  // flat 2D silhouette of a shape (same maths as the 3D profile, wedge side for Chisel) → SVG path, head on the left
  window.HumidorCigarProfile = (shape, W, H) => { const c0 = Object.assign({}, Z, SH[shape] || SH.Parejo), L = 6, R = 0.45, h = Math.min(c0.hR * R + c0.hIn + c0.hL * L, L * 0.86), c = c0.tip * R * 0.5 * (1 - c0.flat * 0.75), N = 60, pts = [];
    for (let i = 0; i <= N; i++) { const d = i / N * L; let rr; if (d >= h) rr = 1; else if (d < c) { const q = d / c; rr = c0.tip * Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))); } else { const q = (d - c) / Math.max(h - c, 1e-4), dome = Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q))); rr = c0.tip + (1 - c0.tip) * (dome * (1 - c0.k) + q * c0.k); }
      if (c0.footT > 0.001 && d > L - 1.2) { const q = (L - d) / 1.2; rr *= 1 - c0.footT * 0.55 * (1 - q * q * (3 - 2 * q)); } const spn = d < h ? 1 - d / h : 0; pts.push([d / L * (W - 2) + 1, rr * (1 - 0.1 * c0.flat * spn) * (H / 2 - 1)]); }
    const f = n => n.toFixed(1); return 'M' + pts.map(p => f(p[0]) + ' ' + f(H / 2 - p[1])).join('L') + 'L' + pts.slice().reverse().map(p => f(p[0]) + ' ' + f(H / 2 + p[1])).join('L') + 'Z'; };
  window.dispatchEvent(new Event('cigar-profile-ready'));
  class Cigar3D extends HTMLElement {
    connectedCallback() {
      if (this._on) return; this._on = true;
      this.style.display = 'block'; this.style.width = '100%'; this.style.height = '100%';
      import(THREE_URL).then(T => { if (this.isConnected) try { this.init(T); } catch (e) { window.__cigErr = String(e && e.stack || e); console.error('cigar-3d init', e); } }).catch(e => console.warn('cigar-3d: three failed to load', e));
    }
    disconnectedCallback() { this._on = false; cancelAnimationFrame(this._raf); if (this._ro) this._ro.disconnect(); window.removeEventListener('cigar-spec', this._onSpec); window.removeEventListener('pointermove', this._onPtr); if (this.renderer) this.renderer.dispose(); }
    init(T) {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const renderer = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(2);   /* always 2x: the surface lines draw at half a CSS pixel, so they read thinner (RAY, 24 Nov) */ renderer.localClippingEnabled = true;
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
      this.appendChild(renderer.domElement);
      const scene = new T.Scene(), cam = new T.PerspectiveCamera(28, 1, 0.1, 100);
      scene.add(new T.AmbientLight(0xffffff, 0.5));
      const key = new T.DirectionalLight(0xfff0dc, 2.3); key.position.set(-2, 5, 6); scene.add(key);
      const fillL = new T.DirectionalLight(0xffe2b8, 0.5); fillL.position.set(3, -2, 5); scene.add(fillL);
      const pink = new T.PointLight(0xe0157f, 32, 30); pink.position.set(6, 3, -3); scene.add(pink);
      const teal = new T.PointLight(0x5fd3cf, 40, 30); teal.position.set(-6, -3, -2); scene.add(teal);
      const aniso = renderer.capabilities.getMaxAnisotropy();
      const canvasTex = (w, h, draw, srgb) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); if (srgb !== false) t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso; return t; };

      // wrapper leaf: fine hairline veins, a few main ribs
      const leafTex = canvasTex(1024, 512, (g, w, h) => {
        g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) { const v = 185 + Math.random() * 70 | 0; g.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.12 + Math.random() * 0.25) + ')'; g.lineWidth = 0.3 + Math.random() * 0.6; const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14 + Math.random() * 50, y + (Math.random() - 0.5) * 10); g.stroke(); }
        for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(105,105,105,.45)'; g.lineWidth = 0.9; const x = i * 118 + Math.random() * 40; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 40, h * 0.3, x + 70, h * 0.65, x + 120, h); g.stroke();
          for (let k = 0; k < 7; k++) { const y = (k + 0.5) * h / 7, bx = x + 120 * (y / h); g.strokeStyle = 'rgba(125,125,125,.28)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + 46, y - 22); g.moveTo(bx, y); g.lineTo(bx - 40, y - 26); g.stroke(); } }
      });
      leafTex.wrapS = leafTex.wrapT = T.RepeatWrapping;
      const ashTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#6b655f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { const v = 40 + Math.random() * 170 | 0; g.fillStyle = 'rgba(' + v + ',' + (v - 6) + ',' + (v - 12) + ',.55)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.4, 0, TAU); g.fill(); } });
      const bandTex = BANDS.map(([base, acc]) => canvasTex(1024, 192, (g, w, h) => {
        g.fillStyle = base; g.fillRect(0, 0, w, h); g.fillStyle = acc; g.strokeStyle = acc;
        [[9, 3], [16, 1.2], [h - 12, 3], [h - 17.2, 1.2]].forEach(([y, t]) => g.fillRect(0, y, w, t));
        for (let x = 6; x < w; x += 12) { g.beginPath(); g.arc(x, 28, 1.3, 0, TAU); g.arc(x, h - 28, 1.3, 0, TAU); g.fill(); }
        [256, 768].forEach(cx => { const cy = h / 2;
          g.lineWidth = 1.2; [[-1, 1], [1, 1]].forEach(([d]) => { g.beginPath(); g.moveTo(cx + d * 74, cy); g.lineTo(cx + d * 215, cy); g.stroke(); g.beginPath(); g.moveTo(cx + d * 74, cy - 7); g.lineTo(cx + d * 170, cy - 7); g.moveTo(cx + d * 74, cy + 7); g.lineTo(cx + d * 170, cy + 7); g.stroke(); g.save(); g.translate(cx + d * 226, cy); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore(); });
          g.beginPath(); g.arc(cx, cy, 64, 0, TAU); g.fill(); g.fillStyle = base; g.beginPath(); g.arc(cx, cy, 58, 0, TAU); g.fill(); g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, 52, 0, TAU); g.stroke();
          g.fillStyle = acc; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; g.beginPath(); g.arc(cx + Math.cos(a) * 55, cy + Math.sin(a) * 55, 0.9, 0, TAU); g.fill(); }
          g.font = '500 66px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', cx, cy + 3); });
      }));

      const root = new T.Group(); scene.add(root);
      const mkStrip = n => { const g = new T.BufferGeometry(), c = n * (M + 1); g.setAttribute('position', new T.BufferAttribute(new Float32Array(c * 3), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(c * 3), 3)); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(c * 2), 2));
        const idx = []; for (let i = 0; i < n - 1; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c2 = a + M + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); } g.setIndex(idx); return g; };
      const NB = 47;
      const leaf = new T.MeshStandardMaterial({ color: 0x1d2030, roughness: 0.74, metalness: 0, map: leafTex, bumpMap: leafTex, bumpScale: 0.6, side: T.DoubleSide });
      leaf.userData.target = new T.Color(0x1d2030);
      const body = new T.Mesh(mkStrip(NB), leaf); body.frustumCulled = false; root.add(body);
      // unwrap: the wrapper peels back from the foot along a spiral seam, showing the binder leaf inside
      const peelU = { value: new T.Vector2(1e3, 0.7) };
      leaf.onBeforeCompile = sh => { sh.uniforms.uPeel = peelU;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;\nuniform vec2 uPeel;').replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nfloat pe = uPeel.x + atan(vLp.z, vLp.y) / 6.2832 * uPeel.y - vLp.x; if (pe < 0.0) discard;').replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(0.35, 1.0, smoothstep(0.0, 0.07, pe));'); };
      const binderMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, map: leafTex, bumpMap: leafTex, bumpScale: 2.2 });
      // filler mix: Ligero (dark) / Seco (mid) / Volado (light) leaves bunched along the cigar, proportions follow strength
      const mixU = { value: new T.Vector3(0.33, 0.34, 0.33) }, mixOn = { value: 0 };
      binderMat.onBeforeCompile = sh => { sh.uniforms.uMix = mixU; sh.uniforms.uMixOn = mixOn;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLp = position;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLp;\nuniform vec3 uMix;\nuniform float uMixOn;').replace('#include <map_fragment>', '#include <map_fragment>\nfloat sa = fract((atan(vLp.z, vLp.y) / 6.2832 + 0.5) * 3.0 + sin(vLp.x * 1.7) * 0.04); vec3 cL = vec3(0.16, 0.085, 0.04), cS = vec3(0.42, 0.26, 0.12), cV = vec3(0.74, 0.6, 0.36), cB = vec3(0.56, 0.53, 0.3);\nvec3 cm = sa < uMix.x ? cL : (sa < uMix.x + uMix.y ? cS : cV); float ed = min(abs(sa - uMix.x), abs(sa - uMix.x - uMix.y)); cm *= mix(0.55, 1.0, smoothstep(0.0, 0.015, ed));\ndiffuseColor.rgb *= mix(cB, cm, uMixOn);'); };
      const MIX = { Mild: [0.1, 0.3, 0.6], Medium: [0.25, 0.45, 0.3], Full: [0.5, 0.36, 0.14] };
      // the loose end of the wrapper, curling off the seam
      const RU = 40, ribGeo = new T.BufferGeometry(); ribGeo.setAttribute('position', new T.BufferAttribute(new Float32Array((RU + 1) * 2 * 3), 3)); ribGeo.setAttribute('uv', new T.BufferAttribute(new Float32Array((RU + 1) * 2 * 2), 2)); { const ix = []; for (let i = 0; i < RU; i++) { const a = i * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } ribGeo.setIndex(ix); const U = ribGeo.attributes.uv.array; for (let i = 0; i <= RU; i++) { U[i * 4] = i / RU * 3; U[i * 4 + 1] = 0; U[i * 4 + 2] = i / RU * 3; U[i * 4 + 3] = 0.35; } }
      const ribMat = new T.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.74, metalness: 0, map: leafTex, bumpMap: leafTex, bumpScale: 0.6, side: T.DoubleSide });
      const ribbon = new T.Mesh(ribGeo, ribMat); ribbon.frustumCulled = false; ribbon.visible = false;
      const binder = new T.Mesh(mkStrip(NB), binderMat); binder.frustumCulled = false; binder.visible = false; root.add(binder); root.add(ribbon);
      const footMat = new T.MeshStandardMaterial({ color: 0x8a8580, map: ashTex, roughness: 1, emissive: 0xff5a1a, emissiveMap: ashTex, emissiveIntensity: 0 });
      const foot = new T.Mesh(new T.CircleGeometry(1, 48), footMat); foot.rotation.y = Math.PI / 2; root.add(foot);
      const ember = new T.PointLight(0xff7a2a, 0, 2.2); root.add(ember);
      const bandMat = new T.MeshStandardMaterial({ color: 0xffffff, map: bandTex[0], roughness: 0.42, metalness: 0.2, transparent: true, opacity: 0, side: T.DoubleSide });
      const band = new T.Mesh(mkStrip(6), bandMat); band.frustumCulled = false; root.add(band);

      // fine blueprint (before the leaf goes on) and leaf detail lines (after)
      const lineMat = new T.LineBasicMaterial({ color: 0x5fd3cf, transparent: true, opacity: 0.55 });
      const seamMat = new T.LineBasicMaterial({ color: 0x150b06, transparent: true, opacity: 0 });
      const clip = new T.Plane(new T.Vector3(-1, 0, 0), 1e3); [leaf, binderMat, ribMat, bandMat, lineMat, seamMat].forEach(m => { m.clippingPlanes = [clip]; });
      const circle = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; circle.push(new T.Vector3(0, Math.cos(a), Math.sin(a))); }
      const ringGeo = new T.BufferGeometry().setFromPoints(circle);
      const ashMat = new T.MeshStandardMaterial({ color: 0xb5b1ab, map: ashTex, roughness: 1, transparent: true, opacity: 0, side: T.DoubleSide }); const ash = new T.Mesh(mkStrip(8), ashMat); ash.frustumCulled = false; root.add(ash);
      const frontMat = new T.LineBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0 }); const front = new T.Line(ringGeo, frontMat); root.add(front);
      const wire = new T.Group(); root.add(wire);
      const rings = []; for (let i = 0; i < 17; i++) { const l = new T.Line(ringGeo, lineMat); wire.add(l); rings.push(l); }
      const NL = 16, longs = []; for (let i = 0; i < NL; i++) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(NB * 3), 3)); const l = new T.Line(g, lineMat); l.frustumCulled = false; wire.add(l); longs.push(l); }
      const detail = new T.Group(); root.add(detail);
      const capRings = [0, 1, 2].map(() => { const l = new T.Line(ringGeo, seamMat); detail.add(l); return l; });
      const NH = 220, helixGeo = new T.BufferGeometry(); helixGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(NH * 3), 3)); const helix = new T.Line(helixGeo, seamMat); helix.frustumCulled = false; detail.add(helix);

      const smokeTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false);
      const puffs = []; for (let i = 0; i < 46; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xcfd3e5 })); s.userData = { life: Math.random(), speed: 0.25 + Math.random() * 0.35, drift: (Math.random() - 0.5) * 0.8, ph: Math.random() * 6 }; scene.add(s); puffs.push(s); }
      const draws = []; for (let i = 0; i < 20; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xeef7f7 })); s.userData = { life: Math.random(), speed: 0.7 + Math.random() * 0.5 }; scene.add(s); draws.push(s); }

      // tobacco plant behind the cigar (strength step): Ligero top · Seco middle · Volado bottom
      const plant = new T.Group(); plant.position.set(-1.2, -0.1, -3); plant.scale.setScalar(0.85); plant.visible = false; scene.add(plant);
      const PT = [['Full', [2.3, 2.75], 1.25, 0.32], ['Medium', [0.85, 1.4], 1.95, 0.5], ['Mild', [-0.75, -0.2], 2.6, 0.66]];
      const stalkM = new T.LineBasicMaterial({ color: 0x5fd3cf, transparent: true, opacity: 0 });
      plant.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, -1.9, 0), new T.Vector3(0, 3.5, 0)]), stalkM));
      const labels = new T.Group(); scene.add(labels);
      const tiers = PT.map(([key, ys, l, w], ti) => { const fillM = new T.MeshBasicMaterial({ color: 0x5fd3cf, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }), edgeM = new T.LineBasicMaterial({ color: 0x5fd3cf, transparent: true, opacity: 0 });
        let n = 0; ys.forEach(y => [0, 1].forEach(sd => { const N = 24, top = [], bot = [], rib = [], P = [];
          for (let i = 0; i <= N; i++) { const u = i / N, hw = w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75) * (1 - 0.35 * u), x = u * l, yy = u * l * (0.55 - ti * 0.18) - u * u * l * 0.45;
            top.push(new T.Vector3(x, yy, hw)); bot.push(new T.Vector3(x, yy, -hw)); rib.push(new T.Vector3(x, yy + 0.01, 0)); P.push(x, yy, hw, x, yy, -hw); }
          const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); const ix = []; for (let i = 0; i < N; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(ix);
          const leafG = new T.Group(); leafG.add(new T.Mesh(g, fillM)); leafG.add(new T.Line(new T.BufferGeometry().setFromPoints(top.concat(bot.slice().reverse())), edgeM)); leafG.add(new T.Line(new T.BufferGeometry().setFromPoints(rib), edgeM));
          leafG.position.y = y; leafG.rotation.y = (n++ * 2.4 + ti * 0.9) + sd * Math.PI; plant.add(leafG); }));
        const lc = document.createElement('canvas'); lc.width = 512; lc.height = 128; const lx = lc.getContext('2d'), name = ['LIGERO', 'SECO', 'VOLADO'][ti], sub = ['Top · full', 'Middle · medium', 'Bottom · mild'][ti];
        const drawL = col => { lx.clearRect(0, 0, 512, 128); lx.textBaseline = 'middle'; lx.shadowColor = col; lx.shadowBlur = 14; lx.fillStyle = col; lx.font = '500 50px Inter, sans-serif'; lx.fillText(name, 8, 40); lx.shadowBlur = 0; lx.fillStyle = '#e4e8f0'; lx.font = '500 40px Inter, sans-serif'; lx.fillText(sub, 8, 96); lt.needsUpdate = true; };
        const lt = new T.CanvasTexture(lc); lt.colorSpace = T.SRGBColorSpace; const lm = new T.SpriteMaterial({ map: lt, transparent: true, opacity: 0, depthWrite: false, depthTest: false }), lab = new T.Sprite(lm); lab.scale.set(4.2, 1.05, 1); lab.center.set(0, 0.5); lab.position.set(0, (ys[0] + ys[1]) / 2 + 0.2, 0); labels.add(lab); drawL('#bdf3f0');
        return { key, fillM, edgeM, lm, drawL, lit: false }; });
      const NLN = 14, NPT = 30, flow = []; for (let i = 0; i < NLN; i++) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(NPT * 3), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(NPT * 3), 3)); const l = new T.Points(g, new T.PointsMaterial({ size: 7 * Math.min(devicePixelRatio, 2), sizeAttenuation: false, map: smokeTex, vertexColors: true, transparent: true, blending: T.NormalBlending, depthWrite: false })); l.frustumCulled = false; l.visible = false; scene.add(l); flow.push(l); /* normal blending keeps the key's colours (RAY, 24 Nov) */ }
      // Thirds as dimension lines on the model (RAY, 24 Nov): foot to head, the current third lit.
      const dimG = new T.Group(); dimG.visible = false; scene.add(dimG);
      const dimLine = op => { const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: 0x5fd3cf, transparent: true, opacity: op, depthTest: false, depthWrite: false })); l.renderOrder = 5; dimG.add(l); return l; };
      const dimSeg = [0, 1, 2].map(() => dimLine(0.3)), dimTick = [0, 1, 2, 3].map(() => dimLine(0.6));
      const dimLab = ['FIRST THIRD', 'MIDDLE', 'LAST THIRD'].map(tx => { const tex = canvasTex(512, 96, (g, w, h) => { g.font = '600 40px Inter, Arial, sans-serif'; g.fillStyle = '#bdf3f0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(tx, w / 2, h / 2); });
        const sp2 = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false })); sp2.scale.set(2.6, 0.49, 1);   /* bigger thirds labels (RAY, 24 Nov) */ sp2.renderOrder = 6; dimG.add(sp2); return sp2; });
      const dA = new T.Vector3(), dB = new T.Vector3(), dN = new T.Vector3();
      const HC = [[0.25, 0.88, 0.5], [1, 0.85, 0.29], [1, 0.03, 0.05]]; let volNow = 3, angNow = 0.75, stageNow = -1, sp = {};
      const cur = Object.assign({ mix: 0, plant: 0, peel: 0, burn: 0, len: 5.6, r: 0.36, band: 0, bandW: 0.5, ember: 0, smoke: 0, wire: 1, tilt: 0.12, draw: 0, focus: 0.12 }, Z, SH.Parejo);
      const tgt = Object.assign({}, cur);
      let baseTilt = 0.45, vert = false, mixT = new T.Vector3(0.33, 0.34, 0.33), profileOn = false, footX = 2.8, clipX = 1e3, burnDur = 4, burnT0 = 0, burnWas = false, burnShape = null, bpCur = 0, heatK = 0.6, kick = 0, spinOn = true, smokeOn = true, lastKey = '';
      const apply = () => {
        const s = window.__cigarSpec || {}; sp = s;
        Object.assign(tgt, Z, SH[s.shape] || SH.Parejo);
        tgt.draw = s.draw ? 1 : 0; tgt.focus = s.focus || 0.12; tgt.len = s.len || 5.6; tgt.r = (s.ring || 46) / 128;
        const b = BANDS[s.budget]; tgt.band = b ? 1 : 0;
        if (b) { tgt.bandW = b[2]; bandMat.map = bandTex[s.budget]; bandMat.metalness = b[3]; }
        let tone = leafTone(T, s.wrapper, s.strength); (s.flavour || []).forEach(f => { const c = FLAV_HUE[f]; if (c == null) return; tone = tone ? tone.lerp(new T.Color(c), 0.4) : new T.Color(c); }); leaf.userData.target = tone || new T.Color(0x1d2030); tgt.wire = tone ? 0 : Math.max(0.15, 1 - (s.progress || 0) * 0.85);
        tgt.smoke = SMOKE[s.strength || ''] || 0; tgt.ember = tgt.smoke ? 0.6 + tgt.smoke * 1.6 : 0;
        vert = !!s.vertical; tgt.tilt = vert ? Math.PI / 2 : baseTilt; tgt.mix = vert ? 1 : 0; { const m = MIX[s.plant] || [0.33, 0.34, 0.33]; mixT.set(m[0], m[1], m[2]); }
        tgt.plant = s.plant != null ? 1 : 0; tgt.peel = s.unwrap || vert ? 1 : 0; tgt.burn = s.burn ? 1 : 0; if (s.burn) { if (!burnWas || s.burn !== burnDur || (s.burnKey !== undefined ? s.burnKey : s.shape) !== burnShape) burnT0 = performance.now(); burnShape = s.burnKey !== undefined ? s.burnKey : s.shape;   // a new shape starts burning again from the foot (RAY, 24 Nov)
        burnDur = s.burn; tgt.smoke = Math.max(tgt.smoke, 0.6); } burnWas = !!s.burn;
        profileOn = !!s.profile; spinOn = s.spin !== false && !profileOn; smokeOn = s.smoke !== false;
        const k = [s.shape, s.len, s.ring, s.budget, s.wrapper, s.strength, (s.flavour || []).join('+')].join('|'); if (!s.preview) { if (lastKey && k !== lastKey && !still && !profileOn) kick = 5.5; lastKey = k; }
      };
      this._onSpec = apply; window.addEventListener('cigar-spec', apply); apply();
      const ptr = { x: 0, y: 0 }; this._onPtr = e => { ptr.x = e.clientX / innerWidth - 0.5; ptr.y = e.clientY / innerHeight - 0.5; }; window.addEventListener('pointermove', this._onPtr);

      // radius profile at distance d (inches) from the head tip → [ry, rz]
      const headLen = () => Math.min(cur.hR * cur.r + cur.hIn + cur.hL * cur.len, cur.len * 0.86);
      const prof = d => {
        const L = cur.len, R = cur.r, h = headLen(), c = cur.tip * R * 0.5 * (1 - cur.flat * 0.75); let rr;
        if (d >= h) rr = 1;
        else if (d < c) { const s = d / c; rr = cur.tip * Math.sqrt(Math.max(0, 1 - (1 - s) * (1 - s))); }
        else { const s = (d - c) / Math.max(h - c, 1e-4), dome = Math.sqrt(Math.max(0, 1 - (1 - s) * (1 - s))); rr = cur.tip + (1 - cur.tip) * (dome * (1 - cur.k) + s * cur.k); }
        if (cur.footT > 0.001 && d > L - 1.2) { const q = (L - d) / 1.2, sm = q * q * (3 - 2 * q); rr *= 1 - cur.footT * 0.55 * (1 - sm); }
        const sp = d < h ? 1 - d / h : 0;
        return [rr * R * (1 - 0.1 * cur.flat * sp), rr * R * (1 - 0.9 * cur.flat * sp)];
      };
      const fill = (g, ds, mult, bandUV) => {
        const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array, n = ds.length, L = cur.len, pr = ds.map(prof);
        for (let i = 0; i < n; i++) { const ry = pr[i][0], rz = pr[i][1], i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, n - 1), dd = ds[i1] - ds[i0]; let sl = dd > 1e-5 ? (pr[i1][0] - pr[i0][0]) / dd : 0; sl = Math.max(-6, Math.min(6, sl));
          for (let j = 0; j <= M; j++) { const a = j / M * TAU, ca = Math.cos(a), sa = Math.sin(a), k = i * (M + 1) + j;
            P[k * 3] = -L / 2 + ds[i]; P[k * 3 + 1] = ca * ry * mult; P[k * 3 + 2] = sa * rz * mult;
            let ny = ca * rz, nz = sa * ry, m = Math.hypot(ny, nz); if (m < 1e-6) { ny = ca; nz = sa; m = 1; } ny /= m; nz /= m; const m2 = Math.hypot(sl, 1);
            N[k * 3] = -sl / m2; N[k * 3 + 1] = ny / m2; N[k * 3 + 2] = nz / m2;
            if (bandUV) { U[k * 2] = j / M; U[k * 2 + 1] = 1 - i / (n - 1); } else { U[k * 2] = j / M * 2; U[k * 2 + 1] = ds[i] * 0.45; } } }
        g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = g.attributes.uv.needsUpdate = true;
      };
      let sig = '';
      const rebuild = () => {
        const s = [cur.len, cur.r, cur.hR, cur.hIn, cur.hL, cur.tip, cur.k, cur.footT, cur.flat, cur.bandW].map(v => v.toFixed(3)).join(); if (s === sig) return; sig = s;
        const L = cur.len, h = headLen(), be = Math.max(h, L - 1.2), ds = [];
        for (let i = 0; i <= 26; i++) ds.push(h * Math.pow(i / 26, 1.7)); for (let i = 1; i <= 8; i++) ds.push(h + (be - h) * i / 8); for (let i = 1; i <= 12; i++) ds.push(be + (L - be) * i / 12);
        fill(body.geometry, ds, 1, false); fill(binder.geometry, ds, 0.972, false);
        const fr = prof(L); foot.scale.set(fr[1] * 0.99, fr[0] * 0.99, 1); foot.position.x = L / 2 + 0.002; ember.position.x = L / 2 + 0.25;
        const dB = Math.min(cur.hR * cur.r + cur.hIn + 0.3 + cur.hL * L * 0.4 + cur.bandW / 2, L - 0.7 - cur.bandW / 2), bd = []; for (let i = 0; i < 6; i++) bd.push(dB - cur.bandW / 2 + cur.bandW * i / 5);
        fill(band.geometry, bd, 1.014, true);
        rings.forEach((l, i) => { const d = 0.06 + (L - 0.06) * i / (rings.length - 1), p = prof(d); l.scale.set(1, p[0] * 1.02, p[1] * 1.02); l.position.x = -L / 2 + d; });
        const pr = ds.map(prof); longs.forEach((l, li) => { const a = li / NL * TAU, P = l.geometry.attributes.position.array; for (let i = 0; i < NB; i++) { P[i * 3] = -L / 2 + ds[i]; P[i * 3 + 1] = Math.cos(a) * pr[i][0] * 1.02; P[i * 3 + 2] = Math.sin(a) * pr[i][1] * 1.02; } l.geometry.attributes.position.needsUpdate = true; });
        capRings.forEach((l, i) => { const d = Math.max(h, 0.12) + 0.05 + i * 0.075, p = prof(d); l.scale.set(1, p[0] * 1.004, p[1] * 1.004); l.position.x = -L / 2 + d; });
        const HP = helixGeo.attributes.position.array, d0 = Math.max(h, 0.12) + 0.3; for (let i = 0; i < NH; i++) { const d = d0 + (L - d0) * i / (NH - 1), p = prof(d), a = d * 2.1; HP[i * 3] = -L / 2 + d; HP[i * 3 + 1] = Math.cos(a) * p[0] * 1.004; HP[i * 3 + 2] = Math.sin(a) * p[1] * 1.004; } helixGeo.attributes.position.needsUpdate = true;
      };

      let W = 0, H = 0, aspect = 1;
      const padEl = this.closest('[data-cigar-pad]'), pad = padEl ? +padEl.dataset.cigarPad || 0 : 0;
      const camFit = tl => { const L = 9.4, t = Math.tan(cam.fov * Math.PI / 360), hw = L / 2 * Math.abs(Math.cos(tl)) + 0.9, hh = L / 2 * Math.sin(tl) + 1.1; const m = cur.mix || 0; let d = Math.max(hh / t, hw / (t * aspect)); if (m > 0) { const dv = Math.max(3.6 / t, 4.4 / (t * aspect)); d = d * (1 - m) + dv * m; }   /* strength step: plant and cigar fill about 80% (RAY, 24 Nov) */
        cam.position.set(1.2 * m, 0.3, d); cam.lookAt(1.2 * m, 0.3, 0); };
      const fit = () => { const w = this.clientWidth, h = this.clientHeight; if (!w || !h || (w === W && h === H)) return; W = w; H = h; const gh = Math.max(h - pad, 40); aspect = w / gh; renderer.setSize(w, h, false); cam.aspect = aspect; cam.setViewOffset(w, gh, 0, -pad, w, h); cam.updateProjectionMatrix();
        baseTilt = aspect < 0.95 ? 0.95 : aspect < 1.5 ? 0.45 : 0.14; tgt.tilt = vert ? Math.PI / 2 : baseTilt; camFit(cur.tilt); };
      this._ro = new ResizeObserver(fit); this._ro.observe(this); fit();

      let spin = 0, last = performance.now(); const t0 = last;
      const tmp = new T.Vector3(), head = new T.Vector3(), hdir = new T.Vector3(), uV = new T.Vector3(), vV = new T.Vector3();
      const loop = () => { try { loop1(); } catch (e) { console.error('cigar-3d frame', e); } };
      const loop1 = () => {
        this._raf = requestAnimationFrame(loop); fit();
        const nowT = performance.now(), dt = Math.min((nowT - last) / 1000, 0.05), t = (nowT - t0) / 1000; last = nowT; const e = 1 - Math.exp(-dt * 5);
        for (const k in cur) cur[k] += (tgt[k] - cur[k]) * e;
        leaf.color.lerp(leaf.userData.target, e); camFit(cur.tilt); mixU.value.lerp(mixT, e); mixOn.value = cur.mix; plant.position.x = -1.2 * (1 - cur.mix) + 0.9 * cur.mix; /* strength step: plant sits further from the cigar (RAY, 24 Nov) */
        binder.visible = ribbon.visible = cur.peel > 0.01; peelU.value.x = cur.peel > 0.005 ? cur.len / 2 + 0.4 - cur.peel * (cur.len * (0.55 + 0.25 * cur.mix) + 0.4) : 1e3;
        if (ribbon.visible) { ribMat.color.copy(leaf.color); const X = peelU.value.x, p = peelU.value.y, P = ribGeo.attributes.position.array, cl = cur.peel;
          for (let i = 0; i <= RU; i++) { const u = i / RU, a = Math.PI + u * 2.4 * Math.PI, xc = X + (a / TAU) * p, lift = 1.015 + cl * 1.5 * Math.pow(u, 1.6), sway = still ? 0 : Math.sin(t * 1.3 + u * 3) * 0.04 * u;
            for (let k = 0; k < 2; k++) { const x = xc + (k ? 0.5 : -0.5) * p * (1 - 0.35 * u) + u * u * 0.5 * cl, d = Math.max(0, Math.min(cur.len, x + cur.len / 2)), pr = prof(d), o = (i * 2 + k) * 3;
              P[o] = x; P[o + 1] = Math.cos(a) * pr[0] * lift + sway; P[o + 2] = Math.sin(a) * pr[1] * lift; } }
          ribGeo.attributes.position.needsUpdate = true; ribGeo.computeVertexNormals(); }
        rebuild();
        const L = cur.len;
        if (cur.burn > 0.02) { const bp = still ? 0.5 : Math.min(((nowT - burnT0) / 1000 % (burnDur * (sp.lines ? BURN_SLOW / 2 : BURN_SLOW) + 2.5)) / (burnDur * (sp.lines ? BURN_SLOW / 2 : BURN_SLOW)), 1), smokeTo = Math.max(L - (Math.min(cur.hR * cur.r + cur.hIn + 0.3 + cur.hL * L * 0.4 + cur.bandW / 2, L - 0.7 - cur.bandW / 2) + cur.bandW / 2 + 0.15), L * 0.3), bl = Math.max(bp * smokeTo, 0.02), al2 = Math.min(0.6, bl), bd = []; bpCur = bp; for (let i = 0; i < 8; i++) bd.push(L - bl + al2 * i / 7); fill(ash.geometry, bd, 1.012, true); const fp = prof(L - bl); front.scale.set(1, fp[0] * 1.02, fp[1] * 1.02); front.position.x = L / 2 - bl; footX = L / 2 - bl + al2; clipX = L / 2 - bl + 0.01; } else { footX = L / 2; clipX = 1e3; }
        foot.position.x = footX + 0.002; ember.position.x = footX + 0.25; { const fq = prof(Math.min(L, footX + L / 2)); foot.scale.set(fq[1] * 0.99, fq[0] * 0.99, 1); }
        ash.visible = front.visible = cur.burn > 0.02; { const bq = bpCur, dR = sp.drawR || [4, 3], hR = sp.heatR || [2, 4], sm = (a, b, x) => { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); }; let vol = dR[0] + (dR[1] - dR[0]) * bq, heat = hR[0] + (hR[1] - hR[0]) * bq;
          let ang = 0.8 - 0.15 * sm(0.6, 1, bq);
          if (sp.shape === 'Belicoso') { vol -= 0.5; ang = 0.6 - 0.15 * bq; heat += 0.3 * bq; } else if (sp.shape === 'Torpedo') { vol -= 1; ang = 0.42 - 0.14 * bq; heat += 0.6 * bq; } else if (sp.shape === 'Chisel') { vol -= 1.4; ang = 0.28; heat -= 0.3; } else if (sp.shape === 'Pyramid') { vol += 1.2 - 2.6 * bq; ang = 1.05 - 0.78 * bq; heat += bq; } else if (sp.shape === 'Perfecto') { vol *= (0.25 + 0.75 * sm(0, 0.3, bq)) * (1 - 0.5 * sm(0.65, 1, bq)); vol += 0.8 * sm(0, 0.3, bq) * (1 - sm(0.65, 1, bq)); ang = 0.2 + 0.9 * sm(0, 0.3, bq) - 0.6 * sm(0.65, 1, bq); heat += 0.8 * (1 - sm(0, 0.3, bq)) + 0.6 * sm(0.65, 1, bq); }
          angNow = Math.max(0.08, ang); { const st = cur.burn > 0.5 && sp.lines ? (bq < 0.34 ? 0 : bq < 0.67 ? 1 : 2) : -1; if (st !== stageNow) { stageNow = st; window.dispatchEvent(new CustomEvent('cigar-stage', { detail: st })); } }
          volNow = Math.max(0.6, Math.min(5, vol)); heatK = (Math.max(1, Math.min(5, heat)) - 1) / 4; }
        const hb = cur.burn * heatK; frontMat.color.setRGB(1, 0.48 + 0.45 * hb, 0.16 + 0.5 * hb); footMat.emissive.setRGB(1, 0.35 + 0.45 * hb, 0.1 + 0.45 * hb); ashMat.opacity = cur.burn; frontMat.opacity = cur.burn * (0.75 + Math.sin(t * 9) * 0.25);
        bandMat.opacity = cur.band; band.visible = cur.band > 0.02;
        lineMat.opacity = cur.wire * (0.85 + Math.sin(t * 2.1) * 0.05);   /* surface lines more opaque (RAY, 24 Nov) */ wire.visible = cur.wire > 0.03;
        seamMat.opacity = (1 - cur.wire) * 0.42 * (1 - cur.peel); detail.visible = cur.wire < 0.97;
        const fl = still ? 1 : 0.85 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13.3) * 0.07;
        const ph = (t % 2.6) / 2.6, pull = still ? cur.draw * 0.6 : cur.draw * (ph < 0.45 ? Math.sin(ph / 0.45 * Math.PI) : 0), em = Math.max(cur.ember * fl, pull * 2.4, cur.burn * (1 + heatK * 2.6) * fl);
        footMat.emissiveIntensity = em; ember.intensity = em * 0.9;
        kick *= Math.exp(-dt * 2.6);
        if (profileOn) { kick = 0; const tg = Math.round((spin - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2; spin += (tg - spin) * (1 - Math.exp(-dt * 4)); } else if (!still) spin += dt * ((spinOn ? 0.35 : 0) + kick);
        root.rotation.set(0, 0, 0); root.rotateZ(cur.tilt + (still ? 0 : Math.sin(t * 0.6) * 0.02)); root.rotateX(spin);
        const pk = profileOn ? 0.15 : 1; root.rotation.y += ptr.x * 0.5 * pk; root.rotation.x += ptr.y * 0.25 * pk;
        root.position.y = 0.3 + (still ? 0 : Math.sin(t * 0.9) * 0.08); root.position.x = -1.9 * cur.mix;
        root.updateMatrixWorld(); clip.normal.set(-1, 0, 0); clip.constant = clipX; clip.applyMatrix4(root.matrixWorld); tmp.set(footX + 0.05, 0, 0).applyMatrix4(root.matrixWorld);
        puffs.forEach((s, i) => { const u = s.userData; u.life += dt * u.speed * (still ? 0 : 1); if (u.life > 1) { u.life = 0; u.on = smokeOn && i / puffs.length < cur.smoke; u.ox = tmp.x; u.oy = tmp.y; u.oz = tmp.z; }
          const p = u.life; s.position.set((u.ox || 0) + u.drift * p * p * 2 + Math.sin(u.ph + p * 5) * 0.12, (u.oy || 0) + p * 3.4, (u.oz || 0)); const sz = 0.3 + p * 1.7; s.scale.set(sz, sz, 1); s.material.opacity = u.on ? Math.sin(p * Math.PI) * 0.34 : 0; });
        head.set(-L / 2 - 0.05, 0, 0).applyMatrix4(root.matrixWorld); hdir.set(-1, 0, 0).transformDirection(root.matrixWorld);
        { const on = cur.burn > 0.5 && !!sp.lines; dimG.visible = on;
          if (on) { dA.set(-cur.len / 2, 0, 0).applyMatrix4(root.matrixWorld); dB.set(cur.len / 2, 0, 0).applyMatrix4(root.matrixWorld);
            dN.set(dB.y - dA.y, -(dB.x - dA.x), 0).normalize(); if (dN.y > 0) dN.negate(); const off = cur.r * 1.2 + 0.35;
            const P = k => dB.clone().lerp(dA, k).addScaledVector(dN, off);   // k = 0 at the foot, 1 at the head
            dimSeg.forEach((l, i) => { l.geometry.setFromPoints([P(i / 3), P((i + 1) / 3)]); l.material.opacity = i === stageNow ? 1 : 0.3; });
            dimTick.forEach((l, i) => { const q = P(i / 3); l.geometry.setFromPoints([q.clone().addScaledVector(dN, -0.12), q.clone().addScaledVector(dN, 0.12)]); });
            dimLab.forEach((sp2, i) => { sp2.position.copy(P((i + 0.5) / 3)).addScaledVector(dN, 0.42); sp2.material.opacity = i === stageNow ? 1 : 0.45; }); } }
        draws.forEach(s => { const u = s.userData; u.life += dt * u.speed * (still ? 0 : 1); if (u.life > 1) { u.life = 0; u.on = cur.draw > 0.05 && ph < 0.5; u.sx = Math.random() - 0.5; u.sy = Math.random() - 0.5; u.f = cur.focus; }
          const p = u.life, f = u.f || 0, sp = (1 - f) * 1.3 + 0.08; s.position.set(head.x + hdir.x * p * 2.2 + (u.sx || 0) * sp * p, head.y + hdir.y * p * 2.2 + (u.sy || 0) * sp * p + p * p * 0.5, head.z + hdir.z * p * 2.2); const sz = 0.12 + p * (0.35 + (1 - f) * 0.9); s.scale.set(sz, sz, 1); s.material.opacity = u.on ? Math.sin(p * Math.PI) * (0.3 + f * 0.35) : 0; });
        if (cur.burn > 0.02 && sp.lines) { uV.set(hdir.y, -hdir.x, 0); if (uV.lengthSq() < 1e-6) uV.set(0, 1, 0); uV.normalize(); vV.crossVectors(hdir, uV); const ts = still ? 0 : t;
          const spread = 0.1 + 1.45 * angNow, nl = Math.max(1, Math.pow(Math.max(0, (volNow - 0.6) / 4.4), 1.6) * NLN), hk = Math.max(0, Math.min(1, (heatK - 0.12) / 0.64)), c0 = hk < 0.5 ? HC[0] : HC[1], c1 = hk < 0.5 ? HC[1] : HC[2], kk = hk < 0.5 ? hk * 2 : (hk - 0.5) * 2, cr = c0[0] + (c1[0] - c0[0]) * kk, cg = c0[1] + (c1[1] - c0[1]) * kk, cb = c0[2] + (c1[2] - c0[2]) * kk;
          flow.forEach((l, i) => { const al = Math.max(0, Math.min(1, nl - i)) * cur.burn; l.visible = al > 0.01; if (!l.visible) return; const P = l.geometry.attributes.position.array, C = l.geometry.attributes.color.array, a = i / NLN * TAU + 0.4, rad = i === 0 ? 0 : 0.45 + 0.55 * ((i * 5) % NLN) / NLN;
            for (let j = 0; j < NPT; j++) { const q = (j / NPT + ts * 0.2 + i * 0.37) % 1, off = spread * rad * Math.pow(q, 1.2), w = 0.2 * Math.sin(q * 7 - ts * 1.5 + i * 1.3) * q * q, ca = Math.cos(a) * off + w, sa = Math.sin(a) * off;
              P[j * 3] = head.x + hdir.x * q * 1.8 + uV.x * ca + vV.x * sa; P[j * 3 + 1] = head.y + hdir.y * q * 1.8 + uV.y * ca + vV.y * sa + q * q * 0.8; P[j * 3 + 2] = head.z + hdir.z * q * 1.8 + uV.z * ca + vV.z * sa;
              const pq = (ts * (0.35 + angNow * 0.4) + i * 0.23) % 1, dq = Math.min(Math.abs(q - pq), 1 - Math.abs(q - pq)), hl = Math.exp(-dq * dq / 0.003) * al * 1.8, fd = Math.pow(Math.sin(Math.PI * q), 0.7) * al * 1.9; C[j * 3] = cr * fd + hl; C[j * 3 + 1] = cg * fd + hl; C[j * 3 + 2] = cb * fd + hl; }
            l.geometry.attributes.position.needsUpdate = l.geometry.attributes.color.needsUpdate = true; });
        } else flow.forEach(l => { l.visible = false; });
        plant.visible = cur.plant > 0.01; if (plant.visible) { if (!still) plant.rotation.y += dt * 0.25; const pv = sp.plant || '', any = !pv || /^No /.test(pv), pc = new T.Color(0xe0157f), tc = new T.Color(0x5fd3cf);
          stalkM.opacity = 0.5 * cur.plant; tiers.forEach(tr => { const on = tr.key === pv, k = (on ? 1 : any ? 0.55 : 0.22) * cur.plant; tr.edgeM.color.lerp(on ? pc : tc, Math.min(1, dt * 8)); tr.fillM.color.copy(tr.edgeM.color); tr.edgeM.opacity = 0.9 * k; tr.fillM.opacity = 0.26 * k; tr.lm.opacity = Math.min(1, k * 1.6); if (tr.lit !== on) { tr.lit = on; tr.drawL(on ? '#ffc4e1' : '#bdf3f0'); } });
          labels.visible = true; labels.position.set(plant.position.x + (1.6 - 0.1 * cur.mix) * plant.scale.x, plant.position.y, plant.position.z); labels.scale.setScalar(plant.scale.x); } else labels.visible = false;
        renderer.render(scene, cam);
      };
      loop();
    }
  }
  customElements.define('cigar-3d', Cigar3D);
})();
