# The Farmyard — style sheet

Files: `farmyard.css` (load after Nocturne `styles.css`; no body class needed), `9.1 Farmyard Colour Template.dc.html`, `Farmyard Characters.dc.html`.

## Colour
- Neon pink — the voice: headlines, prices, actions, Hank's glow. Glow `#e0157f` · tube `#ff7fbf` · lettering `#ffc4e1`. Link `#ff8ccb`, hover `#ffb3dc`.
- Neon green — LIVE, START. Glow `#0a9e43` · tube `#3fe07f` · lettering `#9ff5bf`.
- Neon red (exit-sign, no orange) — CLOSE, OFF AIR. Glow `#a80016` · tube `#e8263a` · lettering `#ff9aa5`.
- Neon teal `#5fd3cf` — the furniture: borders, input focus, rules, icons, face marks.
- Ground `#161826` (Nocturne bg; also the character disc). Surface `#232532`.
- Hazes: pink `rgba(45,15,34,.85)` top-right, teal `rgba(27,74,74,.45)` bottom-left.
- Text: `#e9e9ed` headline/body · `#e4e7f5` paragraph · `#cfd3e5` secondary · `#b2b6ca` labels.
- Rules: neon is a line, text or glow — never a fill. Teal frames, pink content inside. One glowing pink element per view. No pure black/white.

Inspiration library: `NEON-REFS.md` (62 images in `assets/neon-refs/`).

## Neon treatment (approved Oct 2026, see `_ARCHIVE 2026-10-11/Z.SS Neon Style Test`)
- Every lit colour has three parts: glow (deep, saturated), tube (border), lettering (text). No white core layer: it washes the colour out.
- Modules: `.neon-tube` / `.neon-tube-teal`, 2px border, 14px radius, three outer glow layers + inner glow.
- Buttons: `.neon-btn` pill (110×38), `-green`, `-red`. Hover brightens and widens the glow; green START also buzzes.
- Current room / board / channel in the sidebar: pink tube border + pink lettering + `--glow-pink`, no fill (same as primary buttons). One per nav group.
- Green buttons (START etc.) default to the LIVE box look: 2px `--neon-green-tube` border, `--glow-green`, `--neon-green-text` with `--text-glow-green`.
- Tooltips and hints: turquoise (`--neon-teal` glow, `#9eeae6` border, `#c8f4f2` text).
- Disabled = unlit glass: `.neon-btn-off`. Tube visible, no light, no fill.
- Flicker: only one letter or small part, rarely (`.flicker-letter`, `.flicker-letter-slow`). The rest hums steadily.
- Wall spill `.wall-spill` optional, for hero elements. Tube breaks: dropped (not worth the markup).

## Character art
- 1024×1024 transparent PNG · disc 900px `#161826` · ring 12px `#ff3fa4` (art keeps its baked colour) · 20px outer bloom · one breakout ≤80px.
- Heavy ink outline, flat cel shade, sticker finish, three-quarter bust, cocky.
- Palette: pink `#ff2fa0`, cyan `#3fe0e0`, tiger-eye gold `#d98a12`, cream `#f1e9d2`, black ink. Gold or cream for the body.
- Sizes: hero 531 · card 175 (both breathe) · host 96 (static) · list 75 · avatar 48 (face mark: teal outline trace in a 1.5px teal CSS ring).


