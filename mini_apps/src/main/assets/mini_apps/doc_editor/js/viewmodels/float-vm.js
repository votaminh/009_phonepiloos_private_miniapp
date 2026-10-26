// Float — text round a picture or shape while editing. A block set to "square" wrap floats to its side (the CSS of .wf-l / .wf-r); that needs the sheet to lay its blocks out as a normal flow,
// so the sheet leaves its column of flex items (which ignores floats) only while it holds such a block. The page-gap spacer then becomes padding, because margins of neighbours would merge.
(function () {
  'use strict';
  var run0 = Paginate.run;
  Paginate.run = function () {
    var p = Doc.paper(), on = !!p.querySelector('.b.wf-l, .b.wf-r'); if (p.classList.contains('hasfloat') !== on) p.classList.toggle('hasfloat', on);
    return run0.apply(this, arguments);
  };
})();
