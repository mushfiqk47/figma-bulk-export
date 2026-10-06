function setStatus(){ $('statusLine').textContent = state.got >= state.expected ? 'Packaging…' : ('Exporting ' + Math.min(state.got + 1, state.expected) + ' of ' + state.expected + '…'); }
function applyFramesMsg(msg){
  // The plugin list mirrors the canvas selection only.
  var list = Array.isArray(msg.selectedFrames) ? msg.selectedFrames : null;
  if (!list){
    var known = {};
    (Array.isArray(msg.frames) ? msg.frames : []).forEach(function(f){ known[f.id] = true; });
    list = ((Array.isArray(msg.selected) ? msg.selected : []).filter(function(id){ return known[id]; }).map(function(id){
      for (var i = 0; i < msg.frames.length; i++){ if (msg.frames[i].id === id) return msg.frames[i]; } return null;
    }).filter(function(f){ return !!f; }));
  }
  state.frames = list;
  if (typeof msg.skipped === 'number') state.skipped = msg.skipped; else state.skipped = 0;
  var keepChecked = {}; var keepOrder = [];
  // Keep the user's uncheck choices; drop ids that left the canvas selection.
  var inSel = {}; list.forEach(function(f){ inSel[f.id] = true; });
  state.order.forEach(function(id){ if (inSel[id] && state.checked[id]){ keepChecked[id] = true; keepOrder.push(id); } });
  // New canvas picks join the export set by default.
  list.forEach(function(f){ if (!keepChecked[f.id]){ keepChecked[f.id] = true; keepOrder.push(f.id); } });
  state.checked = keepChecked; state.order = keepOrder;
  renderList();

  // Request thumbnail previews for frames that don't have one cached yet
  var needThumbs = [];
  list.forEach(function(f){ if (!state.thumbs[f.id]) needThumbs.push(f.id); });
  if (needThumbs.length > 0 && inFigma){
    send({ type: 'get-thumbnails', ids: needThumbs });
  }
}
function onThumbnail(msg){
  if (!msg || !msg.id || !msg.bytes) return;
  try {
    var blob = new Blob([msg.bytes], { type: 'image/png' });
    var url = URL.createObjectURL(blob);
    state.thumbs[msg.id] = url;
    var el = $('th-' + msg.id);
    if (el){
      el.innerHTML = '';
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      el.appendChild(img);
    }
  } catch(e){}
}
function onFrames(msg){
  // Never yank the list mid-run or after finishing: the export screens own
  // their state. Stash the update and apply it when the user goes Back or
  // starts Export more.
  if (state.running || state.finished){ state.pendingFrames = msg; return; }
  applyFramesMsg(msg);
}
function startExport(){
  if (selCount() === 0 || state.running) return;
  resetRun(); show('screenProgress');
  state.running = true; state.expected = selCount();
  state.plan = {}; planFiles().forEach(function(p){ state.plan[p.id] = p.file; });
  if (state.expected === 1){ var single = state.frames.filter(function(f){ return f.id === state.order[0]; })[0]; }
  setStatus(); $('barFill').style.width = '0';
  send({ type: 'export', ids: state.order.slice(), format: state.format, scale: effScale(), pdf: state.pdf });
  // Outside Figma: simulate incoming files so the UI can be previewed.
  if (!inFigma){ simulate(); }
}
function simulate(){
  var i = 0;
  function next(){
    if (i >= state.order.length){ onDone(); return; }
    var id = state.order[i]; var f = null;
    for (var k = 0; k < state.frames.length; k++){ if (state.frames[k].id === id){ f = state.frames[k]; break; } }
    var label = (f ? f.name : 'Frame') + ' demo bytes';
    var bytes = new TextEncoder().encode(label);
    onFile({ id: id, name: f ? f.name : 'Frame', bytes: bytes, index: i, total: state.order.length });
    i++; setTimeout(next, 350);
  }
  next();
}
function onFile(msg){
  var raw = msg.bytes;
  var u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw || []);
  state.files.push({ id: msg.id, name: msg.name || 'Untitled', bytes: u8 });
  state.got++;
  $('barFill').style.width = Math.round((state.got / Math.max(1, state.expected)) * 100) + '%';
  var dl = $('doneList');
  if (dl){
    var li = document.createElement('li');
    li.textContent = (state.plan && state.plan[msg.id]) || (msg.name || 'file');
    dl.appendChild(li);
  }
  var badge = document.getElementById('st-' + CSS.escape(String(msg.id)));
  if (badge){ badge.textContent = 'Done'; badge.parentElement.classList.add('done'); }
  setStatus();
}
function onErr(msg){
  state.fails.push({ id: msg.id, message: msg.message || 'Export failed.' });
  state.got++;
  $('barFill').style.width = Math.round((state.got / Math.max(1, state.expected)) * 100) + '%';
  setStatus();
}
window.addEventListener('message', function(e){
  var m = e.data && e.data.pluginMessage; if (!m) return;
  if (m.type === 'frames') onFrames(m);
  else if (m.type === 'thumbnail') onThumbnail(m);
  else if (m.type === 'file') onFile(m);
  else if (m.type === 'error') onErr(m);
  else if (m.type === 'done') onDone();
});
