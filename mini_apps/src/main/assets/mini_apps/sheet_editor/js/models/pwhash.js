// PwHash — the password hash of a protected sheet, the way Excel writes it (ECMA-376 agile: SHA-512 over salt + the password in UTF-16, then spun 100 000 times; older files carry a 16-bit hash).
// make() builds the hash that goes into a new protection, check() says whether a typed password matches the one of a file.
(function () {
  'use strict';
  var SPIN = 100000, MAXSPIN = 1000000, ALGS = { 'SHA-512': 1, 'SHA-384': 1, 'SHA-256': 1, 'SHA-1': 1 };
  function b64(u) { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(t) { try { var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } catch (e) { return null; } }
  function utf16(t) { var u = new Uint8Array(t.length * 2); for (var i = 0; i < t.length; i++) { var c = t.charCodeAt(i); u[i * 2] = c & 255; u[i * 2 + 1] = c >> 8; } return u; }
  function cat(a, b) { var u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }
  async function spun(alg, pw, salt, n) {
    var dig = async function (u) { return new Uint8Array(await crypto.subtle.digest(alg, u)); }, h = await dig(cat(salt, utf16(pw))), it = new Uint8Array(4), dv = new DataView(it.buffer);
    for (var i = 0; i < n; i++) { dv.setUint32(0, i, true); h = await dig(cat(h, it)); } return h;
  }
  function legacy(pw) { var h = 0, i; for (i = pw.length - 1; i >= 0; i--) { h = ((h >> 14) & 1) | ((h << 1) & 0x7fff); h ^= pw.charCodeAt(i); } h = ((h >> 14) & 1) | ((h << 1) & 0x7fff); h ^= pw.length; h ^= 0xce4b; return h.toString(16).toUpperCase().padStart(4, '0'); }
  window.PwHash = {
    make: async function (pw) { var salt = crypto.getRandomValues(new Uint8Array(16)), h = await spun('SHA-512', pw, salt, SPIN); return { algorithmName: 'SHA-512', hashValue: b64(h), saltValue: b64(salt), spinCount: SPIN }; },
    check: async function (pw, st) {
      if (!st) return true; if (st.legacy) return legacy(pw) === String(st.legacy).toUpperCase().padStart(4, '0');
      var alg = String(st.algorithmName).toUpperCase(); if (!ALGS[alg]) return false; var salt = unb64(st.saltValue), want = unb64(st.hashValue); if (!salt || !want) return false;
      var got = await spun(alg, pw, salt, Math.min(Math.max(0, Math.trunc(st.spinCount)), MAXSPIN)); if (got.length !== want.length) return false; var d = 0; for (var i = 0; i < got.length; i++) d |= got[i] ^ want[i]; return d === 0;
    }
  };
})();
