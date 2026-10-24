(function () {
  'use strict';
  Theme.init();
  I18n.init();
  Ui.guardBack();
  Router.navigate('home');
  App.start();
  // the entrance animation plays once; nothing replays when a list or card is redrawn
  setTimeout(function () { document.documentElement.classList.add('still'); }, 1400);
})();
