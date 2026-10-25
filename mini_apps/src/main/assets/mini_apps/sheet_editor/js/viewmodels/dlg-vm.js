// Dlg — the pieces the forms are made of (a labelled box, a text input, a switch, a drop-down made with PopMenu, the buttons) so that data validation, links, notes, names, rules and the like all look and behave the same.
// A form lives in the usual sheet: a bottom sheet on a phone, a centred window on a computer. Dlg.st keeps what the form holds while it is open.
(function () {
  'use strict';
  var $ = Ui.$, t = Ui.t, esc = Ui.esc, A = App.acts, D = window.Dlg = { st: {} };

  D.fld = function (label, inner, o) { o = o || {}; return '<div class="df' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><label class="df-l">' + esc(label) + '</label>' + inner + '</div>'; };
  D.input = function (id, value, ph, o) { o = o || {}; return '<input class="field df-i" id="' + id + '" type="text" value="' + esc(value || '') + '" placeholder="' + esc(ph || '') + '" autocomplete="off" spellcheck="false"' + (o.num ? ' inputmode="decimal"' : '') + '>'; };
  D.area = function (id, value, ph) { return '<textarea class="field df-i df-a" id="' + id + '" rows="3" placeholder="' + esc(ph || '') + '" spellcheck="false">' + esc(value || '') + '</textarea>'; };
  D.tgl = function (id, label, on) { D.st[id] = !!on; return '<button type="button" class="df-t' + (on ? ' on' : '') + '" role="switch" aria-checked="' + !!on + '" data-act="dl-tg" data-id="' + id + '"><span class="df-tl">' + esc(label) + '</span><i></i></button>'; };
  // a drop-down: items [{ v, t }]; the value is in Dlg.st[id]; onPick(v) after a choice
  D.sel = function (id, value, items) {
    D.st[id] = value; D.items = D.items || {}; D.items[id] = items; var cur = items.filter(function (i) { return i.v === value; })[0];
    return '<button type="button" class="df-s" data-act="dl-sel" data-id="' + id + '" id="sel-' + id + '"><span>' + esc(cur ? cur.t : '') + '</span>' + Ui.ic('down', 14, 2.4) + '</button>';
  };
  D.buttons = function (list) { return '<div class="btns">' + list.map(function (b) { return '<button type="button" class="btn' + (b.kind === 'ghost' ? ' ol' : b.kind === 'danger' ? ' dn' : '') + '" data-act="' + b.act + '">' + esc(b.label) + '</button>'; }).join('') + '</div>'; };
  D.show = function (name, title, body, buttons) { Ui.sheet(name, '<h2 class="sh-h">' + esc(title) + '</h2><div class="df-wrap">' + body + '</div>' + D.buttons(buttons)); };
  D.val = function (id) { var e = $(id); return e ? e.value : ''; };
  D.close = function () { Ui.closeSheet(); };
  D.change = null;   // a form sets this to be told when a drop-down or a switch changed (it then draws itself again)

  A['dl-tg'] = function (el) { var id = el.dataset.id; D.st[id] = !D.st[id]; el.classList.toggle('on', D.st[id]); el.setAttribute('aria-checked', D.st[id]); if (D.change) D.change(id, D.st[id]); };
  A['dl-sel'] = function (el) {
    var id = el.dataset.id, r = el.getBoundingClientRect();
    PopMenu.show(r.left, r.bottom + 4, (D.items[id] || []).map(function (i) { return { t: i.t, on: i.v === D.st[id], go: function () { D.st[id] = i.v; el.firstChild.textContent = i.t; if (D.change) D.change(id, i.v); } }; }), { from: el });
  };
  A['dl-cancel'] = D.close;
})();
