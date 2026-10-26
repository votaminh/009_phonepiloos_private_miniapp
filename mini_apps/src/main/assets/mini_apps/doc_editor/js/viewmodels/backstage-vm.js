// Backstage — Word's File view: a full page over the editor with the file's commands on the left (Info, Save, Save a copy, Export as PDF, Share, Rename, Close) and what is known about the file on the right.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, ic = Ui.ic, A = App.acts, B = window.Backstage = { on: false };
  function host() { var h = $('bstage'); if (!h) { h = document.createElement('div'); h.id = 'bstage'; h.className = 'bstage'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); $('pgDoc').appendChild(h); } return h; }
  function row(act, icon, label, off) { return '<button type="button" class="bs-i' + (off ? ' off' : '') + '" data-act="' + act + '"' + (off ? ' disabled' : '') + '>' + ic(icon, 20, 1.8) + '<span>' + esc(label) + '</span></button>'; }
  function size(n) { return window.HomeView && HomeView.size ? HomeView.size(n || 0) : Math.round((n || 0) / 1024) + ' KB'; }
  function info() {
    var r = Doc.rec || {}, s = window.DocRich && DocRich.doc && DocRich.doc.sects[0], pg = window.Paginate && Paginate.active() ? Paginate.pages : '–';
    var rows = [['bs.name', r.name], ['bs.size', size(r.size)], ['bs.pages', pg], ['bs.words', Doc.words || 0], ['bs.paper', s ? Math.round(s.w / 56.7) / 10 + ' × ' + Math.round(s.h / 56.7) / 10 + ' cm' : '–']];
    return '<h2>' + esc(t('bs.info')) + '</h2><div class="bs-card">' + rows.map(function (x) { return '<div class="pr-row"><span>' + esc(t(x[0])) + '</span><b>' + esc(String(x[1])) + '</b></div>'; }).join('') + '</div>';
  }
  B.open = function () {
    if (!Doc.rec) return; var h = host(), e = Doc.mode === 'edit';
    h.innerHTML = '<nav class="bs-nav"><button type="button" class="bs-back" data-act="bs-close" aria-label="' + esc(t('a.back')) + '">' + ic('back', 22, 2) + '</button>'
      + row('bs-save', 'check', t('a.save'), !e || !Doc.dirty) + row('m-copy', 'download', t('mn.copy')) + row('m-pdf', 'pages', t('mn.pdf')) + row('ex-menu', 'doc', t('ex.title')) + row('m-share', 'share', t('mn.share')) + row('m-rename', 'edit', t('mn.rename')) + '<i class="bs-sp"></i>' + row('bs-remove', 'trash', t('r.remove')) + row('bs-quit', 'close', t('dk.close')) + '</nav><section class="bs-main">' + info() + '</section>';
    h.classList.add('on'); B.on = true; props();
  };
  // document properties: read from the file, written back on save
  function tag(x, n) { var m = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>').exec(x || ''); return m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&') : ''; }
  async function props() {
    var main = document.querySelector('#bstage .bs-main'); if (!main || !Doc.zbuf) return; var z = await Zipx.open(Doc.zbuf.slice(0)), x = z && await z.text('docProps/core.xml'), cur = (Doc.props && Doc.props.core) || {};
    function v(k, n) { return esc(cur[k] !== undefined && cur[k] !== null ? cur[k] : tag(x, n)); }
    var e = Doc.mode === 'edit', f = function (id, k, n, lab) { return '<label class="pa-f hf-f"><span>' + esc(t('pr.' + (lab || k))) + '</span><input id="' + id + '" type="text" value="' + v(k, n) + '"' + (e ? '' : ' disabled') + ' autocomplete="off"></label>'; };
    main.insertAdjacentHTML('beforeend', '<h2 class="bs-h2">' + esc(t('pr.title')) + '</h2><div class="bs-card">' + f('prT', 'title', 'dc:title', 'ttl') + f('prA', 'creator', 'dc:creator') + f('prS', 'subject', 'dc:subject') + f('prK', 'keywords', 'cp:keywords') + (e ? '<div class="btns"><button type="button" class="btn" data-act="pr-go">' + esc(t('a.apply')) + '</button></div>' : '') + '</div>');
  }
  A['pr-go'] = function () { Doc.props = { core: { title: $('prT').value || null, creator: $('prA').value || null, subject: $('prS').value || null, keywords: $('prK').value || null } }; Doc.dirty = true; Doc.chrome(); Ui.toast(t('pr.ok')); };
  B.close = function () { var h = $('bstage'); if (h) h.classList.remove('on'); B.on = false; };
  A['bs-close'] = B.close;
  function wrap(name) { return function (el) { B.close(); return A[name](el); }; }
  A['bs-save'] = function () { B.close(); A['e-save'](); };
  A['bs-remove'] = function () { B.close(); A['m-remove'](); };
  A['bs-quit'] = function () { B.close(); A['d-back'](); };
  ['m-copy', 'm-pdf', 'm-share'].forEach(function (n) { var f = A[n]; A[n] = function () { B.close(); return f.apply(this, arguments); }; });
  document.addEventListener('keydown', function (e) { if (B.on && e.key === 'Escape') { e.stopPropagation(); B.close(); } }, true);
  // the File tab of the ribbon
  var open0 = Menus.open; Menus.open = function (btn) { if (btn && btn.dataset.mn === 'file' && Wide.pc) { B.open(); return; } open0.apply(this, arguments); };
})();
