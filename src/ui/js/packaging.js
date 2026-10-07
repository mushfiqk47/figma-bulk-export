async function onDone() {
  state.running = false;
  state.finished = true;
  updateProgress(1);
  if (state.fails.length) {
    $('failBox').hidden = false;
    var fl = $('failList');
    fl.innerHTML = '';
    state.fails.forEach(function (x) {
      var li = document.createElement('li');
      li.textContent = nameOf(x.id) + ': ' + x.message;
      fl.appendChild(li);
    });
  }
  if (state.files.length === 0) {
    var pt0 = $('progressTitle'); if (pt0) pt0.textContent = 'Export failed';
    $('statusLine').textContent = state.fails.length ? 'All exports failed.' : 'Nothing exported.';
    var widget0 = $('exportWidget'); if (widget0) widget0.className = 'export-widget is-fail';
    var b2_0 = $('btnBack2'); if (b2_0) b2_0.disabled = false;
    var bm_0 = $('btnMore'); if (bm_0) bm_0.disabled = false;
    return;
  }
  var pt = $('progressTitle'); if (pt) pt.textContent = 'Packaging…';
  $('statusLine').textContent = 'Preparing download…';
  try {
    var singlePdf = state.format === 'PDF' && state.pdf === 'single';
    var htmlBundle = state.format === 'HTML' && state.html === 'bundle';
    if (singlePdf) {
      await downloadSinglePdf();
    } else if (htmlBundle) {
      await downloadHtmlBundle();
    } else if (state.files.length === 1) {
      downloadOne();
    } else {
      await downloadZip();
    }
    var ok = state.files.length, bad = state.fails.length;
    var widget = $('exportWidget');
    if (widget) {
      widget.className = 'export-widget ' + (bad === 0 ? 'is-done' : 'is-fail');
    }
    if (pt) {
      pt.textContent = bad === 0 ? 'Export complete!' : 'Export finished';
      if (bad === 0) pt.classList.add('is-done');
    }
    $('statusLine').textContent = bad === 0
      ? ('Exported ' + ok + (ok === 1 ? ' file.' : ' files.'))
      : ('Exported ' + ok + ', ' + bad + ' failed.');
  } catch (err) {
    $('statusLine').textContent = 'Packaging failed: ' + (err && err.message ? err.message : err);
    var widgetErr = $('exportWidget'); if (widgetErr) widgetErr.className = 'export-widget is-fail';
  }
  var b2 = $('btnBack2'); if (b2) b2.disabled = false;
  var bm = $('btnMore'); if (bm) bm.disabled = false;
}

function nameOf(id) {
  for (var i = 0; i < state.frames.length; i++) {
    if (state.frames[i].id === id) return state.frames[i].name;
  }
  return 'Frame';
}

function orderedFiles() {
  var map = {};
  state.files.forEach(function (f) {
    map[f.id] = f;
  });
  var out = [];
  state.order.forEach(function (id) {
    if (map[id]) out.push(map[id]);
  });
  return out;
}

var activeZip = null;

function initPipelinedZip() {
  activeZip = new JSZip();
}

function addFileToPipelinedZip(f) {
  if (!activeZip) return;
  var filename = (state.plan && state.plan[f.id]) || (f.name + '.' + ext());
  activeZip.file(filename, f.bytes);
}

function resetPipelinedZip() {
  activeZip = null;
}

function downloadOne() {
  var f = orderedFiles()[0];
  var plan = (state.plan && state.plan[f.id]) || null;
  var blob = toBlob(f);
  download(blob, plan || ('export.' + ext()));
}

