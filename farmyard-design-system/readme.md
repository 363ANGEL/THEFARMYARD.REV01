# The Farmyard — design system

The Farmyard is a members-only online clubhouse, **the Barn**, for a small crew: poker nights, a football token league, an arcade, movie night, a jukebox and a Discord voice channel, hosted by **Hank**, a cocky boar in overalls with a pitchfork. The look is a basement dive bar at night: neon pink and teal tubes on a blue-grey ground.

Farmyard is a brand layer on **Nocturne** (Inter, compact 2.8px spacing scale, 8px radii, outlined buttons, fading rules). Farmyard overrides Nocturne's accent with neon pink, adds the neon and glow system, the characters and the Barn components. Both layers' tokens live here.

**Products:** one — the Barn web app (Landing / holding page, Dashboard, rooms such as the Poker Room). No marketing site or mobile app in the hand-off.

**Sources (read-only, attached codebase):** `P14.001 FARMYARD DESIGN.SYSTEM REV.01/project/` — `README.md` (brand book), `Style sheet.md`, `Neon references.md`, `tokens.json`, `design-system.json`, `components/bundle.css` + `bundle.js` + `index.d.ts` (14 React components, "The Farmyard REV C02", namespace `Farmyard`), 32 `components/*/preview.html` foundation and component pages, `fonts/Inter-*.woff2`, `assets/Sounds/`. The Characters and Neon refs asset groups were listed in `design-system.json` but their image files were **not** in the mount (see Caveats). Originals of `bundle.css` and `tokens.json` are kept in `source/`.

## Content fundamentals

- **Voice:** dry, pub-mate, a little cocky — Hank's voice. Short declaratives. "Members only. Hank checks the door." "You bring the boys." "Who you are in the yard is up to you." "Record tonight's winner first, or the points go nowhere."
- **Person:** "you" for the member; Hank in the third person ("Pinned by Hank", "Hosted by Hank"). Never "we".
- **Vocabulary:** the yard, the Barn, rooms, regulars, beans (poker chips), tokens, buy-ins, the Humidor. Rooms are places, not features.
- **Casing:** sentence case for headings, buttons and body ("Open a table", "Leave the yard", "Keep playing"). ALL CAPS plus letter-spacing only for lit signage: NeonButton labels (START, CLOSE, TAKE THE SEAT, DEAL ME IN), `.lot-label`, voice states (LIVE, MUTED, OFF AIR), `.kicker`, league headers, teal links.
- **Punctuation:** middle dot `·` joins facts ("Hold'em · 4 of 8 seats", "Fri 9pm · Lounge voice"). Arrow `→` on onward links. Full stop on the brand: "The Farmyard."
- **Numbers:** tabular figures; British money (£, en-GB); 12-hour times ("Fri 9pm"); money up/down coloured green/red.
- **Emoji:** none. Chess glyphs ♛ ♝ are the silver and bronze medals; suits ♠ ♥ ♣ on cards.

## Visual foundations

