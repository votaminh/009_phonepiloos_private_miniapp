// Zipx — reads single files out of an Office file (a zip) on the page itself: the engine keeps its parts to itself, and drawings, charts and cell styles are needed to show the file.
(function () {
  'use strict';
  function u16(d, o) { return d[o] | d[o + 1] << 8; }
  function u32(d, o) { return (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0; }
  async function inflate(raw) {
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(raw); w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  // list(buf) -> { name: { at, size, csize, method } } from the central directory
  function list(buf) {
    var d = new Uint8Array(buf), e = d.length - 22, out = {};
    while (e >= 0 && u32(d, e) !== 0x06054b50) e--;
    if (e < 0) return out;
    var n = u16(d, e + 10), p = u32(d, e + 16);
    for (var i = 0; i < n && u32(d, p) === 0x02014b50; i++) {
      var nl = u16(d, p + 28), xl = u16(d, p + 30), cl = u16(d, p + 32), name = new TextDecoder().decode(d.subarray(p + 46, p + 46 + nl));
      out[name] = { at: u32(d, p + 42), size: u32(d, p + 24), csize: u32(d, p + 20), method: u16(d, p + 10) }; p += 46 + nl + xl + cl;
    }
    return out;
  }
  window.Zipx = {
    open: function (buf) {
      var d = new Uint8Array(buf), idx = list(buf);
      return {
        has: function (n) { return !!idx[n]; },
        names: function () { return Object.keys(idx); },
        bytes: async function (n) {
          var f = idx[n]; if (!f) return null;
          var o = f.at, s = o + 30 + u16(d, o + 26) + u16(d, o + 28), raw = d.subarray(s, s + f.csize);
          return f.method === 0 ? raw : inflate(raw);
        },
        text: async function (n) { var b = await this.bytes(n); return b ? new TextDecoder().decode(b) : null; }
      };
    }
  };
})();
