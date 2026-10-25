// PresentView — the full-screen show: the two slide canvases, the bar with the counter and clock, the buttons, the notes card. Strings only; no event code.
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic;
  window.PresentView = {
    shell: function () {
      return '<div class="pr-prog" aria-hidden="true"><i id="prBar"></i></div>'
        + '<div class="pr-stage" id="prStage"><canvas id="prA" class="pr-cv"></canvas><canvas id="prB" class="pr-cv"></canvas><i class="laser hidden" id="prLaser" aria-hidden="true"></i><div class="pr-end hidden" id="prEnd"><b>' + esc(t('pr.end')) + '</b><span>' + esc(t('pr.end.s')) + '</span></div></div>'
        + '<div class="pr-top" id="prTop"><button type="button" class="pr-i" data-act="p-close" aria-label="' + esc(t('pr.exit')) + '">' + ic('close', 22, 2) + '</button><div class="pr-n" id="prN"></div><div class="pr-clock"><i></i><span id="prClock">00:00</span></div></div>'
        + '<button type="button" class="pr-notes" id="prNotes" data-act="p-notes"><div><span>' + esc(t('pr.notes')) + '</span>' + ic('up', 18, 2) + '</div><p id="prNoteText"></p></button>'
        + '<div class="pr-bar" id="prBtns"><button type="button" class="pr-i" id="prLaserBtn" data-act="p-laser" aria-label="' + esc(t('pr.laser')) + '">' + ic('laser', 24, 2) + '</button><button type="button" class="pr-i big" data-act="p-prev" aria-label="' + esc(t('pr.prev')) + '">' + ic('back', 26, 2.2) + '</button><button type="button" class="pr-i go" data-act="p-next" aria-label="' + esc(t('pr.next')) + '">' + ic('chev', 32, 2.4) + '</button></div>';
    }
  };
})();
