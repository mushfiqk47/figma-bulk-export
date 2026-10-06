async function downloadSinglePdf(){
  // LIMITATION (stated plainly): Figma returns one single-page PDF per
  // frame. We merge those pages in selection order with pdf-lib. Vector
  // content is preserved when pdf-lib can parse the page; if a page fails
  // to parse we fall back to zipping the individual PDFs.
  var files = orderedFiles();
  try {
    var merged = await PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++){
      var src = await PDFLib.PDFDocument.load(files[i].bytes, { ignoreEncryption: true });
      var pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(function(p){ merged.addPage(p); });
    }
    var out = await merged.save();
    download(new Blob([out], { type: 'application/pdf' }), 'frames.pdf');
  } catch (err){
    var zip = new JSZip();
    files.forEach(function(f){ zip.file((state.plan && state.plan[f.id]) || (f.name + '.pdf'), f.bytes); });
    var blob = await zip.generateAsync({ type: 'blob' });
    download(blob, 'frames-pdf-each.zip');
    var li = document.createElement('li');
    li.textContent = 'Single-PDF merge unavailable; downloaded individual PDFs instead.';
    $('failList').appendChild(li); $('failBox').hidden = false;
  }
}
function goSelect(){
  // Apply any selection change that arrived while exporting, then show it.
  // The done screen never auto-navigates away: only the user's Back /
  // Export more click lands here.
  state.finished = false;
  if (state.pendingFrames){ var m = state.pendingFrames; state.pendingFrames = null; applyFramesMsg(m); }
  else { renderList(); }
  show('screenSelect');
}
function wire(){
  $('selNone').onclick = function(){ state.checked = {}; state.order = []; renderList(); send({ type: 'clear' }); };
  $('btnContinue').onclick = function(){ renderSettings(); show('screenSettings'); };
  var nb = $('btnNavBack'); if (nb) nb.onclick = goSelect;
  var b1 = $('btnBack'); if (b1) b1.onclick = goSelect;
  var b2 = $('btnBack2'); if (b2) b2.onclick = goSelect;
  var bm = $('btnMore'); if (bm) bm.onclick = goSelect;
  $('btnExport').onclick = startExport;
  var fb = document.querySelectorAll('#fmtSeg button');
  for (var i = 0; i < fb.length; i++){ (function(b){ b.onclick = function(){ state.format = b.getAttribute('data-fmt'); renderSettings(); }; })(fb[i]); }
  $('qualitySw').onclick = function(){ state.hq = !state.hq; renderSettings(); };
  var sb = document.querySelectorAll('#scaleRow button');
  for (var j = 0; j < sb.length; j++){ (function(b){ b.onclick = function(){ if (b.disabled) return; state.scale = parseFloat(b.getAttribute('data-scale')); renderSettings(); }; })(sb[j]); }
  var pr = document.querySelectorAll('input[name="pdfmode"]');
  for (var k = 0; k < pr.length; k++){ pr[k].onchange = function(){ var c = document.querySelector('input[name="pdfmode"]:checked'); state.pdf = c ? c.value : 'single'; renderSettings(); }; }
}
function applyTheme(){
  // Figma adds .figma-light / .figma-dark when themeColors:true.
  // Mirror body classes to <html> and fall back to prefers-color-scheme outside Figma.
  var root = document.documentElement;
  if (document.body.classList.contains('figma-dark')) root.classList.add('figma-dark');
  if (document.body.classList.contains('figma-light')) root.classList.add('figma-light');
  if (!root.classList.contains('figma-dark') && !root.classList.contains('figma-light')){
    try { if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches){ root.classList.add('figma-dark'); } } catch (e){}
  }
}
applyTheme(); wire(); renderList(); show('screenSelect');
if (!inFigma){ applyFramesMsg({ selectedFrames: DEMO.slice(), selected: ['d1', 'd2'], skipped: 0 }); }
else { send({ type: 'ready' }); }
})();