- **Ground:** `--fy-bg` #161826 with two radial hazes — `--haze-pink` top-right (900×600 at 80% 10%), `--haze-teal` bottom-left (700×500 at 0% 100%). No photos, no textures, no repeating patterns, no gradients beyond the hazes. `--fy-surface` #232532 for Nocturne cards and dialogs. No pure black or white anywhere.
- **Colour roles:** pink is the voice (headlines, prices, the one main action, Hank's glow). Teal is the furniture (frames, rules, focus, icons, face marks). Green is LIVE and START. Red (exit-sign, never orange) is CLOSE and OFF AIR. Amber only on the seat card. Turquoise (`--hint-border`, `--hint-text`) for hints and popovers.
- **Neon anatomy:** every lit colour has three parts — a glow (`--neon-pink`, used only in `glow-*`/`text-glow-*` shadows), a tube (`--neon-*-tube`, a 2px border) and lettering (`--neon-*-text`). No white core layer. Neon is a line, text or glow, never a fill. Teal frames, pink content inside.
- **Pink text is always `--neon-pink-text`** (#ffc4e1). `--neon-pink` reads 3.8:1 and is glow only. #ff3fa4 is retired.
- **Type:** Inter for everything, headings at 500 and never bolder; hierarchy by size — hero 56 / page-title 28 / brand 20 / card-title 17 / body 15 / ui 14 / small 13 / meta 12 / kicker 11. Caps + tracking for signage only. Yellowtail (script) and Special Elite (typewriter) are optional accent faces, display sizes only, unused in shipped pages.
- **Spacing:** Nocturne scale 2.8 / 5.6 / 8.4 / 11.2 / 16.8 / 22.4. Layout: 232px sidebar in a teal-framed app shell (`.fy-frame`, radius 12); content padding 18×22; grids `auto-fill minmax(180–200px,1fr)` with 10px gaps; paper cards ≤440px, tilted ±1.5°.
- **Radii by role:** row 6 · voice 8 · module 10 · popover 12 · tube 14 · pill 19 · 50% rings.
- **Borders:** 1px teal for frames (`.neon-box`, `.card`); 2px tube for lit modules and buttons; 1.5px for face-mark rings and stepper buttons; dashed teal for empty seats and the paper header rule.
- **Rules:** `.rule-teal` and Nocturne `.hr` fade over 48px at each end; row rules in `--rule-teal` (teal at 35%).
- **Shadows:** elevation is glow, not drop shadow — levels 0 unlit → 1 hint → 2 lit line → 3 tube → 4 hover/hero. Exceptions: the paper card's `drop-shadow(0 12px 14px rgba(0,0,0,.55))`, the ambient layer in `--popover-glow` and under the modal (`--shadow-lg`). One glowing pink element per view at level 3+.
- **Cards:** teal 1px frame, radius 10, `--glow-teal` plus a faint inner glow, surface fill; 12px padding. The paper card is the one textured surface (torn edge clip-path, fold, crease, pink pin).
- **Hover:** glow brightens and widens (neon buttons); nav rows take a teal edge and an 8% teal wash; teal links lighten to `--hint-text`; Nocturne buttons take a 12% tint. **Press:** deeper tint (18–22%). **Focus:** 2px `--color-accent` ring, 2px offset. **Disabled:** unlit glass (`.neon-btn-off`) — tube visible at ~40%, no glow, no fill; Nocturne `.btn` at 45% opacity.
- **Transparency and blur:** the popover only (`--popover-bg` 92% glass, `blur(3px)`, ice-white 2px edge).
- **Imagery:** no photography. Character art is sticker-finish cel shading with a heavy ink outline inside a 900px disc with a 12px pink ring and a soft bloom; palette `--art-*` only; face marks are a teal hairline trace. Full-colour art never below 96px.
- **Motion:** a steady hum and a rare flicker. `steps(1,end)` for electrical buzz (`buzz`, `buzzSlow`, `neonBuzz`, `neonDead`, `boxFlicker`); `ease-in-out` for breath (`charBreath`/`hankBreath` 6s, `btnPulse`, `neonBreath`, `boxBreathe`); `ease-out` for arrivals (`payDrop` .25s, `popIn` .5s). Flicker one letter or one small part per view. `prefers-reduced-motion` stops everything.

### Contrast on `--fy-bg` (4.5:1 minimum for text)

fy-text 14.5 · fy-text-secondary 11.8 · fy-text-label 8.8 · neon-pink-text 11.9 · neon-pink-link 8.3 · neon-pink-hover 10.7 · neon-green-text 13.7 · neon-red-text 8.7 · neon-teal 9.8 · hint-text 14.8. Glow only: neon-pink 3.8, neon-red 2.2. Border/icon only: neon-red-tube 4.0.

## Iconography

- **Phosphor icons**, regular weight, in `--neon-teal` or the lettering colour beside them, with a 6px text glow (`i.ph`). Fill weight only for the gold crown medal; light weight for the two lock glyphs.
- `base/components.css` inlines the sixteen Phosphor glyphs the components use as CSS masks (`.ph.ph-club`, `.ph-fill.ph-crown-simple`, `.ph-light.ph-lock-simple`, `ph-squares-four`, `ph-soccer-ball`, `ph-calendar-blank`, `ph-discord-logo`, `ph-speaker-high`, `ph-speaker-slash`, `ph-plus`, `ph-minus`, `ph-question`, `ph-crown`, `ph-lock-simple-open`…) so no icon font is needed. A page needing more loads `@phosphor-icons/web` from CDN; class names match.
- No emoji. Unicode glyphs as icons only where listed: ♛ ♝ medals, ♠ ♥ ♣ suits, − + on steppers, · and → in copy.
- **Logo:** Hank (`hank-oink.png`) is the host and the logo; no wordmark file exists — the brand is set in Inter 500 ("The Farmyard"). The character PNGs were not in the hand-off, so nothing here draws Hank; the Avatar falls back to the teal open-slot ring.
- **Sound:** two chicken clucks (`assets/sounds/`) on − / + buttons only, after a click, via `fy-clucks.js`.

## Characters

Hank (host, logo) and The Chick are drawn; five roster slots (hen, cock, sheep, goat, cow) are open. Cuts: `--char-hero` 531 (breathing) · `--char-card` 175 (breathing) · `--char-host` 96 (smallest full-colour) · `--char-list` 75 and `--char-avatar` 48 use the face mark inside a 1.5px teal ring. Expected files in `assets/characters/`: hank-oink.png, hank-neon.png, hank-mark.png, hank-mark-min2.png, hank-face-mark.png, lot-yfronts.webp.

## Do / Don't

Do: use the tokens; teal frames, pink content; one lit pink element per view; unlit glass for disabled; load `fy-clucks.js` on pages with steppers.
Don't: use `--neon-pink` or any glow colour for text; use #ff3fa4; fill anything with neon or add a white core; show full-colour art below 96px; flicker whole words or fast; use orange for red states or green/red as decoration; bold headings past 500.

## Index

- `styles.css` — entry; imports `tokens/fonts.css`, `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/shadows.css`, `base/components.css` (all Nocturne + Farmyard classes and keyframes).
- `assets/fonts/` Inter woff2 · `assets/sounds/` clucks + `fy-clucks.js` · `assets/characters/` (empty — awaiting art).
- `guidelines/` — 26 specimen cards: Colors (pink, teal, state, ground, hazes, art, medals, contrast), Type (display, text, signage, accent, numbers), Spacing (scale, radii, borders, glow levels, neon frames, motion, states), Brand (cover, voice, roster, icons).
- `source/` — the hand-off's `bundle.css` and `tokens.json`, untouched.
- `ui_kits/barn/` — The Barn app: Landing, Dashboard, Poker Room (`index.html`, `Shell.jsx`, `Landing.jsx`, `Dashboard.jsx`, `PokerRoom.jsx`).
- `SKILL.md` — agent skill wrapper.

## Components

The inventory is the source's 14 families, grouped by concern under `components/`:

- **actions/** — `NeonButton` (pink/green/red · pill/rect/block · off), `Button` (primary/ghost/secondary, Phosphor icon)
- **inputs/** — `Stepper`
- **surfaces/** — `Card` (neon/pink/tube/tube-teal/paper)
- **badges/** — `Chip` (pink/teal/outline), `Medal` (1–3)
- **identity/** — `Avatar` (full art ≥96, face mark ≤75, open-slot fallback)
- **data/** — `LeagueTable`
- **overlays/** — `Modal`, `Popover`, `Hint`
- **navigation/** — `NavItem`, `VoiceButton`, `PageHeader`

Also exported: `ROSTER` (character file map, from `identity/Avatar.jsx`).

### Intentional additions
None beyond the source. The Avatar's image-error fallback (open-slot ring) is new behaviour, added because the character files are absent.

## Caveats

- **Character art missing:** `design-system.json` lists six character files and 62 neon reference images as blobs, but the mounted folder only held their READMEs. Nothing here recreates Hank; drop the PNGs into `assets/characters/` and the Avatar, sidebar brand and roster card light up.
- **Barn screens are reconstructions:** the original 1.0 Barn Dashboard and 2.1 Poker Room pages were "not synced" in the hand-off; the UI kit composes the documented components by the documented layout rules.
- Accent fonts Yellowtail and Special Elite are fetched from Google Fonts (as the source did); no local files.
