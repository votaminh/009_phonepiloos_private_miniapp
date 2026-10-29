// McpFx — tells the agent's overlay which block of the document a tool acts on. The cursor, the frame and the glow are drawn by the host app (natively), not here:
// the host asks PiloMcp.target(tool, args, result) before the call (result is null) and after it, and aims at the element it returns.
(function () {
  'use strict';
  var M = window.PiloMcp, D = window.McpDoc;
  if (!M || !D) return;

  M.target = function (name, a, res) {
    var bl = D.blocks(); if (!bl.length) return null;
    var i = res && res.data && typeof res.data.index === 'number' ? res.data.index : typeof a.index === 'number' ? a.index : typeof a.table === 'number' ? a.table : typeof a.after === 'number' ? a.after : null;
    if (i === null && res && /^doc_(insert|add)/.test(name)) i = bl.length - 1;
    return i === null ? null : bl[i] || null;
  };
})();
