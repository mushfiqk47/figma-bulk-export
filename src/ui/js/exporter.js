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
  if (typeof pendingThumbIds !== 'undefined') {
    delete pendingThumbIds[msg.id];
  }
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
    var row = document.getElementById('row-' + msg.id);
    if (row && typeof thumbObserver !== 'undefined' && thumbObserver) {
      thumbObserver.unobserve(row);
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

  if (state.format === 'PDF' && state.pdf === 'single') {
    initPipelinedPdf();
  } else if (!(state.format === 'HTML' && state.html === 'single') && selCount() > 1) {
    initPipelinedZip();
  }

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
    if (state.format === 'HTML') {
      var mockHtmlData = {
        title: f ? f.name : 'Landing hero',
        bodyHtml: '<main class="hero-page">\n'
          + '  <header class="navbar">\n'
          + '    <div class="brand-group">\n'
          + '      <svg class="icon-logo" width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="28" rx="6" fill="#2563eb"/><path d="M8 14L12 18L20 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>\n'
          + '      <span class="brand-name">Velto</span>\n'
          + '    </div>\n'
          + '    <nav class="nav-links">\n'
          + '      <span class="nav-item">Features</span>\n'
          + '      <span class="nav-item">Pricing</span>\n'
          + '      <span class="nav-item">Docs</span>\n'
          + '    </nav>\n'
          + '  </header>\n'
          + '  <section class="hero-content">\n'
          + '    <h1 class="hero-title">' + (f ? f.name : 'Landing hero') + '</h1>\n'
          + '    <p class="hero-desc">Clean semantic HTML5 structure with real CSS flexbox layouts and zero SVG clutter.</p>\n'
          + '    <div class="cta-row">\n'
          + '      <button class="btn-primary">Get Started Free</button>\n'
          + '      <button class="btn-secondary">View Documentation</button>\n'
          + '    </div>\n'
          + '  </section>\n'
          + '</main>',
        cssRules: '.hero-page {\n  width: 100%;\n  max-width: 1200px;\n  margin-inline: auto;\n  padding: 40px 24px;\n  display: flex;\n  flex-direction: column;\n  gap: 48px;\n  min-height: 100vh;\n}\n\n'
          + '.navbar {\n  display: flex;\n  flex-direction: row;\n  justify-content: space-between;\n  align-items: center;\n  width: 100%;\n}\n\n'
          + '.brand-group {\n  display: flex;\n  flex-direction: row;\n  align-items: center;\n  gap: 10px;\n}\n\n'
          + '.icon-logo {\n  width: 28px;\n  height: 28px;\n  display: inline-block;\n}\n\n'
          + '.brand-name {\n  font-size: 20px;\n  font-weight: 700;\n  color: #111827;\n}\n\n'
          + '.nav-links {\n  display: flex;\n  flex-direction: row;\n  gap: 24px;\n}\n\n'
          + '.nav-item {\n  font-size: 15px;\n  color: #4b5563;\n  cursor: pointer;\n}\n\n'
          + '.hero-content {\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;\n  gap: 20px;\n  max-width: 680px;\n}\n\n'
          + '.hero-title {\n  font-size: 44px;\n  font-weight: 800;\n  line-height: 1.15;\n  letter-spacing: -0.02em;\n  margin: 0;\n  color: #111827;\n}\n\n'
          + '.hero-desc {\n  font-size: 18px;\n  line-height: 1.55;\n  margin: 0;\n  color: #4b5563;\n}\n\n'
          + '.cta-row {\n  display: flex;\n  flex-direction: row;\n  gap: 12px;\n  margin-top: 8px;\n}\n\n'
          + '.btn-primary {\n  padding: 12px 24px;\n  background-color: #2563eb;\n  color: #ffffff;\n  border-radius: 8px;\n  font-size: 15px;\n  font-weight: 600;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}\n\n'
          + '.btn-secondary {\n  padding: 12px 24px;\n  background-color: #f3f4f6;\n  color: #1f2937;\n  border-radius: 8px;\n  font-size: 15px;\n  font-weight: 600;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n}',
        assets: [
          {
            path: 'assets/icon-logo-1.svg',
            name: 'icon-logo',
            isSvg: true,
            bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#2563eb"/><path d="M8 14L12 18L20 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
            svgText: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#2563eb"/><path d="M8 14L12 18L20 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          }
        ]
      };
      onFile({
        id: id,
        name: f ? f.name : 'Frame',
        bytes: new Uint8Array(0),
        index: i,
        total: state.order.length,
        isRealHtml: true,
        htmlData: mockHtmlData
      });
    } else if (state.format === 'SVG') {
      var svgMock = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f5f5f5"/><text x="200" y="150" font-family="sans-serif" font-size="20" fill="#333" text-anchor="middle" dominant-baseline="middle">' + (f ? f.name : 'Frame') + '</text></svg>';
      bytes = new TextEncoder().encode(svgMock);
      onFile({ id: id, name: f ? f.name : 'Frame', bytes: bytes, index: i, total: state.order.length });
    } else {
      bytes = new TextEncoder().encode(label);
      onFile({ id: id, name: f ? f.name : 'Frame', bytes: bytes, index: i, total: state.order.length });
    }
    i++;
    setTimeout(next, 350);
  }
  next();
}

function onFile(msg) {
  var raw = msg.bytes;
  var u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw || []);
  var fileItem = {
    id: msg.id,
    name: msg.name || 'Untitled',
    bytes: u8,
    isRealHtml: !!msg.isRealHtml,
    htmlData: msg.htmlData || null
  };
  state.files.push(fileItem);
  state.got++;

  if (state.format === 'PDF' && state.pdf === 'single') {
    onPdfFileArrived(fileItem);
  } else if (typeof activeZip !== 'undefined' && activeZip) {
    addFileToPipelinedZip(fileItem);
  }

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
