function goSelect() {
  state.finished = false;
  if (state.pendingFrames) {
    var m = state.pendingFrames;
    state.pendingFrames = null;
    applyFramesMsg(m);
  } else {
    renderList();
  }
  show('screenSelect');
}

function resetRun() {
  state.running = false;
  state.finished = false;
  state.expected = 0;
  state.got = 0;
  state.files = [];
  state.fails = [];
  state.pendingFrames = null;
  var widget = $('exportWidget');
  if (widget) widget.className = 'export-widget';
  var pt = $('progressTitle');
  if (pt) {
    pt.textContent = 'Exporting…';
    pt.classList.remove('is-done');
  }
  var docFmt = $('exportDocFormat');
  if (docFmt) docFmt.textContent = state.format;
  var ring = $('widgetRing');
  if (ring) ring.style.strokeDashoffset = '339.3px';
  var bar = $('barFill');
  if (bar) bar.style.width = '0';
  $('statusLine').textContent = 'Preparing export…';
  $('failBox').hidden = true;
  $('failList').innerHTML = '';
  var b2 = $('btnBack2'); if (b2) b2.disabled = false;
  var bm = $('btnMore'); if (bm) bm.disabled = false;
}

function wire() {
  $('selNone').onclick = function () {
    state.checked = {};
    state.order = [];
    revokeThumbUrls();
    renderList();
    send({ type: 'clear' });
  };
  $('btnContinue').onclick = function () {
    renderSettings();
    show('screenSettings');
  };
  var nb = $('btnNavBack');
  if (nb) nb.onclick = goSelect;
  var b2 = $('btnBack2');
  if (b2) b2.onclick = goSelect;
  var bm = $('btnMore');
  if (bm) bm.onclick = goSelect;
  $('btnExport').onclick = startExport;

  var fb = document.querySelectorAll('#fmtSeg button');
  for (var i = 0; i < fb.length; i++) {
    (function (b) {
      b.onclick = function () {
        state.format = b.getAttribute('data-fmt');
        renderSettings();
      };
    })(fb[i]);
  }

  var sb = document.querySelectorAll('#scaleRow button');
  for (var j = 0; j < sb.length; j++) {
    (function (b) {
      b.onclick = function () {
        var sc = b.getAttribute('data-scale');
        state.scale = (sc === 'none') ? 'none' : parseFloat(sc);
        renderSettings();
      };
    })(sb[j]);
  }

  var pr = document.querySelectorAll('input[name="pdfmode"]');
  for (var k = 0; k < pr.length; k++) {
    pr[k].onchange = function () {
      var c = document.querySelector('input[name="pdfmode"]:checked');
      state.pdf = c ? c.value : 'single';
      renderSettings();
    };
  }

  var hr = document.querySelectorAll('input[name="htmlmode"]');
  for (var m = 0; m < hr.length; m++) {
    hr[m].onchange = function () {
      var c = document.querySelector('input[name="htmlmode"]:checked');
      state.html = c ? c.value : 'single';
      renderSettings();
    };
  }
}

function applyTheme() {
  var root = document.documentElement;
  if (document.body.classList.contains('figma-dark')) root.classList.add('figma-dark');
  if (document.body.classList.contains('figma-light')) root.classList.add('figma-light');
  if (!root.classList.contains('figma-dark') && !root.classList.contains('figma-light')) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('figma-dark');
      }
    } catch (e) {}
  }
}

window.addEventListener('message', function (e) {
  var m = e.data && e.data.pluginMessage;
  if (!m) return;
  if (m.type === 'frames') onFrames(m);
  else if (m.type === 'thumbnail') onThumbnail(m);
  else if (m.type === 'file') onFile(m);
  else if (m.type === 'error') onErr(m);
  else if (m.type === 'done') onDone();
});

applyTheme();
wire();
renderList();
show('screenSelect');

if (!inFigma) {
  applyFramesMsg({ selectedFrames: DEMO.slice(), selected: ['d1', 'd2'], skipped: 0 });
} else {
  send({ type: 'ready' });
  // Resilient handshake: retry ready ping until frames arrive or max 5 attempts
  var pings = 0;
  var readyTimer = setInterval(function () {
    pings++;
    if (state.frames.length > 0 || pings >= 5) {
      clearInterval(readyTimer);
      return;
    }
    send({ type: 'ready' });
  }, 100);
}
