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
      zip.file((state.plan && state.plan[f.id]) || (f.name + '.' + ext()), f.bytes);
    });
  }
  var comp = (state.format === 'SVG') ? 'DEFLATE' : 'STORE';
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

function toBlob(f) {
  if (state.format === 'HTML') {
    var svgText = '';
    try {
      svgText = new TextDecoder('utf-8').decode(f.bytes);
    } catch (e) {
      svgText = String.fromCharCode.apply(null, f.bytes);
    }
    var title = escapeHtml(f.name || 'Frame');
    var htmlDoc = '<!DOCTYPE html>\n'
      + '<html lang="en">\n<head>\n'
      + '<meta charset="utf-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<title>' + title + '</title>\n'
      + '<style>\n'
      + '  * { box-sizing: border-box; }\n'
      + '  html, body { margin: 0; padding: 0; min-height: 100vh; background: #ffffff; }\n'
      + '  .frame-viewport { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }\n'
      + '  svg { display: block; max-width: 100%; height: auto; }\n'
      + '</style>\n'
      + '</head>\n<body>\n'
      + '<div class="frame-viewport">\n'
      + svgText + '\n'
      + '</div>\n</body>\n</html>\n';
    return new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
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
  var svgText = '';
  try {
    svgText = new TextDecoder('utf-8').decode(f.bytes);
  } catch (e) {
    svgText = String.fromCharCode.apply(null, f.bytes);
  }

  var assets = [];
  var assetIndex = 1;

  var processedSvg = svgText.replace(
    /(?:xlink:)?href="data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)"/g,
    function (match, mimeExt, b64Data) {
      var ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt;
      var assetFilename = 'assets/image-' + assetIndex + '.' + ext;
      assetIndex++;
      try {
        var rawBase64 = b64Data.replace(/\s+/g, '');
        var binaryString = atob(rawBase64);
        var len = binaryString.length;
        var u8 = new Uint8Array(len);
        for (var b = 0; b < len; b++) {
          u8[b] = binaryString.charCodeAt(b);
        }
        assets.push({ path: assetFilename, bytes: u8 });
        return 'href="' + assetFilename + '" xlink:href="' + assetFilename + '"';
      } catch (err) {
        return match;
      }
    }
  );

  var title = escapeHtml(f.name || 'Frame');
  var cssContent = '/* Velto Web Project Styles */\n'
    + '* {\n  box-sizing: border-box;\n}\n\n'
    + 'html,\nbody {\n  margin: 0;\n  padding: 0;\n  min-height: 100vh;\n  background: #ffffff;\n'
    + '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;\n}\n\n'
    + '.frame-wrapper {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 100vh;\n  padding: 24px;\n}\n\n'
    + 'svg {\n  display: block;\n  max-width: 100%;\n  height: auto;\n}\n';

  var jsContent = '// Velto Web Project Script\n'
    + 'document.addEventListener(\'DOMContentLoaded\', function () {\n'
    + '  console.log(\'Velto project loaded: ' + title + '\');\n'
    + '});\n';

  var htmlDoc = '<!DOCTYPE html>\n'
    + '<html lang="en">\n<head>\n'
    + '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + title + '</title>\n'
    + '<link rel="stylesheet" href="css/style.css">\n'
    + '</head>\n<body>\n'
    + '<div class="frame-wrapper">\n'
    + processedSvg + '\n'
    + '</div>\n'
    + '<' + 'script src="js/main.js"><' + '/script>\n'
    + '</body>\n</html>\n';

  var zip = new JSZip();
  zip.file('index.html', htmlDoc);
  zip.file('css/style.css', cssContent);
  zip.file('js/main.js', jsContent);
  assets.forEach(function (a) {
    zip.file(a.path, a.bytes);
  });

  var blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  download(blob, sanitize(f.name) + '-web.zip');
}

