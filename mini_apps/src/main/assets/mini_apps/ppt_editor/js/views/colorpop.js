// ColorPop — a small box of colours that opens under a button: swatches, "none", and a field for any #RRGGBB. Esc or a click elsewhere closes it.
//   ColorPop.show(button, currentColor, function (hex or 'none') {...}, { none: true })
(function () {
  'use strict';
  var esc = Ui.esc, t = Ui.t, P = window.ColorPop = {}, root = null, from = null;
  var NAMES = ['sw_black', 'sw_gray', 'sw_navy', 'sw_red', 'sw_orange', 'sw_green', 'sw_teal', 'sw_blue', 'sw_purple', 'sw_white', 'fl_sand', 'fl_mint', 'fl_sky', 'fl_lilac'];

  P.close = function () {
    if (!root) return; root.remove(); root = null; document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', keys, true); window.removeEventListener('resize', P.close);
    if (from) { from.classList.remove('open'); from = null; }
  };
  function away(e) { if (root && !root.contains(e.target)) { if (from && from.contains(e.target)) e.stopPropagation(); P.close(); } }
  function keys(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); P.close(); } }
  function hex(v) { v = String(v || '').trim().replace(/^#/, ''); return /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toUpperCase() : /^[0-9a-f]{3}$/i.test(v) ? '#' + v.replace(/(.)/g, '$1$1').toUpperCase() : null; }
  P.show = function (btn, cur, cb, o) {
    P.close(); o = o || {}; from = btn; btn.classList.add('open');
    var now = String(cur || '').toUpperCase(), d = document.createElement('div'); d.className = 'cpop'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<div class="cp-g">' + NAMES.map(function (n) { var c = C(n); return '<button type="button" class="cp-s' + (c.toUpperCase() === now ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="' + esc(t('c.' + n)) + '" title="' + esc(t('c.' + n)) + '"></button>'; }).join('') + '</div>'
      + (o.none ? '<button type="button" class="cp-n" data-c="none">' + esc(t('c.fl_none')) + '</button>' : '')
      + '<label class="cp-h"><span>#</span><input type="text" maxlength="7" spellcheck="false" placeholder="' + esc(t('dk.hex')) + '" aria-label="' + esc(t('dk.hex')) + '"></label>';
    document.body.appendChild(d); root = d;
    var r = btn.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
    d.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px'; d.style.top = (r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    function pick(c) { P.close(); cb(c); }
    d.addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) pick(b.dataset.c); });
    var inp = d.querySelector('input'); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var h6 = hex(inp.value); if (h6) pick(h6); else inp.classList.add('bad'); } e.stopPropagation(); });
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', keys, true); window.addEventListener('resize', P.close);
  };
})();
