figma.showUI(__html__, { width: 420, height: 440, themeColors: true });

var EXPORTABLE = { FRAME: true, COMPONENT: true, COMPONENT_SET: true };

function canvasSelection() {
  try { return figma.currentPage.selection || []; } catch (e) { return []; }
}

function selectedDetails() {
  var out = [];
  var sel = canvasSelection();
  for (var i = 0; i < sel.length; i++) {
    var n = sel[i];
    if (n && EXPORTABLE[n.type]) {
      var w = 0, h = 0;
      try { w = Math.round(n.width || 0); h = Math.round(n.height || 0); } catch (e) {}
      var pg = '';
      try { pg = figma.currentPage.name; } catch (e) {}
      var nm = 'Untitled';
      try { nm = String(n.name || 'Untitled'); } catch (e) {}
      out.push({ id: n.id, name: nm, width: w, height: h, page: pg });
    }
  }
  return out;
}

function postFrames() {
  var details = selectedDetails();
  var total = 0;
  try { total = canvasSelection().length; } catch (e) {}
  figma.ui.postMessage({
    type: 'frames',
    selected: details.map(function (d) { return d.id; }),
    selectedFrames: details,
    skipped: Math.max(0, total - details.length)
  });
}

figma.on('selectionchange', function () { postFrames(); });
figma.on('currentpagechange', function () { postFrames(); });

// dynamic-page disallows documentchange without loadAllPagesAsync.
// selectionchange and currentpagechange handle active canvas state.

function buildSettings(format, scale) {
  var s = Number(scale) || 1;
  if (format === 'PNG') {
    return { format: 'PNG', constraint: { type: 'SCALE', value: s } };
  }
  if (format === 'JPG') {
    return { format: 'JPG', constraint: { type: 'SCALE', value: s } };
  }
  if (format === 'SVG') {
    return { format: 'SVG' };
  }
  if (format === 'HTML') {
    return { format: 'SVG', svgOutlineText: true, svgIdAttribute: true };
  }
  // PDF ignores scale
  return { format: 'PDF' };
}

var cancelThumbnails = false;

figma.ui.onmessage = async function (msg) {
  if (!msg) return;

  if (msg.type === 'ready') {
    postFrames();
    return;
  }

  if (msg.type === 'clear') {
    cancelThumbnails = true;
    try { figma.currentPage.selection = []; } catch (e) {}
    postFrames();
    return;
  }

  if (msg.type === 'get-thumbnails') {
    cancelThumbnails = false;
    var thumbIds = Array.isArray(msg.ids) ? msg.ids : [];
    for (var t = 0; t < thumbIds.length; t++) {
      if (cancelThumbnails) break;
      var tId = thumbIds[t];
      try {
        var tNode = await figma.getNodeByIdAsync(tId);
        if (cancelThumbnails) break;
        if (tNode && typeof tNode.exportAsync === 'function') {
          var tBytes = await tNode.exportAsync({
            format: 'PNG',
            constraint: { type: 'WIDTH', value: 88 }
          });
          if (!cancelThumbnails) {
            figma.ui.postMessage({ type: 'thumbnail', id: tId, bytes: tBytes });
          }
        }
      } catch (err) { /* ignore thumbnail failures */ }
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return;
  }

  if (msg.type === 'export') {
    cancelThumbnails = true;
    var ids = Array.isArray(msg.ids) ? msg.ids : [];
    var format = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF', 'HTML'].indexOf(format) < 0) format = 'PNG';
    var rawScale = Number(msg.scale) || 1;
    var scale = rawScale;

    var total = ids.length;
    var queue = ids.map(function (id, idx) { return { id: id, index: idx }; });
    var CONCURRENCY = Math.min(2, Math.max(1, queue.length));
    var workers = [];

    for (var w = 0; w < CONCURRENCY; w++) {
      workers.push((async function worker() {
        while (queue.length > 0) {
          var item = queue.shift();
          if (!item) break;
          var id = item.id;
          var idx = item.index;
          try {
            var node = await figma.getNodeByIdAsync(id);
            if (!node || typeof node.exportAsync !== 'function') {
              figma.ui.postMessage({ type: 'error', id: id, message: 'Node no longer exists or cannot be exported.' });
              continue;
            }
            var settings = buildSettings(format, scale);
            var out = await node.exportAsync(settings);
            var bytes;
            var name = 'Untitled';
            try { name = String(node.name || 'Untitled'); } catch (e) {}
            if (typeof out === 'string') {
              var enc = new TextEncoder();
              bytes = enc.encode(out);
            } else {
              bytes = out;
            }
            figma.ui.postMessage({ type: 'file', index: idx, total: total, id: id, name: name, bytes: bytes });
          } catch (err) {
            var message = 'Export failed.';
            try { message = (err && err.message) ? String(err.message) : String(err); } catch (e) {}
            if (/larger than|too large|memory|4096|size/i.test(message)) {
              message = message + ' Try a smaller scale (1x or 2x).';
            }
            figma.ui.postMessage({ type: 'error', id: id, message: message });
          }
          // Yield to keep UI responsive between exports and allow IPC to flush
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      })());
    }

    await Promise.all(workers);
    figma.ui.postMessage({ type: 'done' });
    postFrames();
  }
};

