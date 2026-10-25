// PhonePilot Core SDK v2.11.0 — DO NOT EDIT. Auto-generated from core_sdk/.
window.PILO_SDK_VERSION = '2.11.0';
// Core Context — DO NOT EDIT. Ngữ cảnh đồng bộ của project, do app (hoặc server khi chạy trên web) chèn vào trang trước khi sdk.js chạy.
// Có mặt mỗi khi project có id trên server (không phụ thuộc việc bật chia sẻ): upload file, đồng bộ dữ liệu và link guest đều dựa vào nó.
// Tên cũ `window.__PILOOS_SHARE__` / trường `shareId` vẫn được hiểu (app và server bản cũ còn chèn tên cũ).
(function() {
  var p = window.__PILO_PROJECT__ || window.__PILOOS_SHARE__;
  if (p) {
    if (!p.projectId) p.projectId = p.shareId;
    window.__PILO_PROJECT__ = p;
  }

  // App chủ: trang có thể nạp trước khi project có id và token room (vừa cài từ Market, project được tạo trên server vài giây sau). Khi đó hỏi host đều đặn tới lúc có
  // (công cụ get_project_context), rồi báo 'pilo:project' để đồng bộ và upload bắt đầu ngay, không bắt người dùng mở lại app.
  if (!window.__PILO_PROJECT__ && window.NativeToolsBridge) {
    var tries = 0;
    var ask = function() {
      if (window.__PILO_PROJECT__ || ++tries > 60) return;
      var call = window.NativeTools && window.NativeTools.call ? window.NativeTools.call('get_project_context', {}) : Promise.reject(new Error('no_tools'));
      call.then(function(reply) {
        var c = reply && reply.data;
        if (!c || !c.projectId || window.__PILO_PROJECT__) return setTimeout(ask, 1500);
        if (!c.shareId) c.shareId = c.projectId;
        window.__PILO_PROJECT__ = c;
        document.dispatchEvent(new CustomEvent('pilo:project'));
      }, function() { setTimeout(ask, 1500); });
    };
    setTimeout(ask, 300);
  }
})();

// Core Event Bus — DO NOT EDIT. Simple pub/sub for cross-component communication.
(function() {
  'use strict';

  var listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return function() { off(event, fn); };
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(function(f) { return f !== fn; });
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(function(fn) {
      try { fn(data); } catch(e) { console.error('[Events]', event, e); }
    });
  }

  window.Events = {
    on: on,
    off: off,
    emit: emit
  };
})();

