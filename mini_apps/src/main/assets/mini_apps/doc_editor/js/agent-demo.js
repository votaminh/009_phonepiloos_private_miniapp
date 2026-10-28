// Test-only demo: a small PiloAgent surface for the Doc editor.
// It is not part of the app; load the page with ?agentdemo=1 to show the panel.
(function () {
  'use strict';
  if (!window.App || !window.Doc || !window.Edit || !window.Ui) return;

  var FONTS = ['Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Courier New'];
  var calls = [];

  var typingStyle = document.createElement('style');
  typingStyle.textContent = '.pilo-typing{background:rgba(31,78,121,.035);border-radius:2px;caret-color:#1F4E79;transition:background .2s}' +
    '.pilo-sig,.pilo-sig td{border:none!important;background:transparent!important}';
  document.head.appendChild(typingStyle);

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function waitFor(fn, timeout) {
    var end = Date.now() + (timeout || 5000);
    while (Date.now() < end) { if (fn()) return true; await sleep(50); }
    throw new Error('timeout waiting for the editor');
  }

  function appReady() {
    var top = document.getElementById('homeTop');
    return !!top && top.children.length > 0;
  }

  async function waitApp() {
    if (Doc.rec) return;
    await waitFor(appReady, 8000);
  }

  function editableBlock() {
    var p = Doc.paper();
    return p && p.querySelector('.b.ed');
  }

  function selectionInPaper() {
    var s = getSelection();
    var n = s && s.rangeCount ? s.anchorNode : null;
    var el = n && (n.nodeType === 3 ? n.parentElement : n);
    return !!(el && el.closest && el.closest('#paper'));
  }

  function restoreRange() {
    if (!Doc.range) return false;
    try {
      var s = getSelection();
      s.removeAllRanges();
      s.addRange(Doc.range);
      return selectionInPaper();
    } catch (e) {
      return false;
    }
  }

  function focusEnd() {
    var b = editableBlock();
    if (!b) throw new Error('no editable paragraph');
    b.focus();
    var r = document.createRange();
    r.selectNodeContents(b);
    r.collapse(false);
    var s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    return b;
  }

  async function ensureEdit() {
    await waitApp();
    if (!Doc.rec || Doc.mode !== 'edit') {
      await App.acts['h-new']();
      await waitFor(function () { return Doc.mode === 'edit' && !!editableBlock(); }, 6000);
    }
    if (!selectionInPaper() && !restoreRange()) focusEnd();
  }

  async function insertText(text, opts) {
    if (!text) throw new Error('text is required');
    opts = opts || {};
    document.execCommand('styleWithCSS', false, true);
    if (opts.speed === 'instant') {
      if (!document.execCommand('insertText', false, text)) throw new Error('insertText failed');
      Doc.touch();
      Edit.sync();
      return { ok: true, text: text, speed: 'instant' };
    }

    var chars = Array.from(text), b = currentBlock(), medium = opts.speed === 'medium', slow = opts.speed === 'slow';
    var st = document.getElementById('adStatus');
    if (b) b.classList.add('pilo-typing');
    if (st) st.textContent = 'Agent is typing…';
    try {
      for (var i = 0; i < chars.length;) {
        var n = slow ? 1 + Math.floor(Math.random() * 2)
          : medium ? 2 + Math.floor(Math.random() * 3)
          : 1 + Math.floor(Math.random() * 2);
        var chunk = chars.slice(i, i + n).join('');
        i += n;
        var typed = false;
        for (var tries = 0; tries < 4 && !typed; tries++) {
          if (!selectionInPaper() && !restoreRange()) focusEnd();
          try { typed = document.execCommand('insertText', false, chunk); } catch (e) { typed = false; }
          if (!typed) await sleep(40 + Math.random() * 40);
        }
        if (!typed) throw new Error('insertText failed at ' + i);
        var cur = null;
        try { cur = currentBlock(); } catch (e) {}
        if (cur) cur.classList.add('pilo-typing');
        if (i % 8 === 0) {
          var node = getSelection().anchorNode;
          var el = node && (node.nodeType === 3 ? node.parentElement : node);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        }
        var last = Array.from(chunk).pop();
        var delay = slow ? 26 + Math.random() * 12
          : medium ? 12 + Math.random() * 8
          : 18 + Math.random() * 12;
        if (last === ' ') delay += 10;
        if (/[.,;:!?]/.test(last)) delay += 40 + Math.random() * 30;
        if (i > 0 && i % 15 === 0) delay += 25 + Math.random() * 20;
        await sleep(delay);
      }
    } finally {
      Array.prototype.forEach.call(Doc.paper().querySelectorAll('.pilo-typing'), function (el) { el.classList.remove('pilo-typing'); });
      if (st) st.textContent = 'Ready.';
    }
    Doc.touch();
    Edit.sync();
    return { ok: true, text: text, chars: chars.length, speed: 'human' };
  }

  function setFont(font) {
    if (FONTS.indexOf(font) < 0) throw new Error('unsupported font: ' + font);
    var b = currentBlock();
    b.dataset.f = font;
    b.style.fontFamily = window.Render && Render.family ? Render.family(font) : font;
    Doc.touch();
    return { ok: true, font: font };
  }

  function setSize(size) {
    size = Math.max(6, Math.min(72, Math.round(+size)));
    currentBlock().style.fontSize = size + 'pt';
    Doc.touch();
    return { ok: true, size: size };
  }

  function setColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color || '')) throw new Error('color must be #RRGGBB');
    currentBlock().style.color = color;
    Doc.touch();
    return { ok: true, color: color };
  }

  function newline() {
    if (!document.execCommand('insertLineBreak')) document.execCommand('insertHTML', false, '<br>');
  }

  async function newDocument() {
    await waitApp();
    await App.acts['h-new']();
    await waitFor(function () { return Doc.mode === 'edit' && !!editableBlock(); }, 6000);
    focusEnd();
    return { ok: true };
  }

  function newParagraph() {
    var b = Edit.block();
    if (!b) throw new Error('no current paragraph');
    Struct.split(b);
    return { ok: true };
  }

  function setAlign(p) {
    var a = p && p.align;
    if (['left', 'center', 'right', 'justify'].indexOf(a) < 0) throw new Error('align must be left|center|right|justify');
    App.acts['e-al-' + a]();
    return { ok: true, align: a };
  }

  function currentBlock() {
    var b = Edit.block();
    if (!b) throw new Error('no current paragraph');
    return b;
  }

  function setBold(p) {
    var on = !(p && p.on === false);
    var b = currentBlock();
    b.style.fontWeight = on ? '700' : '400';
    Doc.touch();
    return { ok: true, bold: on };
  }

  function setItalic(p) {
    var on = !(p && p.on === false);
    var b = currentBlock();
    b.style.fontStyle = on ? 'italic' : '';
    Doc.touch();
    return { ok: true, italic: on };
  }

  async function insertSignatureTable(p) {
    p = p || {};
    var leftTitle = p.leftTitle || 'ỨNG VIÊN XÁC NHẬN';
    var leftName = p.leftName || 'Trần Thanh Sơn';
    var rightTitle = p.rightTitle || 'ĐẠI DIỆN CÔNG TY';
    var rightRole = p.rightRole || 'Giám đốc Nhân sự';
    var rightName = p.rightName || 'Nguyễn Thị Hồng';
    var fam = p.font && window.Render && Render.family ? Render.family(p.font) : (p.font || '');
    var size = p.size || 12;
    var tableStyle = 'width:100%;table-layout:fixed;border-collapse:collapse;border:none;' +
      (fam ? 'font-family:' + fam + ';' : '') + 'font-size:' + size + 'pt;';
    var xml = await DocSvc.table(1, 2);
    var rows = '<tr>' +
      '<td data-new="1" style="border:none;text-align:center;vertical-align:top;padding:10px 8px"><br data-ph></td>' +
      '<td data-new="1" style="border:none;text-align:center;vertical-align:top;padding:10px 8px"><br data-ph></td>' +
      '</tr>';
    var el = Insert.block('tbl', '<table class="pilo-sig" style="' + tableStyle + '">' + rows + '</table>', xml);
    el.dataset.simple = '1';
    Insert.place(el);
    Table.arm(true);
    function cellHtml(title, role, name) {
      return '<p style="text-align:center;margin:0 0 4px"><b>' + title + '</b></p>' +
        (role ? '<p style="text-align:center;margin:0 0 4px">' + role + '</p>' : '') +
        '<p style="text-align:center;margin:0 0 4px">' + name + '</p>' +
        '<p style="text-align:center;margin:0;font-style:italic">(Ký và ghi rõ họ tên)</p>';
    }
    var tds = el.querySelectorAll('td');
    tds[0].innerHTML = cellHtml(leftTitle, '', leftName);
    tds[1].innerHTML = cellHtml(rightTitle, rightRole, rightName);
    tds[0].dataset.m = '1';
    tds[1].dataset.m = '1';
    Doc.snap();
    Doc.touch();
    Edit.sync();
    return { ok: true, columns: 2 };
  }

  async function insertEquation(p) {
    var latex = (p && p.latex || '').trim();
    if (!latex) throw new Error('latex is required');
    var align = p.align || 'center';
    if (['left', 'center', 'right'].indexOf(align) < 0) throw new Error('align must be left|center|right');
    var r = await DocSvc.math(latex, align);
    var el = Insert.block('eq al-' + align, Render.math(r.mathml), r.xml);
    el.dataset.latex = latex;
    Insert.place(el);
    Doc.snap();
    Doc.touch();
    Edit.sync();
    return { ok: true, latex: latex, align: align };
  }

  function inlineMathText(latex) {
    var s = String(latex || '');
    s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
    var map = [
      ['\\left', ''], ['\\right', ''], ['\\,', ''], ['\\;', ''], ['\\!', ''],
      ['\\int', '∫'], ['\\sum', '∑'], ['\\sqrt', '√'], ['\\pi', 'π'], ['\\alpha', 'α'],
      ['\\beta', 'β'], ['\\theta', 'θ'], ['\\lambda', 'λ'], ['\\mu', 'μ'],
      ['\\leq', '≤'], ['\\le', '≤'], ['\\geq', '≥'], ['\\ge', '≥'], ['\\neq', '≠'],
      ['\\pm', '±'], ['\\infty', '∞'], ['\\cdot', '·'], ['\\times', '×'], ['\\to', '→'],
      ['\\log', 'log'], ['\\sin', 'sin'], ['\\cos', 'cos'], ['\\tan', 'tan'], ['\\lim', 'lim']
    ];
    map.forEach(function (pair) { s = s.split(pair[0]).join(pair[1]); });
    var sup = '⁰¹²³⁴⁵⁶⁷⁸⁹', sub = '₀₁₂₃₄₅₆₇₈₉';
    s = s.replace(/\^\{?([0-9])\}?/g, function (_, d) { return sup[+d]; });
    s = s.replace(/_\{?([0-9])\}?/g, function (_, d) { return sub[+d]; });
    s = s.replace(/[{}]/g, '').replace(/-/g, '−').replace(/\+/g, ' + ').replace(/=/g, ' = ');
    return s.replace(/\s+/g, ' ').trim();
  }

  async function insertInlineMath(p) {
    var latex = (p && p.latex || '').trim();
    if (!latex) throw new Error('latex is required');
    var text = inlineMathText(latex);
    await insertText(text, { speed: p.speed || 'slow' });
    return { ok: true, latex: latex, text: text };
  }

  async function runDemo() {
    await waitApp();
    await App.acts['h-new']();
    await waitFor(function () { return Doc.mode === 'edit' && !!editableBlock(); }, 6000);
    focusEnd();
    var lines = [
      { text: 'Piloos Doc - Agent demo', font: 'Georgia', size: 24, color: '#1F4E79' },
      { text: 'Dong nay: Arial, 16pt, mau do.', font: 'Arial', size: 16, color: '#C0392B' },
      { text: 'Dong nay: Courier New, 12pt, mau xanh.', font: 'Courier New', size: 12, color: '#2E7D32' },
      { text: 'Tool call: insert_text -> set_font -> set_size -> set_color', font: 'Calibri', size: 11, color: '#555555' }
    ];
    calls.length = 0;
    paintLog('Running demo...');
    for (var i = 0; i < lines.length; i++) {
      await window.PiloAgent.call('set_font', { font: lines[i].font });
      await window.PiloAgent.call('set_size', { size: lines[i].size });
      await window.PiloAgent.call('set_color', { color: lines[i].color });
      await window.PiloAgent.call('insert_text', { text: lines[i].text });
      if (i < lines.length - 1) newline();
    }
    Doc.snap();
    Doc.touch();
    Edit.sync();
    return { ok: true, lines: lines.length };
  }

  async function playFullDemo() {
    await waitApp();
    var steps = [
      ['new_document', {}],
      ['set_align', { align: 'center' }],
      ['set_font', { font: 'Times New Roman' }],
      ['set_size', { size: 13 }],
      ['set_bold', { on: true }],
      ['set_italic', { on: false }],
      ['insert_text', { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Độc lập - Tự do - Hạnh phúc' }],
      ['new_paragraph', {}],
      ['set_size', { size: 12 }],
      ['set_bold', { on: false }],
      ['insert_text', { text: '____________________' }],
      ['new_paragraph', {}],
      ['set_size', { size: 18 }],
      ['set_bold', { on: true }],
      ['insert_text', { text: 'ĐƠN XIN NGHỈ PHÉP' }],
      ['new_paragraph', {}],
      ['new_paragraph', {}],
      ['set_align', { align: 'left' }],
      ['set_size', { size: 12 }],
      ['set_bold', { on: true }],
      ['insert_text', { text: 'Kính gửi: Ban Giám đốc Công ty TNHH PiloOS Việt Nam' }],
      ['new_paragraph', {}],
      ['set_bold', { on: false }],
      ['insert_text', { text: 'Tôi tên: Nguyễn Văn Minh' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Chức vụ: Nhân viên Phát triển phần mềm' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Bộ phận: Phòng Kỹ thuật' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Lý do nghỉ: Có việc gia đình đột xuất, cần về quê giải quyết.' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Thời gian nghỉ: từ ngày 30/10/2026 đến ngày 01/11/2026' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Số ngày nghỉ: 03 ngày' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Bàn giao công việc cho: Anh Trần Quốc Bảo' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Tôi cam kết hoàn thành công việc được giao và chấp hành đúng quy định của Công ty.' }],
      ['new_paragraph', {}],
      ['new_paragraph', {}],
      ['set_align', { align: 'right' }],
      ['insert_text', { text: 'Hà Nội, ngày 29 tháng 10 năm 2026' }],
      ['new_paragraph', {}],
      ['set_bold', { on: true }],
      ['insert_text', { text: 'Người làm đơn' }],
      ['new_paragraph', {}],
      ['set_bold', { on: false }],
      ['set_italic', { on: true }],
      ['insert_text', { text: '(Ký và ghi rõ họ tên)' }],
      ['new_paragraph', {}],
      ['set_italic', { on: false }],
      ['insert_text', { text: 'Nguyễn Văn Minh' }],
      ['new_paragraph', {}]
    ];
    for (var i = 0; i < steps.length; i++) await window.PiloAgent.call(steps[i][0], steps[i][1]);
    Doc.snap();
    Doc.touch();
    Edit.sync();
    await sleep(500);
    var body = document.getElementById('docBody');
    if (body) body.scrollTop = 0;
    return { ok: true, steps: steps.length };
  }

  async function runSteps(steps) {
    await waitApp();
    for (var i = 0; i < steps.length; i++) await window.PiloAgent.call(steps[i][0], steps[i][1]);
    Doc.snap();
    Doc.touch();
    Edit.sync();
    await sleep(400);
    var body = document.getElementById('docBody');
    if (body) body.scrollTop = 0;
    return { ok: true, steps: steps.length };
  }

  function playOnboardDemo() {
    return runSteps([
      ['new_document', {}],
      ['set_align', { align: 'left' }],
      ['set_font', { font: 'Times New Roman' }],
      ['set_size', { size: 12 }],
      ['set_bold', { on: true }],
      ['set_italic', { on: false }],
      ['insert_text', { text: 'CÔNG TY TNHH PILOOS VIỆT NAM' }],
      ['new_paragraph', {}],
      ['set_size', { size: 10 }],
      ['set_bold', { on: false }],
      ['insert_text', { text: 'Địa chỉ: Tầng 8, Tòa nhà PiloOS, Hà Nội' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Email: hr@piloos.com  |  ĐT: 024 9999 8888' }],
      ['new_paragraph', {}],
      ['set_align', { align: 'right' }],
      ['set_size', { size: 11 }],
      ['insert_text', { text: 'Số: 29/2026/TMNV-PILOOS' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Hà Nội, ngày 29 tháng 10 năm 2026' }],
      ['new_paragraph', {}],
      ['set_align', { align: 'center' }],
      ['set_size', { size: 18 }],
      ['set_bold', { on: true }],
      ['insert_text', { text: 'THƯ MỜI NHẬN VIỆC' }],
      ['new_paragraph', {}],
      ['set_align', { align: 'left' }],
      ['set_size', { size: 12 }],
      ['set_bold', { on: false }],
      ['new_paragraph', {}],
      ['set_bold', { on: true }],
      ['insert_text', { text: 'Kính gửi: Ông Trần Thanh Sơn' }],
      ['new_paragraph', {}],
      ['set_bold', { on: false }],
      ['insert_text', { text: 'Năm sinh: 2003' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Công ty TNHH PiloOS Việt Nam trân trọng thông báo và mời Ông Trần Thanh Sơn đến nhận việc tại Công ty với các thông tin sau:' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Vị trí: Nhân viên Phát triển phần mềm' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Mức lương: 6.500.000 đồng/tháng (Bằng chữ: Sáu triệu năm trăm nghìn đồng)' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Thời gian làm việc: Thứ Hai đến Thứ Sáu hằng tuần, 08:30 – 17:30' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Ngày bắt đầu: Thứ Hai, ngày 02/11/2026' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Địa điểm: Văn phòng Công ty tại Hà Nội' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Hồ sơ cần chuẩn bị: CCCD, bằng cấp, ảnh 3x4, sổ BHXH (nếu có)' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Đề nghị Ông xác nhận tham gia trước ngày 31/10/2026 qua email hr@piloos.com hoặc số điện thoại 024 9999 8888.' }],
      ['new_paragraph', {}],
      ['insert_text', { text: 'Chúc Ông sức khỏe và mong sớm được chào đón Ông tại PiloOS.' }],
      ['new_paragraph', {}],
      ['new_paragraph', {}],
      ['insert_signature_table', {
        leftTitle: 'ỨNG VIÊN XÁC NHẬN',
        leftName: 'Trần Thanh Sơn',
        rightTitle: 'ĐẠI DIỆN CÔNG TY',
        rightRole: 'Giám đốc Nhân sự',
        rightName: 'Nguyễn Thị Hồng'
      }]
    ]);
  }

  var methods = {
    insert_text: function (p) { return insertText(p.text, p); },
    set_font: function (p) { return setFont(p.font); },
    set_size: function (p) { return setSize(p.size); },
    set_color: function (p) { return setColor(p.color); },
    new_document: function () { return newDocument(); },
    new_paragraph: function () { return newParagraph(); },
    set_align: function (p) { return setAlign(p); },
    set_bold: function (p) { return setBold(p); },
    set_italic: function (p) { return setItalic(p); },
    insert_signature_table: function (p) { return insertSignatureTable(p); },
    insert_equation: function (p) { return insertEquation(p); },
    insert_inline_math: function (p) { return insertInlineMath(p); },
    run_steps: async function (p) {
      var panel = document.getElementById('adPanel');
      if (panel) panel.style.display = 'none';
      var steps = (p && p.steps) || [];
      for (var i = 0; i < steps.length; i++) await window.PiloAgent.call(steps[i][0], steps[i][1]);
      Doc.snap();
      Doc.touch();
      Edit.sync();
      await sleep(300);
      var body = document.getElementById('docBody');
      if (body) body.scrollTop = 0;
      return { ok: true, steps: steps.length };
    },
    demo: function () { return runDemo(); }
  };

  function paintLog(emptyText) {
    var pre = document.getElementById('adLog');
    if (!pre) return;
    if (!calls.length) {
      pre.textContent = emptyText || 'Ready.';
    } else {
      pre.textContent = calls.slice().reverse().map(function (c) {
        return (c.error ? 'ERR ' : 'OK  ') + c.method + ' ' + JSON.stringify(c.params) + (c.error ? ' -> ' + c.error : '');
      }).join('\n');
      pre.scrollTop = 0;
    }
  }

  function record(method, params, result, error) {
    var logged = method === 'run_js' ? { code: '<js>' }
      : method === 'run_steps' ? { steps: (params && params.steps || []).length }
      : params;
    var row = { at: new Date().toISOString(), method: method, params: logged, result: result, error: error ? String(error.message || error) : null };
    calls.push(row);
    if (calls.length > 30) calls.shift();
    paintLog();
    (error ? console.error : console.log)('[PiloAgent]', method, logged, error || result);
  }

  window.PiloAgent = {
    describe: function () {
      return {
        name: 'doc_editor',
        methods: [
          { name: 'insert_text', params: { text: 'string' }, description: 'Insert text at the caret.' },
          { name: 'set_font', params: { font: FONTS }, description: 'Set the font for the next typed text or the selection.' },
          { name: 'set_size', params: { size: 'number 6..72' }, description: 'Set the font size in pt.' },
          { name: 'set_color', params: { color: '#RRGGBB' }, description: 'Set the text color.' },
          { name: 'new_document', params: {}, description: 'Create a blank document in edit mode.' },
          { name: 'new_paragraph', params: {}, description: 'Split the current paragraph and move the caret to the new one.' },
          { name: 'set_align', params: { align: 'left|center|right|justify' }, description: 'Align the current paragraph.' },
          { name: 'set_bold', params: { on: 'boolean' }, description: 'Set bold on the current paragraph.' },
          { name: 'set_italic', params: { on: 'boolean' }, description: 'Set italic on the current paragraph.' },
          { name: 'insert_signature_table', params: { leftTitle: 'string', leftName: 'string', rightTitle: 'string', rightRole: 'string', rightName: 'string', font: 'string', size: 'number' }, description: 'Insert a borderless two-column signature block.' },
          { name: 'insert_equation', params: { latex: 'string', align: 'left|center|right' }, description: 'Insert a real Word equation from LaTeX (OMML + MathML preview).' },
          { name: 'insert_inline_math', params: { latex: 'string' }, description: 'Insert a simple formula inline as Unicode text, so it wraps with the paragraph and saves as text.' },
          { name: 'run_steps', params: { steps: '[[method, params], ...]' }, description: 'Run a list of tool calls in order.' },
          { name: 'demo', params: {}, description: 'Create a new document and run all four calls.' }
        ]
      };
    },
    call: async function (method, params) {
      params = params || {};
      if (!methods[method]) throw new Error('unknown method: ' + method);
      try {
        await ensureEdit();
        var result = await methods[method](params);
        record(method, params, result, null);
        return result;
      } catch (e) {
        record(method, params, null, e);
        throw e;
      }
    },
    calls: function () { return calls.slice(); }
  };

  var q = location.search;
  if (q.indexOf('agentdemo') < 0) return;

  document.addEventListener('keydown', function (e) {
    if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      playFullDemo().catch(function (err) { console.error(err); });
    }
    if (e.altKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      playOnboardDemo().catch(function (err) { console.error(err); });
    }
  });

  if (q.indexOf('hidepanel') >= 0) {
    if (q.indexOf('autodemo') >= 0) {
      var demo = q.indexOf('autodemo=onboard') >= 0 ? playOnboardDemo : playFullDemo;
      setTimeout(function () { demo().catch(function (err) { console.error(err); }); }, 900);
    }
    return;
  }

  function panel() {
    var box = document.createElement('div');
    box.id = 'adPanel';
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:320px;background:#fff;color:#222;border:1px solid #d0d0d0;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.24);font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;overflow:hidden';
    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1F4E79;color:#fff">' +
        '<b style="flex:1">PiloAgent demo</b>' +
        '<button type="button" id="adClose" style="background:transparent;border:0;color:#fff;font-size:16px;cursor:pointer">×</button>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px">' +
        '<button type="button" data-ad="demo" style="flex:1 0 100%;padding:8px;border:0;border-radius:8px;background:#1F4E79;color:#fff;cursor:pointer">Run full demo</button>' +
        '<button type="button" data-ad="new_document" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">New doc</button>' +
        '<button type="button" data-ad="new_paragraph" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">New paragraph</button>' +
        '<button type="button" data-ad="set_align" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Center</button>' +
        '<button type="button" data-ad="set_bold" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Bold</button>' +
        '<button type="button" data-ad="insert_text" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Insert text</button>' +
        '<button type="button" data-ad="set_font" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Font Georgia</button>' +
        '<button type="button" data-ad="set_size" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Size 18</button>' +
        '<button type="button" data-ad="set_color" style="padding:7px 9px;border:1px solid #ccc;border-radius:8px;background:#fafafa;cursor:pointer">Color red</button>' +
      '</div>' +
      '<div style="display:grid;gap:6px;padding:0 10px 10px">' +
        '<select id="adMethod" style="padding:6px;border:1px solid #ccc;border-radius:8px">' +
          '<option>new_document</option><option>new_paragraph</option><option>set_align</option>' +
          '<option>set_font</option><option>set_size</option><option>set_color</option>' +
          '<option>set_bold</option><option>set_italic</option><option>insert_text</option><option>demo</option>' +
          '<option>insert_equation</option>' +
          '<option>insert_inline_math</option>' +
          '<option>run_steps</option>' +
        '</select>' +
        '<textarea id="adParams" rows="2" placeholder=\'{"align":"center"}\' style="padding:6px;border:1px solid #ccc;border-radius:8px;font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace">{}</textarea>' +
        '<button type="button" id="adCall" style="padding:8px;border:0;border-radius:8px;background:#1F4E79;color:#fff;cursor:pointer">Call tool</button>' +
      '</div>' +
      '<div id="adStatus" style="padding:0 10px 8px;font-size:11px;color:#666">Ready.</div>' +
      '<pre id="adLog" style="margin:0;padding:8px 10px 12px;max-height:150px;overflow:auto;background:#f6f6f6;border-top:1px solid #e5e5e5;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">Ready.</pre>';
    document.body.appendChild(box);
    document.getElementById('adClose').onclick = function () { box.remove(); };
    var callBtn = document.getElementById('adCall');
    callBtn.onclick = async function () {
      var method = document.getElementById('adMethod').value;
      var raw = (document.getElementById('adParams').value || '{}').trim() || '{}';
      var params;
      try { params = JSON.parse(raw); } catch (e) { record(method, raw, null, e); return; }
      callBtn.disabled = true;
      try { await window.PiloAgent.call(method, params); } catch (e) {} finally { callBtn.disabled = false; }
    };
    Array.prototype.forEach.call(box.querySelectorAll('[data-ad]'), function (b) {
      b.onclick = async function () {
        var method = b.dataset.ad;
        var params = method === 'insert_text' ? { text: 'Hello from PiloAgent' }
          : method === 'set_font' ? { font: 'Georgia' }
          : method === 'set_size' ? { size: 18 }
          : method === 'set_color' ? { color: '#C0392B' }
          : method === 'set_align' ? { align: 'center' }
          : method === 'set_bold' ? { on: true } : {};
        try { await window.PiloAgent.call(method, params); }
        catch (e) { record(method, params, null, e); }
      };
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', panel);
  else panel();
})();
