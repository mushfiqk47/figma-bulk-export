function updateProgress(fraction) {
  var pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  var bar = $('barFill');
  if (bar) bar.style.width = pct + '%';
  var ring = $('widgetRing');
  if (ring) {
    var circ = 339.3;
    ring.style.strokeDashoffset = (circ * (1 - (pct / 100))) + 'px';
  }
}

function setStatus() {
  var pt = $('progressTitle');
  var sl = $('statusLine');
  if (state.got >= state.expected) {
    if (pt) pt.textContent = 'Packaging…';
    if (sl) sl.textContent = 'Preparing download…';
  } else {
    if (pt) pt.textContent = 'Exporting…';
    if (sl) sl.textContent = 'Frame ' + Math.min(state.got + 1, state.expected) + ' of ' + state.expected;
  }
}

function applyFramesMsg(msg) {
  var list = Array.isArray(msg.selectedFrames) ? msg.selectedFrames : [];
  state.frames = list;
  if (typeof msg.skipped === 'number') state.skipped = msg.skipped;
  else state.skipped = 0;

  var keepChecked = {};
  var keepOrder = [];
  var inSel = {};
  list.forEach(function (f) {
    inSel[f.id] = true;
  });
  state.order.forEach(function (id) {
    if (inSel[id] && state.checked[id]) {
      keepChecked[id] = true;
      keepOrder.push(id);
    }
  });
  list.forEach(function (f) {
    if (!keepChecked[f.id]) {
      keepChecked[f.id] = true;
      keepOrder.push(f.id);
    }
  });
  state.checked = keepChecked;
  state.order = keepOrder;

  // Prune thumbnails of unselected/removed frames to free memory
  for (var thId in state.thumbs) {
    if (!inSel[thId] && state.thumbs[thId]) {
      try {
        URL.revokeObjectURL(state.thumbs[thId]);
      } catch (e) {}
      delete state.thumbs[thId];
    }
  }

  renderList();
  if (!$('screenSettings').hidden) {
    renderSettings();
  }
  requestThumbnails();
}

function onThumbnail(msg) {
  if (!msg || !msg.id || !msg.bytes) return;
  try {
    var blob = new Blob([msg.bytes], { type: 'image/png' });
    var url = URL.createObjectURL(blob);
    state.thumbs[msg.id] = url;
    var el = document.getElementById('th-' + msg.id);
    if (el) {
      el.innerHTML = '';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      el.appendChild(img);
    }
  } catch (e) {}
}

function onFrames(msg) {
  if (state.running || state.finished) {
    state.pendingFrames = msg;
    return;
  }
  applyFramesMsg(msg);
}

function startExport() {
  if (selCount() === 0 || state.running) return;
  resetRun();
  var widget = $('exportWidget');
  if (widget) widget.className = 'export-widget is-exporting';
  var docFmt = $('exportDocFormat');
  if (docFmt) docFmt.textContent = state.format;
  show('screenProgress');
  state.running = true;
  state.expected = selCount();
  state.plan = {};
  planFiles().forEach(function (p) {
    state.plan[p.id] = p.file;
  });
  setStatus();
  updateProgress(0);
  var b2 = $('btnBack2'); if (b2) b2.disabled = true;
  var bm = $('btnMore'); if (bm) bm.disabled = true;
  send({
    type: 'export',
    ids: state.order.slice(),
    format: state.format,
    scale: effScale(),
    pdf: state.pdf,
    html: state.html
  });
  if (!inFigma) {
    simulate();
  }
}

function simulate() {
  var i = 0;
  function next() {
    if (i >= state.order.length) {
      onDone();
      return;
    }
    var id = state.order[i];
    var f = null;
    for (var k = 0; k < state.frames.length; k++) {
      if (state.frames[k].id === id) {
        f = state.frames[k];
        break;
      }
    }
    var label = (f ? f.name : 'Frame') + ' demo bytes';
    var bytes;
    if (state.format === 'HTML' || state.format === 'SVG') {
      var svgMock = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f5f5f5"/><text x="200" y="150" font-family="sans-serif" font-size="20" fill="#333" text-anchor="middle" dominant-baseline="middle">' + (f ? f.name : 'Frame') + '</text></svg>';
      bytes = new TextEncoder().encode(svgMock);
    } else {
      bytes = new TextEncoder().encode(label);
    }
    onFile({ id: id, name: f ? f.name : 'Frame', bytes: bytes, index: i, total: state.order.length });
    i++;
    setTimeout(next, 350);
  }
  next();
}

function onFile(msg) {
  var raw = msg.bytes;
  var u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw || []);
  state.files.push({ id: msg.id, name: msg.name || 'Untitled', bytes: u8 });
  state.got++;
  updateProgress(state.got / Math.max(1, state.expected));
  var badge = document.getElementById('st-' + msg.id);
  if (badge) {
    badge.textContent = 'Done';
    badge.parentElement.classList.add('done');
  }
  setStatus();
}

function onErr(msg) {
  state.fails.push({ id: msg.id, message: msg.message || 'Export failed.' });
  state.got++;
  updateProgress(state.got / Math.max(1, state.expected));
  setStatus();
}
