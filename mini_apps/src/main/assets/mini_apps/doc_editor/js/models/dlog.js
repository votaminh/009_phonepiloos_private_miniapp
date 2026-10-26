// DocLog — a trace of what the editor does, kept in memory (the last 600 lines) and written to the console with the prefix [doc], so a fault seen on a phone can be read afterwards:
// DocLog.dump() returns the lines; over the phone's WebView debugging (adb forward) a script reads window.DocLog. Switch off with window.DOC_LOG = false before the scripts load.
// It records the taps, the selection, the scrolling, the size of the window (the keyboard), the calls that rebuild the page, the place of the selection menu, and every error.
(function () {
  'use strict';
  var L = [], t0 = performance.now(), lastScroll = 0, body = null;
  function sel() { var s = getSelection(); if (!s || !s.rangeCount) return '-'; var r = s.getRangeAt(0).getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top) + ',' + Math.round(r.width) + 'x' + Math.round(r.height) + (s.isCollapsed ? ' caret' : ' sel'); }
  function quick() { var q = document.querySelector('.quick'); if (!q || q.classList.contains('hidden')) return 'quick:hidden'; var r = q.getBoundingClientRect(); return 'quick:' + Math.round(r.left) + ',' + Math.round(r.top); }
  function log(k, heavy) {
    body = body || document.getElementById('docBody');
    var line = Math.round(performance.now() - t0) + ' ' + k + ' | sc=' + (body ? Math.round(body.scrollTop) + ',' + Math.round(body.scrollLeft) : '-') + ' win=' + innerWidth + 'x' + innerHeight + ' pz=' + (window.Read && Read.pz ? Read.pz.toFixed(2) : '0') + (heavy ? ' | sel=' + sel() + ' | ' + quick() : '');
    L.push(line); if (L.length > 600) L.shift();
    if (window.DOC_LOG !== false) console.log('[doc]', line);
  }
  function wrap(o, k, name) { if (!o || typeof o[k] !== 'function') return; var f = o[k]; o[k] = function () { log('>' + name, true); return f.apply(this, arguments); }; }
  window.DocLog = { log: function (m) { log(m, true); }, dump: function () { return L.slice(); }, clear: function () { L.length = 0; } };
  if (window.DOC_LOG === false) return;
  [[window.Doc, 'render', 'Doc.render'], [window.Doc, 'setMode', 'Doc.setMode'], [window.Doc, 'open', 'Doc.open'], [window.Doc, 'save', 'Doc.save'], [window.Doc, 'chrome', 'Doc.chrome'], [window.Doc, 'snap', 'Doc.snap'], [window.Read, 'apply', 'Read.apply'],
   [window.Edit, 'sync', 'Edit.sync'], [window.PageView, 'build', 'PageView.build'], [window.PageView, 'editStyle', 'PageView.editStyle'], [window.Paginate, 'run', 'Paginate.run'], [window.Struct, 'follow', 'Struct.follow'], [window.Struct, 'placeQuick', 'Struct.placeQuick']
  ].forEach(function (w) { wrap(w[0], w[1], w[2]); });
  window.addEventListener('resize', function () { log('resize'); });   // light: reading the selection here would force a layout of the whole page on every step of the keyboard animation
  if (window.visualViewport) visualViewport.addEventListener('resize', function () { log('vv-resize ' + Math.round(visualViewport.height)); });
  document.addEventListener('focusin', function (e) { log('focusin ' + (e.target.className || e.target.tagName)); });
  document.addEventListener('selectionchange', function () { log('selchange', true); });
  document.addEventListener('pointerdown', function (e) { log('pdown ' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ' ' + (e.target.className || e.target.tagName) + ' ' + (e.pointerType || '')); }, true);
  document.addEventListener('pointerup', function () { log('pup'); }, true);
  document.addEventListener('scroll', function (e) { var n = performance.now(); frames(); if (n - lastScroll < 100) return; lastScroll = n; log('scroll ' + (e.target.id || e.target.className || 'doc')); }, true);
  // while the page is moving, a frame that took more than 50 ms is a flicker: it is written down
  var watching = false, lastF = 0, stopAt = 0;
  function frames() { stopAt = performance.now() + 400; if (watching) return; watching = true; lastF = performance.now(); requestAnimationFrame(tick); }
  function tick(n) { var d = n - lastF; lastF = n; if (d > 50) log('slow frame ' + Math.round(d) + 'ms'); if (n < stopAt) requestAnimationFrame(tick); else watching = false; }
  window.addEventListener('error', function (e) { log('ERROR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  window.addEventListener('unhandledrejection', function (e) { log('REJECTION ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
  log('log started', true);
})();
