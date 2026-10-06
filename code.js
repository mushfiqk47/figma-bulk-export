figma.showUI(__html__, { width: 420, height: 440, themeColors: true });

var CONTAINER_TYPES = {
  FRAME: true,
  COMPONENT: true,
  COMPONENT_SET: true,
  INSTANCE: true,
  SECTION: true,
  GROUP: true
};

function getExportableNode(n) {
  if (!n) return null;
  // If node itself is an exportable frame/container type
  if (CONTAINER_TYPES[n.type]) {
    return n;
  }
  // If user selected a child layer inside a frame/container, climb up to find the enclosing frame
  var curr = n.parent;
  while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
    if (CONTAINER_TYPES[curr.type]) {
      return curr;
    }
    curr = curr.parent;
  }
  // Standalone vector/shape/layer capable of direct export
  if (typeof n.exportAsync === 'function' && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
    return n;
  }
  return null;
}

function canvasSelection() {
  try { return figma.currentPage.selection || []; } catch (e) { return []; }
}

function selectedDetails(sel) {
  var out = [];
  var seen = {};
  var list = sel || canvasSelection();
  var pg = '';
  try { pg = figma.currentPage ? figma.currentPage.name : ''; } catch (e) {}

  for (var i = 0; i < list.length; i++) {
    var target = getExportableNode(list[i]);
    if (target && !seen[target.id]) {
      seen[target.id] = true;
      var w = 0, h = 0;
      try { w = Math.round(target.width || 0); h = Math.round(target.height || 0); } catch (e) {}
      var nm = 'Untitled';
      try { nm = String(target.name || 'Untitled'); } catch (e) {}
      out.push({ id: target.id, name: nm, width: w, height: h, page: pg });
    }
  }
  return out;
}

function postFrames() {
  var sel = canvasSelection();
  var details = selectedDetails(sel);
  figma.ui.postMessage({
    type: 'frames',
    selected: details.map(function (d) { return d.id; }),
    selectedFrames: details,
    skipped: Math.max(0, sel.length - details.length)
  });
}

// Debounce rapid canvas selection updates (e.g. marquee drag selection)
var selectionTimer = null;
function schedulePostFrames() {
  if (selectionTimer) return;
  selectionTimer = setTimeout(function () {
    selectionTimer = null;
    postFrames();
  }, 16);
}

figma.on('selectionchange', schedulePostFrames);
figma.on('currentpagechange', schedulePostFrames);

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
    var thumbIds = Array.isArray(msg.ids) ? msg.ids.slice() : [];
    var THUMB_CONCURRENCY = Math.min(2, Math.max(1, thumbIds.length));
    var thumbWorkers = [];

    for (var tw = 0; tw < THUMB_CONCURRENCY; tw++) {
      thumbWorkers.push((async function () {
        while (thumbIds.length > 0 && !cancelThumbnails) {
          var tId = thumbIds.shift();
          if (!tId) break;
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
      })());
    }

    await Promise.all(thumbWorkers);
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
    var settings = buildSettings(format, scale);

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

// Dispatch initial selection immediately on startup
postFrames();

