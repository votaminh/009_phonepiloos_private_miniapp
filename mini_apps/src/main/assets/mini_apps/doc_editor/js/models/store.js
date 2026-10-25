// Store — the list of documents the person opened (one Storage record each) and the reading preferences. Data stays in memory; Storage keeps it.
(function () {
  'use strict';
  var COL = 'docs', PREFS = 'prefs', list = [], prefs = { key: 'prefs', layout: (window.matchMedia && matchMedia('(min-width: 900px) and (pointer: fine)').matches ? 'page' : 'fit'), size: 100, theme: 'light' };
  window.Store = {
    init: async function () {
      try { list = (await Storage.getAll(COL)).filter(function (d) { return d && d.key; }); } catch (e) { list = []; }
      try { var p = await Storage.get(PREFS, 'prefs'); if (p) prefs = Object.assign(prefs, p); } catch (e) { /* defaults */ }
    },
    all: function () { return list.slice(); },
    recent: function (q) {
      q = String(q || '').trim().toLowerCase();
      return list.filter(function (d) { return !q || String(d.name).toLowerCase().indexOf(q) >= 0; }).sort(function (a, b) { return (b.openedAt || 0) - (a.openedAt || 0); });
    },
    get: function (key) { return list.filter(function (d) { return d.key === key; })[0] || null; },
    put: function (d) {
      var at = list.findIndex(function (x) { return x.key === d.key; }); if (at >= 0) list[at] = d; else list.push(d);
      return Storage.put(COL, d).then(function () { return d; });
    },
    del: function (key) { list = list.filter(function (d) { return d.key !== key; }); return Storage.remove(COL, key).catch(function () {}); },
    prefs: function () { return prefs; },
    savePrefs: function (p) { prefs = Object.assign(prefs, p); return Storage.put(PREFS, prefs).catch(function () {}); },
    // the id of a stored file ("files/<16 hex>.docx") — needed to delete the old copy after a save
    fileId: function (path) { var m = /files\/([0-9a-f]{16})\./.exec(String(path || '')); return m ? m[1] : ''; },
    dropFile: function (path) { var id = Store.fileId(path); return id ? NativeTools.call('delete_stored_file', { ids: [id], reason: 'Remove an old copy' }).catch(function () {}) : Promise.resolve(); }
  };
})();
