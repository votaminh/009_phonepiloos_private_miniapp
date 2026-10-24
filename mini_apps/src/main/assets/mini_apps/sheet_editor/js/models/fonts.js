// Fonts — the fonts the picker offers, all shipped inside this app (fonts/*.woff, cut to Latin + Vietnamese) so every phone draws them the same way.
// The name written to the file is the Excel name; the app draws it with a look-alike that has the same letter widths (Carlito for Calibri, Arimo for Arial, Tinos for Times New Roman...).
(function () {
  'use strict';
  var SANS = "'Carlito','Mulish',sans-serif", SERIF = "'Tinos','Gelasio',serif", MONO = "'Cousine','Roboto Mono',monospace";
  var LIST = [
    { n: 'Calibri', css: SANS, g: 'excel' }, { n: 'Arial', css: "'Arimo'," + SANS, g: 'excel' }, { n: 'Verdana', css: "'Mulish'," + SANS, g: 'excel' }, { n: 'Tahoma', css: "'Mulish'," + SANS, g: 'excel' }, { n: 'Segoe UI', css: "'Mulish'," + SANS, g: 'excel' },
    { n: 'Times New Roman', css: SERIF, g: 'excel' }, { n: 'Georgia', css: "'Gelasio','Tinos',serif", g: 'excel' }, { n: 'Courier New', css: MONO, g: 'excel' },
    { n: 'Mulish', css: "'Mulish'," + SANS, g: 'more' }, { n: 'Lora', css: "'Lora','Tinos',serif", g: 'more' }, { n: 'Roboto Mono', css: "'Roboto Mono'," + MONO, g: 'more' }
  ];
  var by = {}; LIST.forEach(function (f) { by[f.n.toLowerCase()] = f; });
  window.Fonts = {
    list: LIST, def: 'Calibri',
    // a font name from a file that is not in the list still gets a sensible stack
    css: function (name) {
      var f = by[String(name).toLowerCase()]; if (f) return f.css;
      var safe = String(name).replace(/[^A-Za-z0-9 _.-]/g, '');
      return /courier|mono|consolas|menlo|code/i.test(safe) ? MONO : /times|georgia|serif|garamond|cambria|palatino|book|minion|roman/i.test(safe) && !/sans/i.test(safe) ? SERIF : SANS;
    },
    // the cell uses the default look (Calibri) unless the file or the person picked another font
    custom: function (name) { return !!name && String(name).toLowerCase() !== 'calibri'; }
  };
})();
