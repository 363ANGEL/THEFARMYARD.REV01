/* @ds-bundle: {"format":4,"namespace":"FarmyardDesignSystem_f1e07c","components":[{"name":"Button","sourcePath":"components/actions/Button.jsx"},{"name":"NeonButton","sourcePath":"components/actions/NeonButton.jsx"},{"name":"Chip","sourcePath":"components/badges/Chip.jsx"},{"name":"Medal","sourcePath":"components/badges/Medal.jsx"},{"name":"LeagueTable","sourcePath":"components/data/LeagueTable.jsx"},{"name":"ROSTER","sourcePath":"components/identity/Avatar.jsx"},{"name":"Avatar","sourcePath":"components/identity/Avatar.jsx"},{"name":"Stepper","sourcePath":"components/inputs/Stepper.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"VoiceButton","sourcePath":"components/navigation/VoiceButton.jsx"},{"name":"Hint","sourcePath":"components/overlays/Hint.jsx"},{"name":"Modal","sourcePath":"components/overlays/Modal.jsx"},{"name":"Popover","sourcePath":"components/overlays/Popover.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"}],"sourceHashes":{"assets/sounds/fy-clucks.js":"6c06c95dc3d5","components/actions/Button.jsx":"1b037d1a50c3","components/actions/NeonButton.jsx":"7bb2d26f81d1","components/badges/Chip.jsx":"486af47537f3","components/badges/Medal.jsx":"f82c5be5ff9d","components/data/LeagueTable.jsx":"94f893b7d2c6","components/identity/Avatar.jsx":"5e4a6fec0dc0","components/inputs/Stepper.jsx":"52df1576ebbd","components/navigation/NavItem.jsx":"1793530555b3","components/navigation/PageHeader.jsx":"c3b6ff63e4de","components/navigation/VoiceButton.jsx":"eb6267fb1b84","components/overlays/Hint.jsx":"c24b433edc11","components/overlays/Modal.jsx":"fc12fd5c06d0","components/overlays/Popover.jsx":"6b40121d5ada","components/surfaces/Card.jsx":"6b2997d1853c","ui_kits/barn/Dashboard.jsx":"819c668fa3d9","ui_kits/barn/Landing.jsx":"44c61aa422b5","ui_kits/barn/PokerRoom.jsx":"c5adceee95dd","ui_kits/barn/Shell.jsx":"9a8c9b319e9e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FarmyardDesignSystem_f1e07c = window.FarmyardDesignSystem_f1e07c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/sounds/fy-clucks.js
try { (() => {
// Farmyard: site-wide chicken clucks on +/− buttons. Opt out with data-sfx="off" on the button (or an ancestor).
(function () {
  if (window.__fyClucks) return;
  window.__fyClucks = true;
  var base = document.currentScript && document.currentScript.src || location.href;
  var URLS = {
      up: new URL('cluck-happy.mp3', base).href,
      dn: new URL('cluck-sad.mp3', base).href
    },
    cache = {};
  function play(k) {
    var el = cache[k];
    if (!el) {
      el = cache[k] = new Audio(URLS[k]);
      el.preload = 'auto';
      el.volume = .7;
    }
    try {
      el.pause();
      el.currentTime = 0;
    } catch (e) {}
    var p = el.play();
    if (p && p.catch) p.catch(function () {});
  }
  function kind(b) {
    if (b.querySelector('.ph-plus, .ph-plus-circle')) return 'up';
    if (b.querySelector('.ph-minus, .ph-minus-circle')) return 'dn';
    var t = (b.textContent || '').trim();
    if (t === '+') return 'up';
    if (t === '−' || t === '-' || t === '–') return 'dn';
    var a = b.getAttribute('aria-label') || '';
    if (/(^|\s)(more|plus|increase)(\s|$)|Up$/i.test(a)) return 'up';
    if (/(^|\s)(less|fewer|minus|decrease)(\s|$)|Dn$/i.test(a)) return 'dn';
    return null;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.closest('[data-sfx="off"]')) return;
    var k = kind(b);
    if (k) play(k);
  }, true);
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/sounds/fy-clucks.js", error: String((e && e.message) || e) }); }

// components/actions/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Nocturne .btn with the Farmyard pink treatment. Sentence-case labels. primary = pink tube outline · ghost = pink line · secondary = teal neutral line. */
function Button({
  variant = 'primary',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: ['btn', 'btn-' + variant, className].filter(Boolean).join(' ')
  }, rest), icon ? /*#__PURE__*/React.createElement("i", {
    className: 'ph ' + icon,
    "aria-hidden": "true"
  }) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/Button.jsx", error: String((e && e.message) || e) }); }