// Core Files — DO NOT EDIT. Nội bộ SDK, KHÔNG phải API cho mini-app JS/LLM — không export gì lên
// window ngoài __PiloFiles (quy ước __ = nội bộ). Chuẩn file của mini-app:
//  1. pick_file và đầu ra tool native luôn là file TẠM của PiloOS (`/native-output/...`, dọn khi thoát mini-app).
//  2. Storage.put() thấy file tạm trong item thì persistSources() gọi bridge `persist_file`: copy vào bộ nhớ app với id mới do
//     SDK sinh (16 hex), đổi URL/path trong item thành đường dẫn TƯƠNG ĐỐI `files/<id>.<ext>` (WebView phục vụ; tool native
//     nhận lại được), rồi Storage.put ĐỢI xong mới ghi — không bao giờ lưu tham chiếu tới file tạm.
//  3. Mỗi file đã lưu tự động được tải lên server (PUT .../files?fid=<id>) ở nền, xếp hàng + thử lại khi mất mạng. Không cần giá trị
//     trả về: file được tìm theo id — máy này có thì dùng, thiếu mới hỏi server. Bên kia thấy ngay khi link đã chia sẻ.
//  4. Xoá/đổi tham chiếu `files/<id>.<ext>` trong bản ghi (và không bản ghi nào khác còn dùng) thì xoá file ở máy và server.
// File tạm được nhận ra ở 3 chỗ trong item: 1 field chuỗi cấp 1, 1 chuỗi nằm trong mảng cấp 1, hoặc field của object trong mảng cấp 1.
(function() {
  'use strict';
  var proj = window.__PILO_PROJECT__;
  // Ngữ cảnh project đến sau khi trang nạp (app vừa cài): nhận nó, gửi tiếp hàng đợi và bù file còn thiếu ngay thay vì đợi lần mở sau.
  document.addEventListener('pilo:project', function() { proj = window.__PILO_PROJECT__; retryQueue(); backfillMissing(); });
  var UPLOAD_QUEUE_STORE = '__pilo_upload_queue__';
  // Trần TỰ ĐỘNG: file tới 20MB lên server không cần hỏi. File lớn hơn không tự đi — người dùng được hỏi (hộp thoại bên dưới) và có
  // thể chọn tải lên vẫn, tới trần thủ công 100MB (khớp UPLOAD_MAX_BYTES của server).
  var AUTO_MAX_BYTES = 20 * 1024 * 1024;
  var MANUAL_MAX_BYTES = 100 * 1024 * 1024;

  // Địa chỉ server: suy từ socketUrl (wss://host/ws -> https://host), có ở cả app lẫn web.
  function serverOrigin() {
    if (!proj) return null;
    try {
      if (proj.socketUrl) {
        var u = new URL(proj.socketUrl);
        return (u.protocol === 'wss:' ? 'https:' : 'http:') + '//' + u.host;
      }
    } catch (e) { /* địa chỉ hỏng — coi như không có server */ }
    return null;
  }

  function authHeaders() {
    return proj && proj.token ? { 'Authorization': 'Bearer ' + proj.token } : {};
  }

  function guestParam() {
    return proj && proj.gk ? '&gk=' + encodeURIComponent(proj.gk) : '';
  }

  // sysui.js (chuyển động chung) nạp cùng bundle; thiếu nó (test đơn vị) thì đóng ngay, không animation.
  function ui() {
    return window.__PiloUi || { dismiss: function(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }, icon: function() { return ''; }, badge: function() { return ''; }, fileRow: function(k, n, m, r) { return '<div>' + n + ' ' + m + (r || '') + '</div>'; }, kindOf: function() { return 'file'; }, esc: function(t) { return String(t); } };
  }

  // ---- Tiến độ tải lên: báo cho upload_ui.js (pill ở đáy giữa màn hình + sheet danh sách từng file) ----
  function pu() { return window.__PiloUpload || null; }
  var upNames = {}; // fid -> tên file đang gửi (để pill/sheet hiện đúng tên)
  var progress = {
    start: function(fid, total) { var u = pu(); if (u) u.start(fid, total, upNames[fid]); },
    update: function(fid, sent, total) { var u = pu(); if (u) u.update(fid, sent, total); },
    end: function(fid, ok) { var u = pu(); if (u) u.finish(fid, ok); }
  };

  // PUT có báo tiến độ (fetch không báo được tiến độ gửi lên): XMLHttpRequest; môi trường không có XHR (test) thì rơi về fetch.
  function sendPut(url, headers, blob, fid) {
    if (typeof XMLHttpRequest === 'undefined') return fetch(url, { method: 'PUT', headers: headers, body: blob });
    return new Promise(function(resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('PUT', url);
      Object.keys(headers).forEach(function(h) { x.setRequestHeader(h, headers[h]); });
      if (x.upload) x.upload.onprogress = function(e) { if (e.lengthComputable) progress.update(fid, e.loaded, e.total); };
      x.onload = function() {
        resolve({
          status: x.status, ok: x.status >= 200 && x.status < 300,
          json: function() { try { return Promise.resolve(JSON.parse(x.responseText)); } catch (e) { return Promise.reject(e); } }
        });
      };
      x.onerror = x.ontimeout = x.onabort = function() { reject(new Error('network')); };
      x.send(blob);
    });
  }

  // Tối đa MAX_PARALLEL file tải lên cùng lúc; còn lại xếp hàng (mỗi file được đọc vào RAM khi tới lượt, không phải cùng lúc).
  var MAX_PARALLEL = 2;
  var running = 0;
  var waiting = [];
  function schedule(job) {
    return new Promise(function(resolve) {
      waiting.push(function() { return Promise.resolve().then(job).then(resolve, resolve); });
      pump();
    });
  }
  function pump() {
    while (running < MAX_PARALLEL && waiting.length) {
      var next = waiting.shift();
      running++;
      next().then(function() { running--; pump(); });
    }
  }

  // Gửi nhị phân thẳng (PUT, body là chính file). Server cũ chưa có PUT (404 "Not found") thì rơi về cách base64 cũ.
  function putBlob(origin, blob, fileName, fid) {
    var url = origin + '/shares/' + encodeURIComponent(proj.projectId) + '/files?name=' + encodeURIComponent(fileName || 'file.bin') + (fid ? '&fid=' + fid : '') + guestParam();
    var headers = authHeaders();
    headers['Content-Type'] = blob.type || 'application/octet-stream';
    return sendPut(url, headers, blob, fid).then(function(res) {
      if (res.status === 401 || res.status === 403) return { done: true, publicUrl: null, reason: 'denied' };
      if (res.status === 413) return { done: true, publicUrl: null, reason: 'toolarge' };
      if (res.status === 404) {
        return res.json().then(function(j) {
          return j && j.error === 'Not found' ? postBase64(origin, blob, fileName) : { done: true, publicUrl: null, reason: 'noshare' };
        }, function() { return { done: false, reason: 'retry' }; });
      }
      if (!res.ok) return { done: false, reason: 'retry' };
      return res.json().then(function(json) {
        return json && json.url ? { done: true, publicUrl: json.url, reason: 'ok' } : { done: false, reason: 'retry' };
      });
    });
  }

  function postBase64(origin, blob, fileName) {
    return blobToBase64(blob).then(function(base64) {
      return fetch(origin + '/shares/' + encodeURIComponent(proj.projectId) + '/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileName || 'file.bin', base64: base64 }),
      }).then(function(res) { return res.json(); })
        .then(function(json) { return json && json.url ? { done: true, publicUrl: json.url, reason: 'ok' } : { done: false, reason: 'retry' }; });
    });
  }

  // ---- Ảnh xem trước (thumbnail): máy vừa chọn file nên tạo luôn (ảnh: canvas; video: thumbnail native), gửi kèm sau khi file chính lên xong ----
  var THUMB_SIZE = 240;
  var BIG_CSS_PX = 300; // CSS px: above this a picture counts as 'viewed big'
  var THUMB_MAX_BYTES = 190 * 1024;
  var THUMB_WAIT_MS = 4000;
  var THUMB_SOURCE_MAX = 30 * 1024 * 1024; // ảnh gốc lớn hơn mức này thì bỏ qua (giải mã tốn RAM)

  function mediaKind(name, mime) {
    var n = name || '', m = mime || '';
    if (/^image\//.test(m) || /\.(jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(n)) return 'image';
    if (/^video\//.test(m) || /\.(mp4|m4v|mov|webm|mkv|3gp)$/i.test(n)) return 'video';
    return null;
  }

  function imageThumb(blob) {
    return new Promise(function(resolve) {
      if (typeof document === 'undefined' || !document.createElement || typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) { resolve(null); return; }
      var objUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function() {
        try {
          var scale = Math.min(1, THUMB_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(objUrl);
          c.toBlob(function(b) { resolve(b); }, 'image/jpeg', 0.72);
        } catch (e) { URL.revokeObjectURL(objUrl); resolve(null); }
      };
      img.onerror = function() { URL.revokeObjectURL(objUrl); resolve(null); };
      img.src = objUrl;
    });
  }

  function makeThumb(blob, name, localPath) {
    var kind = mediaKind(name, blob.type);
    if (kind === 'image') return blob.size > THUMB_SOURCE_MAX ? Promise.resolve(null) : imageThumb(blob);
    if (kind === 'video' && window.NativeToolsBridge) {
      return fetch(location.origin + '/media-thumbnail/?uri=' + encodeURIComponent('file://' + localPath) + '&timeMs=1000&size=' + THUMB_SIZE)
        .then(function(r) { return r.ok ? r.blob() : null; }, function() { return null; });
    }
    return Promise.resolve(null);
  }

  // Tạo và gửi ảnh xem trước; lỗi gì cũng bỏ qua (chỉ là phần phụ, không đáng để thử lại).
  function uploadThumb(origin, blob, name, localPath, fid) {
    return makeThumb(blob, name, localPath).then(function(t) {
      if (!t || !t.size || t.size > THUMB_MAX_BYTES) return;
      var url = origin + '/shares/' + encodeURIComponent(proj.projectId) + '/files?kind=thumb&fid=' + fid + guestParam();
      var headers = authHeaders();
      headers['Content-Type'] = 'image/jpeg';
      return fetch(url, { method: 'PUT', headers: headers, body: t });
    }).then(function() {}, function() {});
  }

  // Thử upload 1 file (đọc từ localUrl). Trả { done, publicUrl, reason }: done=true khi KHÔNG cần thử lại (xong, hoặc không thể: nguồn local đã mất,
  // không có server, không đủ quyền, quá lớn, hoặc cần người dùng đồng ý 'big'), done=false khi lỗi tạm thời (mạng/server) — đáng xếp hàng thử lại.
  // opts.force: người dùng đã đồng ý tải file lớn hơn trần tự động.
  function attemptUpload(localUrl, fid, fileName, opts) {
    var origin = serverOrigin();
    // Chưa có ngữ cảnh server (vừa cài, token room chưa về lúc mở trang): file mặc định VẪN phải lên server, nên xếp hàng thử lại ở lần nạp trang kế (retryQueue).
    if (!origin) return Promise.resolve({ done: false, publicUrl: null, reason: 'noshare' });
    var force = !!(opts && opts.force);
    return fetch(localUrl, { pilo: true })
      .then(function(res) {
        if (!res || !res.ok) return null; // nguồn local đã mất
        // Biết kích thước từ header thì không đọc file vào RAM chỉ để thấy nó quá lớn.
        var declared = Number(res.headers && res.headers.get && res.headers.get('content-length'));
        if (declared > MANUAL_MAX_BYTES) return { early: { done: true, publicUrl: null, reason: 'toolarge', size: declared } };
        if (declared > AUTO_MAX_BYTES && !force) return { early: { done: true, publicUrl: null, reason: 'big', size: declared } };
        return res.blob().then(function(blob) { return { blob: blob }; });
      }, function() { return null; })
      .then(function(got) {
        if (!got) return { done: true, publicUrl: null, reason: 'lost' };
        if (got.early) return got.early;
        var blob = got.blob;
        if (blob.size > MANUAL_MAX_BYTES) return { done: true, publicUrl: null, reason: 'toolarge', size: blob.size };
        if (blob.size > AUTO_MAX_BYTES && !force) return { done: true, publicUrl: null, reason: 'big', size: blob.size };
        // Ảnh xem trước đi TRƯỚC file chính (vài KB, xong trong chớp mắt): người xem mở danh sách khi file lớn còn đang lên vẫn thấy ảnh, không phải chờ tới khi nó xong.
        // Chờ tối đa vài giây thôi — ảnh xem trước chỉ là phần phụ, không được làm chậm việc gửi file.
        return Promise.race([uploadThumb(origin, blob, fileName, localUrl, fid), new Promise(function(r) { setTimeout(r, THUMB_WAIT_MS); })]).then(function() {
          progress.start(fid, blob.size);
          var beat = setInterval(function() { reportStatus(fid, 'uploading', '', { name: fileName, size: blob.size }); }, HEARTBEAT_MS);
          return putBlob(origin, blob, fileName, fid).then(function(r) { clearInterval(beat); progress.end(fid, !!(r && r.done && r.publicUrl)); if (r && r.publicUrl) r.size = blob.size; return r; }, function(e) { clearInterval(beat); progress.end(fid, false); throw e; });
        });
      })
      .catch(function() { return { done: false, reason: 'retry' }; }); // lỗi mạng/parse tạm thời — đáng thử lại
  }

  // Cho server (và qua đó các máy khác) biết file này đang tải lên hay vì sao không tải lên được: máy khác bấm tải sẽ thấy đúng lý do thay vì một lỗi chung.
  // Không bao giờ làm hỏng việc tải lên: lỗi gửi báo cáo bị bỏ qua.
  var HEARTBEAT_MS = 30000;
  function reportStatus(fid, state, reason, extra) {
    var origin = serverOrigin();
    if (!origin || !proj || !proj.projectId || !fid) return;
    var headers = authHeaders();
    headers['Content-Type'] = 'application/json';
    var body = { state: state };
    if (reason) body.reason = reason;
    if (extra) { if (extra.name) body.name = extra.name; if (extra.size) body.size = extra.size; }
    try {
      fetch(origin + '/shares/' + encodeURIComponent(proj.projectId) + '/files/' + fid + '/status' + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : ''), { method: 'POST', headers: headers, body: JSON.stringify(body), pilo: true })
        .then(function() {}, function() {});
    } catch (e) { /* only a courtesy to the other devices */ }
  }

  function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function() { resolve(String(reader.result).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  var STORED_RE = /^files\/([0-9a-f]{16})\.[A-Za-z0-9]{1,8}$/;

  function storedId(v) {
    var m = typeof v === 'string' ? STORED_RE.exec(v) : null;
    return m ? m[1] : null;
  }

  function extOf(path) {
    var m = /\.([A-Za-z0-9]{1,8})$/.exec(path);
    return m ? m[1].toLowerCase() : 'bin';
  }

  var inFlight = {}; // fid -> true, tránh upload trùng

  // Kết quả một lần thử: xong thì pill đã được báo ở progress.end; lỗi tạm thời → chờ; không thể upload → bỏ khỏi danh sách (denied → hiện "không upload được").
  // diagnostic lines ([FILES]): only when the trace is switched on (localStorage 'pilo_trace' = '1')
  function flog(m) { try { if (localStorage.getItem('pilo_trace') === '1') console.log(m); } catch (e) {} }

  function uploadOutcome(fid, result) {
    flog('[FILES] upload outcome fid=' + fid + ' done=' + !!result.done + ' reason=' + result.reason);
    if (result.done && (result.reason === 'big' || result.reason === 'toolarge' || result.reason === 'denied' || result.reason === 'lost')) reportStatus(fid, 'failed', result.reason);
    var u = pu();
    if (!u) return;
    if (result.done && result.reason === 'ok') u.finish(fid, true);
    else if (!result.done) u.wait(fid);
    else if (result.reason === 'denied') u.fail(fid);
    else u.drop(fid);
  }

  // Trong app: file đi qua HÀNG ĐỢI NỀN của host (enqueue_upload): nó gửi tiếp khi mini app bị ẩn, app bị kill hay máy khởi động lại, và hiện tiến độ trên chip,
  // danh sách tải lên và thông báo hệ thống. Host cũ không có tool này ('unsupported') hoặc trang chạy trên web thì rơi về cách cũ: gửi từ JS trong trang.
  var nativeUpload = null; // null = chưa biết, false = host không hỗ trợ
  function useNativeUpload() { return nativeUpload !== false && !!window.NativeToolsBridge && !!serverOrigin() && !!proj && !!proj.projectId; }
  // The user chose to keep a large file on the phone (or deleted it): the host forgets its queued job.
  function dropNative(fid) {
    if (nativeUpload === false || !window.NativeToolsBridge) return;
    NativeTools.call('upload_control', { action: 'skip:' + fid, reason: 'Upload files' }).then(function() {}, function() {});
  }
  function enqueueNative(fid, path, name, force) {
    return NativeTools.call('enqueue_upload', {
      origin: serverOrigin(), projectId: proj.projectId, token: proj.token || '', gk: proj.gk || '', app: (document.title || ''),
      items: [{ id: fid, ext: extOf(path), name: name, force: !!force }], reason: 'Upload files'
    }).then(function(reply) {
      nativeUpload = true;
      var r = ((reply && reply.data && reply.data.results) || [])[0] || {};
      flog('[FILES] enqueue fid=' + fid + ' status=' + r.status);
      if (r.status === 'big' || r.status === 'toolarge') { reportStatus(fid, 'failed', r.status); addBig(fid, path, name, r.size || 0, r.status === 'toolarge'); }
      else if (r.status === 'lost') reportStatus(fid, 'failed', 'lost');
      return true;
    }, function(e) {
      if (/unsupported/.test(String(e && e.message))) nativeUpload = false;
      return false;
    });
  }

  // Upload nền một file đã lưu: fid + đường dẫn tương đối. Không có giá trị trả về cần dùng.
  function startUpload(fid, path, name, force) {
    if (inFlight[fid] || (big[fid] && !force)) return;
    inFlight[fid] = true;
    isKept(fid).then(function(kept) {
      if (kept && !force) { delete inFlight[fid]; return; }
      if (useNativeUpload()) {
        return enqueueNative(fid, path, name, force).then(function(handled) {
          if (handled) { delete inFlight[fid]; return; }
          return jsUpload(fid, path, name, force);
        });
      }
      return jsUpload(fid, path, name, force);
    });
  }

  function jsUpload(fid, path, name, force) {
    upNames[fid] = name;
    if (pu()) pu().queue(fid, name);
    return schedule(function() { return attemptUpload(path, fid, name, { force: force }); }).then(function(result) {
      delete inFlight[fid];
      uploadOutcome(fid, result);
      if (result.done && result.reason === 'ok') { showSavedNotice(name, result.size); return; }
      if (!result.done) {
        return Storage.__raw.putLocal(UPLOAD_QUEUE_STORE, { key: 'q_' + fid, fid: fid, path: path, fileName: name, force: !!force });
      }
      if (result.reason === 'big' || result.reason === 'toolarge') return addBig(fid, path, name, result.size, result.reason === 'toolarge');
      // 'lost' / 'denied': không có gì để hỏi hay thử lại.
    });
  }

  function retryQueue() {
    Storage.getAll(UPLOAD_QUEUE_STORE).then(function(ops) {
      (ops || []).forEach(function(op) {
        if (inFlight[op.fid]) return; // đang gửi (do bù file thiếu hay lần nạp trước): gửi hai lần cùng lúc chỉ làm hỏng nhau
        inFlight[op.fid] = true;
        upNames[op.fid] = op.fileName;
        if (pu()) pu().queue(op.fid, op.fileName);
        schedule(function() { return attemptUpload(op.path, op.fid, op.fileName, { force: !!op.force }); }).then(function(result) {
          delete inFlight[op.fid];
          uploadOutcome(op.fid, result);
          if (!result.done) return; // vẫn lỗi tạm thời — giữ nguyên trong queue, chờ lần 'online' kế
          return Storage.__raw.removeLocal(UPLOAD_QUEUE_STORE, op.key);
        });
      });
    });
  }

  // Đối chiếu file đã lưu trên máy với server mỗi lần nạp trang (chỉ trong app, nơi có file thật): file nào server chưa có thì tải lên, file đã có mà thiếu ảnh xem trước thì gửi bù.
  // Cứu các file chọn lúc chưa có ngữ cảnh server (bản cũ bỏ rơi chúng) và video/ảnh upload trước khi có ảnh xem trước. Nhiều máy cùng tài khoản: máy nào còn file sẽ vá giúp.
  var BACKFILL_MAX = 300;
  function serverHas(origin, name) {
    return fetch(origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + name + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : ''), { method: 'HEAD' })
      .then(function(r) { return r.ok ? true : (r.status === 404 ? false : null); }, function() { return null; });
  }

  function backfillOne(origin, fid, entry) {
    var path = entry.path, name = entry.name || (fid + '.' + extOf(path)), ext = extOf(path);
    return isKept(fid).then(function(kept) {
      if (kept) return;
      return serverHas(origin, fid + '.' + ext).then(function(has) {
        if (has === null) return;
        if (has === false) return startUpload(fid, path, name, false);
        var kind = mediaKind(name, entry.mime);
        if (!kind) return;
        return serverHas(origin, fid + '.thumb.jpg').then(function(hasThumb) {
          if (hasThumb !== false) return;
          var source = kind === 'image' ? fetch(path, { pilo: true }).then(function(r) { return r.ok ? r.blob() : null; }) : Promise.resolve(new Blob([], { type: entry.mime || 'video/mp4' }));
          return source.then(function(blob) { if (blob) return uploadThumb(origin, blob, name, path, fid); });
        });
      });
    }).catch(function() {});
  }

  function backfillMissing() {
    var origin = serverOrigin();
    if (!origin || !proj.projectId || !window.NativeToolsBridge || proj.role === 'viewer') return;
    fetch('/files/index.json').then(function(r) { return r.ok ? r.json() : null; }).then(function(index) {
      var ids = Object.keys(index || {}).filter(function(k) { return STORED_RE.test((index[k] || {}).path || ''); }).slice(0, BACKFILL_MAX);
      var next = 0;
      function worker() {
        if (next >= ids.length) return Promise.resolve();
        var id = ids[next++];
        return backfillOne(origin, id, index[id]).then(worker);
      }
      return Promise.all([worker(), worker()]);
    }).catch(function() {});
  }

  // ---- File lớn hơn trần tự động: hỏi người dùng một lần (gộp), nhớ lựa chọn "giữ trên máy" ----
  var BIG_STORE = '__pilo_big_files__';
  var big = {}; // fid -> { fid, path, name, size, tooLarge }
  var bigTimer = null;
  var dialogEl = null;

  var DIALOG_STRINGS = {
    en: {
      title: 'Large files are not shared yet',
      body_one: 'This file is over 20 MB, so it was not sent to the server for guests and your other devices.',
      body_many: 'These files are over 20 MB, so they were not sent to the server for guests and your other devices.',
      too_large: 'over 100 MB, stays on this device',
      upload: 'Upload anyway',
      keep: 'Keep on this device'
    },
    vi: {
      title: 'File lớn chưa được chia sẻ',
      body_one: 'File này lớn hơn 20 MB nên chưa được gửi lên server cho khách và các máy khác.',
      body_many: 'Các file này lớn hơn 20 MB nên chưa được gửi lên server cho khách và các máy khác.',
      too_large: 'trên 100 MB, chỉ giữ trên máy này',
      upload: 'Tải lên vẫn',
      keep: 'Giữ trên máy'
    }
  };

  function dialogStrings() {
    var lang = (document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
    return lang.indexOf('vi') === 0 ? DIALOG_STRINGS.vi : DIALOG_STRINGS.en;
  }

  function prettySize(bytes) {
    return bytes >= 1048576 ? (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  function isKept(fid) {
    return Storage.get(BIG_STORE, 'kept:' + fid).then(function(r) { return !!r; }, function() { return false; });
  }

  function addBig(fid, path, name, size, tooLarge) {
    big[fid] = { fid: fid, path: path, name: name || path, size: size || 0, tooLarge: !!tooLarge };
    if (bigTimer) clearTimeout(bigTimer);
    bigTimer = setTimeout(showBigDialog, 700); // gộp nhiều file chọn cùng lúc thành 1 hộp thoại
  }

  function closeDialog() {
    if (dialogEl && !dialogEl.host) ui().dismiss(dialogEl);
    dialogEl = null;
  }

  function showBigDialog() {
    bigTimer = null;
    var entries = Object.keys(big).map(function(k) { return big[k]; });
    if (!entries.length || !document.body || dialogEl) return;
    var H = window.__PiloHostUi;
    if (H && H.ready()) {
      dialogEl = { host: true };
      var tt = dialogStrings();
      H.dialog('large', { files: entries.slice(0, 4).map(function(e) { return { name: e.name, ext: e.name.split('.').pop(), size: e.size, note: e.tooLarge ? tt.too_large : '' }; }) }).then(function(choice) {
        dialogEl = null;
        if (choice === 'upload') entries.filter(function(e) { return !e.tooLarge; }).forEach(function(e) { delete big[e.fid]; startUpload(e.fid, e.path, e.name, true); });
        else if (choice === 'keep') entries.forEach(function(e) { delete big[e.fid]; reportStatus(e.fid, 'failed', 'kept'); dropNative(e.fid); Storage.__raw.putLocal(BIG_STORE, { key: 'kept:' + e.fid, fid: e.fid, size: e.size }); });
      }, function() { dialogEl = null; bigTimer = setTimeout(showBigDialogDom, 0); });
      return;
    }
    showBigDialogDom();
  }

  function showBigDialogDom() {
    var entries = Object.keys(big).map(function(k) { return big[k]; });
    if (!entries.length || !document.body || dialogEl) return;
    var t = dialogStrings(), U = ui();
    U.css();
    var canUpload = entries.filter(function(e) { return !e.tooLarge; });
    var el = document.createElement('div');
    el.className = 'pilo-ov pilo-fd';
    el.setAttribute('data-pilo-overlay', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    var rows = entries.slice(0, 4).map(function(e) {
      return U.fileRow(U.kindOf(e.name), e.name, prettySize(e.size) + (e.tooLarge ? ' · ' + t.too_large : ''));
    }).join('');
    el.innerHTML = '<div class="pilo-card" data-pilo-sheet><div class="pilo-grab"></div><div class="pilo-hd">' + U.badge('cloud', 'warm') + '<div><h2 class="pilo-h pilo-fd-title"></h2></div></div>' +
      '<p class="pilo-p pilo-fd-body"></p><div class="pilo-list pilo-fd-list">' + rows + '</div><p class="pilo-fd-note" hidden></p>' +
      '<div class="pilo-acts pilo-fd-actions"><button type="button" class="pilo-btn pri pilo-press" data-act="upload">' + U.icon('up', 20) + '<span></span></button>' +
      '<button type="button" class="pilo-btn sec pilo-press" data-act="keep"></button></div></div>';
    el.querySelector('.pilo-fd-title').textContent = t.title;
    el.querySelector('.pilo-fd-body').textContent = entries.length === 1 ? t.body_one : t.body_many;
    var upload = el.querySelector('[data-act="upload"]');
    upload.querySelector('span').textContent = t.upload;
    if (!canUpload.length) upload.hidden = true;
    el.querySelector('[data-act="keep"]').textContent = t.keep;
    upload.addEventListener('click', function() {
      closeDialog();
      canUpload.forEach(function(e) { delete big[e.fid]; startUpload(e.fid, e.path, e.name, true); });
    });
    el.querySelector('[data-act="keep"]').addEventListener('click', function() {
      closeDialog();
      entries.forEach(function(e) {
        delete big[e.fid];
        reportStatus(e.fid, 'failed', 'kept');
        dropNative(e.fid);
        Storage.__raw.putLocal(BIG_STORE, { key: 'kept:' + e.fid, fid: e.fid, size: e.size });
      });
    });
    document.body.appendChild(el);
    dialogEl = el;
  }

  // ---- Thẻ "Saved in PiloOS": báo file đã lưu 30 ngày và mời sao lưu vào Telegram. Chỉ trong app PiloOS, tối đa 1 lần mỗi 24 giờ. ----
  var NOTICE_KEY = 'pilo_backup_notice_at';
  var NOTICE_STRINGS = {
    en: { title: 'Saved in PiloOS', keeps: 'PiloOS keeps this for 30 days', until: ', until ', rest: '. Back it up to Telegram to keep it for good.', now: 'Back up now', later: 'Later' },
    vi: { title: 'Đã lưu trong PiloOS', keeps: 'PiloOS giữ file này 30 ngày', until: ', đến ', rest: '. Sao lưu vào Telegram để giữ lâu dài.', now: 'Sao lưu ngay', later: 'Để sau' }
  };
  var NOTICE_CSS =
    '.pilo-sn-box{display:flex;gap:12px;margin-top:16px;padding:14px 16px;border-radius:16px;background:#FCEBDD;color:#7A3A0A;font-size:14px;line-height:1.45}' +
    '.pilo-sn-box svg{flex-shrink:0;margin-top:1px;color:#B3591A}';

  function showSavedNotice(name, size) {
    try {
      if (!window.NativeToolsBridge || !window.NativeTools || !document.body || dialogEl || document.getElementById('pilo-sn')) return;
      var last = Number(localStorage.getItem(NOTICE_KEY) || 0);
      if (Date.now() - last < 86400000) return;
      localStorage.setItem(NOTICE_KEY, String(Date.now()));
    } catch (e) { return; }
    var lang = (document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
    var t = lang.indexOf('vi') === 0 ? NOTICE_STRINGS.vi : NOTICE_STRINGS.en;
    if (!document.getElementById('pilo-sn-style')) {
      var style = document.createElement('style');
      style.id = 'pilo-sn-style';
      style.textContent = NOTICE_CSS;
      document.head.appendChild(style);
    }
    var until = '';
    try { until = new Date(Date.now() + 30 * 86400000).toLocaleDateString(lang.indexOf('vi') === 0 ? 'vi' : 'en', { month: 'short', day: 'numeric' }); } catch (e) { until = ''; }
    var H = window.__PiloHostUi;
    if (H && H.ready()) {
      H.dialog('saved', { name: name, size: size || 0, until: until }).then(function(choice) {
        if (choice === 'now') window.NativeTools.call('open_url', { url: 'piloos://backup', reason: 'Open Backup' }).catch(function() {});
      }, function() { showSavedNoticeDom(name, size, t, until, lang); });
      return;
    }
    showSavedNoticeDom(name, size, t, until, lang);
  }

  function showSavedNoticeDom(name, size, t, until, lang) {
    var el = document.createElement('div');
    el.id = 'pilo-sn';
    el.setAttribute('data-pilo-overlay', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    var U = ui();
    U.css();
    el.className = 'pilo-ov pilo-sn';
    el.innerHTML = '<div class="pilo-card" data-pilo-sheet><div class="pilo-grab"></div><div class="pilo-hd">' + U.badge('check', 'ok') + '<div><div class="pilo-h pilo-sn-title"></div><div class="pilo-sub pilo-sn-sub"></div></div></div>' +
      '<div class="pilo-sn-box">' + U.icon('cloud', 20) + '<span><b></b><span></span></span></div>' +
      '<div class="pilo-acts"><button type="button" class="pilo-btn pri pilo-press pilo-sn-go">' + U.icon('send', 20) + '<span></span></button><button type="button" class="pilo-btn ghost pilo-press pilo-sn-later"></button></div></div>';
    el.querySelector('.pilo-sn-title').textContent = t.title;
    el.querySelector('.pilo-sn-sub').textContent = size ? name + ' · ' + prettySize(size) : name;
    el.querySelector('.pilo-sn-box b').textContent = t.keeps;
    el.querySelector('.pilo-sn-box span span').textContent = (until ? t.until + until : '') + t.rest;
    el.querySelector('.pilo-sn-go span').textContent = t.now;
    el.querySelector('.pilo-sn-later').textContent = t.later;
    function close() { el.removeAttribute('id'); ui().dismiss(el); }
    el.querySelector('.pilo-sn-go').addEventListener('click', function() {
      close();
      window.NativeTools.call('open_url', { url: 'piloos://backup', reason: 'Open Backup' }).catch(function() {});
    });
    el.querySelector('.pilo-sn-later').addEventListener('click', close);
    el.addEventListener('click', function(ev) { if (ev.target === el) close(); });
    document.body.appendChild(el);
  }

  // ---- Xem video/file chưa có trên máy: hỏi tải về, native tải thẳng vào files/<id>.<đuôi>, rồi lệnh bị từ chối được chạy lại (xem native_tools.js) ----
  var DL_STRINGS = {
    en: { title: 'Download to view', body: 'This file is not on this device yet. Download it to open it.', body_many: '{n} files are not on this device yet. Download them to open them.', size: 'Size', total: 'Total', all: 'Download all', yes: 'Download', no: 'Cancel', failed: 'Could not download the file' },
    vi: { title: 'Tải về để xem', body: 'File này chưa có trên máy. Tải về để mở.', body_many: '{n} file chưa có trên máy. Tải về để mở.', size: 'Dung lượng', total: 'Tổng', all: 'Tải tất cả', yes: 'Tải về', no: 'Hủy', failed: 'Không tải được file' }
  };

  var KIND_LABEL = { en: { image: 'Photo', video: 'Video', audio: 'Audio', file: 'File' }, vi: { image: 'Ảnh', video: 'Video', audio: 'Âm thanh', file: 'File' } };

  // items: [{ ext, size }] — các file sắp tải (có thể thiếu: chỉ biết tổng dung lượng và số file).
  function askDownload(sizeBytes, count, items) {
    var H = window.__PiloHostUi;
    if (H && H.ready()) {
      // Hộp hỏi do host (native) vẽ; host cũ chưa hỗ trợ thì rơi về DOM.
      return H.dialog('download', { files: (items || []).map(function(it) { return { ext: it.ext, size: it.size || 0 }; }), total: sizeBytes || 0 })
        .then(function(c) { return c === 'yes'; }, function() { return askDownloadDom(sizeBytes, count, items); });
    }
    return askDownloadDom(sizeBytes, count, items);
  }
  function askDownloadDom(sizeBytes, count, items) {
    return new Promise(function(resolve) {
      if (typeof document === 'undefined' || !document.body || !document.createElement) { resolve(true); return; }
      var lang = (document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
      var vi = lang.indexOf('vi') === 0;
      var t = vi ? DL_STRINGS.vi : DL_STRINGS.en, U = ui();
      U.css();
      var labels = vi ? KIND_LABEL.vi : KIND_LABEL.en;
      var rows = (items || []).slice(0, 4).map(function(it) {
        var kind = U.kindOf(it.ext);
        return U.fileRow(kind, labels[kind] + ' · ' + String(it.ext).toUpperCase(), it.size ? prettySize(it.size) : '');
      }).join('');
      var el = document.createElement('div');
      el.className = 'pilo-ov pilo-fd';
      el.setAttribute('data-pilo-overlay', '');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="pilo-card" data-pilo-sheet><div class="pilo-grab"></div><div class="pilo-hd">' + U.badge('down') + '<div><h2 class="pilo-h pilo-fd-title"></h2></div></div><p class="pilo-p pilo-fd-body"></p>' +
        (rows ? '<div class="pilo-list pilo-fd-list">' + rows + '</div>' : '') + (count > 1 && sizeBytes ? '<div class="pilo-fd-total" style="display:flex;justify-content:space-between;margin-top:12px;font-size:13px;color:#5F636C"><span></span><b style="color:#15171C"></b></div>' : '') +
        '<p class="pilo-fd-note" hidden></p><div class="pilo-acts pilo-fd-actions"><button type="button" class="pilo-btn pri pilo-press" data-act="yes">' + U.icon('down', 20) + '<span></span></button><button type="button" class="pilo-btn ghost pilo-press" data-act="no"></button></div></div>';
      el.querySelector('.pilo-fd-title').textContent = t.title;
      el.querySelector('.pilo-fd-body').textContent = (count > 1 ? t.body_many.replace('{n}', count) : t.body) + (!rows && sizeBytes ? ' (' + prettySize(sizeBytes) + ')' : '');
      var tot = el.querySelector('.pilo-fd-total');
      if (tot) { tot.firstChild.textContent = t.total; tot.lastChild.textContent = prettySize(sizeBytes); }
      el.querySelector('[data-act="yes"] span').textContent = count > 1 ? t.all : t.yes;
      el.querySelector('[data-act="no"]').textContent = t.no;
      function done(v) { ui().dismiss(el); resolve(v); }
      el.querySelector('[data-act="yes"]').addEventListener('click', function() { done(true); });
      el.querySelector('[data-act="no"]').addEventListener('click', function() { done(false); });
      document.body.appendChild(el);
    });
  }

  // ---- Nhiều ảnh gốc cần tải cùng lúc (một màn có nhiều ảnh to): gom lại, HỎI MỘT LẦN, tải cả lượt trong một lệnh native ----
  var wantWait = {};      // fid -> { fid, ext, stored, els: [] }
  var wantTimer = null;
  var declined = {};      // fid -> true: người dùng đã hủy, không hỏi lại cho tới khi chạm vào ảnh

  // A file that is on the phone but cannot be read (a broken download, a format the phone does not decode) is treated like a file that is not on this device: it joins the
  // list of files to download and the picture offers the download question. The new copy replaces the broken one (replace: true). If the file still cannot be read after
  // that once, the phone just does not decode it: from then on only the error picture shows, nothing more is asked.
  var REDL_KEY = 'pilo_redownloaded';
  function redownloaded(id) {
    try { return (JSON.parse(localStorage.getItem(REDL_KEY) || '[]')).indexOf(id) >= 0; } catch (e) { return false; }
  }
  function markRedownloaded(id) {
    try {
      var ids = JSON.parse(localStorage.getItem(REDL_KEY) || '[]');
      if (ids.indexOf(id) < 0) ids.push(id);
      localStorage.setItem(REDL_KEY, JSON.stringify(ids.slice(-300)));
    } catch (e) { /* the memory is only a convenience */ }
  }
  function bust(url) { return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'r=' + Date.now(); }

  function unreadable(el, id, ext, thumbSrc) {
    if (redownloaded(id)) {
      // fetched again already and still unreadable: show the error picture (thumbs.js) and stop
      el.setAttribute('data-pilo-err', '');
      if (window.PiloThumbs && window.PiloThumbs.errorSrc) el.src = window.PiloThumbs.errorSrc;
      return;
    }
    var path = 'files/' + id + '.' + ext;
    noteMissing({ id: id, ext: ext, path: path }, 'unreadable');
    el.dataset.piloThumbSrc = thumbSrc;
    markPending(el, { fid: id, ext: ext, stored: path, replace: true });
  }

  function markPending(el, w) {
    noteMissing(parseStored(w.stored), 'declined');
    // The server preview is already on screen: keep it, declining the original must not blank the picture.
    var showingThumb = el.tagName === 'IMG' && /\.thumb\.jpg(\?|$)/.test(el.getAttribute('src') || '') && el.complete && el.naturalWidth > 0;
    if (showingThumb) { /* keep the preview */ }
    else if (el.tagName === 'IMG' && el.getBoundingClientRect) showPlaceholder(el, 'pending');
    else { el.style.opacity = '0.55'; el.title = placeholderText('pending'); }
    el.addEventListener('click', function(ev) {
      // A broken file: the tap only asks to download it again (the page behind would just open the broken picture)
      if (w.replace && ev && ev.stopPropagation) ev.stopPropagation();
      delete declined[w.fid];
      el.style.opacity = '';
      wantOriginal(el, w.stored, w.replace);
    }, { once: true });
  }

  function wantOriginal(el, stored, replace) {
    var fid = storedId(stored);
    var w = wantWait[fid] || (wantWait[fid] = { fid: fid, ext: stored.split('.').pop(), stored: stored, els: [], replace: false });
    if (replace) w.replace = true;
    w.els.push(el);
    if (declined[fid]) { markPending(el, w); delete wantWait[fid]; return; }
    clearTimeout(wantTimer);
    wantTimer = setTimeout(flushWanted, 300);
  }

  function flushWanted() {
    wantTimer = null;
    var batch = Object.keys(wantWait).map(function(k) { return wantWait[k]; });
    wantWait = {};
    if (!batch.length) return;
    ensureLocalMany(batch.map(function(w) { return { id: w.fid, ext: w.ext, replace: w.replace }; })).then(function() {
      trayForget(batch.map(function(w) { return parseStored(w.stored); }).filter(Boolean));   // they are here now: off the list of files to download
      if (batch.some(function(w) { return w.replace; })) setTimeout(refreshAfterDownload, 0);   // the page draws its pictures again from the new copies
      batch.forEach(function(w) {
        if (w.replace) markRedownloaded(w.fid);
        w.els.forEach(function(el) {
          el.style.opacity = '';
          var thumb = w.replace && el.dataset.piloThumbSrc;
          if (thumb) { el.removeAttribute('data-pilo-err'); delete el.dataset.piloPending; delete el.dataset.piloChecked; el.src = bust(thumb); }   // the new copy: ask for its thumbnail again
          else el.src = w.stored;
        });
      });
    }, function() {
      batch.forEach(function(w) { declined[w.fid] = true; w.els.forEach(function(el) { markPending(el, w); }); });
    });
  }

  function ensureLocalMany(list) {
    var origin = serverOrigin();
    if (!origin || !proj || !proj.projectId) return Promise.reject(new Error('file_not_local'));
    var items = list.map(function(f) {
      var item = { id: f.id, ext: f.ext, url: origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + f.id + '.' + f.ext + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '') };
      if (f.replace) item.replace = true;
      return item;
    });
    return Promise.all(items.map(function(it) {
      return fetch(it.url, { method: 'HEAD' }).then(function(r) {
        if (r.status === 404) {
          var st = parseState(r);
          if (st && !st.telegram && st.state !== 'unknown') throw new Error('file_state:' + st.state + (st.reason ? ':' + st.reason : '')); // the server says why: no point asking to download
          return 0; // server mất file: vẫn hỏi tải, host sẽ thử khôi phục từ bản sao lưu Telegram
        }
      if (!r.ok) throw new Error('offline');
        return Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
      }, function() { throw new Error('offline'); });
    })).then(function(sizes) {
      var total = sizes.reduce(function(a, b) { return a + b; }, 0);
      return askDownload(total, items.length, items.map(function(it, i) { return { ext: it.ext, size: sizes[i] }; })).then(function(yes) {
        if (!yes) throw new Error('cancelled');
        return NativeTools.call('download_stored_file', { items: items, reason: 'Download files' });
      });
    });
  }

  function ensureLocal(id, ext) {
    var origin = serverOrigin();
    if (!origin || !proj || !proj.projectId) return Promise.reject(new Error('file_not_local'));
    var url = origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + id + '.' + ext + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '');
    return fetch(url, { method: 'HEAD' }).then(function(r) {
      if (r.status === 404) {
        var st = parseState(r);
        if (st && !st.telegram && st.state !== 'unknown') throw new Error('file_state:' + st.state + (st.reason ? ':' + st.reason : ''));
        return 0; // server mất file: vẫn hỏi tải, host sẽ thử khôi phục từ bản sao lưu Telegram
      }
      if (!r.ok) throw new Error('offline');
      return Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
    }, function() { throw new Error('offline'); }).then(function(size) {
      return askDownload(size, 1, [{ ext: ext, size: size }]).then(function(yes) {
        if (!yes) throw new Error('cancelled');
        return NativeTools.call('download_stored_file', { id: id, ext: ext, url: url, reason: 'Download file' });
      });
    });
  }

  window.addEventListener('online', retryQueue);
  // setTimeout(0) — KHÔNG gọi Storage.* ngay tại đây (files.js nạp trước storage.js trong thứ tự
  // bundleSdk sort alphabet: events, files, native_tools, router, storage, sync, theme); đợi 1 tick
  // để mọi core file nạp xong trước khi thử flush queue tồn đọng từ trước.
  if (navigator.onLine !== false) setTimeout(function() { retryQueue(); backfillMissing(); }, 0);

  // Placeholder cho ảnh/video/âm thanh lỗi load — capture phase vì lỗi load media không bubble. Hai nguyên nhân khác nhau:
  //  - URL cục bộ pick_file thuộc máy KHÁC (patch URL server chưa tới, hoặc chủ app giữ file lớn trên máy): chưa có file ở máy này.
  //  - URL file của server không tải được: đã hết hạn 30 ngày hoặc bị xoá.
  // Không cần dọn dataset thủ công: khi patch thật tới, sync.js's nav:changed khiến trang render lại toàn bộ, thẻ cũ bị thay bằng thẻ mới với src đúng.
  var PLACEHOLDER_STRINGS = {
    en: { pending: 'Not on this device yet', expired: 'Expired or deleted' },
    vi: { pending: 'Chưa có trên máy này', expired: 'Hết hạn hoặc đã bị xoá' }
  };

  // On the web the picture says why the server cannot give the file: the server answers its 404 with the state (X-Pilo-File-State), shown as a short title and line on the picture.
  var STATE_SHORT = {
    en: {
      uploading: ['Uploading', 'The original phone is sending it'], 'failed:big': ['Not uploaded', 'Large file, waiting for the original phone'], 'failed:toolarge': ['Too large', 'Over 100 MB, stays on the original phone'],
      'failed:kept': ['Not shared', 'The original phone keeps it private'], 'failed:denied': ['Could not upload', 'The original phone was refused'], 'failed:lost': ['File lost', 'The original phone no longer has it'],
      'failed:stalled': ['Upload stopped', 'Waiting for the original phone'], 'failed:error': ['Upload failed', 'The original phone must try again'], expired: ['Expired', 'The server keeps files 30 days'],
      deleted: ['Deleted', 'Removed from the server'], server_lost: ['Data lost', 'The server no longer has the file'], unknown: ['Never uploaded', 'The server never received it']
    },
    vi: {
      uploading: ['Đang tải lên', 'Máy gốc đang gửi file'], 'failed:big': ['Chưa tải lên', 'File lớn, chờ máy gốc đồng ý'], 'failed:toolarge': ['Quá lớn', 'Trên 100 MB, ở lại máy gốc'],
      'failed:kept': ['Không chia sẻ', 'Máy gốc giữ riêng'], 'failed:denied': ['Không tải lên được', 'Máy gốc bị từ chối'], 'failed:lost': ['File đã mất', 'Máy gốc không còn file'],
      'failed:stalled': ['Tải lên bị dừng', 'Chờ máy gốc mở app'], 'failed:error': ['Tải lên lỗi', 'Máy gốc cần thử lại'], expired: ['Đã hết hạn', 'Server giữ file 30 ngày'],
      deleted: ['Đã bị xoá', 'Khỏi server'], server_lost: ['Mất dữ liệu', 'Server không còn file'], unknown: ['Chưa từng tải lên', 'Server chưa nhận file này']
    }
  };
  function isVi() { return !!(ui().lang && ui().lang() === 'vi'); }
  // A state still on its way (the upload runs or went quiet): the picture asks again by itself.
  function waitingKey(kind) { return kind === 'uploading' || kind === 'failed:stalled'; }
  function placeholderParts(kind) {
    var vi = isVi();
    var short = (vi ? STATE_SHORT.vi : STATE_SHORT.en)[kind];
    var cloud = '<path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/><path d="M12 17v-5M9.5 14.5L12 12l2.5 2.5"/>';
    var warn = '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>';
    var down = '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>';
    if (short) return { t1: short[0], t2: short[1], gone: !waitingKey(kind), path: waitingKey(kind) ? cloud : warn, full: noteFor(kind) };
    var gone = kind === 'expired';
    return { t1: placeholderText(kind), t2: vi ? 'Chạm để tải' : 'Tap to download', gone: false, path: down, full: placeholderText(kind) };
  }
  // Ảnh không có trên máy / hết hạn: thay bằng một ô cùng kích thước (SVG) có icon + chữ, như canvas "Placeholders in pictures".
  function placeholderSrc(kind, w, h) {
    var P = placeholderParts(kind);
    var gone = P.gone, t1 = P.t1, t2 = P.t2, path = P.path;
    var bg = gone ? '#F8E3E0' : '#E9EEFF', fg = gone ? '#C2362B' : '#2B5CFB';
    var small = Math.min(w, h) < 96;
    var vw = Math.max(40, Math.round(w || 160)), vh = Math.max(40, Math.round(h || 120));
    var icon = '<g transform="translate(' + (vw / 2 - 13) + ' ' + (small ? vh / 2 - 13 : vh / 2 - 38) + ') scale(1.1)" fill="none" stroke="' + fg + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + path + '</g>';
    var text = small ? '' : '<text x="' + vw / 2 + '" y="' + (vh / 2 + 8) + '" text-anchor="middle" font-family="Instrument Sans,system-ui,sans-serif" font-size="13" font-weight="600" fill="#15171C">' + t1 + '</text><text x="' + vw / 2 + '" y="' + (vh / 2 + 26) + '" text-anchor="middle" font-family="Instrument Sans,system-ui,sans-serif" font-size="12" fill="#5F636C">' + t2 + '</text>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + '" height="' + vh + '" viewBox="0 0 ' + vw + ' ' + vh + '"><rect width="100%" height="100%" rx="12" fill="' + bg + '"/>' + icon + text + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function showPlaceholder(el, kind) {
    el.title = placeholderParts(kind).full;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    if (el.tagName === 'VIDEO') { el.poster = placeholderSrc(kind, r.width || 320, r.height || 180); el.dataset.piloPlaceholder = '1'; return; }
    if (el.tagName !== 'IMG') { el.style.opacity = '0.4'; return; }
    el.dataset.piloPlaceholder = '1';
    el.src = placeholderSrc(kind, r.width, r.height);
  }

  // The web asks the server why a file is missing (HEAD): the kind to show. A server that gives no reason (an old one) says "expired", as before; no answer at all stays "not here yet".
  function serverKind(url) {
    return fetch(url, { method: 'HEAD' }).then(function(r) {
      if (r.ok) return 'ok';
      if (r.status !== 404) return 'pending';
      var st = parseState(r);
      return st ? (st.state === 'failed' ? 'failed:' + (st.reason || 'error') : st.state) : 'expired';
    }, function() { return 'pending'; });
  }
  // While the original phone is still uploading (or the upload went quiet) the picture looks again now and then, and fills in by itself when the file arrives.
  var WEB_WAIT_DELAYS = [5000, 10000, 20000, 30000, 60000];
  function watchUpload(el, url, n) {
    if (n >= WEB_WAIT_DELAYS.length) return;
    setTimeout(function() {
      if (el.isConnected === false) return;
      serverKind(url).then(function(k) {
        if (k === 'ok') {
          delete el.dataset.piloPending; delete el.dataset.piloProbe; delete el.dataset.piloPlaceholder;
          if (el.tagName === 'VIDEO') { el.poster = ''; el.title = ''; if (el.load) el.load(); }
          else if (el.tagName === 'IMG') el.src = bust(url);
          else { el.style.opacity = ''; el.title = ''; if (el.load) el.load(); }
          return;
        }
        if (k !== el.dataset.piloPending && k !== 'pending') { el.dataset.piloPending = k; showPlaceholder(el, k); }
        if (waitingKey(k)) watchUpload(el, url, n + 1);
      });
    }, WEB_WAIT_DELAYS[n]);
  }

  function placeholderText(kind) {
    var lang = (document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
    return (lang.indexOf('vi') === 0 ? PLACEHOLDER_STRINGS.vi : PLACEHOLDER_STRINGS.en)[kind];
  }

  // Ảnh xem trước trên server có thể CHƯA kịp lên khi người xem mở trang (máy kia còn đang gửi): thử lại vài lần, thưa dần, rồi thôi. `?r=` tránh bản 404 đã bị cache.
  var THUMB_RETRY_DELAYS = [2000, 4000, 8000, 16000, 30000];
  function retryThumb(el, src) {
    var n = Number(el.dataset.piloThumbRetry || 0);
    if (n >= THUMB_RETRY_DELAYS.length) return false;
    el.dataset.piloThumbRetry = String(n + 1);
    setTimeout(function() {
      if (el.isConnected === false) return;
      var clean = src.replace(/([?&])r=\d+&?/, '$1').replace(/[?&]$/, '');
      el.src = clean + (clean.indexOf('?') >= 0 ? '&' : '?') + 'r=' + (n + 1);
    }, THUMB_RETRY_DELAYS[n]);
    return true;
  }

  document.addEventListener('error', function(e) {
    var el = e.target;
    if (!el || !/^(IMG|VIDEO|AUDIO)$/.test(el.tagName)) return;
    var src = el.getAttribute('src') || el.currentSrc || '';
    // Chỉ cho ảnh xem trước của VIDEO (không có bản gốc nào để lùi về); ảnh thường vẫn lùi về ảnh gốc ngay như trước.
    if (el.tagName === 'IMG' && el.dataset.piloThumbFallback && /\/files\/[0-9a-f]{16}\.thumb\.jpg(\?|$)/.test(src) && retryThumb(el, src)) return;
    var stored = storedPathOf(src);
    var origin = serverOrigin();
    // A stored file's thumbnail failed: ask the host once why (the old steps below go on at once, this only corrects them): 415 = the file is on this phone but cannot be read.
    if (el.tagName === 'IMG' && src.indexOf('/media-thumbnail/') >= 0 && !el.dataset.piloChecked && typeof fetch === 'function') {
      var failedFile = /files%2F([0-9a-f]{16})\.([A-Za-z0-9]{1,8})/i.exec(src);
      if (failedFile) {
        el.dataset.piloChecked = '1';
        try {
          Promise.resolve(fetch(src, { cache: 'no-store' })).then(function(r) { return r && r.status; }, function() { return 0; }).then(function(code) {
            if (code === 415) unreadable(el, failedFile[1], failedFile[2].toLowerCase(), src);
          });
        } catch (probeErr) { /* a page without fetch: the old steps are all there is */ }
      }
    }
    // Ảnh xem trước của video (thumbnail native) không tạo được vì máy này chưa có file: lấy ảnh xem trước đã được gửi kèm lên server.
    var thumbOf = el.tagName === 'IMG' && src.indexOf('/media-thumbnail/') >= 0 ? /files%2F([0-9a-f]{16})\.[A-Za-z0-9]{1,8}/i.exec(src) : null;
    if (thumbOf && origin && proj && proj.projectId && !el.dataset.piloThumbFallback) {
      el.dataset.piloThumbFallback = '1';
      el.src = origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + thumbOf[1] + '.thumb.jpg' + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '');
      return;
    }
    // Máy này không có ảnh (do máy khác lưu): lấy từ server theo đúng id, một lần. Chỉ với ẢNH: video/audio KHÔNG phát luồng từ server — xem phải tải về máy (ensureLocal).
    // Ảnh đang hiện nhỏ (danh sách, ô lưới: cạnh dài <= THUMB_SIZE điểm ảnh thật) thì lấy ảnh xem trước nhỏ; hiện to (xem full) hoặc chưa có ảnh xem trước thì lấy ảnh gốc.
    if (el.tagName === 'IMG' && origin && proj && proj.projectId) {
      var base = origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/';
      var q = proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '';
      if (stored && !el.dataset.piloFallback) {
        el.dataset.piloFallback = '1';
        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        var px = rect ? Math.max(rect.width, rect.height) * (window.devicePixelRatio || 1) : Infinity;
        // In the app only a picture shown big (full view) is worth asking to download the original; list rows and grid tiles keep the preview.
        var cssBig = !rect || Math.max(rect.width, rect.height) > BIG_CSS_PX;
        var id = storedId(stored);
        el.dataset.piloOrig = base + stored.slice('files/'.length) + q;
        if (px <= THUMB_SIZE || (window.NativeToolsBridge && !cssBig)) { el.dataset.piloUsedThumb = '1'; el.src = base + id + '.thumb.jpg' + q; }
        else if (window.NativeToolsBridge) { el.src = base + id + '.thumb.jpg' + q; wantOriginal(el, stored); } // trong app: ảnh gốc chỉ sau khi người dùng đồng ý tải về
        else el.src = el.dataset.piloOrig;
        return;
      }
      // Ảnh xem trước chưa có trên server (file cũ, hoặc file không tạo được): thử ảnh gốc.
      if (el.dataset.piloUsedThumb === '1' && !el.dataset.piloFull && !window.NativeToolsBridge && src.indexOf('.thumb.jpg') >= 0) {
        el.dataset.piloFull = '1';
        var fid = /\/files\/([0-9a-f]{16})\.thumb\.jpg/.exec(src);
        var orig = el.dataset.piloOrig;
        if (fid && orig) { el.src = orig; return; }
      }
    }
    // Lần tải từ server cũng lỗi (mất mạng, hoặc file đã hết hạn/bị xoá): hỏi server một lần để biết là "chưa có trên máy" hay "đã hết hạn".
    if (!stored && el.dataset.piloFallback && el.dataset.piloOrig && !el.dataset.piloPending && !el.dataset.piloProbe && el.tagName === 'IMG') {
      el.dataset.piloProbe = '1';
      serverKind(el.dataset.piloOrig).then(function(k) {
        if (k === 'ok') return;
        el.dataset.piloPending = k;
        if (typeof document !== 'undefined' && el.getBoundingClientRect) showPlaceholder(el, k);
        if (waitingKey(k)) watchUpload(el, el.dataset.piloOrig, 0);
      });
      return;
    }
    // Web, video / audio: the page reads the file straight from the server; when it is not there say why (the app has its own list for this).
    if (stored && !window.NativeToolsBridge && el.tagName !== 'IMG' && origin && proj && proj.projectId && !el.dataset.piloPending && !el.dataset.piloProbe) {
      el.dataset.piloProbe = '1';
      var mediaUrl = origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + stored.slice('files/'.length) + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '');
      serverKind(mediaUrl).then(function(k) {
        if (k === 'ok') return;
        el.dataset.piloPending = k;
        showPlaceholder(el, k === 'pending' ? 'pending' : k);
        if (waitingKey(k)) watchUpload(el, mediaUrl, 0);
      });
      return;
    }
    var kind = stored ? 'pending' : null;
    if (!kind || el.dataset.piloPending) return;
    el.dataset.piloPending = kind;
    noteMissing(parseStored(stored), 'element');
    if (el.tagName === 'IMG' && typeof document !== 'undefined' && el.getBoundingClientRect) showPlaceholder(el, kind);
    else { el.style.opacity = '0.4'; el.title = placeholderText(kind); }
  }, true);

  // ---- Xoá file khi bản ghi trỏ tới nó bị xoá/đổi ----
  function storedPathOf(src) {
    if (typeof src !== 'string') return null;
    var p = src.indexOf(location.origin + '/') === 0 ? src.slice(location.origin.length + 1) : src;
    p = p.split('?')[0].split('#')[0];
    return storedId(p) ? p : null;
  }

  // Mọi id file đã lưu trong [item] (cùng 3 chỗ với sourceUrlsIn()).
  function storedIn(item) {
    var out = {};
    if (!item || typeof item !== 'object') return out;
    function add(u) { var p = storedPathOf(u); if (p) out[storedId(p)] = p; }
    Object.keys(item).forEach(function(field) {
      var v = item[field];
      add(v);
      if (!Array.isArray(v)) return;
      v.forEach(function(el) {
        add(el);
        if (el && typeof el === 'object') Object.keys(el).forEach(function(k) { add(el[k]); });
      });
    });
    return out;
  }

  function stillReferenced(fileId) {
    return Storage.__raw.listStores().then(function(names) {
      var stores = names.filter(function(n) { return n.indexOf('__pilo') !== 0; });
      return stores.reduce(function(chain, name) {
        return chain.then(function(found) {
          if (found) return true;
          return Storage.getAll(name).then(function(items) {
            return (items || []).some(function(it) { return JSON.stringify(it).indexOf(fileId) !== -1; });
          });
        });
      }, Promise.resolve(false));
    });
  }

  function deleteOnServer(fileId) {
    dropNative(fileId); // the file is gone: it must not stay in the host's upload queue
    var origin = serverOrigin();
    if (!origin) return Promise.resolve();
    var url = origin + '/shares/' + encodeURIComponent(proj.projectId) + '/files/' + fileId + (guestParam() ? '?' + guestParam().slice(1) : '');
    return fetch(url, { method: 'DELETE', headers: authHeaders() }).then(function() {}, function() {}); // hết hạn 30 ngày là lưới an toàn nếu lỗi
  }

  function deleteLocal(fileId) {
    if (!window.NativeTools) return Promise.resolve();
    return NativeTools.call('delete_stored_file', { ids: [fileId] }).then(function() {}, function() {});
  }

  // Gọi từ storage.js khi người dùng ghi đè hoặc xoá 1 bản ghi: file có trong [before] mà không còn trong [after] thì xoá (máy + server), trừ khi bản ghi
  // khác (app nhân bản mục, hai trường cùng trỏ 1 file) vẫn dùng nó.
  function onItemChanged(before, after) {
    var was = storedIn(before);
    var now = storedIn(after);
    Object.keys(was).forEach(function(fileId) {
      if (now[fileId]) return;
      stillReferenced(fileId).then(function(used) { if (!used) { deleteOnServer(fileId); deleteLocal(fileId); } });
    });
  }

  // File tạm: URL `<origin>/native-output/...` hoặc path tuyệt đối trong thư mục tạm của PiloOS.
  var SOURCE_PREFIX = location.origin + '/native-output/';

  function isSource(v) {
    return typeof v === 'string' && (v.indexOf(SOURCE_PREFIX) === 0 || (v.charAt(0) === '/' && v.indexOf('/native_tool_output/') > 0));
  }

  function sourceUrlsIn(item) {
    var seen = {};
    var out = [];
    function add(u) {
      if (isSource(u) && !seen[u]) { seen[u] = true; out.push(u); }
    }
    Object.keys(item).forEach(function(field) {
      var v = item[field];
      add(v);
      if (!Array.isArray(v)) return;
      v.forEach(function(el) {
        add(el);
        if (el && typeof el === 'object') Object.keys(el).forEach(function(k) { add(el[k]); });
      });
    });
    return out;
  }

  // Copy mọi file tạm trong [item] vào app rồi sửa TẠI CHỖ: URL tạm / path tuyệt đối -> `files/<id>.<ext>`, ở field cấp 1 hoặc trong
  // mảng cấp 1. Trả Promise; reject (kể cả 'cancelled') thì item KHÔNG được ghi. Xong thì xếp upload nền theo id.
  function persistSources(item) {
    if (!item || typeof item !== 'object' || !window.NativeTools) return Promise.resolve();
    var urls = sourceUrlsIn(item);
    if (!urls.length) return Promise.resolve();
    flog('[FILES] persistSources: ' + urls.length + ' temp file(s) to copy into the app');
    return NativeTools.call('persist_file', { urls: urls }).then(function(reply) {
      var files = (reply && reply.data && reply.data.files) || [];
      var byFrom = {};
      files.forEach(function(f) {
        byFrom[f.from] = f.url;
        if (f.fromPath) byFrom[f.fromPath] = f.path;
      });
      function swap(v) {
        return typeof v === 'string' && byFrom[v] ? byFrom[v] : v;
      }
      Object.keys(item).forEach(function(field) {
        var v = item[field];
        if (typeof v === 'string') { item[field] = swap(v); return; }
        if (!Array.isArray(v)) return;
        item[field] = v.map(function(el) {
          if (typeof el === 'string') return swap(el);
          if (!el || typeof el !== 'object') return el;
          var copy = {};
          Object.keys(el).forEach(function(k) { copy[k] = swap(el[k]); });
          return copy;
        });
      });
      files.forEach(function(f) { startUpload(f.id, f.path, f.fileName, false); });
    });
  }

  // ---- API công khai cho mini app: Files.request ----
  // File đã lưu có địa chỉ `files/<id>.<đuôi>`. Trong app, file có thể CHƯA có trên máy này (do máy khác tải lên). Chỗ nào người dùng mở, phát toàn màn, sửa hay xử lý file bằng
  // code của app thì gọi TRƯỚC:   await Files.request(item.path)      // path hoặc mảng path; thiếu thì SDK hỏi tải (một hộp thoại gom), xong mới trả về chính đường dẫn đã nhận
  // Từ chối với Error('cancelled') (người dùng không tải), hoặc 'offline'. Trên web file đọc thẳng từ server nên request trả ngay.
  var STORED_PATH = /(?:^|\/)files\/([0-9a-f]{16})\.([A-Za-z0-9]{1,8})(?:[?#].*)?$/;
  function parseStored(p) {
    var m = typeof p === 'string' ? STORED_PATH.exec(p) : null;
    return m ? { id: m[1], ext: m[2], path: 'files/' + m[1] + '.' + m[2] } : null;
  }
  function isLocalInfo(info) {
    if (!window.NativeToolsBridge) return Promise.resolve(true);
    return fetch('/' + info.path, { method: 'HEAD' }).then(function(r) { return !!(r && r.ok); }, function() { return false; });
  }
  function eachLimited(items, limit, fn) {
    var out = new Array(items.length), i = 0;
    function worker() {
      if (i >= items.length) return Promise.resolve();
      var k = i++;
      return Promise.resolve(fn(items[k])).then(function(v) { out[k] = v; }).then(worker);
    }
    var pool = [];
    for (var n = 0; n < Math.min(limit, items.length); n++) pool.push(worker());
    return Promise.all(pool).then(function() { return out; });
  }
  function missingInfos(paths) {
    var seen = {}, infos = [];
    (Array.isArray(paths) ? paths : [paths]).forEach(function(p) { var i = parseStored(p); if (i && !seen[i.id]) { seen[i.id] = 1; infos.push(i); } });
    return eachLimited(infos, 8, isLocalInfo).then(function(local) { return infos.filter(function(_, k) { return !local[k]; }); });
  }
  var PublicFiles = {
    request: function(paths) {
      return missingInfos(paths).then(function(infos) {
        if (!infos.length) return paths;
        return ensureLocalMany(infos).then(function() { trayForget(infos); return paths; });
      });
    }
  };
  window.Files = PublicFiles;

  // ---- Danh sách file thiếu mà app đã cố dùng (lưới an toàn khi app quên Files.request) ----
  // Ghi lại — KHÔNG đổi hành vi của app — những lần app đụng tới file đã lưu mà máy chưa có: lệnh native bị chặn, thẻ ảnh/video/âm thanh lỗi, fetch/XHR nhận 404.
  // Chúng hiện trong một chip nổi; người dùng bấm tải đúng file mình muốn, không có hộp thoại bắt buộc. Chỉ trong app (trên web file đọc thẳng từ server).
  var TRAY_STRINGS = {
    en: { chip: 'Files needed', title: 'Files not on this device', hint: 'An app tried to use these files.', download: 'Download', all: 'Download all', close: 'Close', failed: 'Failed, try again', busy: 'Downloading…', queued: 'Waiting…', done: 'Downloaded', gone: 'No longer on the server or in the backup' },
    vi: { chip: 'File cần tải', title: 'File chưa có trên máy', hint: 'App vừa cần các file này.', download: 'Tải', all: 'Tải tất cả', close: 'Đóng', failed: 'Lỗi, thử lại', busy: 'Đang tải…', queued: 'Đang chờ…', done: 'Đã tải xong', gone: 'Không còn trên server và bản sao lưu' }
  };
  // Why a file cannot be had from the server: the server answers its 404 with the state in X-Pilo-File-State ("uploading", "failed:big", "expired", ...).
  var STATE_NOTES = {
    en: {
      uploading: 'The original phone is still uploading it. Try again in a few minutes',
      'failed:big': 'Not uploaded: the file is large and the original phone has not agreed to send it',
      'failed:toolarge': 'Over 100 MB: it stays on the original phone only',
      'failed:kept': 'The original phone keeps this file private',
      'failed:denied': 'The original phone was not allowed to upload it',
      'failed:lost': 'The original phone no longer has this file',
      'failed:stalled': 'The upload from the original phone stopped half way. It continues when that phone opens the app',
      'failed:error': 'The upload failed. The original phone must open the app to try again',
      expired: 'Expired: the server keeps files for 30 days',
      deleted: 'Deleted from the server',
      server_lost: 'The server lost the data of this file',
      unknown: 'The server never received this file. The original phone may have been offline',
      telegram: 'Not on the server, but there is a Telegram backup',
      network: 'Could not reach the server. Check the connection',
      server_error: 'The server had an error. Try again later'
    },
    vi: {
      uploading: 'Máy gốc đang tải file này lên. Thử lại sau vài phút',
      'failed:big': 'Chưa tải lên: file lớn và máy gốc chưa đồng ý gửi',
      'failed:toolarge': 'Trên 100 MB: chỉ nằm trên máy gốc',
      'failed:kept': 'Máy gốc giữ riêng file này, không chia sẻ',
      'failed:denied': 'Máy gốc không có quyền tải file này lên',
      'failed:lost': 'Máy gốc không còn file này',
      'failed:stalled': 'Tải lên từ máy gốc bị dừng giữa chừng. Nó tiếp tục khi máy đó mở app',
      'failed:error': 'Tải lên bị lỗi. Máy gốc cần mở app để thử lại',
      expired: 'Đã hết hạn: server chỉ giữ file 30 ngày',
      deleted: 'Đã bị xoá khỏi server',
      server_lost: 'Server mất dữ liệu của file này',
      unknown: 'Server chưa từng nhận file này. Có thể máy gốc đã không có mạng',
      telegram: 'Không còn trên server nhưng có bản sao lưu Telegram',
      network: 'Không kết nối được server. Kiểm tra mạng',
      server_error: 'Server đang lỗi. Thử lại sau'
    }
  };
  function noteFor(key) {
    var t = trayText() === TRAY_STRINGS.vi ? STATE_NOTES.vi : STATE_NOTES.en;
    return t[key] || t[String(key).indexOf('failed:') === 0 ? 'failed:error' : 'unknown'];
  }
  // {state, reason, telegram} from a response (the server's header), or null when it carries none.
  function parseState(r) {
    var h = r && r.headers && r.headers.get && r.headers.get('x-pilo-file-state');
    if (!h) return null;
    var parts = h.split(':');
    return { state: parts[0], reason: parts[1] || '', telegram: r.headers.get('x-pilo-file-telegram') === '1' };
  }
  function stateKey(s) { return s.telegram && s.state !== 'uploading' ? 'telegram' : s.state === 'failed' ? 'failed:' + (s.reason || 'error') : s.state; }
  // Can asking again ever help? Only while the upload is still running or stopped by itself (it goes on), or when a Telegram copy can bring it back.
  function retryable(s) { return !!s.telegram || s.state === 'uploading' || (s.state === 'failed' && s.reason === 'stalled'); }
  // Finds out (HEAD) why one missing file is not on the server and writes it on its row: the reason shows before anybody taps Download.
  // At most PROBE_MAX at a time (a long list must not open dozens of connections at once) and each gives up after PROBE_TIMEOUT_MS so a stuck one never holds the line.
  var PROBE_MAX = 3, PROBE_TIMEOUT_MS = 10000, probeActive = 0, probeQueue = [];
  function probeEntry(f) {
    if (!serverOrigin() || !proj || !proj.projectId || typeof fetch !== 'function') return;
    probeQueue.push(f);
    probePump();
  }
  function probePump() {
    while (probeActive < PROBE_MAX && probeQueue.length) {
      (function(f) {
        probeActive++;
        var finished = false;
        function done() { if (finished) return; finished = true; probeActive--; probePump(); }
        setTimeout(done, PROBE_TIMEOUT_MS);
        fetch(serverOrigin() + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + f.id + '.' + f.ext + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : ''), { method: 'HEAD', pilo: true }).then(function(r) {
          done();
          if (r.ok || tray[f.id] !== f) return;
          var s = r.status === 404 ? parseState(r) : null;
          if (!s) return;
          f.note = noteFor(stateKey(s));
          if (!retryable(s) && f.state === 'idle') f.state = 'gone';
          trayRender();
        }, done);
      })(probeQueue.shift());
    }
  }
  var tray = {}, trayChip = null, traySheet = null, trayFilled = false, trayQueue = [], trayActive = 0, trayGot = false, trayOpen = false;
  var TRAY_PARALLEL = 2;
  function trayText() {
    var lang = String((document.documentElement && document.documentElement.lang) || window.PILO_LANG || navigator.language || 'en').toLowerCase();
    return lang.indexOf('vi') === 0 ? TRAY_STRINGS.vi : TRAY_STRINGS.en;
  }
  function noteMissing(info, why) {
    if (!info || !window.NativeToolsBridge || !document.body) return;
    if (tray[info.id]) return;
    flog('[FILES] missing on this device id=' + info.id + ' why=' + why);
    tray[info.id] = { id: info.id, ext: info.ext, path: info.path, why: why, state: 'idle', note: '' };
    probeEntry(tray[info.id]);
    trayRender();
  }
  function trayIds() { return Object.keys(tray); }
  function trayCss() {
    if (document.getElementById('pilo-tray-style')) return;
    var st = document.createElement('style');
    st.id = 'pilo-tray-style';
    st.textContent = '.pilo-tray-chip:active{transform:scale(.97)}.pilo-tray-chip{position:fixed;transition:transform 120ms cubic-bezier(.2,.8,.2,1);right:16px;bottom:var(--pilo-chip-bottom,calc(168px + env(safe-area-inset-bottom,0px)));z-index:2147482300;height:44px;padding:0 16px 0 10px;border-radius:22px;border:0;background:#15171C;color:#fff;display:flex;align-items:center;gap:10px;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 22px rgba(21,23,28,.32);cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.pilo-tray-chip b{min-width:24px;height:24px;border-radius:12px;background:#2B5CFB;font-size:12px;line-height:24px;padding:0 6px;box-sizing:border-box;text-align:center}' +
      '.pilo-tray-x{flex:none;width:44px;height:44px;margin-right:-10px;border:0;background:transparent;color:#5F636C;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '.pilo-tray-list{max-height:46vh;overflow:auto;margin-bottom:6px}' +
      '.pilo-tray-btn{flex:none;height:34px;border:0;border-radius:17px;padding:0 14px;font:600 13px \'Instrument Sans\',system-ui,sans-serif;background:#2B5CFB;color:#fff;cursor:pointer;display:flex;align-items:center}' +
      '.pilo-tray-btn[disabled]{background:#E6E2DA;color:#5F636C}';
    document.head.appendChild(st);
  }
  // Chế độ native: danh sách file thiếu do host hiện (số trên nút PiloOS + mục trong menu); SDK chỉ gửi danh sách và nhận lệnh tải.
  var hostTrayFailed = false;
  function hostTray() { var H = window.__PiloHostUi; return !!(H && H.ready() && !hostTrayFailed); }
  function postMissing() {
    window.__PiloHostUi.post('missing', { files: trayIds().map(function(id) { var f = tray[id]; return { id: id, ext: f.ext, state: f.state === 'idle' ? 'idle' : f.state, note: f.note || '' }; }) }).then(function(ok) {
      if (!ok) { hostTrayFailed = true; trayRender(); }
    });
  }
  function trayRender() {
    if (hostTray()) { postMissing(); return; }
    var ids = trayIds();
    if (!ids.length) {
      if (trayChip) { ui().dismiss(trayChip); trayChip = null; }
      if (traySheet) traySheetClose();
      return;
    }
    var left = ids.filter(function(id) { return tray[id].state !== 'done'; }).length;
    if (!left) {
      // everything on the list is finished: no chip any more, the open list keeps showing the ticks until it is closed
      if (trayChip) { ui().dismiss(trayChip); trayChip = null; }
      if (traySheet) trayFill();
      return;
    }
    trayCss();
    if (!trayChip) {
      trayChip = document.createElement('button');
      trayChip.className = 'pilo-tray-chip';
      trayChip.setAttribute('data-pilo-rise', '');
      trayChip.setAttribute('aria-label', trayText().title);
      trayChip.addEventListener('click', traySheetOpen);
      document.body.appendChild(trayChip);
    }
    trayChip.innerHTML = '<b>' + left + '</b>' + trayText().chip;
    if (traySheet) trayFill();
  }
  function traySheetOpen() {
    if (traySheet) return;
    trayOpen = true;
    trayCss();
    ui().css && ui().css();
    traySheet = document.createElement('div');
    traySheet.className = 'pilo-tray-sheet';
    traySheet.setAttribute('data-pilo-overlay', '');
    traySheet.setAttribute('role', 'dialog');
    traySheet.setAttribute('aria-modal', 'true');
    traySheet.addEventListener('click', function(e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-a]') : e.target;
      var a = t && t.getAttribute ? t.getAttribute('data-a') : null;
      if (!a && e.target === traySheet) a = 'close';
      if (a === 'close') traySheetClose();
      else if (a === 'one') trayDownload([t.getAttribute('data-id')]);
      else if (a === 'all') trayDownload(trayIds());
    });
    document.body.appendChild(traySheet);
    trayFilled = false;
    trayFill();
  }
  function traySheetClose() { if (traySheet) { ui().dismiss(traySheet); traySheet = null; trayIsOpen(false); } }
  // Vẽ lại sheet khi trạng thái file đổi: lần đầu thẻ chạy animation vào, các lần sau mang data-pilo-still nên không chạy lại.
  function trayFill() {
    if (hostTray()) { postMissing(); return; }
    if (!traySheet) return;
    var s = trayText();
    var still = trayFilled ? ' data-pilo-still' : '';
    var U = ui(), vi = U.lang ? U.lang() === 'vi' : false, labels = vi ? KIND_LABEL.vi : KIND_LABEL.en;
    var rows = trayIds().map(function(id) {
      var f = tray[id];
      var kind = U.kindOf(f.ext);
      var note = f.state === 'failed' ? s.failed : f.state === 'done' ? s.done : f.state === 'gone' ? s.gone : f.state === 'busy' ? s.busy : f.state === 'queued' ? s.queued : '';
      if (f.note && (f.state === 'idle' || f.state === 'failed' || f.state === 'gone')) note = f.note;
      var btn = '<button type="button" class="pilo-tray-btn pilo-press" data-a="one" data-id="' + id + '"' + (f.state === 'busy' || f.state === 'queued' ? ' disabled' : '') + '>' + (f.state === 'busy' ? s.busy : f.state === 'queued' ? s.queued : s.download) + '</button>';
      return U.fileRow(kind, labels[kind] + ' · ' + String(f.ext).toUpperCase(), note, btn);
    }).join('');
    traySheet.innerHTML = '<div class="pilo-card" data-pilo-sheet' + still + '><div class="pilo-grab"></div><div class="pilo-hd"><div><div class="pilo-h pilo-tray-title">' + s.title + '</div></div>' +
      '<button type="button" class="pilo-tray-x pilo-press" data-a="close" aria-label="' + s.close + '">' + U.icon('x', 22) + '</button></div><p class="pilo-p pilo-tray-hint" style="font-size:14px;margin-top:6px">' + s.hint + '</p>' +
      '<div class="pilo-list pilo-tray-list">' + rows + '</div><div class="pilo-acts"><button type="button" class="pilo-btn pri pilo-press" data-a="all">' + U.icon('down', 20) + s.all + '</button></div></div>';
    trayFilled = true;
  }
  // Người dùng chủ động bấm tải: mỗi file một lần gọi riêng, tối đa TRAY_PARALLEL file cùng lúc; host vẽ tiến trình và lỗi ngay trên từng hàng
  // của danh sách (quiet = không mở hộp thoại tiến trình). Xong file nào thì bỏ file đó khỏi danh sách; file lỗi giữ lại, đánh dấu "lỗi" hoặc
  // "không còn" (server và bản sao lưu đều không có) để người dùng thấy ngay. Khi cả hàng đợi xong thì cho app đọc lại dữ liệu.
  function trayDownload(ids) {
    var origin = serverOrigin();
    if (!origin || !proj || !proj.projectId) return Promise.resolve();
    var list = ids.map(function(id) { return tray[id]; }).filter(function(f) { return f && f.state !== 'busy' && f.state !== 'queued' && f.state !== 'gone' && f.state !== 'done'; });
    if (!list.length) return Promise.resolve();
    list.forEach(function(f) { f.state = 'queued'; trayQueue.push(f); });
    trayFill();
    trayPump(origin);
    return Promise.resolve();
  }
  function trayPump(origin) {
    while (trayActive < TRAY_PARALLEL && trayQueue.length) {
      (function(f) {
        trayActive++;
        f.state = 'busy';
        trayFill();
        var item = { id: f.id, ext: f.ext, url: origin + '/t/' + encodeURIComponent(proj.projectId) + '/files/' + f.id + '.' + f.ext + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '') };
        if (f.why === 'unreadable') item.replace = true;
        NativeTools.call('download_stored_file', { items: [item], quiet: true, reason: 'Download files' }).then(function() {
          if (f.why === 'unreadable') markRedownloaded(f.id);
          // List open: keep the row with a tick (the host animates it); it goes when the list closes. List closed: gone at once.
          if (trayOpen) f.state = 'done'; else delete tray[f.id];
          trayGot = true;
          trayRender();
        }, function(e) {
          var msg = String(e && e.message), m = /file_state:([a-z_]+)(?::([a-z_]+))?(\|telegram)?/.exec(msg), code = /server_error:(\d+)/.exec(msg);
          if (m) {
            var st = { state: m[1], reason: m[2] || '', telegram: !!m[3] };
            f.note = noteFor(stateKey(st));
            f.state = retryable(st) ? 'failed' : 'gone';
          } else if (/not_available/.test(msg)) { f.state = 'gone'; f.note = ''; }
          else if (/network:/.test(msg)) { f.state = 'failed'; f.note = noteFor('network'); }
          else if (code) { f.state = 'failed'; f.note = noteFor('server_error'); }
          else { f.state = 'failed'; f.note = ''; }
          trayRender();
        }).then(function() {
          trayActive--;
          if (!trayQueue.length && !trayActive && trayGot) { trayGot = false; refreshAfterDownload(); }
          trayPump(origin);
        });
      })(trayQueue.shift());
    }
  }
  // The host tells whether its list is open: finished rows stay (with a tick) while it is, and are dropped when it closes.
  function trayIsOpen(open) {
    trayOpen = open;
    if (open) return;
    Object.keys(tray).forEach(function(id) { if (tray[id].state === 'done') delete tray[id]; });
    trayRender();
  }
  function refreshAfterDownload() {
    try {
      if (window.refreshPage) { window.refreshPage(); return; }
      if (window.Router && window.Router.getCurrent) {
        var slot = window.Router.getCurrent();
        if (slot) document.dispatchEvent(new CustomEvent('nav:changed', { detail: { from: null, to: slot, params: window.Router.getParams ? window.Router.getParams() : null } }));
      }
    } catch (e) {}
  }
  // ---- Phát hiện file thiếu ngay khi dữ liệu được đọc (Storage.get / getAll, kể cả dữ liệu vừa đồng bộ về) ----
  // Bản ghi nào trỏ tới files/<id>.<đuôi> mà máy này chưa có thì vào chip ngay, không cần app đụng tới file. Mỗi id chỉ kiểm tra một lần
  // và chip liệt kê mỗi file một lần (khoá theo id), gom đủ mọi file thiếu của app.
  var scanSeen = {};
  var SCAN_MAX = 500;
  function scanRecords(store, result) {
    if (!window.NativeToolsBridge || typeof document === 'undefined' || !document.body || String(store).indexOf('__') === 0 || !result) return;
    var list = Array.isArray(result) ? result : [result];
    var infos = [];
    list.slice(0, SCAN_MAX).forEach(function(item) {
      var ids = storedIn(item);
      var keys = Object.keys(ids);
      // the size the app saved with the record (only when the record has exactly one stored file, so the number can only be that file's)
      var declared = keys.length === 1 && item && typeof item === 'object' ? Number(item.size || item.sizeBytes) : 0;
      keys.forEach(function(id) {
        var info = parseStored(ids[id]);
        if (info && !scanSeen[id] && !tray[id]) { scanSeen[id] = true; if (declared > 0) info.declared = declared; infos.push(info); }
      });
    });
    if (!infos.length) return;
    eachLimited(infos, 4, function(info) {
      return fetch('/' + info.path, { method: 'HEAD' }).then(function(r) {
        if (!(r && r.ok)) { noteMissing(info, 'record'); return; }
        // The file is here but shorter than when it was saved: a download or a copy was cut off. Same as not being here: offer to fetch it again over the top.
        var length = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
        if (info.declared && length > 0 && length < info.declared && !redownloaded(info.id)) noteMissing(info, 'unreadable');
      }, function() { noteMissing(info, 'record'); });
    });
  }

  // File vừa có trên máy theo đường khác (app gọi Files.request, người dùng tải tay…): gỡ khỏi danh sách.
  function trayForget(infos) { infos.forEach(function(i) { delete tray[i.id]; }); trayRender(); }

  // Quan sát fetch/XHR tới file đã lưu: 404 nghĩa là app đọc file chưa có trên máy. Chỉ ghi lại, trả về đúng kết quả gốc.
  function storedFromUrl(u) {
    try {
      var path = String(u).split('?')[0].split('#')[0];
      var i = path.indexOf('files/');
      return i < 0 ? null : parseStored(path.slice(i));
    } catch (e) { return null; }
  }
  if (typeof window.fetch === 'function' && !window.fetch.__piloWatched) {
    var rawFetch = window.fetch;
    window.fetch = function(input, init) {
      var p = rawFetch.apply(this, arguments);
      try {
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var info = method === 'HEAD' || (init && init.pilo) ? null : storedFromUrl(typeof input === 'string' ? input : input && input.url);
        if (info && window.NativeToolsBridge) p.then(function(r) { if (r && r.status === 404) noteMissing(info, 'read'); }, function() {});
      } catch (e) {}
      return p;
    };
    window.fetch.__piloWatched = true;
  }
  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype && !XMLHttpRequest.prototype.__piloWatched) {
    var rawOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        var info = String(method).toUpperCase() === 'HEAD' ? null : storedFromUrl(url);
        if (info && window.NativeToolsBridge) this.addEventListener('loadend', function() { if (this.status === 404) noteMissing(info, 'read'); });
      } catch (e) {}
      return rawOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.__piloWatched = true;
  }

  window.__PiloFiles = { hostDownload: function(ids) { return trayDownload(ids); }, hostTray: trayIsOpen, scanRecords: scanRecords, afterLocalSave: function(d) { startUpload(d.id, d.path, d.fileName, false); }, noteMissing: function(id, ext, why) { noteMissing({ id: id, ext: ext, path: 'files/' + id + '.' + ext }, why); }, persistSources: persistSources, ensureLocal: ensureLocal, ensureLocalMany: ensureLocalMany, onItemChanged: onItemChanged, tracksUploads: function() { return !!serverOrigin() || !!window.NativeToolsBridge; } };
  // Xem trước giao diện hệ thống với dữ liệu giả (dùng để chụp so với canvas và kiểm tra bằng mắt); không có tác dụng với dữ liệu thật.
  window.__PiloFiles.preview = {
    big: function(list) { list.forEach(function(e, i) { addBig('preview' + i, 'files/preview' + i, e.name, e.size, !!e.tooLarge); }); showBigDialog(); },
    download: function(size, count, items) { return askDownload(size, count, items); },
    saved: function(name, size) { try { localStorage.removeItem(NOTICE_KEY); } catch (e) {} showSavedNotice(name, size); },
    tray: function(list) { list.forEach(function(f) { noteMissing({ id: f.id, ext: f.ext, path: 'files/' + f.id + '.' + f.ext }, 'read'); }); traySheetOpen(); }
  };
})();

// Core Host UI — DO NOT EDIT. Cầu nối tới giao diện hệ thống NATIVE của host Android (pill upload, hộp hỏi file, toast, loading, danh sách file thiếu).
// SDK vẫn là bên biết trạng thái; khi chạy trong app, nó gửi trạng thái / câu hỏi qua tool `pilo_ui` và host vẽ bằng view native (không bị đơ cùng trang).
// Trên web (không có cầu nối) hoặc host cũ chưa có tool này: ready() = false và từng file (upload_ui, files, readonly, notice, sync) tự vẽ bằng DOM như trước.
(function() {
  'use strict';
  var avail = null;   // null: chưa biết; true: host trả lời ping; false: host không có tool này
  var handlers = {};  // event của host -> hàm xử lý (host gọi window.__PiloHostUi.event)

  function bridge() { return typeof window !== 'undefined' && !!window.NativeToolsBridge && !!window.NativeTools; }
  function ready() { return bridge() && avail !== false; }

  function call(action, data) {
    var params = { action: action };
    Object.keys(data || {}).forEach(function(k) { params[k] = data[k]; });
    return window.NativeTools.call('pilo_ui', params).then(function(r) { avail = true; return (r && r.data) || {}; }, function(e) {
      if (!/cancelled/.test(String(e && e.message))) avail = false;
      throw e;
    });
  }

  // Gửi một lần, không chờ kết quả. Thất bại (host cũ) → tắt chế độ native để các màn quay lại DOM; trả Promise<bool> "đã gửi được".
  function post(action, data) {
    if (!ready()) return Promise.resolve(false);
    return call(action, data).then(function() { return true; }, function() { return false; });
  }

  // Hỏi một câu và chờ người dùng chọn: Promise<choice>; reject khi host không hỗ trợ (caller rơi về DOM).
  function dialog(kind, data) {
    var d = {};
    Object.keys(data || {}).forEach(function(k) { d[k] = data[k]; });
    d.kind = kind;
    return call('dialog', d).then(function(r) { return r.choice || 'dismiss'; });
  }

  function on(name, fn) { handlers[name] = fn; }
  function event(name, data) {
    if (name === 'download' && window.__PiloFiles && window.__PiloFiles.hostDownload) { try { window.__PiloFiles.hostDownload((data && data.ids) || []); } catch (e) { /* lỗi tải được hiện qua trạng thái danh sách */ } return; }
    if (name === 'tray' && window.__PiloFiles && window.__PiloFiles.hostTray) { try { window.__PiloFiles.hostTray(!!(data && data.open)); } catch (e) { /* lỗi ở danh sách không được làm hỏng host */ } }
    var fn = handlers[name]; if (fn) { try { fn(data || {}); } catch (e) { /* một handler lỗi không được làm hỏng host */ } } }

  // Màu nền của trang (cho màn loading native): rgb() -> #RRGGBB.
  function pageBg() {
    try {
      var c = getComputedStyle(document.body).backgroundColor;
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c);
      if (m && (m[4] === undefined || Number(m[4]) > 0)) return '#' + [m[1], m[2], m[3]].map(function(x) { return ('0' + Number(x).toString(16)).slice(-2); }).join('');
      var v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) { /* nền không đọc được */ }
    return '#FFFFFF';
  }

  window.__PiloHostUi = { ready: ready, call: call, post: post, dialog: dialog, on: on, event: event, pageBg: pageBg, _off: function() { avail = false; } };
  if (bridge()) setTimeout(function() { call('ping').then(function() {}, function() {}); }, 0);
})();

// Core Native Tools — DO NOT EDIT. Bridge to native-capability tools (image/video/PDF/etc).
(function() {
  'use strict';
  var pending = {};
  var seq = 0;

  // TRACE (OFF by default; localStorage.setItem('pilo_trace','1') switches it on): every native call, uncaught error and page lifecycle event is written with console.log, which the host keeps in the mini app log file (files/mini_app_logs/<id>.log).
  // Only tool names, parameter NAMES and timings are logged, never parameter values or file content.
  var TRACE = (function () { try { return localStorage.getItem('pilo_trace') === '1'; } catch (e) { return false; } })(), T0 = Date.now(), lines = 0;
  function trace(m) { if (!TRACE || lines > 1500) return; lines++; try { console.log('[TRACE +' + (Date.now() - T0) + 'ms] ' + m); } catch (e) {} }
  if (TRACE && typeof window.addEventListener === 'function' && typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    trace('page start ' + location.pathname + ' ua=' + navigator.userAgent.replace(/^Mozilla\/5.0 /, '').slice(0, 90) + ' online=' + navigator.onLine + ' bridge=' + !!window.NativeToolsBridge);
    window.addEventListener('error', function(e) { trace('UNCAUGHT ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno); });
    window.addEventListener('unhandledrejection', function(e) { var r = e.reason; trace('UNHANDLED REJECTION ' + (r && r.message ? r.message : String(r)).slice(0, 200)); });
    window.addEventListener('online', function() { trace('network online'); });
    window.addEventListener('offline', function() { trace('network offline'); });
    document.addEventListener('visibilitychange', function() { trace('visibility ' + document.visibilityState); });
    window.addEventListener('pagehide', function() { trace('pagehide'); });
    window.addEventListener('pageshow', function(e) { trace('pageshow persisted=' + e.persisted); });
    document.addEventListener('nav:changed', function(e) { trace('nav ' + (e.detail && e.detail.from) + ' -> ' + (e.detail && e.detail.to)); });
  }

  function call(toolName, params, onEvent, retried) {
    return new Promise(function(resolve, reject) {
      if (!window.NativeToolsBridge) { reject(new Error('NativeTools bridge not available')); return; }
      var id = String(++seq);
      var streaming = typeof onEvent === 'function';
      pending[id] = { resolve: resolve, reject: reject, onEvent: onEvent, streaming: streaming, tool: toolName, params: params, retried: !!retried, t0: Date.now() };
      trace('call #' + id + ' ' + toolName + ' params=[' + Object.keys(params || {}).join(',') + ']' + (retried ? ' (retry)' : '') + (streaming ? ' stream' : ''));
      window.NativeToolsBridge.postMessage(JSON.stringify({ id: id, tool: toolName, params: params || {}, stream: streaming }));
    });
  }

  if (window.NativeToolsBridge) {
    window.NativeToolsBridge.onmessage = function(event) {
      var reply;
      try { reply = JSON.parse(event.data); } catch (e) { return; }
      var p = pending[reply.id];
      if (!p) return;
      if (p.streaming && reply.event === 'update') {
        if (p.onEvent) p.onEvent(reply.data);
        return;
      }
      delete pending[reply.id];
      trace('reply #' + reply.id + ' ' + p.tool + ' ' + (Date.now() - p.t0) + 'ms ' + (reply.error ? 'ERROR ' + String(reply.error).slice(0, 160) : 'ok data=[' + Object.keys(reply.data || {}).join(',') + ']'));
      if (reply.data && reply.data.path && !reply.data.url) {
        // Served through the /native-output/ path handler (see MiniAppWebViewSetup) — a real
        // URL on this page's own origin, not a raw filesystem path JS could never load. Only
        // applies when Kotlin didn't already build a url itself (pick_file does, via its own
        // /pick-output/ path — see MiniAppNativeToolsBridge.kt).
        reply.data.url = location.origin + '/native-output/' + reply.data.path.split('/').pop();
      }
      // Lệnh cần một file đã lưu (files/<id>.<đuôi>) mà máy này chưa có: SDK hỏi người dùng tải về, rồi chạy lại ĐÚNG lệnh đó một lần.
      var miss = reply.error && !p.retried && window.__PiloFiles && window.__PiloFiles.ensureLocal ? /^file_not_local:([0-9a-f]{16})\.([A-Za-z0-9]{1,8})$/.exec(reply.error) : null;
      if (miss) {
        window.__PiloFiles.ensureLocal(miss[1], miss[2]).then(function() {
          return call(p.tool, p.params, p.onEvent, true).then(p.resolve, p.reject);
        }, function(e) {
          // Người dùng hủy (hoặc không tải được): file vào danh sách "chưa có trên máy" để tải sau khi cần.
          if (window.__PiloFiles.noteMissing) window.__PiloFiles.noteMissing(miss[1], miss[2], 'native');
          p.reject(e);
        });
        return;
      }
      // Nội dung do trang tạo ra vừa được lưu thành file của app: để SDK đưa nó lên server như mọi file đã lưu khác.
      if (!reply.error && p.tool === 'save_local_file' && reply.data && reply.data.id && window.__PiloFiles && window.__PiloFiles.afterLocalSave) window.__PiloFiles.afterLocalSave(reply.data);
      if (reply.error) { p.reject(new Error(reply.error)); } else { p.resolve(reply); }
    };
  }

  window.NativeTools = { call: call };
})();

// Core Notice — DO NOT EDIT. Toast cảnh báo nhỏ, tự chứa (DOM + CSS riêng, tiền tố pilo-nt-) nên chạy y hệt trong WebView native lẫn trang web, không cần phần tử #toast của app.
// Dùng bởi Core Sync khi server không nhận được dữ liệu (hết dung lượng, mục quá lớn): dữ liệu vẫn nằm trên máy, chỉ chưa được sao lưu.
(function() {
  'use strict';

  var STRINGS = {
    en: {
      quota_exceeded: 'Storage is full. New data is saved on this device only and is not backed up to the server.',
      too_large: 'This entry is too large to back up. It is saved on this device only.',
      role_viewer: 'Your access was changed to view only. You can no longer add, change or delete data.',
      role_editor: 'You can now edit this app.',
      access_removed: 'You no longer have access to this app. You can only view what is already on this device.',
      unsaved: 'Your last change was not saved. You can only view this app.'
    },
    vi: {
      quota_exceeded: 'Đã hết dung lượng. Dữ liệu mới chỉ lưu trên máy này, chưa được sao lưu lên server.',
      too_large: 'Mục này quá lớn nên chưa sao lưu được, chỉ lưu trên máy này.',
      role_viewer: '\u0051uy\u1ec1n c\u1ee7a b\u1ea1n \u0111\u00e3 \u0111\u1ed5i th\u00e0nh ch\u1ec9 xem. B\u1ea1n kh\u00f4ng th\u1ec3 th\u00eam, s\u1eeda hay x\u00f3a d\u1eef li\u1ec7u n\u1eefa.',
      role_editor: 'B\u1ea1n \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1ea5p quy\u1ec1n ch\u1ec9nh s\u1eeda app n\u00e0y.',
      access_removed: 'B\u1ea1n kh\u00f4ng c\u00f2n quy\u1ec1n truy c\u1eadp app n\u00e0y. B\u1ea1n ch\u1ec9 xem \u0111\u01b0\u1ee3c nh\u1eefng g\u00ec \u0111ang c\u00f3 tr\u00ean m\u00e1y.',
      unsaved: 'Thay \u0111\u1ed5i v\u1eeba r\u1ed3i ch\u01b0a \u0111\u01b0\u1ee3c l\u01b0u. B\u1ea1n ch\u1ec9 \u0111\u01b0\u1ee3c xem app n\u00e0y.'
    }
  };

  var CSS =
    '.pilo-nt{position:fixed;left:16px;right:16px;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:2147482000;display:flex;justify-content:center;pointer-events:none;font-family:\'Instrument Sans\',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.pilo-nt-card{max-width:420px;display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:14px;background:#15171C;color:#fff;font-size:14px;line-height:1.4;box-shadow:0 10px 30px rgba(21,23,28,.35)}' +
    '.pilo-nt-icon{flex-shrink:0;margin-top:1px;color:#F5B942}';

  var WARN = '<svg class="pilo-nt-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17.5v.01"/></svg>';

  var lastShown = {};
  var hideTimer = null;
  var current = null;

  function strings() {
    var lang = (document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
    return lang.indexOf('vi') === 0 ? STRINGS.vi : STRINGS.en;
  }

  function hide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (current && current.parentNode) { if (window.__PiloUi && !current.__piloOut) window.__PiloUi.dismiss(current); else current.parentNode.removeChild(current); }
    current = null;
  }

  // code: khoá trong STRINGS. Mỗi code chỉ hiện lại sau 60 giây — lỗi lặp (mỗi lần lưu đều hết dung lượng) không được dội toast liên tục.
  function warn(code) {
    var text = strings()[code];
    var now = Date.now();
    if (!text || !document.body || (lastShown[code] && now - lastShown[code] < 60000)) return;
    lastShown[code] = now;
    var H = window.__PiloHostUi;
    if (H && H.ready()) { H.post('toast', { text: text }).then(function(ok) { if (!ok) domToast(text); }); return; }
    domToast(text);
  }

  function domToast(text) {
    if (!document.getElementById('pilo-nt-style')) {
      var style = document.createElement('style');
      style.id = 'pilo-nt-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    hide();
    var el = document.createElement('div');
    el.className = 'pilo-nt';
    el.setAttribute('data-pilo-rise', '');
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="pilo-nt-card">' + WARN + '<span class="pilo-nt-text"></span></div>';
    el.querySelector('.pilo-nt-text').textContent = text;
    document.body.appendChild(el);
    current = el;
    hideTimer = setTimeout(hide, 4000);
  }

  window.__PiloNotice = { warn: warn };
})();

// Core ReadOnly — DO NOT EDIT. Hộp thoại giải thích cho người xem (Viewer) vì sao không lưu được; Storage gọi khi chặn ghi (xem storage.js's readOnlyGuard).
// Tự chứa hoàn toàn (DOM + CSS riêng, tiền tố pilo-ro-) nên chạy y hệt trong WebView native lẫn trang web của link chia sẻ, không phụ thuộc Bootstrap hay DOM của app.
(function() {
  'use strict';

  var STRINGS = {
    en: {
      title: 'You can view this app, not change it',
      body: 'This app was shared with you as a viewer. You can read everything in it, but you can’t add, change or delete entries.',
      unsaved: 'Your last change was not saved',
      chip: 'View only',
      hint: 'To make changes, ask the person who shared it to make you an editor.',
      ok: 'Got it'
    },
    vi: {
      title: 'Bạn chỉ được xem, không sửa được',
      body: 'App này được chia sẻ cho bạn với quyền người xem. Bạn xem được mọi thứ trong app nhưng không thể thêm, sửa hay xóa dữ liệu.',
      unsaved: 'Thay đổi vừa rồi chưa được lưu',
      chip: 'Chỉ xem',
      hint: 'Muốn chỉnh sửa, hãy nhờ người chia sẻ cấp quyền biên tập cho bạn.',
      ok: 'Đã hiểu'
    }
  };

  // Ghi lúc khởi động của app (seed dữ liệu mặc định...) không phải thao tác của người dùng: chỉ hiện hộp thoại sau khi họ đã chạm/bấm gì đó,
  // còn việc ghi vẫn bị từ chối bình thường (xem storage.js).
  var userActed = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function(type) {
    document.addEventListener(type, function() { userActed = true; }, { capture: true, passive: true });
  });

  var CSS =
    '.pilo-ro-card{max-width:360px}.pilo-ro-mid{display:flex;flex-direction:column;align-items:center;text-align:center}' +
    '.pilo-ro-mid .pilo-h{margin-top:16px}.pilo-ro-mid .pilo-p{font-size:14.5px;margin-top:10px}' +
    '.pilo-ro-hint{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#E9EEFF;color:#1D3FBF;font:500 13px/1.4 \'Instrument Sans\',system-ui,sans-serif}' +
    '.pilo-ro-chip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px;z-index:2147482000;height:28px;padding:0 12px;border-radius:14px;border:1px solid #C9C5BC;background:#FBFAF8;color:#5F636C;display:flex;align-items:center;gap:6px;font:600 11px \'Instrument Sans\',system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;pointer-events:none}';

  var EYE = '';
  var shownOnce = false, chipEl = null;

  // Chip "Chỉ xem" ở góc trên phải, hiện từ lần đầu người xem bị chặn ghi.
  function showChip(t) {
    if (chipEl || !document.body) return;
    var U = window.__PiloUi;
    chipEl = document.createElement('div');
    chipEl.className = 'pilo-ro-chip';
    chipEl.setAttribute('data-pilo-rise', '');
    chipEl.innerHTML = (U ? U.icon('eye', 14) : '') + '<span></span>';
    chipEl.lastChild.textContent = t.chip;
    document.body.appendChild(chipEl);
  }

  var openBackdrop = null;

  function strings() {
    var lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
    return lang.indexOf('vi') === 0 ? STRINGS.vi : STRINGS.en;
  }

  function close() {
    if (!openBackdrop) return;
    var el = openBackdrop;
    openBackdrop = null;
    document.removeEventListener('keydown', onKey, true);
    if (window.__PiloUi) window.__PiloUi.dismiss(el); else if (el.parentNode) el.parentNode.removeChild(el);
    if (window.PiloView) window.PiloView.resume();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function show() {
    if (openBackdrop || !userActed || !document.body) return;
    var H = window.__PiloHostUi;
    if (H && H.ready()) {
      // Native: dialog giải thích lần đầu, chip "Chỉ xem" và toast "chưa lưu" các lần sau.
      H.post('chip', { show: true });
      if (shownOnce) { if (window.__PiloNotice) window.__PiloNotice.warn('unsaved'); return; }
      shownOnce = true;
      H.post('dialog', { kind: 'readonly' }).then(function(ok) { if (!ok) { shownOnce = false; domFallback(); } });
      return;
    }
    domFallback();
  }

  function domFallback() {
    var U = window.__PiloUi;
    if (U) U.css();
    if (!document.getElementById('pilo-ro-style')) {
      var style = document.createElement('style');
      style.id = 'pilo-ro-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    var t = strings();
    showChip(t);
    // Lần đầu: hộp thoại giải thích. Các lần sau: chỉ toast "chưa lưu" để không chặn người xem.
    if (shownOnce) { if (window.__PiloNotice) window.__PiloNotice.warn('unsaved'); return; }
    shownOnce = true;
    var backdrop = document.createElement('div');
    backdrop.className = 'pilo-ov pilo-mid pilo-ro-backdrop';
    backdrop.setAttribute('data-pilo-overlay', '');
    backdrop.innerHTML =
      '<div class="pilo-card pilo-ro-card" data-pilo-dialog role="dialog" aria-modal="true" aria-labelledby="pilo-ro-title">' +
        '<div class="pilo-ro-mid">' + (U ? U.badge('eye', '', true) : '') +
        '<h2 class="pilo-h" id="pilo-ro-title"></h2>' +
        '<p class="pilo-p pilo-ro-body"></p>' +
        '<p class="pilo-ro-hint"></p></div>' +
        '<div class="pilo-acts" style="margin-top:18px"><button type="button" class="pilo-btn pri pilo-press pilo-ro-ok"></button></div>' +
      '</div>';
    backdrop.querySelector('.pilo-h').textContent = t.title;
    backdrop.querySelector('.pilo-ro-body').textContent = t.body;
    backdrop.querySelector('.pilo-ro-hint').textContent = t.hint;
    var ok = backdrop.querySelector('.pilo-ro-ok');
    ok.textContent = t.ok;
    ok.addEventListener('click', close);
    backdrop.addEventListener('click', function(e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(backdrop);
    openBackdrop = backdrop;
    // Native View (camera...) nằm trên WebView — phải tạm ẩn thì hộp thoại mới thấy được, đóng lại thì trả về như cũ (xem modal.js).
    if (window.PiloView) window.PiloView.suspend();
    ok.focus();
  }

  window.__PiloReadOnly = { notify: show };
})();

// Core Res — DO NOT EDIT. Android-style resources: res/colors.js (window.AppColors), res/dimens.js (window.AppDimens) and
// res/strings.js (window.AppStrings) hold EVERY color, size and user-visible text of the app. This file publishes them:
//   colors/dimens -> CSS custom properties on <html> (camelCase key -> --kebab-case; numbers become px), so CSS uses var(--primary),
//   JS helpers  C('primary') -> '#1565C0', D('spacing4') -> 16 (number, px), S('save') / S('items_count', 3) -> text ({0} {1} placeholders).
// Texts are multilingual: res/strings.js is { en: { key: 'Save' }, vi: { key: 'Lưu' } }. The host sets window.PILO_LANG to the language of the
// Pilo app (default 'en'); S() reads that language, falls back to 'en', then to the key. An old flat AppStrings ({ key: 'text' }) still works as 'en'.
// A per-app choice overrides it: Lang.set('vi') (this app only, kept in this app's own localStorage, page reloads), Lang.set(null) = follow Pilo again.
// Lang.get() -> language in use, Lang.list() -> languages this app has texts for, Lang.isCustom() -> true when the app overrides Pilo.
// The res files load BEFORE this script; a missing file or key never throws (S returns the key, C returns '', D returns 0).
(function() {
  'use strict';
  var colors = window.AppColors || {};
  var dimens = window.AppDimens || {};
  var allStrings = window.AppStrings || {};
  var languages = Object.keys(allStrings);
  // Nested ({ en: {...}, vi: {...} }) when every top-level value is an object; otherwise the old flat shape, kept working as 'en'.
  var strings = languages.length > 0 && languages.every(function(k) { return allStrings[k] !== null && typeof allStrings[k] === 'object'; })
    ? allStrings : { en: allStrings };

  var LANG_KEY = 'pilo_lang';

  function normalize(code) {
    return String(code || '').toLowerCase().split(/[-_]/)[0];
  }

  function storedLang() {
    try {
      var code = normalize(window.localStorage && window.localStorage.getItem(LANG_KEY));
      return code && strings[code] ? code : '';
    } catch (e) { return ''; }
  }

  function language() {
    return storedLang() || normalize(window.PILO_LANG) || 'en';
  }

  window.Lang = {
    get: language,
    list: function() { return Object.keys(strings); },
    isCustom: function() { return storedLang() !== ''; },
    // code = a language from Lang.list(); null/'' = follow the Pilo app again. Reloads so every screen is redrawn in the new language.
    set: function(code) {
      var next = normalize(code);
      if (next && !strings[next]) { console.warn('Lang.set(): no texts for "' + next + '" in res/strings.js'); return false; }
      try {
        if (next) window.localStorage.setItem(LANG_KEY, next); else window.localStorage.removeItem(LANG_KEY);
      } catch (e) { return false; }
      if (window.location && window.location.reload) window.location.reload();
      return true;
    },
  };

  function cssName(key) {
    return '--' + String(key).replace(/([a-z])([A-Z0-9])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
  }

  var root = document.documentElement;
  Object.keys(colors).forEach(function(key) {
    root.style.setProperty(cssName(key), String(colors[key]));
  });
  Object.keys(dimens).forEach(function(key) {
    var value = dimens[key];
    root.style.setProperty(cssName(key), typeof value === 'number' ? value + 'px' : String(value));
  });

  window.C = function(key) {
    if (colors[key] === undefined) { console.warn('C(): no color "' + key + '" in res/colors.js'); return ''; }
    return colors[key];
  };

  window.D = function(key) {
    var value = dimens[key];
    if (value === undefined) { console.warn('D(): no dimen "' + key + '" in res/dimens.js'); return 0; }
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  };

  window.S = function(key) {
    var text = (strings[language()] || {})[key];
    if (text === undefined) text = (strings.en || {})[key];
    if (text === undefined) { console.warn('S(): no string "' + key + '" in res/strings.js'); return String(key); }
    var args = Array.prototype.slice.call(arguments, 1);
    return String(text).replace(/\{(\d+)\}/g, function(whole, index) {
      return args[index] === undefined ? whole : String(args[index]);
    });
  };
})();

// Core Router — DO NOT EDIT. All navigation goes through this.
(function() {
  'use strict';

  const pages = new Map();
  let current = null;
  let history = [];
  let onBeforeLeave = null;
  let currentParams = null;
  // The very first slot ever navigated to is main.js's initial Router.navigate() call — by
  // definition the app's home/default tab. Used by backOrHome() below.
  let homeSlot = null;

  function register(slot, element) {
    pages.set(slot, element);
  }

  function init() {
    document.querySelectorAll('[data-page]').forEach(function(el) {
      var slot = el.getAttribute('data-page');
      register(slot, el);
    });
  }

  // A tab (a [data-nav] button of the bottom bar, or the home slot) is a ROOT: tabs are lateral, not hierarchical.
  // Arriving on one — by a tab click or by any code calling navigate(tab) — drops the whole back-stack, so Back
  // never resurrects pages that were opened from a tab the user already left (stale detail/form pages, the
  // "navigate('home') after save, then Back returns to the form" trap).
  function isTab(slot) {
    if (slot === homeSlot) return true;
    var nav = document.querySelector && document.querySelector('#bottomNav [data-nav="' + slot + '"]');
    return !!nav;
  }

  // [options.replace] — when true, the current slot is swapped out WITHOUT being pushed onto the back-stack.
  // Pushed (drill-down) pages, e.g. tapping a list item to open a detail screen, must NOT pass replace so Back
  // still returns to the page that opened them. The back-stack stores {slot, params}: Back restores the params
  // the earlier page was opened with.
  function navigate(slot, params, options) {
    if (current === slot) return;
    var target = pages.get(slot);
    if (!target) return;

    if (onBeforeLeave) {
      var canLeave = onBeforeLeave(current, slot);
      if (canLeave === false) return;
    }

    if (homeSlot === null) homeSlot = slot;
    var replace = options && options.replace;
    var from = current;
    if (current) {
      var prev = pages.get(current);
      if (prev) {
        prev.style.display = 'none';
      }
      if (!replace && !isTab(slot)) history.push({ slot: current, params: currentParams });
    }
    if (isTab(slot)) history = [];

    target.style.display = '';
    target.scrollTop = 0;
    current = slot;
    currentParams = params || null;

    // Dispatch navigation event for components to react
    document.dispatchEvent(new CustomEvent('nav:changed', {
      detail: { from: from, to: slot, params: currentParams }
    }));
  }

  // Returns true when it moved to the previous page, false when there was nowhere to go or onBeforeLeave refused.
  function back() {
    if (history.length === 0) return false;
    var entry = history[history.length - 1];
    var target = pages.get(entry.slot);
    if (!target) { history.pop(); return false; }

    if (onBeforeLeave) {
      var canLeave = onBeforeLeave(current, entry.slot);
      if (canLeave === false) return false;
    }
    history.pop();

    var from = current;
    if (current) {
      var cur = pages.get(current);
      if (cur) cur.style.display = 'none';
    }

    target.style.display = '';
    target.scrollTop = 0;
    current = entry.slot;
    currentParams = entry.params || null;

    document.dispatchEvent(new CustomEvent('nav:changed', {
      detail: { from: from, to: current, params: currentParams }
    }));
    return true;
  }

  function getCurrent() {
    return current;
  }

  function getParams() {
    return currentParams;
  }

  function canGoBack() {
    return history.length > 0;
  }

  function setBeforeLeave(fn) {
    onBeforeLeave = fn;
  }

  // Physical/gesture Back should land on the home tab before it's allowed to exit the app — the
  // standard Android bottom-nav convention (matches native BottomNavigationView + Fragment back
  // handling). Returns true if it moved somewhere (pushed history OR home tab), false only when
  // there's truly nowhere left to go (already on the home tab with no pushed history) — the
  // caller (MiniAppFullscreenActivity.onBack()) treats false as "now actually close the app".
  function backOrHome() {
    if (canGoBack()) {
      back();
      return true;
    }
    if (homeSlot && current !== homeSlot) {
      navigate(homeSlot, undefined, { replace: true });
      return true;
    }
    return false;
  }

  window.Router = {
    init: init,
    navigate: navigate,
    back: back,
    getCurrent: getCurrent,
    getParams: getParams,
    canGoBack: canGoBack,
    setBeforeLeave: setBeforeLeave,
    backOrHome: backOrHome
  };

  // Auto-init immediately: this script tag runs after all [data-page] elements are already
  // parsed into the DOM (see index.html's script order), so waiting for DOMContentLoaded here
  // would race against main.js's eager Router.navigate() call — pages would still be an empty
  // Map, navigate() would no-op, and the initial page would never become `current`, leaving it
  // permanently un-hideable on every later navigation.
  init();
})();

// Core Storage — DO NOT EDIT. IndexedDB wrapper with simple key-value API.
(function() {
  'use strict';

  var db = null;
  // IDB_TRACE: step-by-step trace of every IndexedDB open / upgrade / transaction, written with console.log (the host stores it in the mini app log file). OFF by default;
  // switch it on for a page with localStorage.setItem('pilo_trace','1') (used to track down a first-run hang). Every line starts with [IDB +<ms since this page loaded>].
  function traceOn() { try { return localStorage.getItem('pilo_trace') === '1'; } catch (e) { return false; } }
  var IDB_TRACE = traceOn(), T0 = Date.now(), inflight = {}, inflightN = 0, traceLines = 0;
  function dbg(m) { if (!IDB_TRACE || traceLines > 400) return; traceLines++; try { console.log('[IDB +' + (Date.now() - T0) + 'ms] ' + m); } catch (e) {} }
  function track(name) {
    var id = ++inflightN; inflight[id] = { name: name, t: Date.now() };
    return function() { delete inflight[id]; };
  }
  if (IDB_TRACE && typeof setInterval === 'function') {
    var wd = setInterval(function() {
      var ks = Object.keys(inflight), old = ks.filter(function(k) { return Date.now() - inflight[k].t > 2500; });
      if (old.length) dbg('WATCHDOG pending: ' + old.map(function(k) { return inflight[k].name + ' ' + (Date.now() - inflight[k].t) + 'ms'; }).join(', ') + ' | db=' + (db ? 'v' + db.version : 'null') + ' stores=' + knownStores.join(','));
      if (Date.now() - T0 > 60000) clearInterval(wd);
    }, 2000);
    dbg('storage.js loaded, DB_NAME=' + DB_NAME + ' online=' + navigator.onLine);
  }
  // DB_NAME namespaced theo shareId (nếu có) — nếu KHÔNG, mọi link chia sẻ khác nhau trên
  // CÙNG server (cùng origin scheme+host+port, IndexedDB không phân biệt theo path) sẽ vô
  // tình dùng CHUNG 1 database, data của room A rò sang UI room B khi mở trong cùng trình
  // duyệt — bug thật gặp khi verify: mở link mới, Redis server rỗng nhưng trình duyệt vẫn
  // hiện data cũ từ link trước đó. Native WebView (Preview/Chạy ▶) không bị ảnh hưởng — mỗi
  // project vốn đã có origin ảo riêng — nhưng namespace luôn cho nhất quán, vô hại.
  // Native (`proj.native`) KHÔNG namespace: mỗi project có origin riêng và dữ liệu có sẵn của chủ app nằm ở 'app_db' — đổi tên sẽ làm nó biến mất.
  var DB_NAME = (window.__PILO_PROJECT__ && window.__PILO_PROJECT__.projectId && !window.__PILO_PROJECT__.native)
    ? 'app_db_' + window.__PILO_PROJECT__.projectId
    : 'app_db';
  var knownStores = [];
  // Every ensureStore() call is chained onto this single promise instead of firing its own
  // independent indexedDB.open() immediately — real on-device bug this fixes: every tab page's
  // render() runs unconditionally as soon as its <script> tag executes (not gated behind
  // nav:changed), so 4 tabs' worth of Storage.getAll() calls for DIFFERENT store names all land
  // within the same tick, before any of their version-probe/upgrade sequences has resolved. Each
  // one independently saw `db === null` and started its OWN indexedDB.open(DB_NAME, N+1) —
  // multiple concurrent version-upgrade opens on the SAME database, where the losing request(s)
  // hit IndexedDB's `blocked` state (an older connection to the same DB not yet closed) and, since
  // nothing here handled `onblocked`, sat forever with neither onsuccess nor onerror ever firing —
  // the awaiting page's render() hung indefinitely, no thrown error, no console output, blank
  // screen. Serializing every call through one chain means at most one open()/upgrade sequence is
  // ever in flight; by the time the 2nd/3rd/4th call's turn comes, `db` is usually already set and
  // its `if (db && ...)` fast path returns immediately with no new IndexedDB call at all.
  var queue = Promise.resolve();

  // Stores are created on demand: any storeName a page passes to get/put/remove/clear gets its
  // own object store automatically. The DB's real on-disk version (which survives across page
  // loads/app restarts, unlike the in-memory `db` variable) is probed first — opening with a
  // version equal to or below what's already persisted would silently skip onupgradeneeded and
  // never create the missing store.
  function ensureStore(storeName) {
    var done = track('ensureStore(' + storeName + ')');
    dbg('ensureStore(' + storeName + ') queued, db=' + (db ? 'v' + db.version : 'null'));
    queue = queue.then(function() {
      if (db && db.objectStoreNames.contains(storeName)) { dbg('ensureStore(' + storeName + ') fast path'); return db; }
      if (db) { dbg('ensureStore(' + storeName + ') closing v' + db.version + ' to upgrade'); db.close(); db = null; }
      dbg('ensureStore(' + storeName + ') opening');
      return openWithRetry(storeName, 5);
    });
    queue.then(function() { done(); dbg('ensureStore(' + storeName + ') resolved'); }, function(e) { done(); dbg('ensureStore(' + storeName + ') REJECTED ' + e); });
    return queue;
  }

  // A `blocked` event fires when ANOTHER connection to the same origin's database — e.g. a
  // WebView instance mid-teardown after a tab switch/Fragment reload elsewhere in the host app —
  // hasn't released its handle yet. This is a real on-device scenario (not just this script's own
  // in-page concurrency, already handled by the `queue` above): the host Android app can tear
  // down and reinflate this exact WebView on a tab switch without a deterministic point at which
  // the OLD instance's IndexedDB connection is guaranteed closed before the NEW instance starts.
  // That window is normally brief (tens to a couple hundred ms while Chromium finishes closing
  // the old connection), not permanent — so retry a few times with a short delay instead of
  // failing the instant this page loses the race.
  function openWithRetry(storeName, retriesLeft) {
    return new Promise(function(resolve, reject) {
      var tp = Date.now(), probe, mute = function(label, req) { var t = setTimeout(function() { dbg(label + ' no event after 3s'); }, 3000); return function() { clearTimeout(t); }; };
      dbg('probe open(' + DB_NAME + ') for ' + storeName + ' retries=' + retriesLeft);
      probe = indexedDB.open(DB_NAME);
      var stopProbe = mute('probe');
      probe.onupgradeneeded = function() { dbg('probe onupgradeneeded (db did not exist yet)'); };
      probe.onsuccess = function(e) {
        stopProbe();
        var current = e.target.result;
        dbg('probe success v' + current.version + ' in ' + (Date.now() - tp) + 'ms stores=' + [].slice.call(current.objectStoreNames).join(','));
        var currentVersion = current.version;
        var alreadyHasStore = current.objectStoreNames.contains(storeName);
        current.close();
        var allStores = knownStores.indexOf(storeName) === -1 ? knownStores.concat([storeName]) : knownStores;
        var targetVersion = alreadyHasStore ? currentVersion : currentVersion + 1;
        dbg('open v' + targetVersion + ' alreadyHasStore=' + alreadyHasStore);
        var request = indexedDB.open(DB_NAME, targetVersion), stopReq = mute('open v' + targetVersion), tr = Date.now();
        if (!alreadyHasStore) {
          request.onupgradeneeded = function(e2) {
            dbg('onupgradeneeded -> creating ' + allStores.join(','));
            var d = e2.target.result;
            allStores.forEach(function(name) {
              if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: 'key' });
            });
          };
        }
        request.onsuccess = function(e2) {
          stopReq();
          db = e2.target.result;
          dbg('open success v' + db.version + ' in ' + (Date.now() - tr) + 'ms');
          db.onversionchange = function() { dbg('onversionchange received: another connection wants to upgrade, closing ours'); try { db.close(); } catch (er) {} db = null; };
          db.onclose = function() { dbg('connection closed unexpectedly'); };
          knownStores = allStores;
          resolve(db);
        };
        request.onerror = function(e2) { stopReq(); dbg('open ERROR ' + (e2.target.error && e2.target.error.name)); reject(e2.target.error); };
        request.onblocked = function() {
          dbg('open BLOCKED (another connection is still open) retriesLeft=' + retriesLeft);
          if (retriesLeft > 0) {
            setTimeout(function() {
              openWithRetry(storeName, retriesLeft - 1).then(resolve, reject);
            }, 150);
          } else {
            reject(new Error('IndexedDB blocked for ' + storeName + ' after retries'));
          }
        };
      };
      probe.onerror = function(e) { stopProbe(); dbg('probe ERROR ' + (e.target.error && e.target.error.name)); reject(e.target.error); };
      probe.onblocked = function() { dbg('probe BLOCKED'); };
    });
  }

  // Tên các object store đang có trên đĩa (không tạo store mới) — Core Sync dùng để đẩy dữ liệu cục bộ lên server lúc vào room.
  function listStores() {
    return queue.then(function() {
      return new Promise(function(resolve) {
        var req = indexedDB.open(DB_NAME);
        req.onsuccess = function(e) {
          var d = e.target.result;
          var names = [].slice.call(d.objectStoreNames);
          d.close();
          resolve(names);
        };
        req.onerror = function() { resolve([]); };
      });
    });
  }

  function open() {
    return db ? Promise.resolve(db) : ensureStore('kv');
  }

  // Đọc thẳng, KHÔNG qua cổng (Core Sync dùng khi nạp dữ liệu lần đầu — nếu đi qua cổng sẽ tự chờ chính mình).
  function readLocal(storeName, key) {
    return ensureStore(storeName).then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var req = key ? store.get(key) : store.getAll();
        req.onsuccess = function() { resolve(req.result); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  // Cổng đọc: máy chưa từng đồng bộ project này đang tải dữ liệu từ server (Core Sync gọi holdReads). Mọi lần đọc của app chờ ở đây, nên app chỉ vẽ MỘT lần
  // với dữ liệu thật — không vẽ "dự án trống" (màn đầu tiên / onboarding) rồi mới nhảy sang dữ liệu.
  var readGate = null;
  function holdReads(promise) {
    dbg('holdReads: reads wait for the first server load');
    var t = Date.now();
    var release = function() { dbg('readGate released after ' + (Date.now() - t) + 'ms'); if (readGate === gate) readGate = null; };
    var gate = promise.then(release, release);
    readGate = gate;
  }

  function get(storeName, key) {
    var done = track('get(' + storeName + (key ? ',' + key : ',ALL') + ')');
    dbg('get(' + storeName + (key ? ',' + key : ',ALL') + ') gate=' + (readGate ? 'WAITING' : 'open'));
    var read = readGate ? readGate.then(function() { return readLocal(storeName, key); }) : readLocal(storeName, key);
    // Bản ghi trỏ tới file chưa có trên máy này: báo cho chip "File cần tải" ngay khi đọc (files.js scanRecords).
    return read.then(function(r) {
      done(); dbg('get(' + storeName + ') done n=' + (Array.isArray(r) ? r.length : (r ? 1 : 0)));
      var f = window.__PiloFiles;
      if (f && f.scanRecords) { try { f.scanRecords(storeName, r); } catch (e) { /* chip chỉ là phần phụ */ } }
      return r;
    });
  }

  function getAll(storeName) {
    return get(storeName, null);
  }

  // putLocal/removeLocal: hành vi IndexedDB thuần, KHÔNG đụng mạng — y hệt put()/remove() gốc
  // trước khi có sync (đổi tên, thân hàm không đổi 1 dòng nào).
  function putLocal(storeName, value) {
    // Mọi object store dùng keyPath 'key' (xem createObjectStore ở trên) — lỗi thật đã gặp nhiều
    // lần: code trang tự viết Storage.put(store, obj) với obj chỉ có field 'id' (không có 'key'),
    // khiến IndexedDB ném DataError "key path did not yield a value" và nút Lưu/Tạo im lặng fail
    // (catch bắt được, chỉ hiện toast chung chung "Có lỗi xảy ra"). Khoan dung ở tầng SDK thay vì
    // chỉ trông chờ mọi page tự nhớ đúng field: nếu value có 'id' nhưng thiếu 'key', tự đồng bộ
    // 'key' = 'id' trước khi ghi — không đổi hành vi khi value đã có 'key' đúng.
    if (value && typeof value === 'object' && value.key === undefined && value.id !== undefined) {
      value.key = value.id;
    }
    var done = track('putLocal(' + storeName + ')');
    dbg('putLocal(' + storeName + ',' + (value && value.key) + ')');
    return ensureStore(storeName).then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(storeName, 'readwrite');
        var req = tx.objectStore(storeName).put(value);
        req.onsuccess = function() {
          done(); dbg('putLocal(' + storeName + ') ok');
          resolve(req.result);
        };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  function removeLocal(storeName, key) {
    return ensureStore(storeName).then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(storeName, 'readwrite');
        var req = tx.objectStore(storeName).delete(key);
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  // Chỉ so field cấp 1 (shallow) — đủ cho object phẳng mọi page thường dùng. `before` null (item
  // mới hoàn toàn, chưa từng lưu) thì patch = cả object luôn, không có gì để so.
  function diffTopLevel(before, after) {
    var out = {};
    if (!before) return after;
    Object.keys(after).forEach(function(k) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = after[k];
    });
    return out;
  }

  // put/remove PUBLIC — nâng cấp ngầm: khi project có ngữ cảnh đồng bộ (window.__PiloSync tồn tại,
  // gán bởi Core Sync bên dưới), tự tính phần field thật sự đổi rồi gửi lên server; ngoài ra (Preview/
  // Editor, hoặc chạy cục bộ không có server) hành vi giữ y hệt putLocal/removeLocal — page/LLM không cần biết
  // gì về mạng.
  // Share with_data: chặn ghi NGAY ở đây (từ chối Promise) khi người dùng là Viewer, thay vì lưu cục bộ rồi để server từ chối âm thầm
  // (bản ghi chỉ có trên máy khách, chủ không bao giờ thấy). Chỉ dựa vào `role` do nguồn thật gửi (server: viewer/editor/owner; native: owner) —
  // thiếu role (ngữ cảnh cũ) thì KHÔNG chặn, để một giá trị permission cũ/hardcode không khoá nhầm chủ app.
  function readOnlyGuard() {
    var s = window.__PILO_PROJECT__;
    if (s && s.dataMode === 'with_data' && s.role === 'viewer') {
      if (window.__PiloReadOnly) window.__PiloReadOnly.notify();
      return Promise.reject(new Error('Bạn chỉ có quyền xem — không thể lưu thay đổi'));
    }
    return null;
  }

  // Người dùng ghi đè/xoá 1 bản ghi: file đính kèm trên server mà bản ghi không còn trỏ tới thì xoá sớm (xem files.js's onItemChanged). Dữ liệu nhận từ server
  // (Core Sync qua __raw) KHÔNG đi qua đây, nên máy khác xoá thì máy này không gọi xoá lần nữa.
  function trackFiles() {
    return !!(window.__PiloFiles && window.__PiloFiles.tracksUploads && window.__PiloFiles.tracksUploads());
  }

  function put(storeName, value) {
    if (!window.__PiloSync && !trackFiles()) return putLocal(storeName, value);
    if (value && typeof value === 'object' && value.key === undefined && value.id !== undefined) {
      value.key = value.id;
    }
    return get(storeName, value.key).then(function(before) {
      return putLocal(storeName, value).then(function(result) {
        if (window.__PiloSync) {
          var patch = diffTopLevel(before, value);
          if (Object.keys(patch).length > 0) {
            window.__PiloSync.enqueuePatch(storeName, value.key, patch, value);
          }
        }
        if (before && trackFiles()) window.__PiloFiles.onItemChanged(before, value);
        return result;
      });
    });
  }

  function remove(storeName, key) {
    var denied = readOnlyGuard();
    if (denied) return denied;
    var tracked = trackFiles();
    var beforeP = tracked ? get(storeName, key) : Promise.resolve(null);
    var p = beforeP.then(function(before) {
      return removeLocal(storeName, key).then(function(r) {
        if (before) window.__PiloFiles.onItemChanged(before, null);
        return r;
      });
    });
    if (window.__PiloSync) {
      p = p.then(function(r) { window.__PiloSync.enqueueDelete(storeName, key); return r; });
    }
    return p;
  }

  function clear(storeName) {
    var denied = readOnlyGuard();
    if (denied) return denied;
    return ensureStore(storeName).then(function(d) {
      return new Promise(function(resolve, reject) {
        var tx = d.transaction(storeName, 'readwrite');
        var req = tx.objectStore(storeName).clear();
        req.onsuccess = function() { resolve(); };
        req.onerror = function() { reject(req.error); };
      });
    });
  }

  // put() công khai: nếu item còn URL tạm của pick_file (file chưa được copy vào app) thì ĐỢI copy xong rồi mới ghi —
  // xem files.js's persistSources. Hết bước đó là put() cũ y nguyên.
  // Base64 / data: URL trong bản ghi: bản ghi được đồng bộ tới MỌI máy (WebSocket) và nằm trong dữ liệu app, nên nội dung lớn không được nhét vào đó. Muốn giữ nội dung do trang tạo ra
  // (canvas, văn bản sinh ra, SVG...) thì lưu thành file bằng save_local_file rồi chỉ lưu địa chỉ files/<id>.<đuôi> vào bản ghi. Chuỗi nhỏ (icon vài KB) vẫn được.
  var DATA_URL_MAX = 2048;
  var RAW_BASE64_MAX = 4096;
  function findBase64(v, path, depth) {
    if (typeof v === 'string') {
      if (v.length > DATA_URL_MAX && /^data:[^,]{0,100};base64,/i.test(v)) return path;
      if (v.length > RAW_BASE64_MAX && /^[A-Za-z0-9+\/=\r\n]+$/.test(v)) return path;
      return null;
    }
    if (!v || typeof v !== 'object' || depth > 4) return null;
    var keys = Object.keys(v);
    for (var i = 0; i < keys.length; i++) {
      var hit = findBase64(v[keys[i]], path ? path + '.' + keys[i] : keys[i], depth + 1);
      if (hit) return hit;
    }
    return null;
  }

  function putPersisted(storeName, value) {
    var denied = readOnlyGuard();
    if (denied) return denied;
    var base64Field = findBase64(value, '', 0);
    if (base64Field) {
      return Promise.reject(new Error('[base64_not_allowed] Storage.put refuses base64 / data: URLs (field "' + base64Field + '"): a record is synced to every device. ' +
        "To keep content your page generated (canvas drawing, text, SVG, JSON) as a file, call NativeTools.call('save_local_file', { fileName: 'name.png', base64: <payload only> }) " +
        'and store the returned data.path in the record instead.'));
    }
    var files = window.__PiloFiles;
    var done = track('put(' + storeName + ') persistSources'), tp = Date.now();
    dbg('put(' + storeName + ',' + (value && value.key) + ') persistSources start');
    var ready = files && files.persistSources ? files.persistSources(value) : Promise.resolve();
    return ready.then(function() { done(); dbg('persistSources done in ' + (Date.now() - tp) + 'ms'); return put(storeName, value); }, function(e) { done(); dbg('persistSources FAILED ' + e); throw e; });
  }

  // putMany(storeName, values): lưu NHIỀU bản ghi cùng lúc. Mọi file tạm của cả lô được copy vào app trong MỘT lượt (một danh sách tiến độ, không nháy từng file một),
  // rồi từng bản ghi được ghi lần lượt; bản ghi nào lỗi thì bỏ qua, các bản ghi còn lại vẫn lưu. Trả { ok: [bản ghi đã lưu], failed: [{ item, error }] }.
  // Chỉ reject khi cả lô không copy được file (ví dụ người dùng bấm Huỷ) hoặc app ở chế độ chỉ xem.
  function putMany(storeName, values) {
    values = Array.isArray(values) ? values : [];
    if (!values.length) return Promise.resolve({ ok: [], failed: [] });
    var denied = readOnlyGuard();
    if (denied) return denied;
    var files = window.__PiloFiles;
    var wrap = { items: values.slice() };
    var ready = files && files.persistSources ? files.persistSources(wrap) : Promise.resolve();
    return ready.then(function() {
      var ok = [], failed = [];
      return wrap.items.reduce(function(chain, v) {
        return chain.then(function() {
          return putPersisted(storeName, v).then(function() { ok.push(v); }, function(e) { failed.push({ item: v, error: e }); });
        });
      }, Promise.resolve()).then(function() { return { ok: ok, failed: failed }; });
    });
  }

  window.Storage = {
    putMany: putMany,
    get: get,
    getAll: getAll,
    put: putPersisted,
    remove: remove,
    clear: clear,
    open: open,
    // Escape hatch nội bộ — CHỈ Core Sync dùng (ghi data nhận từ server / seed snapshot / quản lý
    // pending queue), không bao giờ đi qua put/remove public để tránh tự diff-enqueue lại chính
    // data vừa nhận từ mạng.
    __raw: { putLocal: putLocal, removeLocal: removeLocal, listStores: listStores, getAllLocal: function(name) { return readLocal(name, null); }, holdReads: holdReads }
  };
})();

// Core Sync — DO NOT EDIT. Đồng bộ realtime khi project có ngữ cảnh đồng bộ (window.__PILO_PROJECT__, xem context.js), im lặng hoàn toàn nếu không.
(function() {
  'use strict';
  // Ngữ cảnh project có thể đến SAU khi trang nạp (app vừa cài: project chưa có id/token lúc mở) — khi đó context.js báo 'pilo:project' và đồng bộ bắt đầu từ lúc đó.
  var proj = null;
  var started = false;
  function boot() {
    proj = window.__PILO_PROJECT__;
    if (started || !proj || proj.dataMode !== 'with_data') return;
    started = true;
    start();
  }

  function start() {

    var QUEUE_STORE = '__pilo_sync_queue__';
    var BASE_STORE = '__pilo_sync_base__';
    var ws = null;
    var connected = false;
    var reconnectTimer = null;
    var firstLoad = Promise.resolve();

    function connect() {
      reconnectTimer = null;
      var sock = new WebSocket(proj.socketUrl);
      ws = sock;
      // Mọi handler chỉ hành động khi `sock` vẫn là socket hiện hành: 1 kết nối hỏng bắn CẢ onerror LẪN
      // onclose, nếu mỗi lần đều hẹn connect() thì sau 2s có 2 socket cùng tồn tại, chung biến `connected`
      // — socket cũ nhận 'joined' đặt connected=true trong khi `ws` đã trỏ sang socket mới còn CONNECTING,
      // sendOp gửi nhầm → "InvalidStateError: Still in CONNECTING state".
      sock.onopen = function() {
        // token: chỉ có ở WebView native của chủ app (token riêng của room); người xem qua web dùng cookie phiên.
        if (ws === sock) sock.send(JSON.stringify({ type: 'join', roomId: proj.projectId, token: proj.token || undefined, guestKey: proj.gk || undefined }));
      };
      sock.onmessage = function(e) {
        if (ws === sock) handleMessage(JSON.parse(e.data));
      };
      function lost() {
        if (ws !== sock) return;
        connected = false;
        if (!reconnectTimer) reconnectTimer = setTimeout(connect, 2000);
      }
      sock.onclose = lost;
      sock.onerror = lost;
    }

    function handleMessage(msg) {
      if (msg.type === 'joined') {
        connected = true;
        // Quyền thật do server tính lúc join (có thể khác quyền ghi sẵn trong trang nếu chủ đã đổi sau khi trang được mở).
        proj.role = msg.role;
        var canWrite = msg.role === 'owner' || msg.role === 'editor' || msg.role === 'guest';
        // Máy mới (cài lại / đăng nhập lại): app đã đọc kho cục bộ TRỐNG lúc khởi động và giữ kết quả trong bộ nhớ, nên chỉ vẽ lại là không đủ — dữ liệu từ
        // server nằm trong kho nhưng app không đọc lại. Lần đồng bộ ĐẦU TIÊN của máy này với phòng có dữ liệu thì tải lại trang đúng một lần.
        // Chờ nạp dữ liệu lần đầu bằng HTTP (nếu đang chạy) rồi mới hỏi "có phải lần đồng bộ đầu": WebSocket có thể về trước HTTP, và khi đó đừng tải lại trang.
        firstLoad.then(firstSyncOnThisDevice).then(function(first) {
          var seeded = first && serverHasData(msg.data);
          return reconcile(msg.data, canWrite).then(flushQueue).then(function() {
            if (seeded && reloadAfterFirstSync()) return;
            refreshCurrentPage();
          });
        });
      } else if (msg.type === 'sync') {
        applyRemote(msg);
        refreshCurrentPage();
      } else if (msg.type === 'access_changed') {
        askRole(); // chủ vừa đổi quyền truy cập của app này — hỏi lại quyền của mình
      } else if (msg.type === 'role') {
        applyRole(msg.role);
      } else if (msg.type === 'ack') {
        ackOp(msg.key);
      } else if (msg.type === 'error') {
        // Server không nhận lần ghi này vì hết dung lượng / quá lớn: GIỮ op trong hàng đợi (gửi lại ở lần kết nối sau) và báo cho người dùng biết
        // là CHƯA được sao lưu — dữ liệu vẫn nằm trong máy. Lỗi vĩnh viễn (không có quyền, dữ liệu sai) thì có thử lại cũng không bao giờ được, bỏ op; lỗi tạm (chưa join...) thì giữ.
        if (msg.code === 'quota_exceeded' || msg.code === 'too_large') {
          if (window.__PiloNotice) window.__PiloNotice.warn(msg.code);
        } else if (msg.key && (msg.code === 'forbidden' || msg.code === 'invalid')) {
          Storage.__raw.removeLocal(QUEUE_STORE, msg.key);
        }
      }
    }

    // ---- Lần đồng bộ đầu tiên của máy này ----
    // Chưa có mốc nào (BASE_STORE trống) và chưa từng tải lại vì lý do này: máy này chưa bao giờ đối chiếu với phòng.
    var FIRST_KEY = 'pilo_first_sync:' + proj.projectId;
    function firstSyncOnThisDevice() {
      try { if (localStorage.getItem(FIRST_KEY)) return Promise.resolve(false); } catch (e) {}
      return Storage.__raw.getAllLocal(BASE_STORE).then(function(bases) { return !(bases && bases.length); }, function() { return false; });
    }
    function serverHasData(data) {
      data = data || {};
      return Object.keys(data).some(function(c) { return Object.keys(data[c] || {}).length > 0; });
    }
    // Trả true nếu đã tải lại (hoặc sắp tải lại). Người dùng đang gõ dở thì không giật trang: để vẽ lại như thường, cờ vẫn đặt để không lặp.
    function reloadAfterFirstSync() {
      try { localStorage.setItem(FIRST_KEY, String(Date.now())); } catch (e) {}
      var a = document.activeElement;
      var typing = a && (a.isContentEditable || /^(INPUT|TEXTAREA)$/.test(a.tagName));
      if (typing) return false;
      window.location.reload();
      return true;
    }

    function askRole() {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'whoami' }));
    }

    // Quyền đổi giữa chừng (chủ nâng/hạ/thu hồi): cập nhật ngay `proj.role` — Storage chặn ghi theo giá trị này — và báo cho người dùng.
    // Mất hẳn quyền (role null) coi như chỉ xem: server đã cho rời room nên không còn nhận dữ liệu mới.
    function applyRole(role) {
      var before = proj.role;
      var next = role || 'viewer';
      proj.role = next;
      if (next === before) return;
      var writer = function(r) { return r === 'owner' || r === 'editor' || r === 'guest'; };
      if (!role) { if (window.__PiloNotice) window.__PiloNotice.warn('access_removed'); }
      else if (writer(before) && !writer(next)) { if (window.__PiloNotice) window.__PiloNotice.warn('role_viewer'); }
      else if (!writer(before) && writer(next)) { if (window.__PiloNotice) window.__PiloNotice.warn('role_editor'); flushQueue(); }
    }
    // Dự phòng nếu lỡ tin "access_changed": hỏi lại định kỳ.
    setInterval(askRole, 30000);

    // window.refreshPage KHÔNG phải quy ước có sẵn ở mọi app — chỉ 1 vài app cũ (viết tay) tự định
    // nghĩa nó, pipeline LLM hiện tại KHÔNG sinh ra hàm này (xác nhận thật: main.js mọi skeleton chỉ
    // gọi Theme.init()+Router.navigate() lúc khởi tạo, không có window.refreshPage nào). Bug thật đã
    // gặp: data đến đúng qua WS, ghi đúng vào IndexedDB, nhưng KHÔNG ai trigger render lại — UI đứng
    // im tới khi user tự F5. Router.navigate(slot) không dùng lại được để force refresh (có guard
    // `if (current === slot) return`, tự không làm gì nếu gọi lại đúng slot đang mở) — nên tự dispatch
    // thẳng `nav:changed`, đúng event MỌI page đã lắng nghe sẵn (xem VARIANT_TASK_GEN_PROMPT's mẫu
    // bắt buộc). window.refreshPage vẫn được ưu tiên nếu app nào tự có (không phá app cũ).
    function refreshCurrentPage() {
      if (window.refreshPage) { window.refreshPage(); return; }
      if (!window.Router || !window.Router.getCurrent) return;
      var slot = window.Router.getCurrent();
      if (!slot) return;
      document.dispatchEvent(new CustomEvent('nav:changed', {
        detail: { from: null, to: slot, params: window.Router.getParams ? window.Router.getParams() : null },
      }));
    }


    // ---- Đối chiếu máy ↔ server (3 bên: máy, server, "mốc" = bản gần nhất cả hai cùng thấy) ----
    // Mốc của từng mục lưu ở BASE_STORE. Nhờ mốc mới phân biệt được "máy sửa" với "server sửa", và "máy tạo mới" với "máy khác đã xoá".
    var INTERNAL = '__pilo';
    var IGNORED = { updatedAt: 1, _v: 1, id: 1, key: 1 }; // field do server/SDK quản lý — không so sánh

    function idOf(item) {
      var id = item && (item.key !== undefined ? item.key : item.id);
      return id === undefined || id === null ? null : String(id);
    }
    function strip(item) {
      var out = {};
      Object.keys(item || {}).sort().forEach(function(k) { if (!IGNORED[k]) out[k] = item[k]; });
      return JSON.stringify(out);
    }
    function baseKey(collection, id) { return collection + '|' + id; }
    function setBase(collection, id, json) {
      return Storage.__raw.putLocal(BASE_STORE, { key: baseKey(collection, id), json: json });
    }
    function removeBase(collection, id) {
      return Storage.__raw.removeLocal(BASE_STORE, baseKey(collection, id));
    }
    // Các field máy đã đổi so với mốc (field bị xoá ở máy → null) — gửi riêng chúng để không đè field server đã đổi ở chỗ khác.
    function changedFields(baseJson, local) {
      var base = JSON.parse(baseJson);
      var patch = {};
      Object.keys(local).forEach(function(k) {
        if (!IGNORED[k] && JSON.stringify(local[k]) !== JSON.stringify(base[k])) patch[k] = local[k];
      });
      Object.keys(base).forEach(function(k) { if (!(k in local)) patch[k] = null; });
      return patch;
    }

    function reconcileItem(store, id, l, s, b, canWrite) {
      var ls = l ? strip(l) : null;
      var ss = s ? strip(s) : null;
      function takeServer() {
        return Storage.__raw.putLocal(store, s).then(function() { return setBase(store, id, ss); });
      }
      if (l && s) {
        if (ls === ss) return setBase(store, id, ss);
        // Máy chưa sửa gì so với mốc (hoặc chưa có mốc) → server mới hơn, lấy bản server. Người xem không có sửa đổi hợp lệ nào → luôn theo server.
        if (b === undefined || ls === b || !canWrite) return takeServer();
        // Máy đã sửa so với mốc → đẩy lại các field máy đã đổi (server đổi field khác thì được giữ nhờ merge nông).
        return persistOp({ collection: store, id: id, kind: 'patch', patch: changedFields(b, l), base: ls });
      }
      if (l && !s) {
        // Máy không sửa từ lần đồng bộ trước mà server không còn → đã bị xoá ở máy khác.
        if (b !== undefined && ls === b) {
          return Storage.__raw.removeLocal(store, l.key !== undefined ? l.key : id).then(function() { return removeBase(store, id); });
        }
        if (!canWrite) return Promise.resolve();
        // Mục mới tạo ở máy (trước khi bật đồng bộ, lúc offline, hoặc op từng bị từ chối) → đẩy lên.
        return persistOp({ collection: store, id: id, kind: 'patch', patch: l, base: ls });
      }
      // Chỉ có ở server. Nếu máy từng có (có mốc) và server chưa đổi → máy đã xoá, xoá cả trên server; ngược lại là mục mới từ máy khác.
      if (canWrite && b !== undefined && ss === b) {
        return persistOp({ collection: store, id: id, kind: 'delete' });
      }
      return takeServer();
    }

    function reconcile(serverData, canWrite) {
      serverData = serverData || {};
      return Promise.all([Storage.__raw.listStores(), Storage.getAll(BASE_STORE)]).then(function(r) {
        var stores = r[0].filter(function(n) { return n.indexOf(INTERNAL) !== 0; });
        Object.keys(serverData).forEach(function(c) { if (stores.indexOf(c) < 0) stores.push(c); });
        var bases = {};
        (r[1] || []).forEach(function(b) { bases[b.key] = b.json; });
        return stores.reduce(function(chain, store) {
          return chain.then(function() {
            return Storage.getAll(store).then(function(items) {
              var local = {};
              (items || []).forEach(function(it) { var id = idOf(it); if (id !== null) local[id] = it; });
              var server = serverData[store] || {};
              var ids = Object.keys(local).concat(Object.keys(server).filter(function(i) { return !(i in local); }));
              return Promise.all(ids.map(function(id) {
                return reconcileItem(store, id, local[id], server[id], bases[baseKey(store, id)], canWrite);
              }));
            });
          });
        }, Promise.resolve());
      });
    }

    function applyRemote(msg) {
      if (msg.op === 'delete') {
        return Storage.__raw.removeLocal(msg.collection, msg.id).then(function() { return removeBase(msg.collection, msg.id); });
      }
      return Storage.__raw.putLocal(msg.collection, msg.item).then(function() {
        var id = idOf(msg.item);
        return id === null ? null : setBase(msg.collection, id, strip(msg.item));
      });
    }

    // ---- Hàng đợi gửi lên server ----
    // Op nằm trong QUEUE_STORE cho tới khi server báo 'ack' — bị từ chối (hết dung lượng...) hoặc mất kết nối giữa chừng thì còn nguyên để gửi lại ở lần 'joined' kế tiếp.
    // `full` = toàn bộ mục sau khi sửa: dùng làm "mốc" khi server xác nhận.
    function enqueuePatch(collection, id, patch, full) {
      enqueue({ key: opKey(), collection: collection, id: id, kind: 'patch', patch: patch, base: strip(full || patch) });
    }
    function enqueueDelete(collection, id) {
      enqueue({ key: opKey(), collection: collection, id: id, kind: 'delete' });
    }
    function opKey() {
      return 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    }

    // Ghi vào queue TRƯỚC — nếu app bị kill giữa lúc này và lúc gửi thành công, lần mở lại vẫn còn op để gửi tiếp, không mất edit.
    function persistOp(op) {
      op.key = op.key || opKey();
      return Storage.__raw.putLocal(QUEUE_STORE, op);
    }
    function enqueue(op) {
      persistOp(op).then(function() {
        if (connected) sendOp(op);
        // offline: op nằm trong QUEUE_STORE tới khi 'joined' kế tiếp (reconnect) trigger flushQueue()
      });
    }

    function sendOp(op) {
      // Chưa mở (đang CONNECTING/đóng): bỏ qua, op vẫn nằm trong QUEUE_STORE và được flushQueue() gửi lại ở lần 'joined' kế tiếp.
      if (!ws || ws.readyState !== 1) return;
      ws.send(JSON.stringify(op.kind === 'delete'
        ? { type: 'delete', roomId: proj.projectId, collection: op.collection, id: String(op.id), key: op.key }
        : { type: 'patch', roomId: proj.projectId, collection: op.collection, id: String(op.id), patch: op.patch, key: op.key }));
    }

    // Server đã ghi xong op: ghi mốc rồi mới xoá op khỏi hàng đợi.
    function ackOp(key) {
      if (!key) return;
      Storage.get(QUEUE_STORE, key).then(function(op) {
        var done = !op ? Promise.resolve()
          : op.kind === 'delete' ? removeBase(op.collection, String(op.id))
          : setBase(op.collection, String(op.id), op.base);
        return done.then(function() { return Storage.__raw.removeLocal(QUEUE_STORE, key); });
      });
    }

    function flushQueue() {
      return Storage.getAll(QUEUE_STORE).then(function(ops) {
        (ops || []).forEach(sendOp);
      });
    }

    window.__PiloSync = { enqueuePatch: enqueuePatch, enqueueDelete: enqueueDelete };

    // ---- Nạp dữ liệu lần đầu bằng HTTP, trước khi app vẽ ----
    // Máy chưa từng đồng bộ project này (mở link của người khác, cài lại, đăng nhập máy mới): app đọc kho trống lúc nạp và vẽ như dự án mới (màn đầu tiên / onboarding),
    // rồi dữ liệu mới về qua WebSocket. Thay vào đó: hiện loading, lấy toàn bộ dữ liệu qua GET /shares/:id/data (HTTP, nén được), ghi vào kho, và giữ mọi lần đọc của
    // app (Storage cổng đọc) tới lúc xong — app vẽ đúng một lần với dữ liệu thật. Quá hạn / mất mạng / lỗi thì thả cổng và chạy như cũ (WebSocket đồng bộ sau).
    var FIRST_LOAD_TIMEOUT_MS = 8000;
    var LOADING_TEXT = { en: 'Loading data…', vi: 'Đang tải dữ liệu…' };
    var LOADING_SUB = { en: 'First open of an app that was just installed or shared with you', vi: 'Lần đầu mở app vừa cài hoặc vừa được chia sẻ với bạn' };

    function httpBase() {
      try {
        var u = new URL(proj.socketUrl);
        return (u.protocol === 'wss:' ? 'https:' : 'http:') + '//' + u.host;
      } catch (e) { return null; }
    }

    // Loading hiện sau 250 ms: lần mở đầu của app mới cài (project chủ vừa tạo) thường xong nhanh hơn, khỏi nháy.
    function showLoading() {
      var removeNow = null;
      var delay = setTimeout(function() { removeNow = buildLoading(); }, 250);
      return function() { clearTimeout(delay); if (removeNow) removeNow(); };
    }

    function buildLoading() {
      var lang = String(document.documentElement.lang || window.PILO_LANG || navigator.language || 'en').toLowerCase();
      var H = window.__PiloHostUi;
      if (H && H.ready()) {
        // Màn loading do host vẽ (native); gỡ khi trang dựng xong.
        H.post('loading', { show: true, bg: H.pageBg(), text: lang.indexOf('vi') === 0 ? LOADING_TEXT.vi : LOADING_TEXT.en, sub: lang.indexOf('vi') === 0 ? LOADING_SUB.vi : LOADING_SUB.en });
        return function() { H.post('loading', { show: false }); };
      }
      var style = document.createElement('style');
      style.textContent = '@keyframes pilo-spin{to{transform:rotate(360deg)}}';
      var el = document.createElement('div');
      el.setAttribute('data-pilo-loading', '');
      el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg,#fff);color:var(--muted,#6b7280);font:15px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      el.style.animation = 'pilo-fade-in 150ms linear both';
      el.innerHTML = '<div style="width:34px;height:34px;box-sizing:border-box;border-radius:50%;border:3px solid #2B5CFB;border-top-color:transparent;animation:pilo-spin .9s linear infinite"></div><div style="font:500 15px \'Instrument Sans\',system-ui,sans-serif"></div><div style="font:400 12.5px/1.4 \'Instrument Sans\',system-ui,sans-serif;max-width:240px;text-align:center;opacity:.8"></div>';
      el.children[1].textContent = lang.indexOf('vi') === 0 ? LOADING_TEXT.vi : LOADING_TEXT.en;
      el.children[2].textContent = lang.indexOf('vi') === 0 ? LOADING_SUB.vi : LOADING_SUB.en;
      var root = document.documentElement;
      root.appendChild(style);
      root.appendChild(el);
      return function() {
        el.style.animation = 'pilo-fade-out 150ms linear both';
        setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); if (style.parentNode) style.parentNode.removeChild(style); }, 160);
      };
    }

    // Chỉ để xem trước giao diện (so với canvas); trả về hàm gỡ màn loading.
    window.__PiloSyncPreview = { loading: buildLoading };

    // Ghi từng nhóm mục song song (mỗi mục kèm "mốc" của nó, y như lúc đối chiếu), để một app nhiều bản ghi không chờ từng cái một.
    function writeAllData(data) {
      var jobs = [];
      Object.keys(data || {}).forEach(function(c) {
        Object.keys(data[c] || {}).forEach(function(id) { jobs.push([c, id, data[c][id]]); });
      });
      var chain = Promise.resolve();
      for (var i = 0; i < jobs.length; i += 40) {
        (function(group) {
          chain = chain.then(function() {
            return Promise.all(group.map(function(j) {
              return Storage.__raw.putLocal(j[0], j[2]).then(function() { return setBase(j[0], j[1], strip(j[2])); });
            }));
          });
        })(jobs.slice(i, i + 40));
      }
      return chain;
    }

    function loadFromServer(base) {
      var hide = showLoading();
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = null;
      var url = base + '/shares/' + encodeURIComponent(proj.projectId) + '/data' + (proj.gk ? '?gk=' + encodeURIComponent(proj.gk) : '');
      var work = fetch(url, { headers: proj.token ? { 'Authorization': 'Bearer ' + proj.token } : {}, signal: ctrl ? ctrl.signal : undefined })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(body) {
          if (!body) return;
          return writeAllData(body.data).then(function() {
            try { localStorage.setItem(FIRST_KEY, String(Date.now())); } catch (e) {}
          });
        });
      var timeout = new Promise(function(resolve) { timer = setTimeout(function() { if (ctrl) ctrl.abort(); resolve(); }, FIRST_LOAD_TIMEOUT_MS); });
      return Promise.race([work, timeout]).catch(function() {}).then(function() { clearTimeout(timer); hide(); });
    }

    function slog(m) { try { if (localStorage.getItem('pilo_trace') === '1') console.log(m); } catch (e) {} }
    (function startFirstLoad() {
      var base = httpBase();
      if (!base || !proj.projectId || navigator.onLine === false) return;
      try { if (localStorage.getItem(FIRST_KEY)) return; } catch (e) {}
      slog('[SYNC] first load starting (reads held)');
      firstLoad = firstSyncOnThisDevice().then(function(first) { slog('[SYNC] firstSyncOnThisDevice=' + first); return first ? loadFromServer(base) : null; });
      firstLoad.then(function() { slog('[SYNC] first load finished'); }, function(e) { slog('[SYNC] first load FAILED ' + e); });
      Storage.__raw.holdReads(firstLoad);
    })();

    connect();
  }

  boot();
  document.addEventListener('pilo:project', boot);
})();

// Core Share — DO NOT EDIT. Tạo link "chỉ mở đúng 1 page" (host) + tự khoá cứng nếu đang là guest.
(function() {
  'use strict';
  var proj = window.__PILO_PROJECT__;

  function origin() {
    return proj && proj.socketUrl ? proj.socketUrl.replace(/^ws/, 'http').replace(/\/ws\/?$/, '') : null;
  }

  // Link dài (luôn dựng được ngay khi chủ app có khoá guest): /t/<projectId>/?gk=…&guestPage=…
  function longLink(page, params) {
    if (!proj || !proj.guestKey || !origin() || !proj.projectId) return null;
    var url = origin() + '/t/' + proj.projectId + '/?gk=' + encodeURIComponent(proj.guestKey) + '&guestPage=' + encodeURIComponent(page);
    if (params) url += '&guestParams=' + encodeURIComponent(JSON.stringify(params));
    return url;
  }

  // ---- Link ngắn /g/<mã> ----
  // createGuestLink PHẢI trả về chuỗi ngay (code do app sinh ra dùng nó đồng bộ), nên không thể chờ server cấp mã tại chỗ. Cách làm: SDK xin SẴN một ít mã chưa gắn từ server
  // (POST /g/allocate, xác thực bằng room token của chủ app); lúc cần thì lấy ngay 1 mã trong túi, trả link ngắn, rồi gắn (trang, tham số) vào mã đó ở nền
  // (POST /g/<mã>/bind) — xong trong khoảng một vòng mạng, trước khi người nhận kịp mở link. Hết mã hoặc chưa có mạng thì trả link dài (vẫn dùng được).
  var canShorten = !!(proj && proj.guestKey && proj.token && proj.projectId && origin());
  var STORE_KEY = canShorten ? 'pilo_guest_links:' + proj.projectId + ':' + proj.guestKey.slice(0, 8) : null; // đổi khoá guest → bộ nhớ link cũ tự bị bỏ
  var state = { bound: {}, pending: {} }; // bound: "trang|tham số" → mã; pending: mã → {page, params} chưa gắn xong
  var codes = [];
  var refilling = false;
  var retryTimer = null;

  try {
    var saved = STORE_KEY && JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.bound && saved.pending) state = saved;
  } catch (e) {}
  function save() {
    try { if (STORE_KEY) localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function post(path, body) {
    return fetch(origin() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + proj.token },
      body: JSON.stringify(body || {})
    }).then(function(r) {
      if (!r.ok) { var err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
      return r.json();
    });
  }

  function refill() {
    if (!canShorten || refilling) return;
    refilling = true;
    post('/g/allocate', { count: 8 }).then(function(d) {
      var taken = {};
      Object.keys(state.bound).forEach(function(k) { taken[state.bound[k]] = true; });
      codes = (d.codes || []).filter(function(c) { return !taken[c] && !state.pending[c]; });
    }).catch(function() {}).then(function() { refilling = false; });
  }

  var inflight = {}; // mã đang gắn dở — không gửi trùng
  function flushPending() {
    Object.keys(state.pending).forEach(function(code) {
      if (inflight[code]) return;
      inflight[code] = true;
      var p = state.pending[code];
      post('/g/' + code + '/bind', { page: p.page, params: p.params }).then(function() {
        delete inflight[code];
        delete state.pending[code];
        save();
      }).catch(function(e) {
        delete inflight[code];
        if (e && e.status === 404) { // mã không còn thuộc project / đã gắn giá trị khác: bỏ, lần sau xin mã mới
          delete state.pending[code];
          Object.keys(state.bound).forEach(function(k) { if (state.bound[k] === code) delete state.bound[k]; });
          save();
        } else if (!retryTimer) { // lỗi mạng: thử lại sau
          retryTimer = setTimeout(function() { retryTimer = null; flushPending(); }, 15000);
        }
      });
    });
  }

  if (canShorten) { refill(); flushPending(); }

  window.Share = {
    // Trả về string URL, hoặc null nếu chưa dựng được link (chủ app chưa có khoá guest — project chưa đồng bộ lên tài khoản lần nào, hoặc người gọi không phải chủ) —
    // code gọi PHẢI kiểm tra null (xem quy tắc ở system prompt). Có thể là link ngắn /g/<mã> (ưu tiên) hoặc link dài (dự phòng). Link guest độc lập với quyền share app.
    createGuestLink: function(page, params) {
      var long = longLink(page, params);
      if (!long) return null;
      if (!canShorten) return long;
      var key = page + '|' + JSON.stringify(params === undefined ? null : params);
      var code = state.bound[key];
      if (!code) {
        code = codes.shift();
        if (!code) { refill(); return long; }
        if (Object.keys(state.bound).length > 500) state.bound = {};
        state.bound[key] = code;
        state.pending[code] = { page: page, params: params === undefined ? null : params };
        save();
        flushPending();
        if (codes.length < 3) refill();
      }
      return origin() + '/g/' + code;
    },
    // Xem thử guest sẽ thấy gì — dùng cho nút "Xem trước" đi kèm "Sao chép liên kết". Điều hướng
    // THẲNG trong CHÍNH phiên/WebView đang chạy (Router.navigate) thay vì mở URL/trình duyệt nào
    // khác — không cần rời khỏi app, dễ xem/dễ chỉnh sửa lại ngay khi đang chat edit. [page]/[params]
    // PHẢI là ĐÚNG cặp vừa truyền cho Share.createGuestLink (không phải url nó trả về).
    previewGuestLink: function(page, params) {
      if (!page) return;
      Router.navigate(page, params || {});
    },
  };

  if (!proj || !proj.guestPage) return; // không phải phiên guest — im lặng hoàn toàn, không đổi gì

  var lockedSlot = proj.guestPage;
  var lockedParams = proj.guestParams ? JSON.parse(proj.guestParams) : undefined;
  var realNavigate = window.Router.navigate;

  function forceLock() {
    realNavigate(lockedSlot, lockedParams, { replace: true });
    document.body.classList.add('pilo-guest-locked');
  }

  // main.js's Router.navigate('home') (chạy SAU sdk.js) mới là lần nav:changed ĐẦU TIÊN thật sự —
  // ép chuyển hướng NGAY LÚC ĐÓ, sớm hơn sẽ bị chính main.js's navigate đè lại (xem Core Sync).
  document.addEventListener('nav:changed', function once() {
    document.removeEventListener('nav:changed', once);
    forceLock();
  });

  // Chặn TRIỆT ĐỂ mọi cách rời trang khoá — ghi đè thẳng object export, mọi page code gọi
  // Router.navigate/back/backOrHome (kể cả bottom-nav tự sinh) đều bị ép quay lại đúng trang này.
  window.Router.navigate = forceLock;
  window.Router.back = forceLock;
  window.Router.backOrHome = function() { forceLock(); return true; };
})();

// Core SysUI — DO NOT EDIT. Chuyển động và vài tiện ích dùng chung cho mọi thứ PiloOS vẽ chồng lên mini app (pill upload, sheet, hộp thoại, toast, chip nổi).
// Quy tắc: tools/app_kit/RULES.md mục 2b. Một đường cong ease-out, không nảy, chỉ transform/opacity, tắt chuyển động thì chỉ mờ → rõ.
// Dùng: đặt `data-pilo-overlay` lên lớp nền mờ, `data-pilo-sheet` (sheet đáy) hoặc `data-pilo-dialog` (hộp giữa màn hình) lên thẻ bên trong;
// đóng bằng __PiloUi.dismiss(el) để thẻ chạy animation ra rồi mới bị gỡ.
(function() {
  'use strict';
  var E = 'cubic-bezier(.2,.8,.2,1)';
  var HEAD = "'Bricolage Grotesque','Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var BODY = "'Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
  var CSS =
    "@font-face{font-family:'Bricolage Grotesque';src:url('/pilo-fonts/bricolage_grotesque.ttf');font-weight:200 800;font-display:swap}" +
    "@font-face{font-family:'Instrument Sans';src:url('/pilo-fonts/instrument_sans.ttf');font-weight:400 700;font-display:swap}" +
    '.pilo-ov,.pilo-tray-sheet{position:fixed;inset:0;z-index:2147482500;display:flex;align-items:flex-end;justify-content:center;background:rgba(21,23,28,.45);font-family:' + BODY + '}' +
    '.pilo-ov.pilo-mid{align-items:center;padding:24px;box-sizing:border-box;z-index:2147483000}' +
    '.pilo-card{box-sizing:border-box;width:100%;max-width:460px;padding:10px 20px calc(28px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:#FBFAF8;color:#15171C;box-shadow:0 -10px 30px rgba(21,23,28,.18)}' +
    '.pilo-mid>.pilo-card{max-width:360px;padding:26px 22px 20px;border-radius:28px;box-shadow:0 18px 50px rgba(21,23,28,.3)}' +
    '.pilo-grab{width:40px;height:4px;margin:0 auto 18px;border-radius:2px;background:#C9C5BC}' +
    '.pilo-hd{display:flex;align-items:center;gap:14px}.pilo-hd>div{min-width:0;flex:1}' +
    '.pilo-bdg{flex:none;display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:26px;background:#E9EEFF;color:#2B5CFB}' +
    '.pilo-bdg.warm{background:#FBF0DC;color:#9A4A06}.pilo-bdg.ok{background:#157A6A;color:#fff}.pilo-bdg.bad{background:#F8E3E0;color:#C2362B}.pilo-bdg.big{width:60px;height:60px;border-radius:30px}' +
    '.pilo-h{margin:0;font:700 22px/1.2 ' + HEAD + ';letter-spacing:-.01em}' +
    '.pilo-p{margin:12px 0 0;font:400 15px/1.5 ' + BODY + ';color:#5F636C}' +
    '.pilo-sub{margin-top:2px;font:400 14px ' + BODY + ';color:#5F636C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pilo-list{margin:14px 0 0;padding:0;list-style:none;border-top:1px solid #DDD9D1}' +
    '.pilo-file{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #DDD9D1}' +
    '.pilo-ft{flex:none;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}' +
    '.pilo-fm{min-width:0;flex:1}.pilo-fn{font:600 15px ' + BODY + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pilo-fs{font:400 13px ' + BODY + ';color:#5F636C}' +
    '.pilo-acts{margin-top:16px}' +
    '.pilo-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:52px;margin-top:0;border:0;border-radius:26px;font:600 16px ' + BODY + ';cursor:pointer;-webkit-tap-highlight-color:transparent;box-sizing:border-box}' +
    '.pilo-btn.pri{background:#2B5CFB;color:#fff}.pilo-btn.sec{margin-top:10px;background:transparent;color:#2B5CFB;border:1.5px solid #2B5CFB}' +
    '.pilo-btn.ghost{height:48px;margin-top:6px;background:transparent;color:#5F636C;font-size:15px}' +
    '.pilo-btn[hidden]{display:none}' +
    '@keyframes pilo-fade-in{from{opacity:0}to{opacity:1}}@keyframes pilo-fade-out{from{opacity:1}to{opacity:0}}' +
    '@keyframes pilo-sheet-in{from{transform:translateY(100%)}to{transform:none}}@keyframes pilo-sheet-out{from{transform:none}to{transform:translateY(100%)}}' +
    '@keyframes pilo-dlg-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes pilo-dlg-out{from{opacity:1;transform:none}to{opacity:0;transform:scale(.96)}}' +
    '@keyframes pilo-rise-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes pilo-rise-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(8px)}}' +
    '@keyframes pilo-pop-in{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}' +
    '@keyframes pilo-spin{to{transform:rotate(360deg)}}@keyframes pilo-blink{0%,100%{opacity:1}50%{opacity:.4}}@keyframes pilo-breathe{0%,100%{opacity:1}50%{opacity:.78}}' +
    '[data-pilo-overlay]{animation:pilo-fade-in 250ms ' + E + ' both}' +
    '[data-pilo-sheet]{animation:pilo-sheet-in 320ms ' + E + ' both}' +
    '[data-pilo-dialog]{animation:pilo-dlg-in 240ms ' + E + ' both}' +
    '[data-pilo-overlay].pilo-out{animation:pilo-fade-out 250ms ' + E + ' both;pointer-events:none}' +
    '.pilo-out>[data-pilo-sheet]{animation:pilo-sheet-out 240ms ' + E + ' both}' +
    '.pilo-out>[data-pilo-dialog]{animation:pilo-dlg-out 200ms ' + E + ' both}' +
    '[data-pilo-rise]{animation:pilo-rise-in 240ms ' + E + ' both}[data-pilo-rise].pilo-out{animation:pilo-rise-out 200ms ' + E + ' both;pointer-events:none}' +
    '[data-pilo-still]{animation:none!important}.pilo-press{transition:transform 120ms ' + E + '}.pilo-press:active{transform:scale(.97)}' +
    '@media (prefers-reduced-motion:reduce){' +
      '[data-pilo-overlay],[data-pilo-sheet],[data-pilo-dialog],[data-pilo-rise]{animation:pilo-fade-in 150ms linear both}' +
      '[data-pilo-overlay].pilo-out,.pilo-out>[data-pilo-sheet],.pilo-out>[data-pilo-dialog],[data-pilo-rise].pilo-out{animation:pilo-fade-out 150ms linear both}' +
      '.pilo-press{transition:none}.pilo-press:active{transform:none}}';

  function lang() {
    var l = String((document.documentElement && document.documentElement.lang) || window.PILO_LANG || (navigator && navigator.language) || 'en').toLowerCase();
    return l.indexOf('vi') === 0 ? 'vi' : 'en';
  }

  var TONE = { image: ['#FDE9DF', '#A63A0C'], video: ['#ECE6FD', '#5B3BC4'], audio: ['#FBEFD3', '#7F5412'], file: ['#E2ECFD', '#1D4FBF'] };
  function kindOf(nameOrExt) {
    var n = String(nameOrExt || '');
    if (/(^|\.)(jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(n)) return 'image';
    if (/(^|\.)(mp4|m4v|mov|webm|mkv|3gp)$/i.test(n)) return 'video';
    if (/(^|\.)(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(n)) return 'audio';
    return 'file';
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // Một dòng file: ô icon theo loại + tên + dòng phụ (+ phần bên phải tuỳ ý).
  function fileRow(kind, name, meta, right) {
    var t = TONE[kind] || TONE.file;
    return '<div class="pilo-file"><span class="pilo-ft" style="background:' + t[0] + ';color:' + t[1] + '">' + icon(kind === 'image' ? 'image' : kind, 20) + '</span><div class="pilo-fm"><div class="pilo-fn">' + esc(name) + '</div><div class="pilo-fs">' + esc(meta) + '</div></div>' + (right || '') + '</div>';
  }
  function badge(name, tone, big) { return '<span class="pilo-bdg ' + (tone || '') + (big ? ' big' : '') + '">' + icon(name, big ? 26 : 24, tone === 'ok' ? 2.6 : 1.9) + '</span>'; }

  function css() {
    if (typeof document === 'undefined' || !document.head || document.getElementById('pilo-sysui-style')) return;
    var st = document.createElement('style');
    st.id = 'pilo-sysui-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  // Chạy animation ra rồi gỡ phần tử. Gọi nhiều lần cho cùng một phần tử vẫn an toàn.
  function dismiss(el, done) {
    if (!el || el.__piloOut) { if (done && el && el.__piloOut) el.__piloOut.push(done); return; }
    el.__piloOut = done ? [done] : [];
    el.classList.add('pilo-out');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
      var cbs = el.__piloOut || [];
      el.__piloOut = null;
      cbs.forEach(function(f) { try { f(); } catch (e) {} });
    }, reduced() ? 150 : 250);
  }

  function size(bytes) {
    bytes = Number(bytes) || 0;
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  var ICONS = {
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01"/><path d="M3 3l18 18"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="M16 10l5-3v10l-5-3"/>',
    audio: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    up: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  function icon(name, px, sw) {
    return '<svg width="' + (px || 20) + '" height="' + (px || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  css();
  document.addEventListener('DOMContentLoaded', css);
  window.__PiloUi = { css: css, lang: lang, dismiss: dismiss, size: size, icon: icon, reduced: reduced, ease: E, esc: esc, kindOf: kindOf, fileRow: fileRow, badge: badge, tone: TONE, head: HEAD, body: BODY };
})();

// Core Theme — DO NOT EDIT. KHÔNG còn cơ chế bật/tắt light/dark lúc runtime (mỗi app giờ chỉ có
// đúng 1 bảng màu cố định do Planner LLM tự chọn — sáng HOẶC tối, xem PLAN_PROMPT's Theme section)
// — chỉ còn đúng 1 việc: báo màu --bg thật của app cho native host (MiniAppFullscreenActivity) để
// tint status bar Android thật khớp màu, không tạo đường viền lệch tông giữa status bar và app.
(function() {
  'use strict';

  function init() {
    var canvasColor = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    if (canvasColor) console.log('__PP_STATUSBAR__:' + canvasColor);
  }

  window.Theme = {
    init: init
  };
})();

// Core Thumbs — DO NOT EDIT. Thumbnails in lists, done by the SDK so no app has to: default pictures while a thumbnail loads / when it fails, and lazy loading.
//
// What an app does:   <img src="/media-thumbnail/?uri=…&size=240">    nothing else: a plain picture. The host makes it (Glide) and caches it.
//                     optional: data-alt="<url of the original>" (tried once when the thumbnail cannot be made), data-kind="image|video|audio|file"
// What the SDK does (the app writes none of the `data-pilo-*` attributes: they are the SDK's own bookkeeping):
//  - loading: every such <img> shows a soft square with the icon of its kind (picked from the file extension in the address) BEHIND the picture, by CSS alone: no request,
//             no change of `src`, the real picture simply covers it. (The <img> needs a size from the app's own CSS, like any picture.)
//  - error:   when the picture cannot be loaded: `data-alt` first, then a soft red square with a warning icon, once. The error picture is never remembered as the thumbnail.
//  - lazy:    in a virtual list (core/vlist.js) the SDK itself turns every thumbnail picture of a row into a lazy one before the row enters the page (defer()):
//             it is fetched only near the screen (the scroller it lives in decides), at most MAX at a time, the ones in view first, and a row that scrolls away
//             before its turn costs nothing (without this a fling would make the host decode every row that went by). A picture shown once is drawn again at once.
// Everything is plain DOM: it works the same on Android and on the web, and with a virtual list (rows created and destroyed all the time).
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.createElement || !document.addEventListener) return;

  var MAX = 3;                                    // thumbnails loading at the same time (the host makes at most 3 at once for the whole app)
  var VIDEO = ['mp4', 'mov', 'm4v', 'mkv', 'webm', '3gp', 'avi'];
  var AUDIO = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'];

  // ---- the default pictures: one icon per kind, drawn as inline SVG ----
  var ICONS = {
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.5-5.5 3.5 3.5 3-3 4 4.5"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
    audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>'
  };
  function svg(inner, stroke, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (extra || '') + inner + '</svg>';
  }
  function dataUri(markup) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup); }
  var LOADING_BG = '#E7ECE9', LOADING_ICON = '#8C9792', ERROR_BG = '#F5E6E3', ERROR_ICON = '#B4574E';
  // the error picture is a whole image (it replaces `src`): a square with the icon in the middle, drawn big in a 64-unit box
  var ERROR_SRC = dataUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="' + ERROR_BG + '"/><g transform="translate(21.5 21.5) scale(.8)" fill="none" stroke="' + ERROR_ICON + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + ICONS.alert + '</g></svg>');

  function kindOf(url, hint) {
    if (hint === 'image' || hint === 'video' || hint === 'audio' || hint === 'file') return hint;
    var m = /\.([a-z0-9]{2,5})(?:&|%26|$)/i.exec(String(url || '').replace(/^.*?[?&]uri=/, ''));
    var ext = m ? m[1].toLowerCase() : '';
    return VIDEO.indexOf(ext) >= 0 ? 'video' : AUDIO.indexOf(ext) >= 0 ? 'audio' : 'image';
  }

  // ---- loading: CSS only (attribute selectors on the extension), so it also covers pictures made later by innerHTML ----
  (function injectCss() {
    function rule(sel, kind) {
      return sel + '{background-image:url("' + dataUri(svg(ICONS[kind], LOADING_ICON)) + '")}';
    }
    var base = 'img[src*="/media-thumbnail/?"],img[data-pilo-thumb]';
    var css = base + '{background-color:' + LOADING_BG + ';background-repeat:no-repeat;background-position:center;background-size:34% auto}'
      + rule(base, 'image');
    [['video', VIDEO], ['audio', AUDIO]].forEach(function (g) {
      var sels = [];
      g[1].forEach(function (e) { sels.push('img[src*="/media-thumbnail/?"][src*=".' + e + '&"]', 'img[data-pilo-thumb*=".' + e + '&"]'); });
      css += rule(sels.join(','), g[0]);
    });
    ['image', 'video', 'audio', 'file'].forEach(function (k) { css += rule('img[data-kind="' + k + '"]', k); });
    var st = document.createElement('style');
    st.setAttribute('data-pilo-thumbs', '');
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  })();

  // ---- lazy loading ----
  var queue = [], inflight = 0, loaded = {}, observers = [], busy = [];   // loaded: thumbnail address -> the address that was drawn; busy: pictures loading now
  var scrollerOf = typeof WeakMap === 'function' ? new WeakMap() : null;

  function scrollerFor(el) {
    for (var p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      var cached = scrollerOf && scrollerOf.get(p);
      if (cached !== undefined) return cached;
      var oy = window.getComputedStyle ? window.getComputedStyle(p).overflowY : '';
      if (oy === 'auto' || oy === 'scroll') { if (scrollerOf) scrollerOf.set(p, p); return p; }
    }
    return null;
  }

  function observerFor(scroller) {
    for (var i = 0; i < observers.length; i++) if (observers[i].root === scroller) return observers[i].io;
    observers = observers.filter(function (o) {            // forget the observers of scrollers that left the page
      if (o.root && !o.root.isConnected) { o.io.disconnect(); return false; }
      return true;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        queue.push(e.target);
      });
      pump();
    }, { root: scroller, rootMargin: '200px' });
    observers.push({ root: scroller, io: io });
    return io;
  }

  // The next picture to load: of those still on the page, the first that is in view (a fling must not wait for pictures it already passed), else the first.
  function nextImg() {
    queue = queue.filter(function (i) { return i.isConnected; });
    if (!queue.length) return null;
    var h = window.innerHeight, at = 0;
    for (var k = 0; k < queue.length && k < 60; k++) {
      var r = queue[k].getBoundingClientRect();
      if (r.bottom > 0 && r.top < h) { at = k; break; }
    }
    return queue.splice(at, 1)[0];
  }

  // a picture whose row was taken away (virtual list) while it loaded may never say load or error: its place is given back here
  function reap() {
    busy = busy.filter(function (i) {
      if (i.isConnected) return true;
      finishQuiet(i);
      return false;
    });
  }
  function finishQuiet(img) {
    if (!img.hasAttribute('data-pilo-busy')) return;
    img.removeAttribute('data-pilo-busy');
    inflight = Math.max(0, inflight - 1);
  }

  function pump() {
    reap();
    while (inflight < MAX && queue.length) {
      var img = nextImg();
      if (!img) return;
      inflight++;
      img.setAttribute('data-pilo-busy', '');
      busy.push(img);
      img.src = img.getAttribute('data-pilo-thumb');
      (function (el) {
        setTimeout(function () { finish(el); }, 25000);                          // never let one picture that says nothing hold a place for ever
        setTimeout(function () { reap(); pump(); }, 2000);                         // and look again soon for rows that went away
      })(img);
    }
  }

  function finish(img) {
    if (!img.hasAttribute('data-pilo-busy')) return;
    finishQuiet(img);
    busy = busy.filter(function (i) { return i !== img; });
    pump();
  }

  function register(img) {
    if (img.__piloThumb) return;
    img.__piloThumb = true;
    var url = img.getAttribute('data-pilo-thumb');
    if (!url || img.getAttribute('src')) return;
    if (loaded[url]) { img.src = loaded[url]; return; }
    if (typeof IntersectionObserver !== 'function') { queue.push(img); pump(); return; }
    observerFor(scrollerFor(img)).observe(img);
  }

  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.tagName === 'IMG' && root.hasAttribute('data-pilo-thumb')) register(root);
    var found = root.querySelectorAll ? root.querySelectorAll('img[data-pilo-thumb]') : [];
    for (var i = 0; i < found.length; i++) register(found[i]);
  }

  if (typeof MutationObserver === 'function') {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) scan(added[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(document.documentElement); });
  else scan(document.documentElement);

  // a lazy picture arrived: remember it (never the error picture) and let the next one start
  document.addEventListener('load', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-pilo-busy')) return;
    var shown = img.currentSrc || img.src;
    if (shown && shown.indexOf('data:') !== 0) loaded[img.getAttribute('data-pilo-thumb')] = shown;
    finish(img);
  }, true);

  // ---- error: the original first (data-alt, once), then the default error picture (once) ----
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG') return;
    // this picture's own turn is over, whatever follows (the preview kept on the server and its retries, the original, the error picture) must not hold a place
    // in the queue: a few broken files would otherwise block every picture behind them
    if (img.hasAttribute('data-pilo-busy')) finish(img);
    var src = img.getAttribute('src') || '';
    if (src.indexOf('data:') === 0) return;
    if (!img.hasAttribute('data-pilo-thumb') && !img.hasAttribute('data-pilo-alt') && src.indexOf('/media-thumbnail/') < 0) return;   // only the pictures this module is about (one that moved on to its data-alt original still is)
    if (img.hasAttribute('data-pilo-err')) return;
    // files.js is already handling this one (the preview kept on the server, "not on this device yet"): its steps come first
    if (img.hasAttribute('data-pilo-thumb-fallback') || img.hasAttribute('data-pilo-fallback') || img.hasAttribute('data-pilo-probe') || img.hasAttribute('data-pilo-pending')) return;
    var alt = img.getAttribute('data-alt');
    if (alt && !img.hasAttribute('data-pilo-alt')) {
      img.setAttribute('data-pilo-alt', '');
      img.src = alt;
      return;
    }
    img.setAttribute('data-pilo-err', '');
    img.src = ERROR_SRC;
    finish(img);
  }, true);

  // Markup in, markup out: every <img> that shows a thumbnail gets its `src` renamed to the SDK's lazy attribute, so the browser does not start fetching it
  // when the row is created (the virtual list calls this for each row it draws).
  function defer(html) {
    if (typeof html !== 'string' || html.indexOf('/media-thumbnail/') < 0) return html;
    return html.replace(/<img\b[^>]*>/gi, function (tag) {
      if (tag.indexOf('/media-thumbnail/') < 0 || /\sdata-pilo-thumb=/.test(tag)) return tag;
      return tag.replace(/(\s)src=(["'])([^"']*\/media-thumbnail\/[^"']*)\2/i, '$1data-pilo-thumb=$2$3$2');
    });
  }

  window.PiloThumbs = { kindOf: kindOf, errorSrc: ERROR_SRC, max: MAX, defer: defer };
})();

