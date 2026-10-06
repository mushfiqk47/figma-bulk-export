async function onDone(){
  state.running = false; state.finished = true;
  $('barFill').style.width = '100%';
  if (state.fails.length){ $('failBox').hidden = false; var fl = $('failList'); fl.innerHTML = '';
    state.fails.forEach(function(x){ var li = document.createElement('li'); li.textContent = nameOf(x.id) + ': ' + x.message; fl.appendChild(li); }); }
  if (state.files.length === 0){
    $('statusLine').textContent = state.fails.length ? 'All exports failed.' : 'Nothing exported.';
    return;
  }
  $('statusLine').textContent = 'Packaging…';
  try {
    var singlePdf = state.format === 'PDF' && state.pdf === 'single';
    if (singlePdf){ await downloadSinglePdf(); }
    else if (state.files.length === 1){ downloadOne(); }
    else { await downloadZip(); }
    var ok = state.files.length, bad = state.fails.length;
    $('statusLine').textContent = bad === 0 ? ('Done. Exported ' + ok + (ok === 1 ? ' file.' : ' files.'))
      : ('Done. Exported ' + ok + ', ' + bad + ' failed.');
  } catch (err){ $('statusLine').textContent = 'Packaging failed: ' + (err && err.message ? err.message : err); }
}
function nameOf(id){ for (var i = 0; i < state.frames.length; i++){ if (state.frames[i].id === id) return state.frames[i].name; } return 'Frame'; }
function orderedFiles(){ var map = {}; state.files.forEach(function(f){ map[f.id] = f; });
  var out = []; state.order.forEach(function(id){ if (map[id]) out.push(map[id]); }); return out; }
function downloadOne(){ var f = orderedFiles()[0]; var plan = (state.plan && state.plan[f.id]) || null;
  var blob = toBlob(f); download(blob, plan || ('export.' + ext())); }
async function downloadZip(){
  var zip = new JSZip(); var files = orderedFiles();
  files.forEach(function(f){ zip.file((state.plan && state.plan[f.id]) || (f.name + '.' + ext()), f.bytes); });
  var blob = await zip.generateAsync({ type: 'blob' });
  download(blob, 'bulk-' + state.format.toLowerCase() + '-export.zip');
}
function toBlob(f){
  var mime = state.format === 'PNG' ? 'image/png' : state.format === 'JPG' ? 'image/jpeg' : state.format === 'SVG' ? 'image/svg+xml' : 'application/pdf';
  return new Blob([f.bytes], { type: mime });
}
