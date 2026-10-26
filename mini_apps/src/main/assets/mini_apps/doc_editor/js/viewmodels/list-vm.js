// ListStyle — the list menu: pick a kind of numbering or bullet for the list under the caret (or turn the selected paragraphs into one), and start the numbering again at 1.
// A kind the file does not have yet is written into the file's numbering part on save (Doc.listDefs: numId -> kind).
(function () {
  'use strict';
  var t = Ui.t, A = App.acts;
  function items() { var bs = Para.blocks(); return bs; }
  // the run of list items around a block that belong to the same list (same id, or none and the same kind)
  function same(a, b) { return a.classList.contains('li') && b.classList.contains('li') && (a.dataset.nid || '') === (b.dataset.nid || '') && (a.dataset.nid || a.dataset.k === b.dataset.k); }
  function run(b) {
    var out = [b], p = b.previousElementSibling, n = b.nextElementSibling;
    while (p && same(p, b)) { out.unshift(p); p = p.previousElementSibling; }
    while (n && same(n, b)) { out.push(n); n = n.nextElementSibling; }
    return out;
  }
  function fresh(preset) { var id = String(Doc.nextNum++); Doc.listDefs[id] = preset; return id; }
  function finish() { Surface.renumber(); Doc.snap(); Edit.sync(); if (window.Paginate) Paginate.schedule(0); }
  A['ls-set'] = function (el) {
    var id = el.dataset.id, p = Lists.get(id), bs = items(); if (!bs.length) return Ui.toast(t('e.tap'));
    var targets = [], was = bs.map(function (b) { return b.classList.contains('li'); }), runs = bs.map(function (b, i) { return was[i] ? run(b) : null; });
    bs.forEach(function (b, i) { if (was[i]) runs[i].forEach(function (x) { if (targets.indexOf(x) < 0) targets.push(x); }); else { var n = Struct.toList(b, p.kind); if (targets.indexOf(n) < 0) targets.push(n); } });
    var nid = fresh(id);
    targets.forEach(function (x) { x.dataset.k = p.kind; x.dataset.ls = id; x.dataset.nid = nid; x.classList.toggle('ord', p.kind === 'ordered'); x.classList.toggle('bul', p.kind !== 'ordered'); x.dataset.m = '1'; });
    finish();
  };
  // numbering starts again at 1 from the item under the caret to the end of its list
  A['ls-restart'] = function () {
    var b = Edit.block(); if (!b || !b.classList.contains('li')) return Ui.toast(t('ls.notlist'));
    var r = run(b), at = r.indexOf(b), ls = b.dataset.ls || (b.dataset.k === 'bullet' ? 'b1' : 'n1'), nid = fresh(ls);
    r.slice(at).forEach(function (x) { x.dataset.nid = nid; x.dataset.ls = ls; x.dataset.m = '1'; });
    finish();
  };
  // the list goes on from the list before it (the items from the caret to the end of their list take its id and kind)
  A['ls-continue'] = function () {
    var b = Edit.block(); if (!b || !b.classList.contains('li')) return Ui.toast(t('ls.notlist'));
    var r = run(b), first = r[0], prev = first.previousElementSibling; while (prev && !(prev.classList.contains('li') && prev.dataset.nid !== b.dataset.nid && prev.dataset.k === b.dataset.k)) prev = prev.previousElementSibling;
    if (!prev) return Ui.toast(t('ls.noprev'));
    r.slice(r.indexOf(b)).forEach(function (x) { if (prev.dataset.nid) x.dataset.nid = prev.dataset.nid; else x.removeAttribute('data-nid'); if (prev.dataset.ls) x.dataset.ls = prev.dataset.ls; else x.removeAttribute('data-ls'); x.dataset.m = '1'; });
    finish();
  };
  A['ls-menu'] = function (el) {
    var r = el.getBoundingClientRect(), b = Edit.block(), cur = b && b.dataset.ls, kind = el.dataset.k;
    var its = Lists.presets.filter(function (p) { return p.kind === kind; }).map(function (p) { var c = [1, 1, 1, 1]; return { t: Lists.label(p.id, p.kind, 0, c) + '  ' + Lists.label(p.id, p.kind, 1, [1, 1]) + '  ' + Lists.label(p.id, p.kind, 2, [1, 1, 1]), on: cur === p.id, go: function () { A['ls-set']({ dataset: { id: p.id } }); } }; });
    if (kind === 'ordered') { its.push('-'); its.push({ t: t('ls.restart'), go: function () { A['ls-restart'](); } }); its.push({ t: t('ls.continue'), go: function () { A['ls-continue'](); } }); }
    PopMenu.show(r.left, r.bottom + 2, its, { from: el });
  };
})();
