# Handoff: The Farmyard · Slice 1 (the spine)

## Overview
The Farmyard is a members-only clubhouse website, "the Barn". Slice 1 covers:
- Discord sign-in with a claim-link invite.
- The app shell and side menu.
- Online presence.
- Pages: Dashboard, Yard Wall, What's Next, Room Template holding pages, Profile (three views), Admin, the public Coming Soon page and About.

The full build spec is in **`HANDOFF-SLICE1.md`**: scope, auth, money rules, tables, profile views, admin, presence, RLS and launch acceptance. Read it first. Page numbering is in `PAGES.md` and phase order in `ROADMAP.md`.

## About the design files
The files in `design/` are **design references built in HTML**. They are prototypes that show the intended look and behaviour, not production code. Recreate them in the target stack: GitHub Pages frontend plus Supabase, per ROADMAP. Each `.dc.html` opens in a browser: serve the `design/` folder locally (for example `npx serve design`) and open a page. They pull the Farmyard design system from `_ds/…`, which is **not** in this bundle, so styles that come from it will be missing locally. Use the Farmyard design system package for tokens and components.

## Fidelity
**High fidelity.** Colours, type, spacing, glow, radii and copy are final. Match them using the Farmyard design system tokens (`--neon-*`, `--fy-*`, `--fs-*`, `--ic-*`) and `farmyard.css`. `farmyard.css` is the local layer on top of the design system.

## Screens
| File | Screen | Notes |
|---|---|---|
| 0.0 Coming Soon | Public holding page | Live at the-farmyard.com. Also embedded in holding rooms |
| 0.1 Invite Door | Claim link + Discord sign-in | |
| 0.2 New User Set-up | Yard name, icon, birthday, links | |
| 0.3 About | Public About | Layout only. Copy is written during the build |
| 1.0 Barn Dashboard | Home | Wall widget, IOUs, room modules, online strip. Avatars open profiles |
| 1.2 Yard Wall | Post feed | Text ≤280, one reaction, admin pin/delete |
| 1.4 What's Next | Upcoming rooms | Cards → 2.0 holding pages + suggestion box |
| 2.0 Room Template | Holding room | `?room=` picks the copy |
| 3.0 Barn Profile | Profile, 3 views | Own (default) · Public `?user=Name` · Admin `?view=admin&user=Name` |
| 0.9 Admin Dashboard | Admin | Members, Poker dockets, League pools, tk & IOUs |

Each page's Tweaks props (`view`, `viewAs`, `device`) only switch the preview. They are not app settings.

## Interactions and state
These are covered in `HANDOFF-SLICE1.md` §§4–8. The key rules:
- **One currency:** tokens (tk).
- **Net ledgers:** IOUs net across all rooms.
- **Instant saves:** admin edits save immediately and are logged.
- **Pay:** opens the payee's revolut.me page.

The prototypes keep sample data in each page's script and in `localStorage` (`fy.*` keys). Replace all of it with Supabase queries.

## Design tokens
Use the Farmyard design system: neon pink `#e0157f` (glow only), pink text `#ffc4e1`, teal `#5fd3cf`, ground `#161826`, surface `#232532`. Type is Inter, with headings at weight 500. Radii: row 6, voice 8, module 10, popover 12. Elevation is glow, not drop shadow. Phone-only overrides live at the end of `farmyard.css` (`.fy-phone …`).

## Assets
- **Character images:** `assets/hank-oink.png`, `hank-oink-sm.png`, `lot-yfronts.webp`.
- **Icons:** Phosphor regular. Phosphor icons missing from the design system are added as masks in `farmyard.css`, from the official SVGs. Three are custom drawings: `ph-brandy` (whisky tumbler), `ph-strategy` (chess king) and `ph-thought-bubble`.
- **Sign:** the "Under construction" sign uses the design system's `.fy-sign` classes.

## Files
- `design/`: the slice 1 pages plus `farmyard.css`, `support.js` (prototype runtime only, don't ship), `sidebar-subs.js`, `fy-clucks.js`, `sounds.js`, `humidor-club.js` and `assets/`.
- `HANDOFF-SLICE1.md`, `PAGES.md`, `ROADMAP.md`.
