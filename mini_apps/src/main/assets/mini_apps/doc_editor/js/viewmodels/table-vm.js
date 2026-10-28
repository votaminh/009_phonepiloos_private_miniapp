// Table — a table in the page: typing inside its cells, adding and removing rows and columns, inserting a new one. Plan reads the cells back; the engine rewrites only the cell text.
(function () {
  'use strict';
  var t = Ui.t, $ = Ui.$, A = App.acts, size = { r: 3, c: 3 };
  var Table = window.Table = {};
  function cell() { var s = getSelection(); if (!s.rangeCount) return null; var n = s.anchorNode, el = n && (n.nodeType === 3 ? n.parentElement : n); return el && el.closest ? el.closest('#paper .tbl td') : null; }
  Table.cell = cell;
  function blockOf(td) { return td.closest('.b.tbl'); }
  function addOp(b, op) { var l = JSON.parse(b.dataset.ops || '[]'); l.push(op); b.dataset.ops = JSON.stringify(l); b.dataset.m = '1'; }
  function fresh(n) { var tr = ''; for (var i = 0; i < n; i++) tr += '<td data-new="1"><br data-ph></td>'; return tr; }
  function touch(b, td) { b.dataset.m = '1'; if (td) td.dataset.m = '1'; Doc.snap(); Edit.sync(); }
  Table.h = { blockOf: blockOf, addOp: addOp, fresh: fresh, pos: pos, cellsOf: cellsOf, plainTable: plainTable };   // what table-sort-vm.js needs
  Table.simple = function (td) { var b = td && blockOf(td); return !!b && b.dataset.simple === '1'; };

  // ---- cell text -------------------------------------------------------------------------------------------------------------
  Table.arm = function (on) {   // cells are typed in only while editing
    Array.prototype.forEach.call(Doc.paper().querySelectorAll('.tbl td'), function (td) { td.contentEditable = on ? 'true' : 'false'; });
  };
  document.addEventListener('input', function (e) { var td = e.target.closest && e.target.closest('.tbl td'); if (td) { td.dataset.m = '1'; } });
  // what Plan sends for one table block: [[ [paragraph, ...] | null ]] — null leaves a cell as it was
  Table.cells = function (b) {
    return Array.prototype.map.call(b.querySelectorAll('tr'), function (tr) {
      return Array.prototype.map.call(tr.children, function (td) { return td.dataset.m || td.dataset.new ? td.innerText.replace(/ /g, ' ').replace(/\n$/, '').split('\n') : null; });
    });
  };

  // ---- rows and columns --------------------------------------------------------------------------------------------------------
  function rowOps(before, del) {
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var b = blockOf(td);
    if (b.dataset.simple !== '1') return Ui.toast(t('e.lock'));
    var tr = td.parentElement, at = Array.prototype.indexOf.call(tr.parentElement.children, tr), body = tr.parentElement, n = tr.children.length;
    if (del) { if (body.children.length < 2) return Ui.toast(t('tb.last')); addOp(b, { op: 'row-', at: at }); var nx = tr.nextElementSibling || tr.previousElementSibling; tr.remove(); if (nx && nx.firstElementChild) nx.firstElementChild.focus(); }
    else { addOp(b, { op: 'row+', at: at, before: before }); var nr = document.createElement('tr'); nr.innerHTML = fresh(n); Array.prototype.forEach.call(nr.children, function (c) { c.contentEditable = 'true'; }); before ? tr.before(nr) : tr.after(nr); nr.firstElementChild.focus(); }
    Doc.snap(); Edit.sync();
  }
  function colOps(before, del) {
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var b = blockOf(td);
    if (b.dataset.simple !== '1') return Ui.toast(t('e.lock'));
    var at = Array.prototype.indexOf.call(td.parentElement.children, td), rows = b.querySelectorAll('tr');
    if (del) { if (td.parentElement.children.length < 2) return Ui.toast(t('tb.last')); addOp(b, { op: 'col-', at: at }); var f = td.nextElementSibling || td.previousElementSibling; Array.prototype.forEach.call(rows, function (r) { var c = r.children[at]; if (c) c.remove(); }); if (f) f.focus(); }
    else { addOp(b, { op: 'col+', at: at, before: before }); Array.prototype.forEach.call(rows, function (r) { var c = document.createElement('td'); c.dataset.new = '1'; c.contentEditable = 'true'; c.innerHTML = '<br data-ph>'; var ref = r.children[at]; before ? ref.before(c) : ref.after(c); }); (before ? td.previousElementSibling : td.nextElementSibling).focus(); }
    Doc.snap(); Edit.sync();
  }
  A['t-rowa'] = function () { rowOps(true); }; A['t-rowb'] = function () { rowOps(false); }; A['t-cola'] = function () { colOps(true); }; A['t-colb'] = function () { colOps(false); };
  A['t-delrow'] = function () { rowOps(false, true); }; A['t-delcol'] = function () { colOps(false, true); };
  A['t-deltable'] = function () { var td = cell(); if (!td) return; var b = blockOf(td), nx = b.nextElementSibling; b.remove(); Doc.snap(); if (nx && nx.classList.contains('ed')) nx.focus(); Ui.toast(t('g.deleted'), function () { A['e-undo'](); }); };

  // ---- merge, split, shading ---------------------------------------------------------------------------------------------------
  function pos(td) { var tr = td.parentElement; return { r: Array.prototype.indexOf.call(tr.parentElement.children, tr), c: Array.prototype.indexOf.call(tr.children, td) }; }
  // ---- a block of cells: drag across them (or Shift+click) to select; merge, shade and clear work on the whole block ---------------------------------------
  var anchor = null, selecting = false, SEL = null;   // SEL = { b, r0, c0, r1, c1 }
  function tdOf(el) { return el && el.closest ? el.closest('#paper .tbl td') : null; }
  function rect(a, z) { var pa = pos(a), pz = pos(z); return { b: blockOf(a), r0: Math.min(pa.r, pz.r), c0: Math.min(pa.c, pz.c), r1: Math.max(pa.r, pz.r), c1: Math.max(pa.c, pz.c) }; }
  function cellsOf(s) { var rows = s.b.querySelectorAll('tr'), out = []; for (var r = s.r0; r <= s.r1; r++) for (var c = s.c0; c <= s.c1; c++) { var td = rows[r] && rows[r].children[c]; if (td) out.push(td); } return out; }
  function paintSel() { Array.prototype.forEach.call(Doc.paper().querySelectorAll('.tbl td.csel'), function (x) { x.classList.remove('csel'); }); if (SEL) cellsOf(SEL).forEach(function (x) { if (!x.hidden) x.classList.add('csel'); }); }
  Table.selection = function () { return SEL && cellsOf(SEL).length > 1 ? SEL : null; };
  Table.clearSel = function () { if (!SEL) return; SEL = null; selecting = false; paintSel(); };
  function select(a, z) { if (blockOf(a) !== blockOf(z)) return; SEL = rect(a, z); paintSel(); getSelection().removeAllRanges(); if (window.Ribbon) Ribbon.follow(); }
  document.addEventListener('pointerdown', function (e) {
    if (Doc.mode !== 'edit') return; var td = tdOf(e.target);
    if (!td) { if (SEL && !e.target.closest('#dkBar, .ctxm, .pop, .sheet')) Table.clearSel(); anchor = null; return; }
    if (e.shiftKey && anchor && anchor !== td && blockOf(anchor) === blockOf(td)) { e.preventDefault(); select(anchor, td); return; }
    if (e.button === 2 && td.classList.contains('csel') && Table.selection()) return;   // right click on the selected cells opens their menu: the selection stays
    Table.clearSel(); anchor = td; selecting = false;
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (rs || !anchor || !(e.buttons & 1) || Doc.mode !== 'edit') return; var td = tdOf(document.elementFromPoint(e.clientX, e.clientY)); if (!td || td === anchor && !selecting) return;
    if (blockOf(td) !== blockOf(anchor)) return; if (td !== anchor || selecting) { selecting = true; select(anchor, td); }
  });
  document.addEventListener('pointerup', function () { selecting = false; });
  document.addEventListener('selectstart', function (e) { if (selecting) e.preventDefault(); });
  document.addEventListener('keydown', function (e) {
    if (!SEL) return; var s = Table.selection(); if (!s) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cellsOf(s).forEach(function (x) { if (x.hidden) return; x.innerHTML = '<br data-ph>'; x.dataset.m = '1'; }); Doc.snap(); }
    else if (e.key === 'Escape') Table.clearSel();
  }, true);
  function plain(s) { return cellsOf(s).every(function (x) { return !x.hidden && (x.colSpan || 1) === 1 && (x.rowSpan || 1) === 1; }); }
  function mergeRect(s) {
    if (!plain(s)) return Ui.toast(t('tb.complex')); var b = s.b, rows = b.querySelectorAll('tr');
    for (var r = s.r0; r <= s.r1; r++) {
      var td = rows[r].children[s.c0], n = s.c1 - s.c0; if (!n) continue; addOp(b, { op: 'merge', r: r, c: s.c0, n: n });
      for (var k = 0; k < n; k++) { var nx = td.nextElementSibling; td.colSpan = (td.colSpan || 1) + (nx.colSpan || 1); if (nx.textContent.trim()) td.insertAdjacentHTML('beforeend', '<br>' + nx.innerHTML); nx.remove(); }
      td.dataset.m = '1';
    }
    var top = rows[s.r0].children[s.c0];
    for (var r2 = s.r0 + 1; r2 <= s.r1; r2++) {
      var below = rows[r2].children[s.c0]; addOp(b, { op: 'vmerge', r: s.r0, c: s.c0, r2: r2 }); top.rowSpan = (top.rowSpan || 1) + 1; if (below.textContent.trim()) top.insertAdjacentHTML('beforeend', '<br>' + below.innerHTML); below.innerHTML = '<br data-ph>'; below.hidden = true; below.dataset.vc = '1';
    }
    top.dataset.m = '1'; b.dataset.simple = ''; Table.clearSel(); Doc.snap(); Edit.sync();
  }
  A['t-merge'] = function () {
    var sel = Table.selection(); if (sel) return mergeRect(sel);
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var nx = td.nextElementSibling; if (!nx) return Ui.toast(t('tb.nomerge')); var b = blockOf(td), p = pos(td);
    addOp(b, { op: 'merge', r: p.r, c: p.c, n: 1 }); td.colSpan = (td.colSpan || 1) + (nx.colSpan || 1); if (nx.textContent.trim()) td.insertAdjacentHTML('beforeend', '<br>' + nx.innerHTML); nx.remove(); b.dataset.simple = ''; td.dataset.m = '1'; Doc.snap(); Edit.sync();
  };
  A['t-split'] = function () {
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var n = td.colSpan || 1; if (n < 2) return Ui.toast(t('tb.nosplit')); var b = blockOf(td), p = pos(td);
    addOp(b, { op: 'split', r: p.r, c: p.c }); td.colSpan = 1; for (var i = 1; i < n; i++) { var c = document.createElement('td'); c.dataset.new = '1'; c.contentEditable = 'true'; c.innerHTML = '<br data-ph>'; td.after(c); } b.dataset.simple = ''; td.dataset.m = '1'; Doc.snap(); Edit.sync();
  };
  // a cell and the one under it become one; the covered cell stays in the table (hidden) so cells keep their place in the XML
  function rowOf(td) { return td.parentElement; }
  A['t-vmerge'] = function () {
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var b = blockOf(td), p = pos(td), span = td.rowSpan || 1, rows = rowOf(td).parentElement.children, tr2 = rows[p.r + span], below = tr2 && tr2.children[p.c];
    if (!below) return Ui.toast(t('tb.nobelow'));
    addOp(b, { op: 'vmerge', r: p.r, c: p.c, r2: p.r + span }); td.rowSpan = span + (below.rowSpan || 1); if (below.textContent.trim()) td.insertAdjacentHTML('beforeend', '<br>' + below.innerHTML); below.innerHTML = '<br data-ph>'; below.hidden = true; below.dataset.vc = '1'; b.dataset.simple = ''; td.dataset.m = '1'; Doc.snap(); Edit.sync();
  };
  A['t-vsplit'] = function () {
    var td = cell(); if (!td) return Ui.toast(t('e.tap')); var n = td.rowSpan || 1; if (n < 2) return Ui.toast(t('tb.nosplit')); var b = blockOf(td), p = pos(td), rows = rowOf(td).parentElement.children;
    addOp(b, { op: 'vsplit', r: p.r, c: p.c }); for (var i = 1; i < n; i++) { var c = rows[p.r + i] && rows[p.r + i].children[p.c]; if (c) { c.hidden = false; c.removeAttribute('data-vc'); } } td.rowSpan = 1; b.dataset.simple = ''; td.dataset.m = '1'; Doc.snap(); Edit.sync();
  };
  // ---- column width and row height by dragging a cell's edge; borders ----------------------------------------------------------------------------------
  var EDGE = 5, rs = null;
  // A column is dragged by its own right edge, as in Word: the last column moves the table's outer edge (the table grows or shrinks), any other one trades width with the column
  // next to it (the table stays as wide). So the table first keeps the pixel width of every column it has now.
  function setCol(b, c, w) { Array.prototype.forEach.call(b.querySelectorAll('tr'), function (tr) { var x = tr.children[c]; if (x) x.style.width = w + 'px'; }); }
  function fit(tb, w) {   // the collapsed borders make the box a pixel wider than its width: take that off, so a table as wide as the text area does not scroll
    tb.style.width = w + 'px'; var ex = tb.offsetWidth - w; if (ex > 0.5) tb.style.width = (w - ex) + 'px';
  }
  function freeze(b) {
    var tb = b.querySelector('table'), z = zoomOf(), ws = Array.prototype.map.call(tb.querySelector('tr').children, function (c) { return c.getBoundingClientRect().width / z; });
    tb.style.tableLayout = 'fixed'; tb.style.minWidth = '0'; ws.forEach(function (w, i) { setCol(b, i, w); }); fit(tb, ws.reduce(function (a, x) { return a + x; }, 0));
    return ws;
  }
  function dragCol(e, z) {
    var d = rs, i = d.c, last = i === d.ws.length - 1, w = Math.max(24, d.ws[i] + (e.clientX - d.x0) / z);
    if (last) {   // never wider than the text area (or than it was, if it already was): a table pulled off the page could not be reached again
      var cap = Math.floor(d.b.clientWidth / z), room = d.W0 > cap + 2 ? d.W0 : cap; w = Math.max(24, Math.min(w, d.ws[i] + room - d.W0));
      var tb = d.b.querySelector('table'), W = d.W0 + w - d.ws[i]; setCol(d.b, i, w); tb.style.width = W + 'px';
      var ex = tb.offsetWidth - W; if (ex > 0.5) { w -= ex; setCol(d.b, i, w); tb.style.width = (W - ex) + 'px'; }   // the collapsed borders add a pixel or two to the box: take them off the last column
      d.w = w; return;
    }
    var wn = Math.max(24, d.ws[i] + d.ws[i + 1] - w); w = d.ws[i] + d.ws[i + 1] - wn; setCol(d.b, i + 1, wn); d.wn = wn;
    setCol(d.b, i, w); d.w = w;
  }
  function zoomOf() { return parseFloat(Doc.paper().style.zoom) || 1; }
  function plainTable(b) { return Array.prototype.every.call(b.querySelectorAll('td'), function (x) { return !x.hidden && (x.colSpan || 1) === 1 && (x.rowSpan || 1) === 1; }); }
  function edgeAt(e) {
    var td = tdOf(e.target); if (!td || Doc.mode !== 'edit') return null; var r = td.getBoundingClientRect();
    if (r.right - e.clientX <= EDGE && r.right - e.clientX >= -2) return { td: td, kind: 'col' };
    if (r.bottom - e.clientY <= EDGE && r.bottom - e.clientY >= -2) return { td: td, kind: 'row' };
    return null;
  }
  document.addEventListener('pointermove', function (e) {
    if (rs) { var z = zoomOf(); if (rs.kind === 'col') { dragCol(e, z); } else { var h = Math.max(16, rs.h0 + (e.clientY - rs.y0) / z); rs.tr.style.height = h + 'px'; Array.prototype.forEach.call(rs.tr.children, function (c) { c.style.height = h + 'px'; }); rs.h = h; } return; }
    if (e.buttons) return; var ed = edgeAt(e), p = Doc.paper(); p.classList.toggle('rs-col', !!ed && ed.kind === 'col'); p.classList.toggle('rs-row', !!ed && ed.kind === 'row');
  });
  document.addEventListener('pointerdown', function (e) {
    var ed = edgeAt(e); if (!ed || (e.button && e.button !== 0)) return; var b = blockOf(ed.td); if (!plainTable(b)) { Ui.toast(t('tb.complexw')); return; }
    e.preventDefault(); e.stopPropagation(); var p = pos(ed.td), r = ed.td.getBoundingClientRect(), z = zoomOf();
    rs = { kind: ed.kind, b: b, c: p.c, r: p.r, tr: ed.td.parentElement, x0: e.clientX, y0: e.clientY, w0: r.width / z, h0: r.height / z };
    if (ed.kind === 'col') { rs.ws = freeze(b); rs.W0 = rs.ws.reduce(function (a, x) { return a + x; }, 0); }
  }, true);
  document.addEventListener('pointerup', function () {
    if (!rs) return; var d = rs; rs = null; Doc.paper().classList.remove('rs-col', 'rs-row');
    if (d.kind === 'col' && d.w) { addOp(d.b, { op: 'colw', c: d.c, w: Math.round(d.w * 15) }); if (d.wn) addOp(d.b, { op: 'colw', c: d.c + 1, w: Math.round(d.wn * 15) }); d.b.dataset.simple = ''; }
    else if (d.kind === 'row' && d.h) addOp(d.b, { op: 'rowh', r: d.r, h: Math.round(d.h * 15) });
    else return; d.b.dataset.m = '1'; Doc.snap(); Edit.sync();
  });
  // borders of the selected cells (or the cell the caret is in): all, outside, none, one side — or of the whole table
  var SIDE = { t: 'borderTop', b: 'borderBottom', l: 'borderLeft', r: 'borderRight' };
  function setBorders(td, sides, style) {
    var b = blockOf(td), p = pos(td); addOp(b, { op: 'border', r: p.r, c: p.c, sides: sides, style: style }); td.dataset.m = '1';
    sides.split('').forEach(function (s) { td.style[SIDE[s]] = style === 'nil' ? 'none' : '1px solid ' + C('paper_ink'); });
  }
  A['t-borders'] = function (el) {
    var r = el.getBoundingClientRect(), td0 = cell() || (Table.selection() ? cellsOf(Table.selection())[0] : null); if (!td0) return Ui.toast(t('e.tap'));
    var sel = Table.selection(), cells = sel ? cellsOf(sel).filter(function (x) { return !x.hidden; }) : [td0], b = blockOf(td0), all = Array.prototype.slice.call(b.querySelectorAll('td')).filter(function (x) { return !x.hidden; });
    function apply(list, fn) { list.forEach(function (x) { var s = fn(x); if (s.sides) setBorders(x, s.sides, s.style); }); Doc.snap(); Edit.sync(); }
    function outside(x) { var p = pos(x), q = sel || { r0: p.r, r1: p.r, c0: p.c, c1: p.c }, s = ''; if (p.r === q.r0) s += 't'; if (p.r === q.r1) s += 'b'; if (p.c === q.c0) s += 'l'; if (p.c === q.c1) s += 'r'; return { sides: s, style: 'single' }; }
    PopMenu.show(r.left, r.bottom + 2, [
      { t: t('bd.all'), go: function () { apply(cells, function () { return { sides: 'tblr', style: 'single' }; }); } },
      { t: t('bd.outside'), go: function () { apply(cells, outside); } },
      { t: t('bd.none'), go: function () { apply(cells, function () { return { sides: 'tblr', style: 'nil' }; }); } }, '-',
      { t: t('bd.top'), go: function () { apply(cells, function (x) { return { sides: pos(x).r === (sel ? sel.r0 : pos(x).r) ? 't' : '', style: 'single' }; }); } },
      { t: t('bd.bottom'), go: function () { apply(cells, function (x) { return { sides: pos(x).r === (sel ? sel.r1 : pos(x).r) ? 'b' : '', style: 'single' }; }); } }, '-',
      { t: t('bd.tableall'), go: function () { apply(all, function () { return { sides: 'tblr', style: 'single' }; }); } },
      { t: t('bd.tablenone'), go: function () { apply(all, function () { return { sides: 'tblr', style: 'nil' }; }); } }], { from: el });
  };
  var SHADES = ['hl_yellow', 'hl_green', 'hl_pink', 'hl_blue', 'chip', 'accent_soft', 'warn_soft'];
  A['t-shade'] = function (el) {
    Doc.range = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : Doc.range;
    Edit.pop(SHADES.map(function (k) { return '<button type="button" class="pop-sw" style="background:' + C(k) + '" data-act="t-setshade" data-k="' + k + '" aria-label="' + k + '"></button>'; }).join('') + '<button type="button" class="pop-sw none" data-act="t-setshade" data-k="" aria-label="' + Ui.esc(t('f.nohl')) + '">' + Ui.ic('close', 16, 2.4) + '</button>', el, 'sw');
  };
  A['t-setshade'] = function (el) {
    var td = cell() || (Doc.range && (Doc.range.startContainer.nodeType === 3 ? Doc.range.startContainer.parentElement : Doc.range.startContainer).closest('.tbl td')); Edit.hidePops(); if (!td && Table.selection()) td = cellsOf(Table.selection())[0]; if (!td) return Ui.toast(t('e.tap'));
    var hex = el.dataset.k ? C(el.dataset.k).replace('#', '').toUpperCase() : '', b = blockOf(td), sel = Table.selection(), list = sel ? cellsOf(sel).filter(function (x) { return !x.hidden; }) : [td];
    list.forEach(function (x) { var p = pos(x); addOp(b, { op: 'shade', r: p.r, c: p.c, fill: hex }); x.style.background = hex ? '#' + hex : ''; x.dataset.m = '1'; }); Doc.snap(); Edit.sync();
  };

  // ---- a new table --------------------------------------------------------------------------------------------------------------
  A['i-table'] = function (el) { size = { r: 3, c: 3 }; var p = Edit.pop(SheetsView.tablePick(3, 3), el, 'tp'); p.dataset.tp = '1'; };
  A['i-tsize'] = function (el) { size = { r: +el.dataset.r, c: +el.dataset.c }; var p = document.querySelector('.pop.tp'); if (p) p.innerHTML = SheetsView.tablePick(size.r, size.c); };
  A['i-tins'] = async function () {
    Edit.hidePops();
    try {
      var xml = await DocSvc.table(size.r, size.c), rows = '';
      for (var i = 0; i < size.r; i++) rows += '<tr>' + fresh(size.c).replace(/ data-new="1"/g, ' data-new="1"' + (i === 0 ? ' class="th"' : '')) + '</tr>';
      var el = Insert.block('tbl', '<table style="width:100%;table-layout:fixed">' + rows + '</table>', xml); el.dataset.simple = '1'; el.dataset.hdr = '1';
      Insert.place(el); Table.arm(true);
      var f = el.querySelector('td');
      if (f) {   // the caret goes into the first cell (Insert.place left it in the paragraph after the table): typing and the table tools work at once
        f.focus(); var r = document.createRange(), sel = getSelection(); r.selectNodeContents(f); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
        Doc.range = r.cloneRange(); Edit.sync();
      }
    } catch (e) { App.fail('err.generic', e); }
  };
})();