async function downloadZip() {
  var zip = activeZip || new JSZip();
  if (!activeZip) {
    var files = orderedFiles();
    files.forEach(function (f) {
      if (f.isRealHtml) {
        var b = toBlob(f);
        zip.file((state.plan && state.plan[f.id]) || (f.name + '.html'), b);
      } else {
        zip.file((state.plan && state.plan[f.id]) || (f.name + '.' + ext()), f.bytes);
      }
    });
  }
  var comp = (state.format === 'SVG' || state.format === 'HTML') ? 'DEFLATE' : 'STORE';
  var blob = await zip.generateAsync({ type: 'blob', compression: comp }, function (meta) {
    if (meta && typeof meta.percent === 'number') {
      var pct = Math.round(meta.percent);
      $('statusLine').textContent = 'Packaging ' + pct + '%…';
      updateProgress(pct / 100);
    }
  });
  download(blob, 'velto-' + state.format.toLowerCase() + '-export.zip');
  activeZip = null;
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function uint8ToBase64(u8) {
  if (!u8 || u8.length === 0) return '';
  var CHUNK_SIZE = 0x8000;
  var index = 0;
  var length = u8.length;
  var result = '';
  while (index < length) {
    var slice = u8.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

function getCssReset() {
  return '/* ========================================================\n'
    + '   Velto Web Project — Compiled from Figma\n'
    + '   Clean semantic CSS with modern layout and reset\n'
    + '   ======================================================== */\n\n'
    + '*, *::before, *::after {\n'
    + '  box-sizing: border-box;\n'
    + '}\n\n'
    + 'html {\n'
    + '  scroll-behavior: smooth;\n'
    + '  height: 100%;\n'
    + '}\n\n'
    + 'body {\n'
    + '  margin: 0;\n'
    + '  padding: 0;\n'
    + '  min-height: 100vh;\n'
    + '  background: #ffffff;\n'
    + '  color: #111827;\n'
    + '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;\n'
    + '  -webkit-font-smoothing: antialiased;\n'
    + '  -moz-osx-font-smoothing: grayscale;\n'
    + '  overflow-x: hidden;\n'
    + '  overflow-y: auto;\n'
    + '}\n\n'
    + 'img {\n'
    + '  max-width: 100%;\n'
    + '  height: auto;\n'
    + '  display: block;\n'
    + '}\n\n'
    + 'svg {\n'
    + '  display: block;\n'
    + '  max-width: 100%;\n'
    + '}\n\n'
    + 'button {\n'
    + '  font-family: inherit;\n'
    + '  font-size: inherit;\n'
    + '  line-height: inherit;\n'
    + '  color: inherit;\n'
    + '  cursor: pointer;\n'
    + '  border: none;\n'
    + '  background: none;\n'
    + '  padding: 0;\n'
    + '  margin: 0;\n'
    + '  text-align: inherit;\n'
    + '}\n\n'
    + 'a {\n'
    + '  color: inherit;\n'
    + '  text-decoration: none;\n'
    + '}\n';
}

function toBlob(f) {
  if (state.format === 'HTML') {
    var title = escapeHtml(f.name || 'Frame');
    if (f.isRealHtml && f.htmlData) {
      var body = f.htmlData.bodyHtml || '';
      var cssRules = f.htmlData.cssRules || '';

      // Inline assets as data URIs for self-contained single HTML file
      if (Array.isArray(f.htmlData.assets)) {
        f.htmlData.assets.forEach(function (asset) {
          if (!asset) return;
          var dataUri = asset.dataUri;
          if (!dataUri && asset.bytes && asset.bytes.length > 0) {
            var mime = asset.isSvg ? 'image/svg+xml' : (asset.mime || 'image/png');
            var b64 = asset.base64 || uint8ToBase64(asset.bytes);
            dataUri = 'data:' + mime + ';base64,' + b64;
          }
          if (dataUri && asset.path && dataUri.length > 30) {
            body = body.split('src="' + asset.path + '"').join('src="' + dataUri + '"');
            cssRules = cssRules.split('url("' + asset.path + '")').join('url("' + dataUri + '")');
            cssRules = cssRules.split("url('" + asset.path + "')").join("url('" + dataUri + "')");
            cssRules = cssRules.split('url(' + asset.path + ')').join('url(' + dataUri + ')');
          }
        });
      }
      var singleHtml = '<!DOCTYPE html>\n'
        + '<html lang="en">\n<head>\n'
        + '<meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + '<title>' + title + '</title>\n'
        + '<style>\n'
        + getCssReset() + '\n'
        + cssRules + '\n'
        + '</style>\n'
        + '</head>\n<body>\n'
        + body + '\n'
        + '<' + 'script>\n'
        + '// Velto Standalone HTML Export\n'
        + 'document.addEventListener(\'DOMContentLoaded\', function () {\n'
        + '  console.log(\'Velto loaded: ' + title + '\');\n'
        + '});\n'
        + '<' + '/script>\n'
        + '</body>\n</html>\n';
      return new Blob([singleHtml], { type: 'text/html;charset=utf-8' });
    }

    var rawText = '';
    try {
      rawText = new TextDecoder('utf-8').decode(f.bytes);
    } catch (e) {
      rawText = String.fromCharCode.apply(null, f.bytes);
    }
    var fallbackDoc = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>' + title + '</title>\n<style>\n' + getCssReset() + '\n</style>\n</head>\n<body>\n' + rawText + '\n</body>\n</html>\n';
    return new Blob([fallbackDoc], { type: 'text/html;charset=utf-8' });
  }

  var mime = state.format === 'PNG' ? 'image/png'
    : state.format === 'JPG' ? 'image/jpeg'
    : state.format === 'SVG' ? 'image/svg+xml'
    : 'application/pdf';
  return new Blob([f.bytes], { type: mime });
}

function download(blob, name) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {}
    a.remove();
  }, 1000);
}