// Core Upload UI — DO NOT EDIT. Pill "Đang upload 1/10" ở giữa đáy màn hình + bottom sheet liệt kê từng file (xem tools/app_kit/RULES.md mục 2b).
// files.js báo trạng thái từng file qua window.__PiloUpload: queue → start → update → finish | wait | fail | drop. Không có API cho mini app.
(function() {
  'use strict';
  var STR = {
    en: { up: 'Uploading {k}/{n}', done: 'Uploaded {k}/{n}', wait: 'Waiting · {m} left', sent: '{s} sent', total: 'Total {p}%', waiting: 'Waiting', ok: 'Done', failed: 'Could not upload', keep: 'Uploads keep going if you close this.', close: 'Close' },
    vi: { up: 'Đang upload {k}/{n}', done: 'Đã upload {k}/{n}', wait: 'Đang chờ mạng · còn {m}', sent: 'Đã gửi {s}', total: 'Tổng {p}%', waiting: 'Đang chờ', ok: 'Xong', failed: 'Không upload được', keep: 'Đóng cửa sổ này, việc upload vẫn chạy tiếp.', close: 'Đóng' }
  };
  var HOLD_MS = 2000;
  var files = {};      // fid -> { fid, name, size, sent, state: 'wait' | 'up' | 'done' | 'fail' }
  var order = [];
  var pill = null, sheet = null, holdTimer = null, shownState = '';

  function ui() { return window.__PiloUi; }
  function t(key, vars) {
    var s = (STR[ui().lang()] || STR.en)[key] || '';
    Object.keys(vars || {}).forEach(function(k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  var CSS =
    '.pilo-upill{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:var(--pilo-pill-bottom,calc(92px + env(safe-area-inset-bottom,0px)));z-index:2147482000;height:40px;min-width:196px;padding:0 12px 0 14px;border:0;border-radius:20px;background:#15171C;color:#fff;display:flex;align-items:center;gap:10px;font:600 14px \'Instrument Sans\',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 8px 22px rgba(21,23,28,.3);cursor:pointer;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:background 400ms cubic-bezier(.2,.8,.2,1)}' +
    '.pilo-upill>*{flex:none}.pilo-upill .pu-lbl{flex:1;white-space:nowrap;text-align:left}.pilo-upill .pu-chev{opacity:.7;display:flex}' +
    '.pilo-upill.is-wait{background:#3A2A12;animation:pilo-breathe 2.4s ease-in-out infinite}' +
    '.pilo-upill .pu-sp{width:16px;height:16px;border-radius:8px;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;box-sizing:border-box;animation:pilo-spin .9s linear infinite}' +
    '.pilo-upill .pu-ok{width:18px;height:18px;border-radius:9px;background:#2FA37F;display:flex;align-items:center;justify-content:center;animation:pilo-pop-in 200ms cubic-bezier(.2,.8,.2,1) both}' +
    '.pilo-upill .pu-wf{color:#F5B942;display:flex;animation:pilo-blink 1.6s ease-in-out infinite}' +
    '.pilo-upill .pu-bar{position:absolute;left:16px;right:16px;bottom:0;height:3px;border-radius:2px;background:rgba(255,255,255,.22);overflow:hidden}' +
    '.pilo-upill .pu-bar i{display:block;height:100%;width:100%;border-radius:2px;background:#7C9BFF;transform-origin:left;transform:scaleX(0);transition:transform 200ms linear}' +
    '.pilo-upill.is-ok .pu-bar,.pilo-upill.is-wait .pu-bar{opacity:0}' +
    '.pu-swap{animation:pilo-fade-in 150ms linear both}' +
    '.pilo-ul{position:fixed;inset:0;z-index:2147482500;display:flex;align-items:flex-end;justify-content:center;background:rgba(21,23,28,.45);font-family:\'Instrument Sans\',system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.pilo-ul-card{box-sizing:border-box;width:100%;max-width:460px;padding:10px 20px calc(24px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:#FBFAF8;color:#15171C;box-shadow:0 -10px 30px rgba(21,23,28,.18)}' +
    '.pilo-ul-grab{width:40px;height:4px;border-radius:2px;background:#C9C5BC;margin:0 auto 18px}' +
    '.pilo-ul-head{display:flex;align-items:center;gap:10px}.pilo-ul-head>div{flex:1;min-width:0}' +
    '.pilo-ul-title{font:700 22px/1.2 \'Bricolage Grotesque\',\'Instrument Sans\',system-ui,sans-serif;letter-spacing:-.01em}.pilo-ul-sub{margin-top:2px;font-size:13px;color:#5F636C;font-variant-numeric:tabular-nums}' +
    '.pilo-ul-x{flex:none;width:44px;height:44px;margin-right:-10px;border:0;background:transparent;color:#5F636C;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
    '.pilo-ul-total,.pilo-ul-bar{height:8px;border-radius:4px;background:#E6E2DA;overflow:hidden}.pilo-ul-total{margin-top:14px}' +
    '.pilo-ul-total i,.pilo-ul-bar i{display:block;height:100%;width:100%;border-radius:4px;background:#2B5CFB;transform-origin:left;transform:scaleX(0);transition:transform 200ms linear}' +
    '.pilo-ul-list{margin-top:6px;max-height:48vh;overflow-y:auto}' +
    '.pilo-ul-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #DDD9D1;animation:pilo-rise-in 240ms cubic-bezier(.2,.8,.2,1) both}' +
    '.pilo-ul-ic{flex:none;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}' +
    '.pilo-ul-mid{min-width:0;flex:1}.pilo-ul-name{font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.pilo-ul-meta{font-size:12.5px;color:#5F636C;min-height:16px}.pilo-ul-bar{margin-top:6px}' +
    '.pilo-ul-st{flex:none;min-width:48px;text-align:right;font-size:13px;font-weight:600;color:#2B5CFB;font-variant-numeric:tabular-nums}' +
    '.pilo-ul-row.is-wait .pilo-ul-st{color:#5F636C;font-weight:500}.pilo-ul-row.is-done .pilo-ul-st{color:#157A6A;display:flex;align-items:center;justify-content:flex-end;gap:6px;animation:pilo-fade-in 150ms linear both}.pilo-ul-row.is-fail .pilo-ul-st{color:#C2362B}' +
    '.pilo-ul-row.is-wait .pilo-ul-bar,.pilo-ul-row.is-done .pilo-ul-bar,.pilo-ul-row.is-fail .pilo-ul-bar{display:none}' +
    '.pilo-ul-foot{margin-top:10px;font-size:12.5px;line-height:1.4;color:#5F636C;text-align:center}';

  var TONE = { image: ['#FDE9DF', '#A63A0C'], video: ['#ECE6FD', '#5B3BC4'], audio: ['#FBEFD3', '#7F5412'], file: ['#E2ECFD', '#1D4FBF'] };
  function kindOf(name) {
    var n = String(name || '');
    if (/\.(jpe?g|png|gif|webp|bmp|avif|heic)$/i.test(n)) return 'image';
    if (/\.(mp4|m4v|mov|webm|mkv|3gp)$/i.test(n)) return 'video';
    if (/\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(n)) return 'audio';
    return 'file';
  }

  function css() {
    ui().css();
    if (document.getElementById('pilo-upload-style')) return;
    var st = document.createElement('style');
    st.id = 'pilo-upload-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---- số liệu ----
  function stats() {
    var n = order.length, done = 0, fail = 0, up = 0, wait = 0, retry = 0, sent = 0, frac = 0;
    order.forEach(function(id) {
      var f = files[id];
      if (f.state === 'done') { done++; frac += 1; sent += f.size || 0; }
      else if (f.state === 'fail') { fail++; frac += 1; }
      else if (f.state === 'up') { up++; frac += f.size ? Math.min(1, f.sent / f.size) : 0; sent += f.sent || 0; }
      else { wait++; if (f.retry) retry++; }
    });
    return { n: n, done: done, fail: fail, up: up, wait: wait, retry: retry, sent: sent, frac: n ? frac / n : 0, k: Math.min(n, done + fail + 1) };
  }
  // up: có file đang gửi (hoặc mới xếp hàng); wait: chỉ còn file phải thử lại hoặc máy mất mạng; ok: xong hết.
  function mode(s) {
    if (s.up) return 'up';
    if (!s.wait) return 'ok';
    return s.retry || navigator.onLine === false ? 'wait' : 'up';
  }

  function swap(node, text) {
    if (node.textContent === text) return;
    node.textContent = text;
    node.classList.remove('pu-swap');
    void node.offsetWidth;
    node.classList.add('pu-swap');
  }

  // ---- pill ----
  function ensurePill() {
    if (pill || !document.body) return pill;
    css();
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'pilo-upill pilo-press';
    pill.setAttribute('data-pilo-rise', '');
    pill.innerHTML = '<span class="pu-lead"></span><span class="pu-lbl"></span><span class="pu-chev">' + ui().icon('chev', 16, 2.2) + '</span><span class="pu-bar"><i></i></span>';
    pill.addEventListener('click', openSheet);
    document.body.appendChild(pill);
    shownState = '';
    return pill;
  }

  function renderPill() {
    var s = stats();
    if (!s.n) { removePill(); return; }
    if (!ensurePill()) return;
    var m = mode(s);
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (pill.classList.contains('pilo-out')) { pill.classList.remove('pilo-out'); pill.__piloOut = null; }
    var label = m === 'ok' ? t('done', { k: s.done, n: s.n }) : m === 'wait' ? t('wait', { m: s.wait }) : t('up', { k: s.k, n: s.n });
    swap(pill.querySelector('.pu-lbl'), label);
    pill.setAttribute('aria-label', label);
    if (shownState !== m) {
      shownState = m;
      pill.classList.toggle('is-up', m === 'up');
      pill.classList.toggle('is-ok', m === 'ok');
      pill.classList.toggle('is-wait', m === 'wait');
      pill.querySelector('.pu-lead').outerHTML = m === 'ok' ? '<span class="pu-lead pu-ok">' + ui().icon('check', 12, 3) + '</span>'
        : m === 'wait' ? '<span class="pu-lead pu-wf">' + ui().icon('wifi', 18) + '</span>' : '<span class="pu-lead pu-sp"></span>';
    }
    pill.querySelector('.pu-bar i').style.transform = 'scaleX(' + s.frac.toFixed(3) + ')';
    if (m === 'ok') holdTimer = setTimeout(finishSession, HOLD_MS);
  }

  function removePill() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (pill) { ui().dismiss(pill); pill = null; shownState = ''; }
  }

  function finishSession() {
    holdTimer = null;
    if (pill) { ui().dismiss(pill); pill = null; shownState = ''; }
    if (!sheet) { files = {}; order = []; }
  }

  // ---- sheet danh sách ----
  function rowHtml(f, i) {
    var kind = kindOf(f.name), tone = TONE[kind];
    return '<div class="pilo-ul-row" data-fid="' + f.fid + '" style="animation-delay:' + (i < 5 ? i * 30 : 0) + 'ms"><span class="pilo-ul-ic" style="background:' + tone[0] + ';color:' + tone[1] + '">' + ui().icon(kind, 20) + '</span>' +
      '<div class="pilo-ul-mid"><div class="pilo-ul-name"></div><div class="pilo-ul-meta"></div><div class="pilo-ul-bar"><i></i></div></div><span class="pilo-ul-st"></span></div>';
  }

  function fillRow(row, f) {
    row.className = 'pilo-ul-row is-' + f.state;
    row.querySelector('.pilo-ul-name').textContent = f.name;
    var meta = f.state === 'fail' ? t('failed') : (f.state === 'up' ? '' : (f.size ? ui().size(f.size) : ''));
    swap(row.querySelector('.pilo-ul-meta'), meta);
    var pct = f.size ? Math.min(100, Math.round(f.sent * 100 / f.size)) : 0;
    var st = row.querySelector('.pilo-ul-st');
    if (f.state === 'done') { if (!st.querySelector('svg')) st.innerHTML = ui().icon('check', 16, 2.4) + '<span>' + t('ok') + '</span>'; }
    else swap(st, f.state === 'up' ? pct + '%' : f.state === 'fail' ? '' : t('waiting'));
    row.querySelector('.pilo-ul-bar i').style.transform = 'scaleX(' + (f.state === 'up' && f.size ? (f.sent / f.size).toFixed(3) : 0) + ')';
  }

  function openSheet() {
    if (sheet || !document.body) return;
    css();
    var el = document.createElement('div');
    el.className = 'pilo-ul';
    el.setAttribute('data-pilo-overlay', '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="pilo-ul-card" data-pilo-sheet><div class="pilo-ul-grab"></div><div class="pilo-ul-head"><div><div class="pilo-ul-title"></div><div class="pilo-ul-sub"></div></div>' +
      '<button type="button" class="pilo-ul-x pilo-press" aria-label="' + t('close') + '">' + ui().icon('x', 22) + '</button></div>' +
      '<div class="pilo-ul-total"><i></i></div><div class="pilo-ul-list"></div><div class="pilo-ul-foot">' + t('keep') + '</div></div>';
    var list = el.querySelector('.pilo-ul-list');
    order.forEach(function(id, i) { list.insertAdjacentHTML('beforeend', rowHtml(files[id], i)); });
    el.addEventListener('click', function(ev) { if (ev.target === el || ev.target.closest('.pilo-ul-x')) closeSheet(); });
    document.body.appendChild(el);
    sheet = el;
    renderSheet();
  }

  function closeSheet() {
    if (!sheet) return;
    var el = sheet;
    sheet = null;
    ui().dismiss(el, function() {
      var s = stats();
      if (!pill && !(s.up || s.wait)) { files = {}; order = []; }
    });
  }

  function renderSheet() {
    if (!sheet) return;
    var s = stats();
    var list = sheet.querySelector('.pilo-ul-list');
    order.forEach(function(id) {
      var row = list.querySelector('[data-fid="' + id + '"]');
      if (!row) { list.insertAdjacentHTML('beforeend', rowHtml(files[id], 5)); row = list.lastChild; }
      fillRow(row, files[id]);
    });
    var title = s.up || s.wait ? t('up', { k: s.k, n: s.n }) : t('done', { k: s.done, n: s.n });
    swap(sheet.querySelector('.pilo-ul-title'), title);
    swap(sheet.querySelector('.pilo-ul-sub'), t('total', { p: Math.round(s.frac * 100) }));
    sheet.querySelector('.pilo-ul-total i').style.transform = 'scaleX(' + s.frac.toFixed(3) + ')';
  }

  // ---- giao diện native của host (host_ui.js): SDK chỉ gửi ảnh chụp trạng thái, host vẽ pill + sheet ----
  function hostMode() { var H = window.__PiloHostUi; return !!(H && H.ready()); }
  var sendTimer = null, lastSend = 0, hostHold = null, hostDrawn = false;
  function snapshot() {
    var st = stats();
    return {
      n: st.n, done: st.done, fail: st.fail, up: st.up, wait: st.wait, retry: st.retry, frac: st.frac, k: st.k, mode: st.n ? mode(st) : 'none',
      files: order.slice(0, 100).map(function(id) { var f = files[id]; return { fid: f.fid, name: f.name, size: f.size, sent: f.sent, state: f.state }; })
    };
  }
  function sendSnapshot(force) {
    var now = Date.now();
    if (!force && now - lastSend < 120) {
      if (!sendTimer) sendTimer = setTimeout(function() { sendTimer = null; sendSnapshot(true); }, 120 - (now - lastSend));
      return;
    }
    lastSend = now;
    var snap = snapshot();
    window.__PiloHostUi.post('upload', { snapshot: snap }).then(function(ok) {
      if (ok) return;
      renderPill(); renderSheet(); // host cũ không hỗ trợ: quay lại DOM
    });
    hostDrawn = !!snap.n;
    if (hostHold) { clearTimeout(hostHold); hostHold = null; }
    if (snap.mode === 'ok') hostHold = setTimeout(function() { hostHold = null; files = {}; order = []; window.__PiloHostUi.post('upload', { snapshot: { n: 0 } }); hostDrawn = false; }, HOLD_MS);
  }

  function render() {
    if (hostMode()) {
      if (pill) { removePill(); }
      if (sheet) { var el = sheet; sheet = null; ui().dismiss(el); }
      sendSnapshot(order.length === 0 || !hostDrawn);
      return;
    }
    renderPill(); renderSheet();
  }

  // ---- API cho files.js ----
  function get(fid, name) {
    if (!files[fid]) { files[fid] = { fid: fid, name: name || fid, size: 0, sent: 0, state: 'wait', retry: false }; order.push(fid); }
    else if (name) files[fid].name = name;
    return files[fid];
  }
  function guard(fn) { return function() { try { if (typeof document !== 'undefined' && document.body && window.__PiloUi) fn.apply(null, arguments); } catch (e) { if (window.console) console.warn('[PiloUpload]', e && e.message); } }; }

  window.__PiloUpload = {
    queue: guard(function(fid, name) { var f = get(fid, name); if (f.state === 'done' || f.state === 'fail') { f.state = 'wait'; f.sent = 0; } f.retry = false; render(); }),
    start: guard(function(fid, total, name) { var f = get(fid, name); f.state = 'up'; f.retry = false; f.size = total || f.size; f.sent = 0; render(); }),
    update: guard(function(fid, sent, total) { var f = files[fid]; if (!f) return; f.state = 'up'; f.sent = sent; if (total) f.size = total; render(); }),
    finish: guard(function(fid, ok) { var f = files[fid]; if (!f) return; if (ok) { f.state = 'done'; f.sent = f.size; } else { f.state = 'wait'; f.retry = true; f.sent = 0; } render(); }),
    wait: guard(function(fid) { var f = files[fid]; if (!f) return; if (f.state !== 'done') { f.state = 'wait'; f.retry = true; f.sent = 0; } render(); }),
    fail: guard(function(fid) { var f = files[fid]; if (!f) return; f.state = 'fail'; render(); }),
    drop: guard(function(fid) { if (!files[fid]) return; delete files[fid]; order = order.filter(function(x) { return x !== fid; }); render(); }),
    snapshot: function() { return { files: order.map(function(id) { return files[id]; }), stats: stats() }; }
  };

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', function() { if (order.length) guard(render)(); });
    window.addEventListener('offline', function() { if (order.length) guard(render)(); });
  }
})();

// Core Native View — DO NOT EDIT. Tự mount / cập nhật / gỡ Pilo Native View theo SỰ HIỆN DIỆN của marker `<div data-pilo-view="camera">`
// trong trang đang mở (xem DESIGN_NATIVE_VIEW_TARGETVIEW.md). LLM không gọi hàm nào — chỉ khai marker rỗng đúng chỗ muốn hiện.
//
// Ràng buộc đã verify trên thiết bị (mục 2 design doc): WebView KHÔNG tôn trọng việc đổi độ trong suốt của 1 phần tử ĐÃ vẽ bằng JS. Chỉ có 2
// thao tác DOM đáng tin: tạo phần tử MỚI (nền có ngay lúc tạo) và `.remove()` phần tử đang có. File này chỉ dùng đúng 2 thao tác đó
// (thay marker bằng bản trong suốt, gỡ `.pilo-canvas`, tạo lại `.pilo-canvas`) — không bao giờ sửa CSS của phần tử đã render.
//
// Mô hình: `reconcile()` so sánh "marker đang hiệu lực" (marker đầu tiên trong trang Router đang mở) với view đang mount:
//   chưa mount          -> mount (không có giới hạn thời gian chờ: marker xuất hiện lúc nào cũng được)
//   cùng marker         -> không làm gì (chỉ dọn `.pilo-canvas` mới xuất hiện)
//   marker khác, CÙNG trang, cùng loại -> trang vừa dựng lại HTML: chuyển theo dõi sang marker mới, KHÔNG gỡ view (tài liệu đã tải còn nguyên)
//   marker khác trang / khác loại      -> gỡ rồi mount lại
//   không còn marker    -> gỡ view và tạo lại `.pilo-canvas` cho trang
// Chạy sau mỗi `nav:changed` và mỗi thay đổi cây DOM (gộp bằng microtask) — nên nav:changed bắn lại cho cùng trang (Core Sync) là no-op.
(function() {
  'use strict';

  var current = null;      // { marker, type, page, slot, status: 'mounting' | 'mounted' }
  var dirty = false;       // có thay đổi DOM trong lúc view.mount còn chờ -> reconcile lại ngay khi xong
  var scheduled = false;
  var failedMarker = null; // marker đã mount lỗi: không thử lại cho tới khi marker bị thay hoặc có nav:changed mới
  var cachedColor = {};    // slot -> màu `.pilo-canvas` đọc được lần cuối (canvas bị gỡ vĩnh viễn sau lần mount đầu)
  var domObserver = null;
  var resizeObserver = null;
  var trackTicking = false;
  var lastRect = '';

  // JS không cần biết view nào nằm trên hay dưới WebView: runtime tự quy ước theo loại (xem PiloViewController). Mỗi dialog/sheet HTML cứ gọi
  // PiloView.suspend()/resume() -> view.setVisible; runtime chỉ thật sự ẩn view nằm TRÊN WebView (pdf), view nằm dưới (video, camera) thì bỏ qua.
  // Trang có view dưới WebView cần nền trong suốt: html/body/.page không có background đặc, nền trang để ở `.pilo-canvas` (SDK tự gỡ khi mount).
  var suspendCount = 0;

  function applySuspend() {
    if (!current || current.status !== 'mounted') return;
    NativeTools.call('view.setVisible', { visible: suspendCount === 0 }).catch(function() {});
  }

  window.PiloView = {
    suspend: function() { suspendCount++; if (suspendCount === 1) applySuspend(); },
    resume: function() { if (suspendCount > 0) suspendCount--; if (suspendCount === 0) applySuspend(); }
  };

  function currentPage() {
    var slot = window.Router && Router.getCurrent ? Router.getCurrent() : null;
    var page = slot ? document.querySelector('[data-page="' + slot + '"]') : null;
    return page ? { slot: slot, page: page } : null;
  }

  function desiredMarker() {
    var cur = currentPage();
    if (!cur) return null;
    var marker = cur.page.querySelector('[data-pilo-view]');
    return marker ? { marker: marker, slot: cur.slot, page: cur.page } : null;
  }

  // Màu nền cho View native phía sau (nativeCanvasBg): `.pilo-canvas` đang có -> cache -> biến `--bg` của theme -> trắng.
  function readColor(page, slot) {
    var canvas = page.querySelector('.pilo-canvas');
    if (canvas) { cachedColor[slot] = getComputedStyle(canvas).backgroundColor; return cachedColor[slot]; }
    if (cachedColor[slot]) return cachedColor[slot];
    var probe = document.createElement('div');
    probe.style.background = 'var(--bg, #FFFFFF)';
    document.body.appendChild(probe);
    var color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    cachedColor[slot] = color || 'rgb(255, 255, 255)';
    return cachedColor[slot];
  }

  // Gỡ MỌI `.pilo-canvas` trong trang đang hiển thị view native (kể cả cái lồng trong wrapper hay mới xuất hiện sau khi trang dựng lại):
  // 1 canvas đục còn sót sẽ che mất view native mà không báo lỗi gì.
  function removeCanvases(page) {
    var canvases = page.querySelectorAll('.pilo-canvas');
    for (var i = 0; i < canvases.length; i++) canvases[i].remove();
  }

  // Trang không còn view native -> trả lại nền cho trang bằng 1 `.pilo-canvas` MỚI TẠO (tạo mới là thao tác an toàn).
  function restoreCanvas(page, slot) {
    if (!page || page.querySelector('.pilo-canvas') || !cachedColor[slot]) return;
    var canvas = document.createElement('div');
    canvas.className = 'pilo-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:-1;background:' + cachedColor[slot] + ';';
    page.insertBefore(canvas, page.firstChild);
  }

  // LLM đôi khi đặt `background` lên CHÍNH marker -> thay bằng phần tử MỚI (giữ class/style, ép nền trong suốt ngay lúc tạo). Đánh dấu
  // `data-pilo-bound` để không thay lại ở các lần reconcile sau.
  function bind(marker) {
    if (marker.getAttribute('data-pilo-bound')) return marker;
    var fresh = document.createElement('div');
    fresh.setAttribute('data-pilo-view', marker.getAttribute('data-pilo-view'));
    fresh.setAttribute('data-pilo-bound', '1');
    fresh.className = marker.className;
    fresh.style.cssText = marker.style.cssText;
    fresh.style.background = 'transparent';
    fresh.style.backgroundColor = 'transparent';
    fresh.style.backgroundImage = 'none';
    marker.replaceWith(fresh);
    return fresh;
  }

  function rectOf(marker) {
    var r = marker.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function sendUpdate() {
    if (!current || current.status !== 'mounted') return;
    var r = rectOf(current.marker);
    var key = r.left + ',' + r.top + ',' + r.width + ',' + r.height;
    if (key === lastRect) return;
    lastRect = key;
    NativeTools.call('view.update', r);
  }

  function onScrollOrResize() {
    if (trackTicking) return;
    trackTicking = true;
    requestAnimationFrame(function() { trackTicking = false; sendUpdate(); });
  }

  // Chỉ theo dõi cuộn CẢ TRANG (window) — chưa verify marker nằm trong 1 container cuộn RIÊNG (overflow:auto lồng bên trong).
  // Vị trí marker còn đổi mà KHÔNG có scroll/resize: trang đang chạy animation vào (transform) lúc mount nên rect đo được là rect giữa chừng.
  // Nên sau khi mount (và mỗi khi 1 animation/transition kết thúc) đo lại; sendUpdate bỏ qua khi rect không đổi.
  var SETTLE_MS = 1000;
  var settleTimer = null;

  function settle(marker) {
    var end = Date.now() + SETTLE_MS;
    clearTimeout(settleTimer);
    (function step() {
      if (!current || current.marker !== marker) return;
      sendUpdate();
      if (Date.now() < end) settleTimer = setTimeout(step, 50);
    })();
  }

  function onMotionEnd() { if (current && current.status === 'mounted') settle(current.marker); }

  function startTracking(marker) {
    stopTracking();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('animationend', onMotionEnd, true);
    document.addEventListener('transitionend', onMotionEnd, true);
    resizeObserver = new ResizeObserver(onScrollOrResize);
    resizeObserver.observe(marker);
    settle(marker);
  }

  function stopTracking() {
    clearTimeout(settleTimer);
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
    document.removeEventListener('animationend', onMotionEnd, true);
    document.removeEventListener('transitionend', onMotionEnd, true);
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
  }

  function mount(want) {
    var color = readColor(want.page, want.slot);
    var marker = bind(want.marker);
    var type = marker.getAttribute('data-pilo-view');
    var r = rectOf(marker);
    var mine = { marker: marker, type: type, page: want.page, slot: want.slot, status: 'mounting' };
    current = mine;
    lastRect = r.left + ',' + r.top + ',' + r.width + ',' + r.height;
    NativeTools.call('view.mount', {
      type: type, color: color, left: r.left, top: r.top, width: r.width, height: r.height
    }).then(function() {
      if (current !== mine) return;
      mine.status = 'mounted';
      removeCanvases(mine.page);
      startTracking(mine.marker);
      if (suspendCount > 0) applySuspend();
      if (dirty) { dirty = false; schedule(); }
    }).catch(function(err) {
      console.error('[view] mount failed', err);
      if (current === mine) { current = null; failedMarker = marker; }
    });
  }

  function unmount() {
    var gone = current;
    stopTracking();
    current = null;
    lastRect = '';
    NativeTools.call('view.unmount', {});
    if (gone) restoreCanvas(gone.page, gone.slot);
  }

  // Trang vừa dựng lại HTML (marker mới, cùng trang, cùng loại): giữ nguyên view native, chỉ đổi phần tử được theo dõi.
  function rebind(want) {
    var marker = bind(want.marker);
    current.marker = marker;
    removeCanvases(current.page);
    startTracking(marker);
    lastRect = '';
    sendUpdate();
  }

  function reconcile() {
    if (current && current.status === 'mounting') { dirty = true; return; }
    var want = desiredMarker();
    if (!current) {
      if (want && want.marker !== failedMarker) mount(want);
      return;
    }
    if (!want) { unmount(); return; }
    var type = want.marker.getAttribute('data-pilo-view');
    if (want.marker === current.marker) { removeCanvases(current.page); return; }
    if (want.page === current.page && type === current.type) { rebind(want); return; }
    unmount();
    mount(want);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(function() { scheduled = false; reconcile(); });
  }

  // Marker xuất hiện/biến mất/bị thay ở BẤT KỲ lúc nào (kể cả sau 1 `await` hay 1 thao tác của người dùng) đều được theo kịp.
  domObserver = new MutationObserver(schedule);
  domObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });

  // Đọc màu `.pilo-canvas` NGAY khi trang đích hiện ra (trước khi script trang dựng lại HTML và có thể xoá nó cùng lúc tạo marker).
  document.addEventListener('nav:changed', function(e) {
    var slot = e.detail.to;
    var page = document.querySelector('[data-page="' + slot + '"]');
    var canvas = page ? page.querySelector('.pilo-canvas') : null;
    if (canvas) cachedColor[slot] = getComputedStyle(canvas).backgroundColor;
    failedMarker = null;
    schedule();
  });
})();

// Core VList — DO NOT EDIT. A virtual list in the spirit of Android's RecyclerView. The scroller holds ONE tall host (its height is the sum of every row), and only the rows near the viewport exist
// as DOM nodes; rows that scroll away go back to a small pool and are reused. A thousand files and ten thousand files cost the same: about 30 rows alive.
//
//   var list = VList.mount(scroller, host, adapter);
//   adapter = {
//     count():      number of rows (a row is one line: a header, a file row, or one line of a grid with several tiles)
//     height(i):    height in px of row i (fixed per type, so the scrollbar and the positions are known without drawing anything)
//     html(i):      the markup that fills row i (the "bind")
//     cls(i):       optional extra class for the row (its type)
//     onBind(el,i): optional, after a row got its markup (thumbnails start loading here)
//   }
//   list.relayout()  heights changed (the width changed): measure again, redraw the rows in view
//   list.refresh()   data of the visible rows changed: bind them again
//   list.update()    scroll position changed from outside (e.g. restored): draw what is in view now
//   list.destroy()
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.createElement) return;
  var POOL_MAX = 24;

  // The module brings its own CSS (so it can move to the SDK as it is): the host is one tall box, rows are positioned inside it.
  function css() {
    if (document.querySelector('style[data-vlist]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-vlist', '');
    st.textContent = '.vl{position:relative;flex:none}.vrow{position:absolute;left:0;right:0;box-sizing:border-box}'
      + '.vrow.hd{display:flex;align-items:flex-end;padding-bottom:6px}.vrow.li>.row{height:100%;min-height:0;border-bottom:1px solid var(--line)}';
    document.head.appendChild(st);
  }

  function mount(scroller, host, ad) {
    css();
    var offs = [], total = 0, live = {}, pool = [], raf = 0, dead = false, ro = null;

    function measure() {
      var n = ad.count(), y = 0;
      offs.length = 0;
      for (var i = 0; i < n; i++) { offs.push(y); y += ad.height(i); }
      total = y;
      host.style.height = total + 'px';
    }

    // the last row that starts at or above y
    function find(y) {
      var lo = 0, hi = offs.length - 1;
      if (hi < 0) return -1;
      while (lo < hi) {
        var mid = (lo + hi + 1) >> 1;
        if (offs[mid] <= y) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    function hostTop() { return host.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop; }

    function release(i) {
      var el = live[i];
      if (!el) return;
      delete live[i];
      if (el.parentNode === host) host.removeChild(el);
      el.innerHTML = '';
      if (pool.length < POOL_MAX) pool.push(el);
    }

    function bind(i) {
      var el = pool.pop() || document.createElement('div');
      el.className = 'vrow' + (ad.cls ? ' ' + ad.cls(i) : '');
      el.style.top = offs[i] + 'px';
      el.style.height = ad.height(i) + 'px';
      // thumbnails in a row load lazily, whatever the app wrote (core/thumbs.js)
      var html = ad.html(i);
      el.innerHTML = window.PiloThumbs && window.PiloThumbs.defer ? window.PiloThumbs.defer(html) : html;
      host.appendChild(el);
      live[i] = el;
      if (ad.onBind) ad.onBind(el, i);
    }

    function update() {
      raf = 0;
      if (dead || !offs.length) return;
      var vh = scroller.clientHeight || window.innerHeight, pad = Math.max(vh * 0.75, 320);
      var y = scroller.scrollTop - hostTop();
      var a = Math.max(0, find(y - pad)), b = Math.min(offs.length - 1, find(y + vh + pad));
      Object.keys(live).forEach(function (k) { if (+k < a || +k > b) release(+k); });
      for (var i = a; i <= b; i++) if (!live[i]) bind(i);
    }

    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    scroller.addEventListener('scroll', onScroll, { passive: true });

    var lastW = scroller.clientWidth;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        if (dead) return;
        var w = scroller.clientWidth;
        if (w !== lastW) { lastW = w; api.relayout(); } else onScroll();   // width changed (turned phone, page shown for the first time) = heights change; height only = draw more rows
      });
      ro.observe(scroller);
    }

    var api = {
      relayout: function () {
        Object.keys(live).forEach(function (k) { release(+k); });
        measure();
        update();
      },
      refresh: function () {
        Object.keys(live).forEach(function (k) { release(+k); });
        update();
      },
      update: update,
      destroy: function () {
        dead = true;
        scroller.removeEventListener('scroll', onScroll);
        if (ro) ro.disconnect();
        if (raf) cancelAnimationFrame(raf);
        live = {}; pool = [];
      },
      // how many rows exist right now (for tests / measuring)
      alive: function () { return Object.keys(live).length; }
    };

    measure();
    update();
    return api;
  }

  window.VList = { mount: mount };
})();

