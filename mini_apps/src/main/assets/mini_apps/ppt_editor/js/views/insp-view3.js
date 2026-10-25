// InspView, animations: the list of what moves on this slide (in the order it plays), and the options of the one that is picked. Strings only; no event code (anim-vm.js).
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, V = window.InspView;
  var KINDS = { entr: ['appear', 'fade', 'flyIn', 'wipe', 'splitIn', 'bounce', 'flipIn', 'zoom'], emph: ['pulse', 'spin', 'grow', 'teeter'], exit: ['disappear', 'fadeOut', 'flyOut', 'wipeOut', 'shrink', 'zoomOut'], path: ['motionPath'] };
  V.ANIM = KINDS; V.TRIG = ['onClick', 'withPrevious', 'afterPrevious']; V.DIR = ['top', 'bottom', 'left', 'right']; V.DIRECTIONAL = ['flyIn', 'flyOut', 'wipe', 'wipeOut'];

  V.animRow = function (a, i, on, label) {
    return '<button type="button" class="ip-an' + (on ? ' on' : '') + '" data-ip="an-pick" data-v="' + i + '"><b>' + (i + 1) + '</b><span><em>' + esc(t('an.k.' + a.effect)) + '</em><small>' + esc(label) + '</small></span><i class="ip-ak ' + esc(a.kind) + '"></i></button>';
  };
  V.anim = function (items, pick, labelOf) {
    var h = items.length ? '<div class="ip-al">' + items.map(function (a, i) { return V.animRow(a, i, i === pick, labelOf(a)); }).join('') + '</div>' : '<p class="ip-note">' + esc(t('an.none')) + '</p>';
    var a = items[pick];
    if (a) {
      h += V.row(t('an.start'), V.sel('an-trig', t('an.t.' + a.trigger), t('an.start'))) + V.row(t('ip.effect'), V.sel('an-eff', t('an.k.' + a.effect), t('ip.effect')))
        + (V.DIRECTIONAL.indexOf(a.effect) >= 0 ? V.row(t('an.dir'), V.sel('an-dir', t('an.d.' + (a.direction || 'left')), t('an.dir'))) : '')
        + V.row(t('an.dur'), V.step('an-dur', Math.round(a.durationMs / 100) / 10, t('an.dur')) + '<span class="ip-u">s</span>') + V.row(t('ip.after'), V.step('an-delay', Math.round(a.delayMs / 100) / 10, t('ip.after')) + '<span class="ip-u">s</span>')
        + V.row(t('an.order'), V.ib('an-up', 'up', t('dk.moveup'), false) + V.ib('an-down', 'down', t('dk.movedown'), false) + V.ib('an-del', 'trash', t('a.delete'), false));
    }
    return h + V.row('', V.sel('an-add', t('an.add'), t('an.add')) + V.chip('an-play', t('dk.fromcur'), false));
  };
})();
