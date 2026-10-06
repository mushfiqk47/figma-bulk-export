(function(){
'use strict';
var inFigma = typeof parent !== 'undefined' && parent !== window;
function send(m){ try{ parent.postMessage({ pluginMessage: m }, '*'); }catch(e){} }
var $ = function(id){ return document.getElementById(id); };
var state = { frames: [], checked: {}, order: [], thumbs: {}, format: 'PNG', hq: true, scale: 2, pdf: 'single',
  running: false, finished: false, expected: 0, got: 0, files: [], fails: [], skipped: 0, pendingFrames: null };
var DEMO = [ { id: 'd1', name: 'Landing hero', width: 1440, height: 900, page: 'Page 1' },
  { id: 'd2', name: 'Pricing cards', width: 1200, height: 800, page: 'Page 1' },
  { id: 'd3', name: 'Mobile / home', width: 390, height: 844, page: 'Page 1' } ];
function fmtWH(f){ return (f.width && f.height) ? (' · ' + f.width + ' × ' + f.height) : ''; }
function selCount(){ return state.order.length; }
function effScale(){
  if (state.format !== 'PNG' && state.format !== 'JPG') return 1;
  if (state.scale === 'none') return 1;
  return Number(state.scale) || 1;
}
function ext(){ return state.format === 'JPG' ? 'jpg' : state.format === 'PNG' ? 'png' : state.format === 'SVG' ? 'svg' : 'pdf'; }
function sanitize(n){ var s = String(n || 'Untitled').trim() || 'Untitled'; s = s.replace(/[\\/:*?"<>|]/g, '-'); s = s.replace(/\s+/g, ' ').trim(); return s.slice(0, 100) || 'Untitled'; }
function suffix(){
  if (state.format !== 'PNG' && state.format !== 'JPG') return '';
  if (state.scale === 'none') return '';
  var s = effScale();
  return s !== 1 ? ('@' + s + 'x') : '';
}
function planFiles(){ var used = {}; var out = [];
  for (var i = 0; i < state.order.length; i++){ var id = state.order[i];
    var f = null; for (var k = 0; k < state.frames.length; k++){ if (state.frames[k].id === id){ f = state.frames[k]; break; } }
    var base = sanitize(f ? f.name : 'Frame') + suffix() + '.' + ext();
    if (used[base] === undefined){ used[base] = 1; out.push({ id: id, file: base }); }
    else { used[base]++; var dot = base.lastIndexOf('.'); out.push({ id: id, file: base.slice(0, dot) + '-' + used[base] + base.slice(dot) }); } }
  return out; }
function renderList(){
  var list = $('frameList'); list.innerHTML = '';
  state.frames.forEach(function(f){
    var lab = document.createElement('label'); lab.className = 'row';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!state.checked[f.id];
    cb.onchange = function(){ toggle(f.id, cb.checked); };
    
    var th = document.createElement('div'); th.className = 'thumb'; th.id = 'th-' + f.id;
    if (state.thumbs[f.id]){
      var img = document.createElement('img'); img.src = state.thumbs[f.id]; img.alt = '';
      th.appendChild(img);
    } else {
      var icon = document.createElement('span'); icon.className = 'th-ph';
      icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="11" height="11" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 9.5L4.5 6.5L8 10L10 8L12.5 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      th.appendChild(icon);
    }

    var m = document.createElement('span'); m.className = 'm';
    var n = document.createElement('span'); n.className = 'n'; n.textContent = f.name;
    var s = document.createElement('span'); s.className = 's'; s.textContent = (f.page || '') + fmtWH(f);
    m.appendChild(n); m.appendChild(s);
    var st = document.createElement('span'); st.className = 'st'; st.id = 'st-' + f.id; st.textContent = state.checked[f.id] ? 'Selected' : '';
    lab.appendChild(cb); lab.appendChild(th); lab.appendChild(m); lab.appendChild(st); list.appendChild(lab);
  });
  var empty = state.order.length === 0;
  $('emptyState').hidden = !empty; $('selTools').style.display = empty ? 'none' : 'flex';
  $('countBadge').textContent = selCount() + ' selected';
  $('subtitle').textContent = empty ? 'Nothing selected yet.' : 'Select frames on the canvas to export.';
  $('btnContinue').disabled = selCount() === 0;
  var sk = $('skipHint');
  if (sk){ if (state.skipped > 0 && !empty){ sk.hidden = false; sk.textContent = state.skipped + (state.skipped === 1 ? ' selected layer is not a frame and will be skipped.' : ' selected layers are not frames and will be skipped.'); } else { sk.hidden = true; sk.textContent = ''; } }
}
