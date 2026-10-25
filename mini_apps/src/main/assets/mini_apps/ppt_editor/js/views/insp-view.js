// InspView — the format panel on the right of a computer: one scrolling column of sections (text, fill, outline, effects, then in insp-view2.js size, arrange, picture, table, slide). Strings only; no event code (insp-vm.js).
(function () {
  'use strict';
  var t = Ui.t, esc = Ui.esc, ic = Ui.ic, V = window.InspView = {};
  var DASH = ['solid', 'sysDot', 'sysDash', 'dash', 'dashDot', 'lgDash', 'lgDashDot'], ENDS = ['none', 'arrow', 'triangle', 'stealth', 'diamond', 'oval'];
  V.DASH = DASH; V.ENDS = ENDS;

  // ---- small parts -----------------------------------------------------------------------------------------------------------------------------
  V.sec = function (k, title, body, shut) {
    return '<section class="ip-s' + (shut ? ' shut' : '') + '" data-sec="' + k + '"><button type="button" class="ip-t" data-ip="sec" data-k="' + k + '"><span>' + esc(title) + '</span>' + ic('down', 14, 2.4) + '</button><div class="ip-b">' + body + '</div></section>';
  };
  V.row = function (label, html) { return '<div class="ip-r"><label>' + esc(label) + '</label><div class="ip-v">' + html + '</div></div>'; };
  V.ib = function (ip, icon, label, on, v) {
    return '<button type="button" class="ip-i' + (on ? ' on' : '') + '" data-ip="' + ip + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + ' title="' + esc(label) + '" aria-label="' + esc(label) + '">' + (icon.charAt(0) === '<' ? icon : ic(icon, 18, 1.9)) + '</button>';
  };
  V.sel = function (ip, text, label) { return '<button type="button" class="ip-sel" data-ip="' + ip + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '><span>' + esc(text) + '</span>' + ic('down', 12, 2.6) + '</button>'; };
  V.col = function (ip, color, label) {
    var none = !color || color === 'none';
    return '<button type="button" class="ip-c' + (none ? ' none' : '') + '" data-ip="' + ip + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"><i style="background:' + (none ? 'transparent' : esc(color)) + '"></i></button>';
  };
  V.num = function (id, val, label, w) { return '<input class="ip-n" type="text" inputmode="decimal" data-ipn="' + id + '" value="' + esc(val == null ? '' : val) + '" aria-label="' + esc(label || '') + '"' + (w ? ' style="width:' + w + 'px"' : '') + '>'; };
  V.step = function (id, val, label) { return '<span class="ip-st">' + V.ib(id, 'minus', '−', false, '-') + V.num(id, val, label) + V.ib(id, 'plus', '+', false, '+') + '</span>'; };
  V.seg = function (items) { return '<div class="ip-seg">' + items.join('') + '</div>'; };
  V.chip = function (ip, label, on, v) { return '<button type="button" class="ip-ch' + (on ? ' on' : '') + '" data-ip="' + ip + '"' + (v != null ? ' data-v="' + esc(v) + '"' : '') + '>' + esc(label) + '</button>'; };
  V.sw = function (ip, on, label) { return '<button type="button" class="ip-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-ip="' + ip + '" aria-label="' + esc(label) + '"><i></i></button>'; };
  V.head = function (title, sub) { return '<div class="ip-hd"><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; };
  V.dashName = function (d) { return t('ip.d.' + (d || 'solid')); };
  V.endName = function (e) { return t('ip.e.' + (e || 'none')); };

  // ---- text ---------------------------------------------------------------------------------------------------------------------------------------
  V.text = function (s) {
    var q = s.q, f = q.font || {}, m = q.more || {}, ps = q.paragraphs || [], p0 = ps[0] || {}, al = p0.align || 'left', bl = p0.bullet;
    return V.row(t('q.font'), V.sel('t-font', f.family || Fonts.def, t('q.font')) + V.step('t-size', f.size ? Math.round(f.size * 10) / 10 : '', t('q.size')))
      + V.row(t('ip.style'), V.ib('t-b', '<b>B</b>', t('f.bold'), f.bold) + V.ib('t-i', '<i>I</i>', t('f.italic'), f.italic) + V.ib('t-u', '<u>U</u>', t('f.under'), f.underline) + V.ib('t-s', '<s>S</s>', t('f.strike'), m.strike) + V.col('t-color', f.color, t('q.color')))
      + V.row(t('ip.align'), V.ib('t-al', 'alignl', t('f.alignl'), al === 'left', 'left') + V.ib('t-al', 'alignc', t('f.alignc'), al === 'center', 'center') + V.ib('t-al', 'alignr', t('f.alignr'), al === 'right', 'right') + V.ib('t-al', 'alignj', t('f.alignj'), al === 'justify', 'justify'))
      + V.row(t('ip.vert'), V.ib('t-anc', 'anchort', t('q.top'), q.anchor === 'top', 'top') + V.ib('t-anc', 'anchorm', t('q.mid'), q.anchor === 'middle', 'middle') + V.ib('t-anc', 'anchorb', t('q.bot'), q.anchor === 'bottom', 'bottom'))
      + V.row(t('ip.list'), V.ib('t-bul', 'bullets', t('f.bullets'), bl === 'char') + V.ib('t-num', '<span class="ip-no">1.</span>', t('ip.numbered'), bl === 'number') + V.ib('t-ind', 'alignl', t('f.outdent'), false, '-1') + V.ib('t-ind', 'alignj', t('f.indent'), false, '1'))
      + V.row(t('q.lines'), V.step('t-ls', Math.round(q.lineHeight || 100), t('q.lines')) + '<span class="ip-u">%</span>')
      + V.row(t('ip.before'), V.num('t-sb', m.spaceBefore == null ? '' : m.spaceBefore, t('ip.before'), 52) + '<span class="ip-u">pt</span>' + V.row2(t('ip.after'), V.num('t-sa', m.spaceAfter == null ? '' : m.spaceAfter, t('ip.after'), 52) + '<span class="ip-u">pt</span>'))
      + V.row(t('ip.autofit'), V.sel('t-fit', t('ip.fit.' + (m.autofit || 'none')), t('ip.autofit')));
  };
  V.row2 = function (label, html) { return '<label class="ip-l2">' + esc(label) + '</label>' + html; };

  // ---- fill ---------------------------------------------------------------------------------------------------------------------------------------
  V.fill = function (s) {
    var q = s.q, m = q.more || {}, kind = m.fillKind === 'gradient' ? 'gradient' : q.fill && q.fill !== 'none' ? 'solid' : m.fillKind === 'image' ? 'image' : 'none', g = m.gradient, h = V.seg([V.chip('f-kind', t('ip.none'), kind === 'none', 'none'), V.chip('f-kind', t('ip.solid'), kind === 'solid', 'solid'), V.chip('f-kind', t('ip.gradient'), kind === 'gradient', 'gradient')]);
    if (kind === 'solid') h += V.row(t('q.color'), V.col('f-color', q.fill, t('q.fill')) + V.alpha(q.fill));
    if (kind === 'gradient' && g) {
      var a = Math.round(((g.angle || 0) / 60000) % 360);
      h += V.row(t('ip.stops'), V.col('f-g0', g.stops[0] && g.stops[0].color, t('ip.stop1')) + '<span class="ip-ar">→</span>' + V.col('f-g1', g.stops[g.stops.length - 1] && g.stops[g.stops.length - 1].color, t('ip.stop2')) + V.ib('f-gswap', 'flip', t('ip.swap'), false))
        + V.row(t('ip.angle'), V.num('f-gang', a, t('ip.angle'), 56) + '<span class="ip-u">°</span>' + V.chip('f-gtype', t(g.path ? 'ip.radial' : 'ip.linear'), false));
    }
    return h;
  };
  // a colour may carry its see-through part as #RRGGBBAA
  V.alpha = function (c) { var a = c && /^#[0-9a-f]{8}$/i.test(c) ? Math.round(parseInt(c.slice(7), 16) / 255 * 100) : 100; return '<span class="ip-ar">' + esc(t('ip.opaque')) + '</span>' + V.num('f-alpha', a, t('ip.opaque'), 48) + '<span class="ip-u">%</span>'; };

  // ---- outline ------------------------------------------------------------------------------------------------------------------------------------
  V.line = function (s) {
    var q = s.q, m = q.more || {}, st = q.stroke, on = !!st, h = V.seg([V.chip('l-kind', t('ip.none'), !on, 'none'), V.chip('l-kind', t('ip.solid'), on, 'solid')]);
    if (on) {
      h += V.row(t('q.color'), V.col('l-color', st.color, t('q.line'))) + V.row(t('q.width'), V.step('l-w', Math.round(st.widthPt * 100) / 100, t('q.width')) + '<span class="ip-u">pt</span>')
        + V.row(t('ip.dash'), V.sel('l-dash', V.dashName(m.dash), t('ip.dash')));
    }
    return h;
  };

  // ---- effects --------------------------------------------------------------------------------------------------------------------------------------
  V.effects = function (s) {
    var q = s.q, m = q.more || {}, sh = m.shadowFull || (q.shadow ? {} : null);
    var h = V.row(t('q.shadow'), V.sw('e-shadow', !!sh, t('q.shadow')));
    if (sh) h += V.row(t('ip.blur'), V.step('e-sblur', sh.blurRad != null ? Math.round(sh.blurRad / 12700) : 6, t('ip.blur')) + '<span class="ip-u">pt</span>') + V.row(t('ip.dist'), V.step('e-sdist', sh.dist != null ? Math.round(sh.dist / 12700) : 3, t('ip.dist')) + '<span class="ip-u">pt</span>');
    h += V.row(t('ip.glow'), V.sw('e-glow', !!m.glow, t('ip.glow')) + (m.glow ? V.col('e-gcolor', m.glow.color, t('ip.glow')) : ''));
    if (m.glow) h += V.row(t('ip.radius'), V.step('e-grad', Math.round(m.glow.radius / 12700), t('ip.radius')) + '<span class="ip-u">pt</span>');
    h += V.row(t('ip.reflect'), V.sw('e-refl', !!m.reflection, t('ip.reflect')));
    if (s.isPic) h += V.row(t('ip.soft'), V.step('e-soft', Math.round((m.softEdge || 0) / 12700), t('ip.soft')) + '<span class="ip-u">pt</span>');
    return h;
  };
})();
