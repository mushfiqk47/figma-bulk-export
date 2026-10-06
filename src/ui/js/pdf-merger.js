async function downloadSinglePdf() {
  // LIMITATION (stated plainly): Figma returns one single-page PDF per
  // frame. We merge those pages in selection order with pdf-lib. Vector
  // content is preserved when pdf-lib can parse the page; if a page fails
  // to parse we fall back to zipping the individual PDFs.
  var files = orderedFiles();
  try {
    var merged = await PDFLib.PDFDocument.create();
    for (var i = 0; i < files.length; i++) {
      var src = await PDFLib.PDFDocument.load(files[i].bytes, { ignoreEncryption: true });
      var pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(function (p) {
        merged.addPage(p);
      });
      src = null;
      if (i % 5 === 0) {
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    var out = await merged.save();
    download(new Blob([out], { type: 'application/pdf' }), 'frames.pdf');
  } catch (err) {
    var zip = new JSZip();
    files.forEach(function (f) {
      zip.file((state.plan && state.plan[f.id]) || (f.name + '.pdf'), f.bytes);
    });
    var blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    download(blob, 'frames-pdf-each.zip');
    var li = document.createElement('li');
    li.textContent = 'Single-PDF merge unavailable; downloaded individual PDFs instead.';
    $('failList').appendChild(li);
    $('failBox').hidden = false;
  }
}
