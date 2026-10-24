// Farmyard: site-wide chicken clucks on +/− buttons. Opt out with data-sfx="off" on the button (or an ancestor).
(function () {
  if (window.__fyClucks) return; window.__fyClucks = true;
  var URLS = { up: 'assets/cluck-happy.mp3', dn: 'assets/cluck-sad.mp3' }, cache = {};
  function play(k) {
    var el = cache[k]; if (!el) { el = cache[k] = new Audio(URLS[k]); el.preload = 'auto'; el.volume = .7; }
    try { el.pause(); el.currentTime = 0; } catch (e) {}
    var p = el.play(); if (p && p.catch) p.catch(function () {});
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
    var b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
    if (b.closest('[data-sfx="off"]')) return;
    var k = kind(b); if (k) play(k);
  }, true);
})();
