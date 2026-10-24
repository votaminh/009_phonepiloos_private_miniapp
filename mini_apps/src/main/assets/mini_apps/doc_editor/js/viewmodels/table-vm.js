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

  // ---- a new table --------------------------------------------------------------------------------------------------------------
  A['i-table'] = function (el) { size = { r: 3, c: 3 }; var p = Edit.pop(SheetsView.tablePick(3, 3), el, 'tp'); p.dataset.tp = '1'; };
  A['i-tsize'] = function (el) { size = { r: +el.dataset.r, c: +el.dataset.c }; var p = document.querySelector('.pop.tp'); if (p) p.innerHTML = SheetsView.tablePick(size.r, size.c); };
  A['i-tins'] = async function () {
    Edit.hidePops();
    try {
      var xml = await DocSvc.table(size.r, size.c), rows = '';
      for (var i = 0; i < size.r; i++) rows += '<tr>' + fresh(size.c).replace(/ data-new="1"/g, ' data-new="1"' + (i === 0 ? ' class="th"' : '')) + '</tr>';
      var el = Insert.block('tbl', '<table>' + rows + '</table>', xml); el.dataset.simple = '1'; el.dataset.hdr = '1';
      Insert.place(el); Table.arm(true);
      var f = el.querySelector('td'); if (f) f.focus();
    } catch (e) { App.fail('err.generic', e); }
  };
})();