async function downloadHtmlBundle() {
  var f = orderedFiles()[0];
  var title = escapeHtml(f.name || 'Frame');
  var zip = new JSZip();

  if (f.isRealHtml && f.htmlData) {
    var indexHtml = '<!DOCTYPE html>\n'
      + '<html lang="en">\n<head>\n'
      + '<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<title>' + title + '</title>\n'
      + '<link rel="stylesheet" href="css/style.css">\n'
      + '</head>\n<body>\n'
      + (f.htmlData.bodyHtml || '') + '\n'
      + '<' + 'script src="js/main.js"><' + '/script>\n'
      + '</body>\n</html>\n';

    var rawCss = f.htmlData.cssRules || '';
    // In external stylesheet css/style.css, assets are at ../assets/
    var adjustedCss = rawCss
      .split('url("assets/').join('url("../assets/')
      .split("url('assets/").join("url('../assets/")
      .split('url(assets/').join('url(../assets/');
    var cssContent = getCssReset() + '\n' + adjustedCss;

    var jsContent = '// Velto Web Project Script\n'
      + 'document.addEventListener(\'DOMContentLoaded\', function () {\n'
      + '  console.log(\'Velto project loaded: ' + title + '\');\n'
      + '});\n';

    zip.file('index.html', indexHtml);
    zip.file('css/style.css', cssContent);
    zip.file('js/main.js', jsContent);

    if (Array.isArray(f.htmlData.assets)) {
      f.htmlData.assets.forEach(function (asset) {
        if (asset && asset.path && asset.bytes) {
          zip.file(asset.path, asset.bytes);
        }
      });
    }
  } else {
    var rawText = '';
    try {
      rawText = new TextDecoder('utf-8').decode(f.bytes);
    } catch (e) {
      rawText = String.fromCharCode.apply(null, f.bytes);
    }
    var fallbackHtml = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>' + title + '</title><link rel="stylesheet" href="css/style.css"></head><body>' + rawText + '<' + 'script src="js/main.js"><' + '/script></body></html>';
    zip.file('index.html', fallbackHtml);
    zip.file('css/style.css', getCssReset());
    zip.file('js/main.js', '// Velto project script\n');
  }

  $('statusLine').textContent = 'Creating web bundle…';
  var blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, function (meta) {
    if (meta && typeof meta.percent === 'number') {
      var pct = Math.round(meta.percent);
      $('statusLine').textContent = 'Packaging ' + pct + '%…';
      updateProgress(pct / 100);
    }
  });
  download(blob, sanitize(f.name) + '-web.zip');
}

