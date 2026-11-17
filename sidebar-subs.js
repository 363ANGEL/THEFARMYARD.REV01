/* Sidebar sub-page groups: one click on any row goes straight to that page (RAY, 16 Nov). A section's sub-pages roll down once you are on it or on one of its sub-pages. */
(function () {
  document.documentElement.classList.add('sub-js');
  function subsOf(p) { var o = [], n = p && p.nextElementSibling; while (n && n.classList && n.classList.contains('nav-sub')) { o.push(n); n = n.nextElementSibling; } return o; }
  function parentOf(a) { var p = a.previousElementSibling; while (p && p.classList.contains('nav-sub')) p = p.previousElementSibling; return p; }
  function open(list) { list.forEach(function (s) { s.classList.add('sub-open'); }); }
  function init() {
    document.querySelectorAll('a.nav-sub').forEach(function (a) {
      if (a.__subInit) return; a.__subInit = true;
      var p = parentOf(a), on = a.getAttribute('aria-current') === 'page' || a.getAttribute('data-open') === 'true' || (p && p.getAttribute('aria-current') === 'page');
      if (on && p) open(subsOf(p));
    });
  }
  new MutationObserver(init).observe(document.documentElement, { childList: true, subtree: true });
  init();
})();
