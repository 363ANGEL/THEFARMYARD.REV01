/* Sidebar sub-page groups: first click on a section with sub-pages rolls them down; a second click goes to the section page. */
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
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button, a');
    if (!t || t.classList.contains('nav-sub')) return;
    var subs = subsOf(t);
    if (!subs.length || subs[0].classList.contains('sub-open')) return;
    e.preventDefault(); e.stopPropagation(); open(subs);
  }, true);
})();
