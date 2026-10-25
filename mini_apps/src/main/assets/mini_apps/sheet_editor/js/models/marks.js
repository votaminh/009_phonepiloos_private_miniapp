// Marks — the small things a cell carries besides its value: a link (blue, opens when clicked) and a note (red corner, shows when the pointer rests on it).
// The lists live on the sheet (sh.links, sh.notes) as the file gave them; here they are looked up by cell, and changed (the engine is told at Save through sh.linkOps and sh.notesDirty).
(function () {
  'use strict';
  var M = window.Marks = {};
  var MAX_CELLS = 2000;   // a link on a very large range is only kept in the list, not looked up cell by cell

  function index(list) {
    var map = {};
    list.forEach(function (x) {
      var a = Wb.areas(x.ref)[0]; if (!a) return;
      for (var r = a.startRow, n = 0; r <= a.endRow; r++) for (var c = a.startColumn; c <= a.endColumn && n++ < MAX_CELLS; c++) map[SheetSvc.ref(r, c)] = x;
    });
    return map;
  }
  M.link = function (sh, r, c) { if (!sh._lk) sh._lk = index(sh.links); return sh._lk[SheetSvc.ref(r, c)] || null; };
  M.note = function (sh, r, c) { if (!sh._nt) sh._nt = index(sh.notes); return sh._nt[SheetSvc.ref(r, c)] || null; };
  // the classes a drawn cell gets
  M.cls = function (sh, r, c) { return (M.link(sh, r, c) ? ' lnk' : '') + (M.note(sh, r, c) ? ' nt' : ''); };

  // target: a web address, a cell like Sheet2!A1, or null to take the link away
  M.setLink = function (sh, r, c, target) {
    var ref = SheetSvc.ref(r, c);
    sh.links = sh.links.filter(function (x) { return x.ref !== ref; }); if (target) sh.links.push({ ref: ref, target: target, tip: '' });
    sh.linkOps.push({ row: r, column: c, target: target || null }); sh._lk = null;
  };
  // text: the note, empty to delete it
  M.setNote = function (sh, r, c, text, author) {
    var ref = SheetSvc.ref(r, c);
    sh.notes = sh.notes.filter(function (x) { return x.ref !== ref; }); if (text) sh.notes.push({ ref: ref, author: author || '', text: text });
    sh.notesDirty = true; sh._nt = null;
  };
})();
