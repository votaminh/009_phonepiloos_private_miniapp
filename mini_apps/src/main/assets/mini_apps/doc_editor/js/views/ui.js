// Ui — small helpers shared by the screens: escaping, line icons, the bottom sheet, the confirm dialog, the toast, dates and ids.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var P = {
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>', cast: '<rect x="3" y="6" width="14" height="11" rx="2"/><path d="M20 9a6 6 0 0 1 0 8M22 6a10 10 0 0 1 0 14"/>',
    volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5h.01"/>',
    skipb: '<path d="M7 5h2v14H7zM20 5v14L10 12z" fill="currentColor"/>', skipf: '<path d="M15 5h2v14h-2zM4 5v14l10-7z" fill="currentColor"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/>', remote: '<rect x="7.5" y="2.5" width="9" height="19" rx="3"/><circle cx="12" cy="8" r="1.6"/><path d="M10 14h4M10 17.5h4"/>',
    power: '<path d="M12 3.5v8"/><path d="M6.7 6.9a7.5 7.5 0 1 0 10.6 0"/>', home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z"/>', mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l4 5M20 9.5l-4 5"/>',
    ir: '<rect x="9" y="11" width="6" height="10" rx="2"/><path d="M12 8V5M8 9L6.2 7.2M16 9l1.8-1.8"/>', keyboard: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>', source: '<path d="M4 12h11M11 7l5 5-5 5"/><path d="M20 4v16"/>',
    touch: '<path d="M9 11V5.5a1.8 1.8 0 0 1 3.6 0V11"/><path d="M12.6 10.5a1.8 1.8 0 0 1 3.6.4v1.6a1.8 1.8 0 0 1 3 1.3V16a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.7-2.3L5 15.5a1.8 1.8 0 0 1 2.9-2.1L9 14.5V11"/>',
    cup: '<path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M8 4v2M12 4v2"/>', dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="15" cy="15" r="1.1"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M8 5v14M16 5v14M4 9.5h4M16 9.5h4M4 14.5h4M16 14.5h4"/>', tent: '<path d="M3.5 19L12 5l8.5 14zM12 5v14M9 19l3-5 3 5"/>', glass: '<path d="M6 5h12l-6 7zM12 12v7M8.5 19h7"/>',
    ball: '<circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="9.5" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="12" cy="13" r="1"/>', gamepad: '<rect x="3.5" y="8" width="17" height="9" rx="4.5"/><path d="M8 10.5v4M6 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="17.5" cy="13.5" r=".9"/>',
    key: '<circle cx="8.5" cy="12" r="3.5"/><path d="M12 12h8M17 12v3M20 12v2"/>', brush: '<path d="M12 4a8 8 0 1 0 0 16c1.3 0 2-.8 2-1.8 0-1.2-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H17a3 3 0 0 0 3-3A7.5 7.5 0 0 0 12 4z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>', phone: '<path d="M6 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2L15 12.5l4 1.5v3a2 2 0 0 1-2 2A12.5 12.5 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', sliders: '<path d="M5 8h8M17 8h2M5 16h2M11 16h8"/><circle cx="15" cy="8" r="2"/><circle cx="9" cy="16" r="2"/>', info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>', hash: '<path d="M9 4L7 20M17 4l-2 16M4.5 9h16M3.5 15h16"/>', wifi: '<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0"/><circle cx="12" cy="19" r="1"/>', mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 8l8 5.5L20 8"/>', qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v2M14 20h2M18 18v2h2"/>', minus: '<path d="M5 12h14"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', back: '<path d="M15 5l-7 7 7 7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
    edit: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14 7l3 3"/>', share: '<path d="M12 15V4M8 7.5L12 4l4 3.5M6 11v8h12v-8"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    users: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.5-3.2 2.6-5 5.5-5s5 1.8 5.5 5"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.3c1.8.5 3 2.2 3.3 4.7"/>', user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.6-4 3.2-6 7-6s6.4 2 7 6"/>',
    flag: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>', list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    play: '<path d="M8 5.5v13l11-6.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>', refresh: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
    bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>', star: '<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5L12 16.3 7 19l1.1-5.5L4 9.7 9.6 9z"/>', pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    chev: '<path d="M9 6l6 6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>', sort: '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>', filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>', dup: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>', note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>', gavel: '<path d="M4 20h9M9.5 14.5l-4-4M13 4l7 7M11 6l7 7-3 3-7-7z"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>', drop: '<path d="M12 4s6 6 6 10.5a6 6 0 0 1-12 0C6 10 12 4 12 4z"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 0 8"/>', mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>', image: '<rect x="4" y="5" width="16" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3.5 3 2-2L19 17"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/>', grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    wallet: '<path d="M4 8a2 2 0 0 1 2-2h11v3M4 8v9a2 2 0 0 0 2 2h13V9H6a2 2 0 0 1-2-2"/><circle cx="15.5" cy="14" r="1.1"/>', map: '<path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>', gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18v-2.5H3zM12 6.5V20M12 6.5c-1-3-5-3-4.5-.5M12 6.5c1-3 5-3 4.5-.5"/>',
    paw:'<circle cx="7" cy="9.2" r="1.7"/><circle cx="10.8" cy="6.6" r="1.7"/><circle cx="15.2" cy="6.6" r="1.7"/><circle cx="19" cy="9.2" r="1.7"/><path d="M12 19c-2.8 0-5-1.5-5-3.8 0-2 2-3.7 5-3.7s5 1.7 5 3.7C17 17.5 14.8 19 12 19z"/>', dog:'<path d="M5 9l1.5-3.5L9 8h6l2.5-2.5L19 9v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/><path d="M10.5 15h3"/>', cat:'<path d="M6 10l1-4.5 3 3h4l3-3L18 10v4a6 6 0 0 1-12 0z"/><circle cx="9.5" cy="12" r=".9"/><circle cx="14.5" cy="12" r=".9"/><path d="M11 15h2"/>', bird:'<path d="M5 14a5 5 0 0 1 5-5h4l3.5-2L16 10a4.5 4.5 0 0 1-3.5 6.5H8A3 3 0 0 1 5 14z"/><circle cx="15" cy="10.5" r=".8"/><path d="M10 17l-1 3"/>', fish:'<path d="M3.5 12c3.5-4.2 11-4.2 14.5 0-3.5 4.2-11 4.2-14.5 0z"/><path d="M18 12l2.5-3.2v6.4z"/><circle cx="8.5" cy="11.4" r=".9"/>', hamster:'<circle cx="12" cy="13" r="7"/><circle cx="7.2" cy="6.6" r="2.2"/><circle cx="16.8" cy="6.6" r="2.2"/><circle cx="9.6" cy="12" r=".9"/><circle cx="14.4" cy="12" r=".9"/><path d="M11 15h2"/>', food:'<path d="M4.5 11h15a7.5 7.5 0 0 1-15 0z"/><path d="M9 8c0-1.4 1.6-1.4 1.6-2.8M13.4 8c0-1.4 1.6-1.4 1.6-2.8"/>', syringe:'<path d="M20 4l-2.5 2.5M16.5 3.5l4 4M13 7l4 4"/><path d="M13 9l-6.5 6.5V20H9l6.5-6.5"/>', worm:'<path d="M3.5 15c2.2-3.2 5.2-3.2 7.4 0s5.2 3.2 7.4 0"/><circle cx="3.6" cy="15" r="1"/>', scale:'<rect x="5" y="4" width="14" height="16" rx="3"/><path d="M8.5 9.5h7L12 13.5z"/><path d="M12 13.5V16"/>', scissors:'<circle cx="6.5" cy="7" r="2.4"/><circle cx="6.5" cy="17" r="2.4"/><path d="M8.6 8.2 19 15M8.6 15.8 19 9"/>', vet:'<path d="M6.5 5H5v4.5a5 5 0 0 0 10 0V5h-1.5"/><path d="M12 14.5v1.5a4 4 0 0 0 4 4h.5"/><circle cx="18" cy="20" r="1.7"/>', pill:'<rect x="3.5" y="8.5" width="17" height="7" rx="3.5"/><path d="M12 8.5v7"/>', cake:'<rect x="4" y="12" width="16" height="8" rx="2"/><path d="M4 15.5h16"/><path d="M8.5 12V9M12 12V8M15.5 12V9"/>'
  };
  var Ui = window.Ui = {
    $: $,
    icons: P,
    ic: function (n, s, w) { return '<svg width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>'; },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    t: function (k, v) { return I18n.t(k, v); },
    // ids that never repeat, even when made in the same millisecond
    nextId: (function () { var last = 0; return function () { last = Math.max(Date.now(), last + 1); return last; }; })(),
    pad: function (n) { return String(n).padStart(2, '0'); },
    ymd: function (d) { d = d || new Date(); return d.getFullYear() + '-' + Ui.pad(d.getMonth() + 1) + '-' + Ui.pad(d.getDate()); },
    parse: function (s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); },
    fmt: function (d, o) { return d.toLocaleDateString(I18n.locale(), o); },
    toast: function (text, undo) {
      var el = $('toast'); el.innerHTML = '<span></span>' + (undo ? '<button type="button" data-act="toast-undo">' + Ui.t('a.undo') + '</button>' : '');
      el.firstChild.textContent = text; Ui.undo = undo || null; el.classList.add('on'); clearTimeout(Ui.tt);
      Ui.tt = setTimeout(function () { el.classList.remove('on'); Ui.undo = null; }, undo ? 4500 : 2200);
    },
    state: { sheet: '', dlg: null },
    sheet: function (name, html) { var s = $('sheet'); Ui.state.sheet = name; s.innerHTML = html; s.scrollTop = 0; s.classList.add('on'); $('scrim').classList.add('on'); },
    closeSheet: function () { if (!Ui.state.sheet) return false; Ui.state.sheet = ''; $('sheet').classList.remove('on'); if (!Ui.state.dlg) $('scrim').classList.remove('on'); return true; },
    dialog: function (title, body, yesLabel, yes, danger) {
      var d = $('dlg'); Ui.state.dlg = yes;
      d.innerHTML = '<h2>' + Ui.esc(title) + '</h2><p>' + Ui.esc(body) + '</p><div class="btns"><button type="button" class="btn light" data-act="dlg-no">' + Ui.t('a.cancel') + '</button><button type="button" class="btn' + (danger ? ' red' : '') + '" data-act="dlg-yes">' + Ui.esc(yesLabel) + '</button></div>';
      d.classList.add('on'); $('scrim').classList.add('on');
    },
    closeDialog: function () { if (!Ui.state.dlg) return false; Ui.state.dlg = null; $('dlg').classList.remove('on'); if (!Ui.state.sheet) $('scrim').classList.remove('on'); return true; },
    // a soft ripple from the finger on every button, so each tap answers back
    ripple: function () {
      document.addEventListener('pointerdown', function (e) {
        var el = e.target.closest('button,[data-act],.opt'); if (!el || el.disabled) return;
        var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, d = Math.max(x, r.width - x, y, r.height - y) * 2;
        var box = el.querySelector(':scope > .rpl'); if (!box) { box = document.createElement('span'); box.className = 'rpl'; el.appendChild(box); }
        var dot = document.createElement('i'); dot.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px';
        box.appendChild(dot); setTimeout(function () { dot.remove(); }, 600);
      }, { passive: true });
    },
    // on the web a mouse wheel must scroll every sideways list (chip rows, carousels): the wheel turns left/right there, and goes on scrolling the page once the row is at its end
    hwheel: function () {
      document.addEventListener('wheel', function (e) {
        if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        for (var el = e.target; el && el !== document.documentElement; el = el.parentElement) {
          var ox = getComputedStyle(el).overflowX;
          if ((ox !== 'auto' && ox !== 'scroll') || el.scrollWidth <= el.clientWidth + 1) continue;
          var oy = getComputedStyle(el).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) continue;
          var max = el.scrollWidth - el.clientWidth, to = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
          if (to !== el.scrollLeft) { el.scrollLeft = to; e.preventDefault(); }
          return;
        }
      }, { passive: false });
    },
    // one click handler for the whole page: the button's data-act picks the function in acts
    bind: function (acts) {
      Ui.ripple(); Ui.hwheel();
      document.addEventListener('click', function (ev) {
        var el = ev.target.closest('[data-act]'); if (!el) return;
        var a = el.dataset.act;
        if (a === 'dlg-no') return Ui.closeDialog();
        if (a === 'dlg-yes') { var f = Ui.state.dlg; Ui.closeDialog(); if (f) f(); return; }
        if (a === 'toast-undo') { var u = Ui.undo; $('toast').classList.remove('on'); Ui.undo = null; if (u) u(); return; }
        if (acts[a]) acts[a](el, ev);
      });
      $('scrim').addEventListener('click', function () { if (!Ui.closeDialog()) Ui.closeSheet(); });
    },
    // the host back gesture closes a sheet or dialog first, and only then leaves the page
    // the host's Back button calls window.MiniAppBackHandler first (see MiniAppFullscreenActivity): closing a sheet or dialog there works on the home page too, where the Router has no history and never reaches setBeforeLeave
    guardBack: function () {
      Router.setBeforeLeave(function (from, to) { if (to === from) return true; if (Ui.closeDialog() || Ui.closeSheet()) return false; return true; });
      if (typeof window.MiniAppBackHandler !== 'function') window.MiniAppBackHandler = function () { return !!(Ui.closeDialog() || Ui.closeSheet()); };
    },
    // How a page opens: the list and a document morph into each other (ui-nav.js, which sets Ui.vtOn while it runs); every other page slides in from the side, and slides back out.
    pageIn: function (to, back) {
      var el = document.querySelector('[data-page="' + to + '"]'); if (!el || Ui.vtOn) return;
      var c = back ? 'pg-backslide' : 'pg-slide';
      el.classList.remove('pg-slide', 'pg-backslide'); void el.offsetWidth; el.classList.add(c);
      el.addEventListener('animationend', function f(e) { if (e.target !== el) return; el.classList.remove(c); el.removeEventListener('animationend', f); });
    },
    reveal: function () { var r = function () { document.documentElement.classList.remove('wait-launch'); }; setTimeout(r, 1200); r(); }
  };
})();
