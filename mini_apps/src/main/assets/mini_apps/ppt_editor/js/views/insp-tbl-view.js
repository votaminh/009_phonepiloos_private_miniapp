// InspView, the table section: rows and columns at the end, the cells picked with the mouse (rows and columns around them, merge and split, sizes, vertical place), and the look of the whole table (style, header row, banding).
// It takes the place of the short section in insp-view2.js. Strings only; the events are in insp-tbl-vm.js.
(function () {
  'use strict';
  var t = Ui.t, V = window.InspView, esc = Ui.esc;
  var STYLES = ['No Style, No Grid', 'No Style, Table Grid', 'Themed Style 1 - Accent 1', 'Light Style 1', 'Light Style 2 - Accent 1', 'Light Style 3 - Accent 1', 'Medium Style 1 - Accent 1', 'Medium Style 2', 'Medium Style 2 - Accent 1', 'Medium Style 2 - Accent 2', 'Medium Style 2 - Accent 3', 'Medium Style 2 - Accent 4', 'Medium Style 2 - Accent 5', 'Medium Style 2 - Accent 6', 'Medium Style 3 - Accent 1', 'Medium Style 4 - Accent 1', 'Dark Style 1 - Accent 1', 'Dark Style 2 - Accent 1'];
  V.TSTYLES = STYLES;
  function col(n) { var s = ''; n++; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
  V.table = function (s) {
    var q = s.q, c = s.cell, fl = (q.more && q.more.tableStyle && q.more.tableStyle.flags) || {}, h = '';
    h += V.row(t('ip.rows'), V.step('tb-rows', q.rows, t('ip.rows'))) + V.row(t('ip.cols'), V.step('tb-cols', q.cols, t('ip.cols')));
    if (c) {
      var name = col(c.c1) + (c.r1 + 1) + (c.r1 === c.r2 && c.c1 === c.c2 ? '' : ':' + col(c.c2) + (c.r2 + 1));
      h += V.row(t('tc.cells'), '<b class="ip-no">' + esc(name) + '</b>')
        + V.row(t('tc.row'), V.chip('tc-ra', t('tc.above'), false) + V.chip('tc-rb', t('tc.below'), false) + V.chip('tc-rd', t('tc.del'), false))
        + V.row(t('tc.col'), V.chip('tc-cl', t('tc.left'), false) + V.chip('tc-cr', t('tc.right'), false) + V.chip('tc-cd', t('tc.del'), false))
        + V.row(t('tc.merge'), V.chip('tc-merge', t('tc.merge'), false) + V.chip('tc-split', t('tc.split'), false))
        + V.row(t('tc.height'), V.num('tc-h', s.th == null ? '' : s.th, t('tc.height')) + '<span class="ip-u">' + esc(s.u.n) + '</span>')
        + V.row(t('tc.width'), V.num('tc-w', s.tw == null ? '' : s.tw, t('tc.width')) + '<span class="ip-u">' + esc(s.u.n) + '</span>')
        + V.row(t('tc.anchor'), V.seg([V.chip('tc-anc', t('tc.top'), false, 'top'), V.chip('tc-anc', t('tc.middle'), false, 'middle'), V.chip('tc-anc', t('tc.bottom'), false, 'bottom')]));
    } else h += '<p class="ip-hint">' + esc(t('tc.hint')) + '</p>';
    h += V.row(t('tc.style'), V.sel('tc-style', t('tc.pick'), t('tc.style')))
      + V.row(t('tc.parts'), '<div class="ip-ly">' + V.chip('tc-flag', t('tc.header'), !!fl.firstRow, 'firstRow') + V.chip('tc-flag', t('tc.total'), !!fl.lastRow, 'lastRow') + V.chip('tc-flag', t('tc.first'), !!fl.firstCol, 'firstCol') + V.chip('tc-flag', t('tc.last'), !!fl.lastCol, 'lastCol') + V.chip('tc-flag', t('tc.bandr'), !!fl.bandRow, 'bandRow') + V.chip('tc-flag', t('tc.bandc'), !!fl.bandCol, 'bandCol') + '</div>')
      + V.row(t('ip.cells'), V.chip('tb-edit', t('tb.edit'), false));
    return h;
  };
})();
