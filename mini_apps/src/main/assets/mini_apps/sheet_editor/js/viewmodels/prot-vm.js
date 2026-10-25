// Prot — sheet protection (Tools > Protect sheet): cells are locked unless the file marks them unlocked, and the choices of the form say what else stays allowed (formatting, inserting rows …).
// The engine writes the protection element. There is no password here: a sheet protected with a password in Excel can be opened and read, but only Excel can unlock it.
(function () {
  'use strict';
  var t = Ui.t, A = App.acts, G = window.Grid, D = window.Dlg, P = window.Prot = {}, last = 0;
  var PERMS = ['selectLockedCells', 'selectUnlockedCells', 'formatCells', 'formatColumns', 'formatRows', 'insertColumns', 'insertRows', 'insertHyperlinks', 'deleteColumns', 'deleteRows', 'sort', 'autoFilter'];
  var DEF = { selectLockedCells: true, selectUnlockedCells: true };
  P.say = function (what) { var n = Date.now(); if (n - last < 1500) return; last = n; Ui.toast(t(what === 'struct' ? 'pr.nostruct' : what === 'format' ? 'pr.noformat' : 'pr.locked')); };
  Wb.onLocked = P.say;
  // may these structure edits go ahead on a protected sheet
  P.allows = function (sh, ops) { var al = sh.prot && sh.prot.allow || {}, map = { 'insert-rows': 'insertRows', 'remove-rows': 'deleteRows', 'insert-cols': 'insertColumns', 'remove-cols': 'deleteColumns' }; return ops.every(function (o) { return !map[o.kind] || al[map[o.kind]]; }); };

  function form() {
    var h = '<p class="df-hint">' + t('pr.hint') + '</p>' + D.fld(t('pr.pw'), '<input class="field df-i" id="prPw" type="password" autocomplete="new-password" placeholder="' + Ui.esc(t('pr.pw.ph')) + '">') + '<div class="df-tg">';
    PERMS.forEach(function (k) { h += D.tgl(k, t('pr.p.' + k), D.st[k]); }); return h + '</div>';
  }
  function open() {
    if (Wb.readOnly || !G.geo) return; var sh = G.geo.sh;
    if (sh.prot) { if (!sh.prot.password) return off(sh, ''); D.st = {}; return D.show('prpw', t('pr.unprotect'), D.fld(t('pr.pw'), '<input class="field df-i" id="prPw" type="password" autocomplete="off">'), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'pr-off', label: t('pr.unprotect') }]); }
    D.st = Object.assign({}, DEF); D.show('prot', t('pr.title'), form(), [{ act: 'dl-cancel', label: t('a.cancel'), kind: 'ghost' }, { act: 'pr-on', label: t('pr.on') }]);
  }
  function off(sh, pw) { sh.protOut = { sheetName: sh.name, protected: false, verified: !!sh.prot.password }; sh.prot = null; sh.protDirty = true; Book.touch(); G.paint(true); Ui.toast(t('pr.off')); }
  A['pr-off'] = async function () { var sh = G.geo.sh, pw = D.val('prPw'); if (!(await PwHash.check(pw, sh.prot.hash))) return Ui.toast(t('pr.wrong')); D.close(); off(sh, pw); };
  A['pr-on'] = async function () {
    var sh = G.geo.sh, al = {}, pw = D.val('prPw'); PERMS.forEach(function (k) { al[k] = !!D.st[k]; }); var hash = pw ? await PwHash.make(pw) : null;
    sh.prot = { password: !!hash, allow: al, hash: hash }; sh.protOut = { sheetName: sh.name, protected: true, allow: al, password: hash }; sh.protDirty = true; D.close(); Book.touch(); G.paint(true); Ui.toast(t('pr.done'));
  };
  if (window.Menus) Menus.add('tools', function () { var on = G.geo && G.geo.sh.prot; return [{ t: t(on ? 'pr.unprotect' : 'pr.title') + '…', off: Wb.readOnly, go: open }]; });
})();
