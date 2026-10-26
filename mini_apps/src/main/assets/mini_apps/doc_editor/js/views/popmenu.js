// PopMenu — a small menu that opens at a point (right click) or under a button (menu bar): items with a shortcut, a check mark, a sub menu; arrows, Enter and Esc work; a click anywhere else closes it.
//   PopMenu.show(x, y, [{ t: 'Cut', k: 'Ctrl+X', go: fn }, '-', { t: 'More', sub: [...] }], { from: button })
(function () {
  'use strict';
  var esc = Ui.esc, root = null, subs = [], sel = [], P = window.PopMenu = {};

  function row(it, i) {
    if (it === '-') return '<i class="ctx-sep"></i>';
    return '<button type="button" role="menuitem" class="ctx-i' + (it.off ? ' off' : '') + (it.danger ? ' danger' : '') + '" data-i="' + i + '"' + (it.off ? ' disabled' : '') + '>'
      + '<span class="ctx-ck">' + (it.on ? Ui.ic('check', 16, 2.4) : '') + '</span><span class="ctx-t">' + esc(it.t) + '</span>' + (it.k ? '<kbd>' + esc(it.k) + '</kbd>' : '') + (it.sub ? '<span class="ctx-sub">' + Ui.ic('right', 14, 2.2) + '</span>' : '') + '</button>';
  }
  function make(items, cls) {
    var d = document.createElement('div'); d.className = 'ctxm ' + (cls || ''); d.setAttribute('role', 'menu'); d.items = items;
    d.innerHTML = items.map(row).join(''); document.body.appendChild(d); return d;
  }
  function put(d, x, y, side) {
    var w = d.offsetWidth, h = d.offsetHeight, W = innerWidth, H = innerHeight;
    if (side) { x = x + side.w + 2 + w > W - 6 ? side.x - w - 2 : x + side.w + 2; y = Math.min(y, H - h - 8); } else { x = Math.min(x, W - w - 8); y = y + h > H - 8 ? Math.max(8, y - h) : y; }
    d.style.left = Math.max(8, x) + 'px'; d.style.top = Math.max(8, y) + 'px';
  }
  function closeFrom(level) { while (subs.length > level) { var d = subs.pop(); if (d.parentNode) d.parentNode.removeChild(d); } }
  P.close = function () {
    closeFrom(0); if (root && root.parentNode) root.parentNode.removeChild(root); root = null; document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', keys, true); window.removeEventListener('blur', P.close); window.removeEventListener('resize', P.close);
    if (P.from) { P.from.classList.remove('open'); P.from = null; }
  };
  P.isOpen = function () { return !!root; };
  function away(e) { if (!(e.target.closest && e.target.closest('.ctxm'))) { if (P.from && P.from.contains(e.target)) { e.stopPropagation(); } P.close(); } }
  function openSub(d, btn) {
    var i = +btn.dataset.i, it = d.items[i], level = subs.indexOf(d) + 1; closeFrom(level); if (!it || !it.sub || it.off) return;
    var s = make(it.sub, 'sub'); subs.push(s); var r = btn.getBoundingClientRect(), pr = d.getBoundingClientRect(); put(s, pr.right - 4, r.top - 6, { w: 0, x: pr.left });
  }
  function run(d, btn) {
    var it = d.items[+btn.dataset.i]; if (!it || it.off) return; if (it.sub) { openSub(d, btn); return; }
    P.close(); if (it.go) setTimeout(function () { it.go(); }, 0);
  }
  function list() { return subs.length ? subs[subs.length - 1] : root; }
  function keys(e) {
    var d = list(), bs = Array.prototype.filter.call(d.querySelectorAll('.ctx-i'), function (b) { return !b.disabled; }), at = bs.indexOf(d.querySelector('.ctx-i.hot')), k = e.key;
    function hot(i) { bs.forEach(function (b) { b.classList.remove('hot'); }); if (bs[i]) { bs[i].classList.add('hot'); bs[i].scrollIntoView({ block: 'nearest' }); } }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); if (subs.length) closeFrom(subs.length - 1); else P.close(); }
    else if (k === 'ArrowDown') { e.preventDefault(); hot(at + 1 >= bs.length ? 0 : at + 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); hot(at <= 0 ? bs.length - 1 : at - 1); }
    else if (k === 'ArrowRight' && bs[at] && d.items[+bs[at].dataset.i].sub) { e.preventDefault(); openSub(d, bs[at]); var s = list(); var f = s.querySelector('.ctx-i:not(:disabled)'); if (f) f.classList.add('hot'); }
    else if (k === 'ArrowLeft' && subs.length) { e.preventDefault(); closeFrom(subs.length - 1); }
    else if (k === 'Enter' || k === ' ') { if (bs[at]) { e.preventDefault(); e.stopPropagation(); run(d, bs[at]); } }
    else if (k === 'Tab') { e.preventDefault(); }
  }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.ctx-i'); if (b && b.parentNode.items) run(b.parentNode, b); });
  P.show = function (x, y, items, o) {
    P.close(); o = o || {}; root = make(items); root.id = 'ctxm'; P.from = o.from || null; if (P.from) P.from.classList.add('open'); put(root, x, y);
    root.addEventListener('pointermove', function (e) { var b = e.target.closest && e.target.closest('.ctx-i'); if (!b) return; var d = b.parentNode; Array.prototype.forEach.call(d.querySelectorAll('.hot'), function (h) { h.classList.remove('hot'); }); b.classList.add('hot'); if (d.items[+b.dataset.i].sub) openSub(d, b); else closeFrom(subs.indexOf(d) + 1); });
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', keys, true); window.addEventListener('blur', P.close); window.addEventListener('resize', P.close);
    return root;
  };
})();