// components/actions/NeonButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Lit neon pill button. pink = the voice (one lit pink per view) · green = LIVE/START · red = CLOSE/OFF AIR. off = unlit glass (disabled). */
function NeonButton({
  tone = 'pink',
  shape = 'pill',
  off = false,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}) {
  const cls = ['neon-btn', tone !== 'pink' && 'neon-btn-' + tone, shape === 'rect' && 'neon-btn-rect', shape === 'block' && 'neon-btn-block', off && 'neon-btn-off', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: off || disabled
  }, rest), children);
}
Object.assign(__ds_scope, { NeonButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/actions/NeonButton.jsx", error: String((e && e.message) || e) }); }

// components/badges/Chip.jsx
try { (() => {
/** Small label on the Nocturne .tag, Farmyard-lit. pink = .tag-accent (live counts) · teal = .tag-neutral (sources, headcount) · outline = .tag-outline. */
function Chip({
  tone = 'teal',
  icon,
  children
}) {
  const cls = {
    pink: 'tag tag-accent',
    teal: 'tag tag-neutral',
    outline: 'tag tag-outline'
  }[tone];
  return /*#__PURE__*/React.createElement("span", {
    className: cls,
    style: {
      whiteSpace: 'nowrap',
      gap: 5
    }
  }, icon ? /*#__PURE__*/React.createElement("i", {
    className: 'ph ' + icon,
    "aria-hidden": "true"
  }) : null, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/badges/Chip.jsx", error: String((e && e.message) || e) }); }

// components/badges/Medal.jsx
try { (() => {
const GLYPH = {
  2: '♛︎',
  3: '♝︎'
};
/** Leaderboard place marker: 1 = gold Phosphor crown, 2 = silver chess queen, 3 = bronze chess bishop. */
function Medal({
  place = 1,
  size = 17,
  flash = false
}) {
  if (place === 1) return /*#__PURE__*/React.createElement("i", {
    className: "ph-fill ph-crown-simple fy-medal-1",
    "aria-label": "First place",
    style: {
      fontSize: size,
      animation: flash ? 'crownFlash 1.6s ease-in-out infinite' : undefined
    }
  });
  return /*#__PURE__*/React.createElement("span", {
    role: "img",
    "aria-label": place === 2 ? 'Second place' : 'Third place',
    className: 'fy-medal-' + place,
    style: {
      fontSize: size
    }
  }, GLYPH[place]);
}
Object.assign(__ds_scope, { Medal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/badges/Medal.jsx", error: String((e && e.message) || e) }); }

// components/data/LeagueTable.jsx
try { (() => {
/** Poker League board: teal-ruled grid, glowing header, medals for the top three. */
function LeagueTable({
  columns = [],
  rows = [],
  medals = true
}) {
  return /*#__PURE__*/React.createElement("table", {
    className: "fy-league"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "pos"
  }, "Pos"), columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: c.key === 'name' ? 'left' : 'center'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "pos"
  }, i + 1), columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: c.key === 'name' ? 'player' : r[c.key + 'Tone'] || ''
  }, c.key === 'name' ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      display: 'grid',
      placeItems: 'center'
    }
  }, medals && i < 3 ? /*#__PURE__*/React.createElement(__ds_scope.Medal, {
    place: i + 1,
    flash: i === 0,
    size: 18
  }) : null), r.name) : r[c.key]))))));
}
Object.assign(__ds_scope, { LeagueTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/LeagueTable.jsx", error: String((e && e.message) || e) }); }

// components/identity/Avatar.jsx
try { (() => {
/** ring = baked ring position as % of the image: l/t from top-left, w = diameter as % of image width. aspect = width / height. */
const ROSTER = {
  hank: {
    name: 'Hank',
    img: 'characters/hank-oink.png',
    face: 'characters/hank-face-mark.png',
    aspect: 1199 / 1312,
    ring: {
      l: 3.58,
      t: 10.47,
      w: 91.44
    }
  },
  chick: {
    name: 'The Chick',
    img: 'characters/lot-yfronts.webp',
    aspect: 252 / 276,
    ring: {
      l: 1.47,
      t: 7.43,
      w: 95.72
    }
  }
};
/** Character avatar. ≤75px renders the teal face mark in a CSS ring (question mark if none); ≥96px renders full-colour art with the layered pink ring (glow behind, tube over the baked ring). */
function Avatar({
  character = 'hank',
  size = 48,
  src,
  face,
  name,
  assetBase = 'assets/',
  breathe,
  ring = true,
  ringGeom
}) {
  const c = ROSTER[character] || {};
  const label = name || c.name || 'Member';
  const art = src || c.img && assetBase + c.img;
  const mark = face || c.face && assetBase + c.face;
  const [broken, setBroken] = React.useState(false);
  const q = /*#__PURE__*/React.createElement("i", {
    className: "ph ph-question",
    style: {
      fontSize: size * .36,
      color: 'var(--fy-text-label)'
    }
  });
  if (size <= 75) return /*#__PURE__*/React.createElement("span", {
    className: "char-mark",
    role: "img",
    "aria-label": label,
    style: {
      width: size,
      height: size,
      overflow: 'hidden',
      flex: 'none'
    }
  }, mark && !broken ? /*#__PURE__*/React.createElement("img", {
    src: mark,
    alt: "",
    onError: () => setBroken(true)
  }) : q);
  const b = breathe == null ? size >= 175 : breathe;
  if (!art || broken) return /*#__PURE__*/React.createElement("span", {
    className: "char-mark",
    role: "img",
    "aria-label": label,
    style: {
      width: size,
      height: size,
      borderColor: 'var(--rule-teal)',
      boxShadow: 'none',
      flex: 'none'
    }
  }, q);
  const anim = b ? 'charBreath 6s ease-in-out infinite' : undefined;
  if (!ring) return /*#__PURE__*/React.createElement("img", {
    className: "char",
    src: art,
    alt: label,
    style: {
      width: size,
      height: 'auto',
      animation: anim
    },
    onError: () => setBroken(true)
  });
  const g = ringGeom || !src && c.ring || null;
  const pos = g ? {
    left: g.l + '%',
    top: g.t + '%',
    width: g.w + '%'
  } : {
    left: 0,
    top: 0,
    width: '100%'
  };
  return /*#__PURE__*/React.createElement("span", {
    className: 'char-ring' + (g ? '' : ' char-ring-plain'),
    role: "img",
    "aria-label": label,
    style: {
      width: size,
      animation: anim
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "char-ring-glow",
    style: pos
  }), /*#__PURE__*/React.createElement("img", {
    src: art,
    alt: "",
    onError: () => setBroken(true)
  }), /*#__PURE__*/React.createElement("span", {
    className: "char-ring-line",
    style: pos
  }));
}
Object.assign(__ds_scope, { ROSTER, Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/identity/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/inputs/Stepper.jsx
try { (() => {
/** Teal +/− number stepper (Poker Room buy-ins). Load assets/sounds/fy-clucks.js once per page for the clucks; sfx={false} opts out. */
function Stepper({
  value = 0,
  min = 0,
  max = 99,
  onChange,
  label = 'buy-ins',
  sfx = true
}) {
  const set = v => onChange && onChange(Math.max(min, Math.min(max, v)));
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-stepper",
    "data-sfx": sfx === false ? 'off' : undefined
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fy-stepper-btn",
    "aria-label": 'Less ' + label,
    disabled: value <= min,
    onClick: () => set(value - 1)
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    className: "fy-stepper-value",
    "aria-live": "polite"
  }, value), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fy-stepper-btn",
    "aria-label": 'More ' + label,
    disabled: value >= max,
    onClick: () => set(value + 1)
  }, "+"));
}
Object.assign(__ds_scope, { Stepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/inputs/Stepper.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
/** Sidebar room row. current = pink tube + lettering (one per nav group); hover = teal edge and 8% wash. */
function NavItem({
  icon,
  label,
  count,
  current = false,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fy-nav-item",
    "aria-current": current ? 'page' : undefined,
    onClick: onClick
  }, icon ? /*#__PURE__*/React.createElement("i", {
    className: 'ph ' + icon,
    "aria-hidden": "true"
  }) : null, /*#__PURE__*/React.createElement("span", null, label), count != null && count !== '' ? /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, count) : null);
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
/** Room header: 28px title, optional chip, spacer, actions on the right. */
function PageHeader({
  title,
  chip,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-page-head"
  }, /*#__PURE__*/React.createElement("h2", null, title), chip, /*#__PURE__*/React.createElement("div", {
    className: "spacer"
  }), actions);
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/VoiceButton.jsx
try { (() => {
/** Voice channel toggle: LIVE (green) or MUTED (red). Unlit until it is the member's channel. */
function VoiceButton({
  kind = 'live',
  on = false,
  sub,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: 'fy-voice fy-voice-' + kind + (on ? ' is-on' : ''),
    onClick: onClick
  }, /*#__PURE__*/React.createElement("i", {
    className: 'ph ' + (kind === 'live' ? 'ph-speaker-high' : 'ph-speaker-slash'),
    style: {
      fontSize: 13,
      color: kind === 'live' ? 'var(--neon-green-text)' : 'var(--neon-red-text)'
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, kind === 'live' ? 'LIVE' : 'MUTED', sub ? /*#__PURE__*/React.createElement("small", null, sub) : null));
}
Object.assign(__ds_scope, { VoiceButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/VoiceButton.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Hint.jsx
try { (() => {
/** Turquoise hint / tooltip box; drops in with payDrop. */
function Hint({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-hint",
    role: "status",
    style: style
  }, children);
}
Object.assign(__ds_scope, { Hint });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Hint.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Modal.jsx
try { (() => {
/** Nocturne .dialog in the Farmyard teal neon-box frame. inline renders without the fixed backdrop. */
function Modal({
  open = true,
  title,
  children,
  actions,
  onClose,
  inline = false
}) {
  if (!open) return null;
  const box = /*#__PURE__*/React.createElement("div", {
    className: "dialog fy-modal",
    role: "dialog",
    "aria-modal": !inline,
    "aria-label": typeof title === 'string' ? title : undefined,
    onClick: e => e.stopPropagation()
  }, title ? /*#__PURE__*/React.createElement("div", {
    className: "dialog-title"
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    className: "dialog-body"
  }, children), actions ? /*#__PURE__*/React.createElement("div", {
    className: "dialog-actions"
  }, actions) : null);
  return inline ? box : /*#__PURE__*/React.createElement("div", {
    className: "dialog-backdrop",
    onClick: onClose
  }, box);
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Modal.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Popover.jsx
try { (() => {
/** Seat pop-in panel: dark glass, ice-white 2px edge, teal glow, arrow on the anchor side. Children: .fy-popover-label / .fy-popover-field markup. */
function Popover({
  arrow = 'bottom',
  arrowAt = '50%',
  style,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-popover",
    "data-arrow": arrow,
    style: style,
    role: "dialog"
  }, children, arrow !== 'none' ? /*#__PURE__*/React.createElement("span", {
    className: "fy-popover-arrow",
    style: {
      left: arrowAt
    }
  }) : null);
}
Object.assign(__ds_scope, { Popover });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Popover.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
/** Farmyard card. neon = teal .card frame (default) · pink = .neon-box-pink · tube / tube-teal = 2px lit tube · paper = pinned leaderboard sheet. */
function Card({
  variant = 'neon',
  kicker,
  title,
  meta,
  footer,
  tilt = 'left',
  pinned = true,
  style,
  children
}) {
  if (variant === 'paper') {
    return /*#__PURE__*/React.createElement("div", {
      className: 'fy-paper' + (tilt === 'right' ? ' is-tilt-right' : ''),
      style: style
    }, /*#__PURE__*/React.createElement("div", {
      className: "fy-paper-sheet"
    }, /*#__PURE__*/React.createElement("span", {
      className: "fy-paper-fold"
    }), /*#__PURE__*/React.createElement("span", {
      className: "fy-paper-crease"
    }), title || meta ? /*#__PURE__*/React.createElement("div", {
      className: "fy-paper-head"
    }, title ? /*#__PURE__*/React.createElement("span", {
      className: "lot-label"
    }, title) : null, meta ? /*#__PURE__*/React.createElement("span", {
      className: "fy-paper-meta"
    }, meta) : null) : null, children, footer ? /*#__PURE__*/React.createElement("div", {
      className: "fy-paper-foot"
    }, footer) : null), pinned ? /*#__PURE__*/React.createElement("span", {
      className: "fy-paper-pin"
    }) : null);
  }
  const cls = {
    neon: 'card',
    pink: 'card neon-box-pink',
    tube: 'neon-tube',
    'tube-teal': 'neon-tube-teal'
  }[variant] || 'card';
  return /*#__PURE__*/React.createElement("div", {
    className: cls,
    style: {
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, kicker || meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8
    }
  }, kicker ? /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, kicker) : null, meta ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: 'var(--fy-text-label)'
    }
  }, meta) : null) : null, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-heading)',
      fontSize: 17,
      fontWeight: 'var(--font-heading-weight)'
    }
  }, title) : null, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// ui_kits/barn/Dashboard.jsx
try { (() => {
const F = window.FarmyardDesignSystem_f1e07c;
const BARN_ROWS = [['Tali', 4, 7, 1], ['Dmitri', 3, 6, 2], ['Jo', 3, 8, 3], ['Ray', 2, 6, 0], ['Pinky', 1, 5, 0]];
function Dashboard({
  go
}) {
  const {
    PageHeader,
    Chip,
    NeonButton,
    Card,
    Medal
  } = F;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Dashboard",
    chip: /*#__PURE__*/React.createElement(Chip, {
      tone: "pink"
    }, "3 live"),
    actions: /*#__PURE__*/React.createElement(NeonButton, {
      onClick: () => go('poker')
    }, "DEAL ME IN")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)',
      gap: 22,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Tonight"), /*#__PURE__*/React.createElement("div", {
    className: "barn-grid"
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "tube-teal",
    kicker: "Fri 9pm",
    meta: "Poker"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "Hold'em \xB7 4 of 8 seats"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Hosted by Hank")), /*#__PURE__*/React.createElement(Card, {
    variant: "tube-teal",
    kicker: "Fri 9pm",
    meta: "Voice"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "Lounge voice \xB7 2 in"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "via Discord"))), /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Rooms"), /*#__PURE__*/React.createElement("div", {
    className: "barn-grid"
  }, /*#__PURE__*/React.createElement(Card, {
    kicker: "Poker",
    meta: "4 playing",
    title: "Hold'em"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Table up, join from here")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Football",
    meta: "Week 9",
    title: "Token league"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Tali leads by 3")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Steam",
    meta: "3 playing",
    title: "Barn Brawl"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Lobby up, join from here")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Movie night",
    meta: "Sat 8pm",
    title: "Now showing"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Vote closes Fri")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Jukebox",
    meta: "12 queued",
    title: "The Humidor"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Dmitri has the aux")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Arcade",
    meta: "2 online",
    title: "High scores"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Jo on 48,200")))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 26
    }
  }, /*#__PURE__*/React.createElement(Card, {
    variant: "paper",
    title: "Poker League \xB7 Top 5",
    meta: "Pinned by Hank",
    footer: /*#__PURE__*/React.createElement("a", {
      className: "fy-link-teal",
      href: "#",
      onClick: e => {
        e.preventDefault();
        go('poker');
      }
    }, "Full league in the Poker Room \u2192")
  }, /*#__PURE__*/React.createElement("table", {
    className: "fy-paper-rows"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    className: "pos"
  }, "Pos"), /*#__PURE__*/React.createElement("th", null, "Player"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Wins"), /*#__PURE__*/React.createElement("th", {
    className: "num"
  }, "Buy-ins"))), /*#__PURE__*/React.createElement("tbody", null, BARN_ROWS.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r[0]
  }, /*#__PURE__*/React.createElement("td", {
    className: "pos"
  }, i + 1), /*#__PURE__*/React.createElement("td", null, r[0], " ", r[3] ? /*#__PURE__*/React.createElement(Medal, {
    place: r[3],
    size: 15
  }) : null), /*#__PURE__*/React.createElement("td", {
    className: "num",
    style: {
      fontWeight: 600,
      color: 'var(--neon-pink-text)'
    }
  }, r[1]), /*#__PURE__*/React.createElement("td", {
    className: "num",
    style: {
      color: 'var(--fy-text-secondary)'
    }
  }, r[2])))))))));
}
Object.assign(window, {
  Dashboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/barn/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/barn/Landing.jsx
try { (() => {
const F = window.FarmyardDesignSystem_f1e07c;
function Landing({
  onEnter
}) {
  const {
    Button,
    Avatar,
    Hint
  } = F;
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-frame",
    style: {
      minHeight: 688,
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      alignItems: 'center',
      padding: 'var(--space-8)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-6)',
      maxWidth: 440
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 56,
      lineHeight: 1.02,
      letterSpacing: '-0.02em'
    }
  }, "The Farmyard."), /*#__PURE__*/React.createElement("p", {
    className: "neon-pink",
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 500
    }
  }, "Members only. Hank checks the door."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      lineHeight: 1.55,
      color: 'var(--fy-text-body)'
    }
  }, "Poker nights, the football token league, an arcade, movie night and a jukebox. Voice by Discord. You bring the boys."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    icon: "ph-discord-logo",
    onClick: onEnter
  }, "Sign in with Discord"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "House rules")), /*#__PURE__*/React.createElement(Hint, {
    style: {
      alignSelf: 'flex-start'
    }
  }, "Who you are in the yard is up to you.")), /*#__PURE__*/React.createElement("div", {
    className: "wall-spill",
    style: {
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 300,
    assetBase: "../../assets/",
    breathe: true,
    name: "Hank"
  })));
}
Object.assign(window, {
  Landing
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/barn/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/barn/PokerRoom.jsx
try { (() => {
const F = window.FarmyardDesignSystem_f1e07c;
const POKER_COLS = [{
  key: 'name',
  label: 'Player'
}, {
  key: 'played',
  label: 'Played'
}, {
  key: 'won',
  label: 'Won'
}, {
  key: 'buyins',
  label: 'Buy-ins'
}, {
  key: 'bal',
  label: '£'
}];
const POKER_ROWS = [{
  name: 'Tali',
  played: 7,
  won: 4,
  buyins: 7,
  bal: '+£18',
  balTone: 'up'
}, {
  name: 'Dmitri',
  played: 6,
  won: 3,
  buyins: 6,
  bal: '+£9',
  balTone: 'up'
}, {
  name: 'Jo',
  played: 8,
  won: 3,
  buyins: 8,
  bal: '−£2',
  balTone: 'down'
}, {
  name: 'Ray',
  played: 6,
  won: 2,
  buyins: 6,
  bal: '−£11',
  balTone: 'down'
}, {
  name: 'Pinky',
  played: 5,
  won: 1,
  buyins: 5,
  bal: '−£14',
  balTone: 'down'
}];
function PokerRoom() {
  const {
    PageHeader,
    Chip,
    NeonButton,
    Button,
    Card,
    LeagueTable,
    Stepper,
    Popover,
    Hint,
    Modal,
    Avatar
  } = F;
  const [seats, setSeats] = React.useState(['Tali', 'Dmitri', 'Jo', null, null, null, null, null]);
  const [pick, setPick] = React.useState(null);
  const [tableName, setTableName] = React.useState('Jo the Shark');
  const [buyins, setBuyins] = React.useState(2);
  const [live, setLive] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const taken = seats.filter(Boolean).length;
  const take = () => {
    setSeats(s => s.map((v, i) => i === pick ? 'Ray' : v));
    setPick(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Poker",
    chip: /*#__PURE__*/React.createElement(Chip, null, taken, " of 8 seats"),
    actions: live ? /*#__PURE__*/React.createElement(NeonButton, {
      tone: "red",
      shape: "rect",
      onClick: () => setClosing(true)
    }, "CLOSE") : /*#__PURE__*/React.createElement(NeonButton, {
      tone: "green",
      shape: "rect",
      onClick: () => setLive(true)
    }, "START")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)',
      gap: 22,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    kicker: "Fri 9pm \xB7 Hold'em",
    meta: live ? /*#__PURE__*/React.createElement("span", {
      className: "neon-green",
      style: {
        fontWeight: 700,
        letterSpacing: '.14em',
        fontSize: 11
      }
    }, "LIVE") : 'Hosted by Hank',
    title: "The table",
    style: {
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 48,
    assetBase: "../../assets/"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)'
    }
  }, "Hank deals. Blinds 5 / 10 beans.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: 'repeat(4,44px)',
      gap: 14,
      justifyContent: 'center',
      padding: '10px 0'
    }
  }, seats.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    className: 'barn-seat' + (s ? ' is-taken' : ''),
    "aria-label": s ? s : 'Seat ' + (i + 1),
    onClick: () => !s && setPick(pick === i ? null : i)
  }, s ? /*#__PURE__*/React.createElement(Avatar, {
    size: 40,
    name: s,
    character: s === 'Hank' ? 'hank' : s.toLowerCase()
  }) : i + 1)), pick != null && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: '100%',
      transform: 'translateX(-50%)',
      zIndex: 2,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Popover, {
    arrow: "top"
  }, /*#__PURE__*/React.createElement("label", {
    className: "fy-popover-label"
  }, "FARMYARD NAME", /*#__PURE__*/React.createElement("div", {
    className: "fy-popover-field is-locked"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ph-light ph-lock-simple",
    style: {
      fontSize: 21,
      color: 'var(--neon-red-tube)'
    }
  }), /*#__PURE__*/React.createElement("span", null, "Ray"))), /*#__PURE__*/React.createElement("label", {
    className: "fy-popover-label"
  }, "TABLE NAME", /*#__PURE__*/React.createElement("div", {
    className: "fy-popover-field"
  }, /*#__PURE__*/React.createElement("i", {
    className: "ph-light ph-lock-simple-open",
    style: {
      fontSize: 21,
      color: 'var(--neon-green-tube)'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: tableName,
    maxLength: 16,
    onChange: e => setTableName(e.target.value)
  }))), /*#__PURE__*/React.createElement(NeonButton, {
    tone: "green",
    shape: "block",
    onClick: take
  }, "TAKE THE SEAT")))), /*#__PURE__*/React.createElement("div", {
    className: "rule-teal"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "kicker"
  }, "Buy-ins"), /*#__PURE__*/React.createElement(Stepper, {
    value: buyins,
    min: 0,
    max: 8,
    onChange: setBuyins,
    label: "buy-ins"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--fy-text-secondary)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "\xA3", buyins * 5, " in the pot"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "House rules")), pick != null && /*#__PURE__*/React.createElement(Hint, null, "Pick a table name. Your yard name stays as it is.")), /*#__PURE__*/React.createElement(Card, {
    kicker: "Poker League",
    meta: "Season 3",
    title: "The board",
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(LeagueTable, {
    columns: POKER_COLS,
    rows: POKER_ROWS
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      paddingTop: 6
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "fy-link-teal",
    href: "#",
    onClick: e => e.preventDefault()
  }, "Every season \u2192")))), /*#__PURE__*/React.createElement(Modal, {
    open: closing,
    onClose: () => setClosing(false),
    title: "Close the table?",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setClosing(false)
    }, "Keep playing"), /*#__PURE__*/React.createElement(NeonButton, {
      tone: "red",
      shape: "rect",
      onClick: () => {
        setLive(false);
        setClosing(false);
      }
    }, "CLOSE"))
  }, "Record tonight's winner first, or the points go nowhere.", /*#__PURE__*/React.createElement(Hint, {
    style: {
      marginTop: 10
    }
  }, taken, " players are still seated.")));
}
Object.assign(window, {
  PokerRoom
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/barn/PokerRoom.jsx", error: String((e && e.message) || e) }); }

// ui_kits/barn/Shell.jsx
try { (() => {
const F = window.FarmyardDesignSystem_f1e07c;
function Shell({
  screen,
  go,
  children
}) {
  const {
    NavItem,
    VoiceButton,
    Avatar
  } = F;
  const [voice, setVoice] = React.useState('live');
  return /*#__PURE__*/React.createElement("div", {
    className: "fy-frame",
    style: {
      display: 'grid',
      gridTemplateColumns: '232px minmax(0,1fr)',
      minHeight: 688
    }
  }, /*#__PURE__*/React.createElement("aside", {
    className: "fy-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fy-brand"
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 96,
    assetBase: "../../assets/"
  }), /*#__PURE__*/React.createElement("span", null, "The Farmyard")), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-squares-four",
    label: "Dashboard",
    current: screen === 'dashboard',
    onClick: () => go('dashboard')
  }), /*#__PURE__*/React.createElement("div", {
    className: "fy-nav-group"
  }, "Rooms"), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-club",
    label: "Poker",
    count: 4,
    current: screen === 'poker',
    onClick: () => go('poker')
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-soccer-ball",
    label: "Football : League"
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-squares-four",
    label: "Arcade",
    count: 2
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-calendar-blank",
    label: "Movie night"
  }), /*#__PURE__*/React.createElement("div", {
    className: "fy-nav-group"
  }, "Core"), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-calendar-blank",
    label: "Calendar"
  }), /*#__PURE__*/React.createElement(NavItem, {
    icon: "ph-discord-logo",
    label: "Discord"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "fy-voice-head"
  }, "Voice channel"), /*#__PURE__*/React.createElement(VoiceButton, {
    kind: "live",
    on: voice === 'live',
    sub: "via Discord",
    onClick: () => setVoice('live')
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6
    }
  }), /*#__PURE__*/React.createElement(VoiceButton, {
    kind: "muted",
    on: voice === 'muted',
    sub: "on Discord",
    onClick: () => setVoice('muted')
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "fy-nav-item",
    style: {
      marginTop: 10
    },
    onClick: () => go('landing')
  }, /*#__PURE__*/React.createElement("span", null, "Leave the yard"))), /*#__PURE__*/React.createElement("main", {
    className: "barn-main"
  }, children));
}
Object.assign(window, {
  Shell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/barn/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.NeonButton = __ds_scope.NeonButton;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Medal = __ds_scope.Medal;

__ds_ns.LeagueTable = __ds_scope.LeagueTable;

__ds_ns.ROSTER = __ds_scope.ROSTER;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Stepper = __ds_scope.Stepper;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.VoiceButton = __ds_scope.VoiceButton;

__ds_ns.Hint = __ds_scope.Hint;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Popover = __ds_scope.Popover;

__ds_ns.Card = __ds_scope.Card;

})();