// SDK Modal — Bootstrap modal wrapper.
(function() {
  'use strict';

  function hookNativeView(el, showEvent, hiddenEvent) {
    if (!el || el.__piloViewHook) return;
    el.__piloViewHook = true;
    el.addEventListener(showEvent, function() { if (window.PiloView) window.PiloView.suspend(); });
    el.addEventListener(hiddenEvent, function() { if (window.PiloView) window.PiloView.resume(); });
  }
  window.showModal = function(title, bodyHTML) {
    var t = document.getElementById('modalTitle');
    var b = document.getElementById('modalBody');
    if (t) t.textContent = title || '';
    if (b) b.innerHTML = bodyHTML || '';
    hookNativeView(document.getElementById('modalOverlay'), 'show.bs.modal', 'hidden.bs.modal');
    new bootstrap.Modal(document.getElementById('modalOverlay')).show();
  };
  window.hideModal = function() {
    var el = document.getElementById('modalOverlay');
    if (!el) return;
    var m = bootstrap.Modal.getInstance(el);
    if (m) m.hide();
  };
})();
// Bottom Navigation component — pure mechanics only (click → Router.navigate, active-state
// toggle on nav:changed). Icon/label markup is authored entirely by the Planner/page-gen LLM
// directly into index.html (see PLAN_PROMPT's TAB: format) — this file does NOT own icon
// choice, color, or style, so it never needs updating when a new app picks a different icon.
(function() {
  'use strict';

  var nav = document.getElementById('bottomNav');
  if (!nav) return;

  var items = nav.querySelectorAll('.nav-item');

  function setActive(page) {
    items.forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-nav') === page);
    });
  }

  items.forEach(function(item) {
    item.addEventListener('click', function() {
      var page = this.getAttribute('data-nav');
      if (!page) return;
      Router.navigate(page, undefined, { replace: true });
    });
  });

  document.addEventListener('nav:changed', function(e) {
    setActive(e.detail.to);
  });

  setActive(Router.getCurrent() || '');
})();

