// Names — named ranges: a name for a block of cells (or a value) that formulas can use (=SUM(Revenue)). The list is in Data > Named ranges; typing a new name in the Name box and pressing Enter names the selection.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, G = window.Grid, D = window.Dlg, N = window.Names = {};

  function key(n) { return (n.sheet >= 0 && Wb.sheets[n.sheet] ? Wb.sheets[n.sheet].name + '!' : '') + n.name.toLowerCase(); }
  function list() { return Object.keys(Wb.names || {}).map(function (k) { return Wb.names[k]; }).filter(function (n) { return !n.hidden && !/^_xlnm\./.test(n.name); }).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function absRef(r, c) { return '$' + SheetSvc.col(c) + '$' + (r + 1); }
  function quote(name) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : "'" + name.replace(/'/g, "''") + "'"; }
  // the selection as a reference a name can keep: Data!$A$1:$B$4
  N.selection = function () {
    var s = G.sel, sh = G.geo.sh; return quote(sh.name) + '!' + absRef(s.r1, s.c1) + (s.r1 !== s.r2 || s.c1 !== s.c2 ? ':' + absRef(s.r2, s.c2) : '');
  };
  N.valid = function (name) { return /^[A-Za-z_][A-Za-z0-9_.]{0,254}$/.test(name) && !/^[A-Za-z]{1,3}\d+$/i.test(name) && !/^r\d*c\d*$/i.test(name) && !/^(true|false)$/i.test(name); };
  function parses(f) { try { CalcParse.parse('=' + f); return true; } catch (e) { return false; } }
  // keep a name (replacing the one it renames); returns false and tells why when it cannot
  N.save = function (old, name, sheet, formula) {
    name = String(name).trim(); formula = String(formula).trim().replace(/^=/, '');
    if (!N.valid(name)) { Ui.toast(t('nm.bad')); return false; }
    if (!formula || !parses(formula)) { Ui.toast(t('nm.badref')); return false; }
    var n = { name: name, sheet: sheet, hidden: false, formula: formula }, k = key(n);
    if (Wb.names[k] && Wb.names[k] !== old) { Ui.toast(t('nm.dup')); return false; }
    if (old) delete Wb.names[key(old)]; Wb.names[k] = n; Wb.namesDirty = true; Calc.reset(); Book.touch(); G.paint(); return true;
  };
  N.remove = function (n) { delete Wb.names[key(n)]; Wb.namesDirty = true; Calc.reset(); Book.touch(); G.paint(); };

  // ---- the list ------------------------------------------------------------------------------------------------------------------
  N.open = function () {
    var items = list(); N.items = items;
    var body = items.length ? '<div class="nm-list">' + items.map(function (n, i) {
      return '<div class="nm-row"><div class="nm-t"><b>' + esc(n.name) + '</b><small>' + esc(n.formula) + (n.sheet >= 0 && Wb.sheets[n.sheet] ? ' · ' + esc(Wb.sheets[n.sheet].name) : '') + '</small></div>'
        + (Wb.readOnly ? '' : '<button type="button" class="ib" data-act="nm-edit" data-i="' + i + '" aria-label="' + esc(t('nm.edit')) + '">' + Ui.ic('edit', 18, 2) + '</button><button type="button" class="ib" data-act="nm-del" data-i="' + i + '" aria-label="' + esc(t('dl.remove')) + '">' + Ui.ic('trash', 18, 2) + '</button>') + '</div>';
    }).join('') + '</div>' : '<p class="df-hint">' + esc(t('nm.none')) + '</p>';
    D.show('nm', t('nm.title'), body, Wb.readOnly ? [{ act: 'dl-cancel', label: t('nm.close') }] : [{ act: 'dl-cancel', label: t('nm.close'), kind: 'ghost' }, { act: 'nm-new', label: t('nm.new') }]);
  };
  function form(n) {
    D.st = { old: n || null };
    var scope = [{ v: -1, t: t('nm.workbook') }].concat(Wb.sheets.map(function (s, i) { return { v: i, t: s.name }; }));
    D.show('nm', n ? t('nm.edit') : t('nm.new'), D.fld(t('nm.name'), D.input('nmName', n ? n.name : '', 'Revenue')) + D.fld(t('nm.scope'), D.sel('nmScope', n ? n.sheet : -1, scope)) + D.fld(t('nm.refers'), D.input('nmRef', n ? n.formula : N.selection(), 'Data!$A$1:$A$9')),
      [{ act: 'nm-back', label: t('nm.back'), kind: 'ghost' }, { act: 'nm-save', label: t('dl.save') }]);
    setTimeout(function () { var i = $('nmName'); if (i) i.focus(); }, 80);
  }
  A['nm-new'] = function () { form(null); }; A['nm-edit'] = function (el) { form(N.items[+el.dataset.i]); }; A['nm-back'] = N.open;
  A['nm-del'] = function (el) { N.remove(N.items[+el.dataset.i]); Ui.toast(t('nm.deleted')); N.open(); };
  A['nm-save'] = function () { if (N.save(D.st.old, D.val('nmName'), +D.st.nmScope, D.val('nmRef'))) { Ui.toast(t('nm.saved')); N.open(); } };

  // typing a new name in the Name box names the selection (what Excel does); a name already there is jumped to as before
  var goto0 = window.Menus && Menus.goto;
  if (goto0) Menus.goto = function (text) {
    if (goto0.call(Menus, text)) return true; text = String(text || '').trim();
    if (Wb.readOnly || !G.geo || !N.valid(text) || (Wb.names && Wb.names[text.toLowerCase()])) return false;
    if (!N.save(null, text, -1, N.selection())) return true; Ui.toast(t('nm.added', { n: text })); return true;
  };
  if (window.Menus) Menus.add('data', function () { return [{ t: t('nm.title') + '…', go: N.open }]; });
})();
