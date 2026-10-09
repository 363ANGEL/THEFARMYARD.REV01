# The Farmyard — style sheet

Files: `farmyard.css` (load after Nocturne `styles.css`; no body class needed), `Farmyard Colour Template.dc.html`, `Farmyard Characters.dc.html`.

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

## Neon treatment (approved Oct 2026, see `Z.SS Neon Style Test`)
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
