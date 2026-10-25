// PresentAnim — the animations of the boxes while presenting: each click plays one step (the effect and what goes with it), entrances start hidden, exits leave the slide.
(function () {
  'use strict';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var PA = window.PresentAnim = { cur: null };
  var ENTRANCE = { appear: 1, fade: 1, flyIn: 1, wipe: 1, wipeDown: 1, splitIn: 1, bounce: 1, flipIn: 1, zoom: 1 };
  var EXIT = { disappear: 1, fadeOut: 1, flyOut: 1, wipeOut: 1, shrink: 1, zoomOut: 1 };

  // the steps of a slide: a click starts one, "with previous" and "after previous" ride along inside it
  PA.prepare = async function (i, tree) {
    var st = { i: i, tree: tree, steps: [], at: 0, hidden: {}, busy: false, cv: null, f: null, ov: null }, items = [], cur = null, seen = {};
    try { items = await PptSvc.animations(i); } catch (e) { /* a slide without animations */ }
    items.forEach(function (a) {
      var n = tree.nodes.filter(function (x) { return x.durableId === a.el || x.sourceId === a.el; })[0];
      if (!n || (!ENTRANCE[a.effect] && !EXIT[a.effect] && ['pulse', 'spin', 'grow', 'teeter'].indexOf(a.effect) < 0)) return;
      var key = n.sourceId; if (!seen[key]) { seen[key] = 1; if (ENTRANCE[a.effect]) st.hidden[key] = true; }
      if (a.trigger === 'onClick' || !cur) { cur = { items: [], end: 0, auto: a.trigger !== 'onClick' }; st.steps.push(cur); }
      var start = a.trigger === 'afterPrev' ? cur.end : 0, d = Math.max(1, a.durationMs || 500);
      cur.items.push({ n: n, a: a, t: start + (a.delayMs || 0), d: d }); cur.end = Math.max(cur.end, start + (a.delayMs || 0) + d);
    });
    return st;
  };
  PA.bind = function (st, cv, f) { PA.reset(); PA.cur = st; st.cv = cv; st.f = f; if (st.steps[0] && st.steps[0].auto) PA.click(); };
  PA.reset = function () { var st = PA.cur; if (st && st.ov) st.ov.remove(); PA.cur = null; };
  function redraw(st) {
    var dpr = Math.min(2, window.devicePixelRatio || 1), c = st.cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); SlideDraw.draw(c, st.tree, st.hidden);
  }
  function frames(it, f) {
    var a = it.a, b = it.n.box, dir = a.direction || 'bottom', e = a.effect, far = { left: -(b.x + b.w), right: f.w - b.x, top: -(b.y + b.h), bottom: f.h - b.y }[dir];
    var move = function (p) { return dir === 'left' || dir === 'right' ? 'translateX(' + p + 'px)' : 'translateY(' + p + 'px)'; };
    var inset = { left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', top: 'inset(0 0 100% 0)', bottom: 'inset(100% 0 0 0)' }[e === 'wipeDown' ? 'top' : dir === 'bottom' ? 'left' : dir];
    var o = { appear: [{ opacity: 0 }, { opacity: 1 }], disappear: [{ opacity: 1 }, { opacity: 0 }], fade: [{ opacity: 0 }, { opacity: 1 }], fadeOut: [{ opacity: 1 }, { opacity: 0 }],
      flyIn: [{ transform: move(far), opacity: 0 }, { transform: 'none', opacity: 1 }], flyOut: [{ transform: 'none', opacity: 1 }, { transform: move(far), opacity: 0 }],
      wipe: [{ clipPath: inset }, { clipPath: 'inset(0)' }], wipeDown: [{ clipPath: inset }, { clipPath: 'inset(0)' }], wipeOut: [{ clipPath: 'inset(0)' }, { clipPath: inset }],
      splitIn: [{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0)' }], bounce: [{ transform: 'translateY(-' + Math.round(b.y + b.h) + 'px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      flipIn: [{ transform: 'perspective(700px) rotateY(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], zoom: [{ transform: 'scale(.2)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      zoomOut: [{ transform: 'none', opacity: 1 }, { transform: 'scale(.2)', opacity: 0 }], shrink: [{ transform: 'none', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }],
      pulse: [{ transform: 'none' }, { transform: 'scale(1.12)', offset: .5 }, { transform: 'none' }], grow: [{ transform: 'none' }, { transform: 'scale(1.25)' }],
      spin: [{ transform: 'none' }, { transform: 'rotate(360deg)' }], teeter: [{ transform: 'none' }, { transform: 'rotate(-8deg)', offset: .25 }, { transform: 'rotate(8deg)', offset: .75 }, { transform: 'none' }] };
    return o[e];
  }
  // one click: every item of the step gets its own canvas with only that box on it; the slide behind is drawn without them until the step ends
  PA.click = function () {
    var st = PA.cur; if (!st) return false; if (st.busy) return true; var step = st.steps[st.at]; if (!step) return false; st.at++; st.busy = true;
    var f = st.f, dpr = Math.min(2, window.devicePixelRatio || 1), ov = st.ov;
    if (!ov) { ov = st.ov = document.createElement('div'); ov.className = 'pr-ov'; ov.style.cssText = 'left:50%;top:50%;width:' + f.w + 'px;height:' + f.h + 'px;margin:' + (-f.h / 2) + 'px 0 0 ' + (-f.w / 2) + 'px'; document.getElementById('prStage').appendChild(ov); }
    var prior = {}; step.items.forEach(function (it) { prior[it.n.sourceId] = st.hidden[it.n.sourceId]; st.hidden[it.n.sourceId] = true; }); redraw(st);
    var runs = step.items.map(function (it) {
      var cv = document.createElement('canvas'), c = cv.getContext('2d'), b = it.n.box; cv.width = Math.round(f.w * dpr); cv.height = Math.round(f.h * dpr); cv.style.cssText = 'left:0;top:0;width:' + f.w + 'px;height:' + f.h + 'px;transform-origin:' + b.centerX + 'px ' + b.centerY + 'px';
      c.setTransform(dpr, 0, 0, dpr, 0, 0); SlideDraw.node(c, it.n); ov.appendChild(cv);
      var kf = frames(it, f), k = calm && calm.matches ? 1 : it.d;
      var an = cv.animate(kf, { duration: k, delay: calm && calm.matches ? 0 : it.t, fill: 'both', easing: it.a.effect === 'bounce' ? 'cubic-bezier(.3,1.5,.5,1)' : 'cubic-bezier(.2,.8,.2,1)' });
      return an.finished.catch(function () {}).then(function () { cv.remove(); });
    });
    Promise.all(runs).then(function () {
      step.items.forEach(function (it) { var id = it.n.sourceId, e = it.a.effect; st.hidden[id] = EXIT[e] ? true : ENTRANCE[e] ? false : !!prior[id]; if (!st.hidden[id]) delete st.hidden[id]; });
      if (PA.cur === st) redraw(st); st.busy = false;
    });
    return true;
  };
})();