// SDK Bottom Sheet — Bootstrap offcanvas wrapper.
// showSheet(bodyHTML, title?) — without a title the sheet header shows only the close button (top right corner);
// put your own heading inside bodyHTML, or pass a title to show it in the header.
(function() {
  'use strict';

  function hookNativeView(el, showEvent, hiddenEvent) {
    if (!el || el.__piloViewHook) return;
    el.__piloViewHook = true;
    el.addEventListener(showEvent, function() { if (window.PiloView) window.PiloView.suspend(); });
    el.addEventListener(hiddenEvent, function() { if (window.PiloView) window.PiloView.resume(); });
  }
  window.showSheet = function(bodyHTML, title) {
    var el = document.getElementById('bottomSheet');
    var b = document.getElementById('sheetBody');
    if (b) b.innerHTML = bodyHTML || '';
    if (el) {
      var t = el.querySelector('.offcanvas-title');
      var header = el.querySelector('.offcanvas-header');
      if (t) t.textContent = title || '';
      if (header) header.classList.toggle('has-title', !!title);
    }
    hookNativeView(el, 'show.bs.offcanvas', 'hidden.bs.offcanvas');
    new bootstrap.Offcanvas(document.getElementById('bottomSheet')).show();
  };
  window.hideSheet = function() {
    var el = document.getElementById('bottomSheet');
    if (!el) return;
    var s = bootstrap.Offcanvas.getInstance(el);
    if (s) s.hide();
  };
})();

// SDK Toast — Bootstrap toast wrapper.
(function() {
  'use strict';
  window.showToast = function(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    var body = el.querySelector('.toast-body');
    if (body) body.textContent = msg;
    bootstrap.Toast.getOrCreateInstance(el).show();
  };
})();
