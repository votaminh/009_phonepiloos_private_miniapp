// McpExt — agent tools for text inserted at a spot, the page colour, the watermark, and the table tools the ribbon keeps in menus (sort, borders, row height, column width).
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc, A = App.acts, $ = function (id) { return document.getElementById(id); };
  if (!M || !D) return;

  function hex(c) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')); if (!m) throw new Error('bad_color:' + c + ' (use RRGGBB)'); return m[1].toUpperCase(); }
  function cellAt(a) {
    var tb = D.at(a.table, 'table'), tr = tb.querySelectorAll('tr')[a.row || 0], td = tr && tr.children[a.col || 0];
    if (!td) throw new Error('no_cell:' + (a.row || 0) + ',' + (a.col || 0)); return { tb: tb, tr: tr, td: td };
  }

  // ---- text at a spot ---------------------------------------------------------------------------------------------------------------
  M.tool('doc_insert_text', function (a) {
    D.ready(); var b = D.at(a.index, 'text'), len = D.text(b).length, at = a.offset === undefined ? len : Math.max(0, Math.min(a.offset, len));
    Struct.putCaret(b, { a: at, z: at }); document.execCommand('insertText', false, a.text); b.dataset.m = '1'; D.done(b);
    return { summary: 'Inserted ' + a.text.length + ' characters into block ' + a.index + ' at ' + at, data: null };
  });

  // ---- page look --------------------------------------------------------------------------------------------------------------------
  M.tool('doc_set_page_color', function (a) {
    D.ready(); Doc.pageColor = a.color === 'none' ? null : hex(a.color);
    var st = document.documentElement.style; if (Doc.pageColor) st.setProperty('--pgbg', '#' + Doc.pageColor); else st.removeProperty('--pgbg');
    Doc.dirty = true; Doc.touch(); Doc.chrome(); return { summary: Doc.pageColor ? 'Page colour #' + Doc.pageColor : 'Page colour removed', data: null };
  });
  M.tool('doc_set_watermark', function (a) {
    D.ready(); var text = a.text === 'none' ? '' : a.text;
    // the ribbon's Watermark menu keeps its items (with their actions) on the menu element: run the one for "custom text" or "none"
    var none = function () {}, from = { getBoundingClientRect: function () { return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }; }, classList: { add: none, remove: none, toggle: none, contains: none }, setAttribute: none, removeAttribute: none };
    A['wm-menu'](from);
    var menus = document.querySelectorAll('.ctxm'), menu = menus[menus.length - 1], go = menu && menu.items ? menu.items.filter(function (x) { return x && x.go; }) : [];
    if (!go.length) throw new Error('watermark_menu_missing'); menu.remove();
    if (!text) { go[go.length - 1].go(); return { summary: 'Watermark removed', data: null }; }
    go[go.length - 2].go();
    if (!$('wmText')) throw new Error('watermark_dialog_missing'); $('wmText').value = text;
    if (a.opacity) { var op = $('wmOp') && $('wmOp').querySelector('[data-v="' + a.opacity + '"]'); if (op) op.click(); }
    if (a.layout) { var ly = $('wmDir') && $('wmDir').querySelector('[data-v="' + (a.layout === 'horizontal' ? 'h' : 'd') + '"]'); if (ly) ly.click(); }
    A['wm-go'](); return { summary: 'Watermark "' + text + '" added', data: null };
  });

  // ---- table extras -----------------------------------------------------------------------------------------------------------------
  function num(x) { var v = parseFloat(String(x).replace(/[\s,]/g, '').replace(',', '.')); return isFinite(v) && /^[-+\d.,\s%€$£]+$/.test(x.trim()) ? v : null; }
  M.tool('doc_table_sort', function (a) {
    D.ready(); var c = cellAt({ table: a.table, row: 0, col: a.col }), b = c.tb, H = Table.h, dir = a.order === 'desc' ? -1 : 1;
    if (!H.plainTable(b)) throw new Error('table_complex: merged or resized cells cannot be sorted');
    var rows = Array.prototype.slice.call(b.querySelectorAll('tr')), head = a.header === false ? 0 : 1, data = rows.slice(head);
    var keys = data.map(function (r) { return (r.children[a.col] && r.children[a.col].textContent || '').trim(); }), allNum = keys.every(function (k) { return !k || num(k) !== null; });
    var order = data.map(function (r, i) { return i; }).sort(function (x, z) { var p = keys[x], q = keys[z], cmp = allNum ? (num(p) || 0) - (num(q) || 0) : p.localeCompare(q, undefined, { numeric: true, sensitivity: 'base' }); return cmp * dir || x - z; });
    H.addOp(b, { op: 'rows', order: rows.map(function (r, i) { return i; }).slice(0, head).concat(order.map(function (i) { return i + head; })) });
    var parent = rows[0].parentElement; order.forEach(function (i) { parent.appendChild(data[i]); });
    b.dataset.m = '1'; Array.prototype.forEach.call(b.querySelectorAll('td'), function (x) { x.dataset.m = '1'; }); Doc.snap(); Edit.sync();
    return { summary: 'Table ' + a.table + ' sorted by column ' + a.col + (dir < 0 ? ' (descending)' : ''), data: null };
  });
  M.tool('doc_table_borders', function (a) {
    D.ready(); var c = cellAt({ table: a.table, row: 0, col: 0 }), b = c.tb, H = Table.h, style = a.style === 'none' ? 'nil' : 'single', sides = { all: 'tblr', outside: 'tblr', top: 't', bottom: 'b', left: 'l', right: 'r' }[a.where || 'all'];
    var rows = b.querySelectorAll('tr'), SIDE = { t: 'borderTop', b: 'borderBottom', l: 'borderLeft', r: 'borderRight' };
    Array.prototype.forEach.call(rows, function (tr, r) { Array.prototype.forEach.call(tr.children, function (td, k) {
      if (td.hidden) return; var s = a.where === 'outside' ? (r === 0 ? 't' : '') + (r === rows.length - 1 ? 'b' : '') + (k === 0 ? 'l' : '') + (k === tr.children.length - 1 ? 'r' : '') : sides; if (!s) return;
      H.addOp(b, { op: 'border', r: r, c: k, sides: s, style: style }); td.dataset.m = '1'; s.split('').forEach(function (x) { td.style[SIDE[x]] = style === 'nil' ? 'none' : '1px solid ' + C('paper_ink'); });
    }); });
    b.dataset.m = '1'; Doc.snap(); Edit.sync(); return { summary: 'Table ' + a.table + ' borders: ' + (a.style || 'all') + ' on ' + (a.where || 'all') + ' cells', data: null };
  });
  M.tool('doc_table_row_height', function (a) {
    D.ready(); var c = cellAt({ table: a.table, row: a.row, col: 0 }), r = Array.prototype.indexOf.call(c.tr.parentElement.children, c.tr);
    Table.h.addOp(c.tb, { op: 'rowh', r: r, h: Math.round(a.height * 20) }); c.tr.style.height = Math.round(a.height * 4 / 3) + 'px'; c.tb.dataset.m = '1'; Doc.snap(); Edit.sync();
    return { summary: 'Row ' + a.row + ' is now ' + a.height + ' pt tall', data: null };
  });
  M.tool('doc_table_column_width', function (a) {
    D.ready(); var c = cellAt({ table: a.table, row: 0, col: a.col }), b = c.tb;
    Table.h.addOp(b, { op: 'colw', c: a.col, w: Math.round(a.width * 20) });
    Array.prototype.forEach.call(b.querySelectorAll('tr'), function (tr) { var td = tr.children[a.col]; if (td) td.style.width = Math.round(a.width * 4 / 3) + 'px'; });
    b.dataset.simple = ''; b.dataset.m = '1'; Doc.snap(); Edit.sync();
    return { summary: 'Column ' + a.col + ' is now ' + a.width + ' pt wide (rows and columns can no longer be added to this table)', data: null };
  });
})();