## Contrast fixes (13 Oct 2026, from P14 design system)
- `--neon-pink` (#e0157f) is glow-only. Pink TEXT always uses `--neon-pink-text` (#ffc4e1): ghost buttons, pink chips, `.lot-label`.
- Old #ff3fa4 retired; use tokens.
- Avatars 75px and below use the face mark (`face` on CHARACTERS), not full-colour art.

## Site layer, 13-14 Nov 2026 (RAY's review pass)
The working rules live in the site's own `farmyard.css` (repo root); this sheet says what they are for. Where a class is named, it exists there.

### IOU coin
- One mark for token standing. Artwork is RAY's own: `assets/iou.coin.pink.png` (neutral, also the standings watermark), `.green.png` (credit, IOUs won), `.red.png` (debit, IOUs lost), `.cyan.png` (headings). 1500×1500 RGBA with real transparency, so it sits on any background: no `mix-blend-mode`, no black-key trick. Never re-encode or flatten these.
- Text form: `.fy-iou` + `-up` (green) / `-down` (red) / `-flat` (grey); the signed figure beside the coin takes the same colour. Markup: `<span class="fy-iou fy-iou-up"><i class="ph ph-coins"></i>+10</span>`.
- Art form: `<img class="fy-coin-art" src="assets/iou.coin.red.png" alt="">`, 3.1em, so it scales with the text beside it. `.coinart` is the 2.2em, 80% opacity variant. Sizes in use: 3.1em in profile badges; 2.2em small rows.
- Colour rule: green = credit/won, red = debit/lost. Net takes green when positive, red when negative, pink and grey when square.

### Presence colours (the In the yard strip)
- In voice = green: text `--neon-green-text` + `--text-glow-green`, dot `--neon-green-tube` with a 6px glow, label "In Voice", and a LIVE tag in the same green. Online = amber: `--neon-amber-text` + `--text-glow-amber`, dot `--neon-amber-tube`. Away = grey, dimmed, no glow.
- `--text-glow-amber` is the one amber glow token; amber is therefore no longer "seat card only".

### Page head
- Every page opens with `.fy-pagehead`: an `<h2 class="t-title-b">` (pink lettering, pink text glow, mixed case: "Chat wall", "User profile") with a `.t-tagline` (cyan, one short dry sentence) under it. There is no `.t-pagehead` class.
- Card headings are pink too: `.t-module`; inside admin cards they step down to `--fs-sm` with .14em tracking so a card reads as a label, not a headline.

### Page header image: `.fy-banner`
- A full-bleed band across the top of the main panel, above `.fy-pagehead`. Negative margin `-18px -22px 0` cancels the panel's inline padding (`#main` is `18px 22px` at every width); height `clamp(96px,13vw,176px)`.
- Empty state: `<div class="fy-banner fy-banner-empty" role="img" aria-label="Page header image"><span>Page header image</span></div>`. A real picture goes in as `background-image`.
- For a leader the View as bar is the panel's first child; `#fy-viewbar + .fy-banner` drops the top bleed so the band starts just under it.
- `.fy-leagueimg` is the same picture cropped to 16:7 on a dashboard league card (one image per league, two places). Admin lists every page's image in a "Page headers" card (`.phdr`).

### Coming-soon tooltip: `.soon`
- Add `soon` to any control that is not built yet. Clicking focuses it and a pink-bordered "Coming soon" shows in its centre. CSS only (`:focus::after`), no script; never `disabled`, or it cannot take focus.

### Face ring: `.fy-face`
- `FY.faceRing(member, px, label)` returns `<span class="fy-face" style="--s:PXpx;--rw:…">` around the member's art. Order front to back: character (z 2), pink ring (z 1), glow disc (z 0). One ring only; the character may break out of it.
- Geometry is the art's baked ring: left 3.6%, top 10.4%, width 91%. Ring 1.5px at 48px and below, 2px above. Inside a table cell (`td .fy-face`) the glow is dialled right back.
- Sizes in use: 28 admin table · 36 wall composer · 39 wall posts and dashboard wall box · 44 sidebar member button · 47 In the yard strip · 56 admin member detail. Stock SVG avatars (`.plain`) are clipped to a circle inside the ring.

### Missing-glyph trap
- Only glyphs inlined as masks (`base/components.css`, and the site `farmyard.css`) draw. Anything else, including the whole `ph-fill` weight, `ph-coin`, heart, caret-up/down, upload and trophy, renders as a solid square with no error.
- Use `ph ph-coins`, and plain text for the rest: ♥ ♡ for likes (`.hrt`), ▲ ▼ – for movement. Before using any icon, find its `.ph-NAME` rule in the inlined set.
