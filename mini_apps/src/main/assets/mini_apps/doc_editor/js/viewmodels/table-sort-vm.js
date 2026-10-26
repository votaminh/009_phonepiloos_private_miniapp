// TableSort — sort the rows of a table by the column of the caret, and turn paragraphs into a table (the two tools that sit beside the table editing of table-vm.js).
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, Table = window.Table, H = Table.h, cell = Table.cell, blockOf = H.blockOf, addOp = H.addOp, fresh = H.fresh, pos = H.pos, cellsOf = H.cellsOf, plainTable = H.plainTable;
  // ---- sort the rows by the column of the caret; turn paragraphs into a table ---------------------------------------------------------------------------
  function num(x) { var v = parseFloat(String(x).replace(/[\s,]/g, '').replace(',', '.')); return isFinite(v) && /^[-+\d.,\s%€$£]+$/.test(x.trim()) ? v : null; }
  A['t-sort'] = function (el) {
    var td = cell() || (Table.selection() ? cellsOf(Table.selection())[0] : null); if (!td) return Ui.toast(t('e.tap')); var b = blockOf(td); if (!plainTable(b)) return Ui.toast(t('tb.complexw'));
    var r = el.getBoundingClientRect(), c = pos(td).c;
    PopMenu.show(r.left, r.bottom + 2, [{ t: t('so.asc'), go: function () { sortBy(b, c, 1); } }, { t: t('so.desc'), go: function () { sortBy(b, c, -1); } }], { from: el });
  };
  function sortBy(b, c, dir) {
    var body = b.querySelector('tbody') || b.querySelector('table'), rows = Array.prototype.slice.call(b.querySelectorAll('tr')), head = b.dataset.hdr === '1' || (rows[0] && rows[0].firstElementChild && (rows[0].firstElementChild.classList.contains('th'))) ? 1 : 0;
    var idx = rows.map(function (r, i) { return i; }), data = rows.slice(head), keys = data.map(function (r) { return (r.children[c] && r.children[c].textContent || '').trim(); }), allNum = keys.every(function (k) { return !k || num(k) !== null; });
    var order = data.map(function (r, i) { return i; }).sort(function (a, z) { var x = keys[a], y = keys[z], cmp = allNum ? (num(x) || 0) - (num(y) || 0) : x.localeCompare(y, I18n.locale(), { numeric: true, sensitivity: 'base' }); return cmp * dir || a - z; });
    var final = idx.slice(0, head).concat(order.map(function (i) { return i + head; })); addOp(b, { op: 'rows', order: final });
    var parent = rows[0].parentElement; order.forEach(function (i) { parent.appendChild(data[i]); }); b.dataset.m = '1'; Array.prototype.forEach.call(b.querySelectorAll('td'), function (x) { x.dataset.m = '1'; }); Doc.snap(); Edit.sync();
  }
  A['t-fromtext'] = async function () {
    if (Doc.mode !== 'edit') return Ui.toast(t('ps.edit')); var bs = Para.blocks().filter(function (x) { return x.classList.contains('ed'); }); if (!bs.length) return Ui.toast(t('e.tap'));
    var lines = bs.map(function (x) { return x.textContent.replace(/\u00a0/g, ' '); }), sep = lines.some(function (l) { return l.indexOf('\t') >= 0; }) ? '\t' : lines.every(function (l) { return l.indexOf(',') >= 0 || l.indexOf(';') >= 0; }) ? (lines.some(function (l) { return l.indexOf(';') >= 0; }) ? ';' : ',') : null;
    var cells = lines.map(function (l) { return sep ? l.split(sep).map(function (x) { return x.trim(); }) : [l]; }), cols = Math.max.apply(null, cells.map(function (r) { return r.length; })), n = cells.length;
    try {
      var xml = await DocSvc.table(n, cols), rows = cells.map(function (r, i) { var tr = '<tr>'; for (var j = 0; j < cols; j++) tr += '<td data-new="1"' + (i === 0 ? ' class="th"' : '') + '>' + (r[j] ? Ui.esc(r[j]) : '<br data-ph>') + '</td>'; return tr + '</tr>'; }).join('');
      var el = Insert.block('tbl', '<table>' + rows + '</table>', xml); el.dataset.simple = '1'; el.dataset.hdr = '1'; el.dataset.m = '1'; Array.prototype.forEach.call(el.querySelectorAll('td'), function (x) { x.dataset.m = '1'; }); bs[0].before(el); var after = bs[bs.length - 1].nextElementSibling;
      bs.forEach(function (x) { x.remove(); }); if (!after || !after.classList.contains('ed')) { var p = Struct.fresh(el, 'p'); p.dataset.t = 'p'; p.innerHTML = '<br data-ph>'; el.after(p); }
      Table.arm(true); Doc.snap(); Doc.dirty = true; Doc.chrome();
    } catch (e) { App.fail('err.generic', e); }
  };
})();
