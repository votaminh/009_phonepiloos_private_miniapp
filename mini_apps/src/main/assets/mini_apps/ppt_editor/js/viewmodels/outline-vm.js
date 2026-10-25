// Outline — the deck as flowing text: one card per slide with a small picture, its title, its paragraphs and its notes. The other way to look at the deck; the button in the title bar switches, and the choice is kept.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, A = App.acts, calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)'), esc = Ui.esc;
  var O = window.Outline = { on: false, gen: 0 };
  function still() { return calm && calm.matches; }

  // paragraphs of a slide from its render tree: the title first, then the other boxes top to bottom
  function paras(tree) {
    var nodes = tree.nodes.filter(function (n) { return n.text && n.text.lines && n.text.lines.length && !n.empty; }), title = null, rest = [];
    nodes.forEach(function (n) { if (!title && /title/i.test(n.placeholder || '')) title = n; else rest.push(n); });
    rest.sort(function (a, b) { return a.box.y - b.box.y || a.box.x - b.box.x; });
    function lines(n) {
      var out = [];
      n.text.lines.forEach(function (ln) {
        var txt = ln.runs.filter(function (r) { return !r.isBullet && !r.image; }).map(function (r) { return r.text; }).join(''), bullet = ln.runs.some(function (r) { return r.isBullet; });
        if (!txt.trim()) return; if (ln.paraStart || !out.length) out.push({ t: txt, lv: ln.level || 0, b: bullet }); else out[out.length - 1].t += ' ' + txt;
      });
      return out;
    }
    return { title: title ? lines(title).map(function (p) { return p.t; }).join(' ') : '', body: rest.reduce(function (a, n) { return a.concat(lines(n)); }, []) };
  }
  function card(i, tree, hidden) {
    var p = paras(tree), body = p.body.map(function (x) { return '<p class="ol-p' + (x.b ? ' bl' : '') + '" style="padding-left:' + (x.lv * 18 + (x.b ? 16 : 0)) + 'px">' + esc(x.t) + '</p>'; }).join('');
    return '<article class="ol-c' + (hidden ? ' hid' : '') + '" data-act="ol-go" data-i="' + i + '"><div class="ol-th"><b>' + (i + 1) + '</b><canvas width="240" height="' + Math.round(240 * tree.heightPx / tree.widthPx) + '"></canvas></div>'
      + '<div class="ol-tx"><h3>' + (p.title ? esc(p.title) : '<em>' + esc(t('ol.untitled')) + '</em>') + '</h3>' + body + '<div class="ol-n hidden" id="olN' + i + '"></div></div></article>';
  }
  async function fill() {
    var host = $('outline'), g = ++O.gen, n = Deck.count(); host.innerHTML = '';
    for (var i = 0; i < n; i++) {
      var tree; try { tree = await Deck.tree(i); } catch (e) { continue; } if (g !== O.gen) return;
      host.insertAdjacentHTML('beforeend', card(i, tree, Deck.info.slides[i].hidden)); var cv = host.lastElementChild.querySelector('canvas'), c = cv.getContext('2d'), k = cv.width / tree.widthPx; c.scale(k, k); SlideDraw.draw(c, tree);
      (function (ix) { PptSvc.notes(ix).then(function (x) { var el = $('olN' + ix); if (el && x) { el.textContent = x; el.classList.remove('hidden'); } }).catch(function () {}); })(i);
    }
  }
  // the page is in one of two states: slide editor, or outline; moving between them fades one out and lifts the other in
  O.show = function (on, silent) {
    var pg = $('pgDeck'), out = on ? [$('stage'), $('quick'), $('film'), $('deckTools')] : [$('outline')], inc = on ? $('outline') : $('stage');
    function go() {
      O.on = on; pg.classList.toggle('ol-on', on); if (on) fill(); else { Stage.layout(); Stage.show(); }
      Viewer.chrome();
      if (!still() && !silent) (on ? [inc] : [$('stage'), $('quick'), $('film'), $('deckTools')]).forEach(function (el, k) { el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: k * 40, easing: 'cubic-bezier(.2,.9,.25,1.06)', fill: 'backwards' }); });
    }
    if (still() || silent || !Deck.info) return go();
    var anims = out.map(function (el) { return el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.98)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' }); }), end = function () { anims.forEach(function (a) { a.cancel(); }); go(); };
    anims[0].finished.then(end, end);
  };
  O.set = function (on) { if (!!Store.prefs().outline === on) return; Store.savePrefs({ outline: on }); O.show(on); };
  A['d-outline'] = function () { O.set(!O.on); };
  A['ol-go'] = function (el) { var i = +el.dataset.i; Store.savePrefs({ outline: false }); O.show(false); setTimeout(function () { Slides.go(i); }, 330); };
  // a deck that opens follows the last choice
  O.sync = function () { if (!!Store.prefs().outline !== O.on) O.show(!!Store.prefs().outline, true); };
})();
