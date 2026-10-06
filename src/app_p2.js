function toggle(id, on){
  if (on && !state.checked[id]){ state.checked[id] = true; state.order.push(id); }
  if (!on && state.checked[id]){ delete state.checked[id]; state.order = state.order.filter(function(x){ return x !== id; }); }
  renderList();
}
function applySelected(ids){
  state.checked = {}; state.order = [];
  (ids || []).forEach(function(id){ for (var i = 0; i < state.frames.length; i++){ if (state.frames[i].id === id){ state.checked[id] = true; state.order.push(id); break; } } });
  renderList();
}
function renderSettings(){
  var btns = document.querySelectorAll('#fmtSeg button');
  for (var i = 0; i < btns.length; i++){ btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-fmt') === state.format ? 'true' : 'false'); }
  var sb = document.querySelectorAll('#scaleRow button');
  for (var j = 0; j < sb.length; j++){
    var attr = sb[j].getAttribute('data-scale');
    var isSel = (attr === 'none' && state.scale === 'none') || (parseFloat(attr) === state.scale);
    sb[j].setAttribute('aria-pressed', isSel ? 'true' : 'false');
  }
  var raster = state.format === 'PNG' || state.format === 'JPG';
  $('qualityGroup').hidden = !raster;
  $('pdfGroup').hidden = state.format !== 'PDF';
  var man = $('manifest');
  if (man){ man.innerHTML = ''; planFiles().forEach(function(p){ var li = document.createElement('li'); li.textContent = p.file; man.appendChild(li); }); }
  $('btnExport').textContent = state.format === 'PDF' && state.pdf === 'single' ? 'Export 1 PDF' : 'Export ' + selCount() + (selCount() === 1 ? ' file' : ' files');
  $('btnExport').disabled = selCount() === 0;
}
function show(which){
  ['screenSelect', 'screenSettings', 'screenProgress'].forEach(function(id){ $(id).hidden = id !== which; });
  $('footSelect').hidden = which !== 'screenSelect';
  $('footSettings').hidden = which !== 'screenSettings';
  $('footDone').hidden = which !== 'screenProgress';
  var nb = $('btnNavBack');
  if (nb) nb.hidden = which !== 'screenSettings';
  var logo = $('brandLogo');
  if (logo) logo.hidden = which === 'screenSettings';
}
function resetRun(){ state.running = false; state.finished = false; state.expected = 0; state.got = 0; state.files = []; state.fails = []; state.pendingFrames = null;
  $('barFill').style.width = '0'; $('statusLine').textContent = 'Exporting…';
  var dl = $('doneList'); if (dl) dl.innerHTML = '';
  $('failBox').hidden = true; $('failList').innerHTML = ''; }
function download(blob, name){
  var url = URL.createObjectURL(blob); var a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 400);
}
