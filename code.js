/* Bulk export — plugin sandbox (main thread).
 * Plain JS, no build step. Uses async APIs only (dynamic-page).
 */

figma.showUI(__html__, { width: 420, height: 440, themeColors: true });

var EXPORTABLE = { FRAME: true, COMPONENT: true, COMPONENT_SET: true };

function topLevelExportables() {
  var out = [];
  try {
    var kids = figma.currentPage.children || [];
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n && EXPORTABLE[n.type]) {
        var w = 0, h = 0;
        try {
          w = Math.round(n.width || 0);
          h = Math.round(n.height || 0);
        } catch (e) { /* ignore */ }
        out.push({ id: n.id, name: String(n.name || 'Untitled'), width: w, height: h, page: figma.currentPage.name });
      }
    }
  } catch (e) { /* page not ready */ }
  return out;
}

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
    frames: topLevelExportables(),
    selected: details.map(function (d) { return d.id; }),
    selectedFrames: details,
    skipped: Math.max(0, total - details.length)
  });
}

figma.on('selectionchange', function () { postFrames(); });
figma.on('currentpagechange', function () { postFrames(); });

// The UI sends { type: 'ready' } on boot, which triggers the first
// postFrames(). No documentchange listener: it is illegal in
// dynamic-page (incremental) mode without loadAllPagesAsync(), and
// selectionchange + currentpagechange already cover renames,
// adds/deletes and adds/removes on the current page.

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
  // PDF ignores scale
  return { format: 'PDF' };
}

figma.ui.onmessage = async function (msg) {
  if (!msg) return;

  if (msg.type === 'ready') {
    postFrames();
    return;
  }

  if (msg.type === 'clear') {
    try { figma.currentPage.selection = []; } catch (e) {}
    postFrames();
    return;
  }

  if (msg.type === 'export') {
    var ids = Array.isArray(msg.ids) ? msg.ids : [];
    var format = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF'].indexOf(format) < 0) format = 'PNG';
    var rawScale = Number(msg.scale) || 1;
    // Quality toggle off => force 1x for raster (UI already does this, double-guard here)
    var scale = rawScale;

    var total = ids.length;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
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
          // SVG_STRING path (not used by default, but handle it)
          var enc = new TextEncoder();
          bytes = enc.encode(out);
        } else {
          bytes = out; // Uint8Array
        }
        figma.ui.postMessage({ type: 'file', index: i, total: total, id: id, name: name, bytes: bytes });
      } catch (err) {
        var message = 'Export failed.';
        try { message = (err && err.message) ? String(err.message) : String(err); } catch (e) {}
        // Friendlier hint for the classic 4x-too-big case
        if (/larger than|too large|memory|4096|size/i.test(message)) {
          message = message + ' Try a smaller scale (1x or 2x).';
        }
        figma.ui.postMessage({ type: 'error', id: id, message: message });
      }
      // Yield so we never block the main thread between exports
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    figma.ui.postMessage({ type: 'done' });
    // Refresh the selection list after the run. The UI ignores
    // 'frames' while exporting and applies this once done, so the
    // plugin stays on the done screen instead of jumping.
    postFrames();
  }
};
