var activeMergedPdf = null;
var pdfMergeError = false;
var receivedPdfs = {};
var nextPdfOrderIndex = 0;

async function initPipelinedPdf() {
  activeMergedPdf = null;
  pdfMergeError = false;
  receivedPdfs = {};
  nextPdfOrderIndex = 0;
  try {
    if (typeof PDFLib !== 'undefined' && PDFLib.PDFDocument) {
      activeMergedPdf = await PDFLib.PDFDocument.create();
    }
  } catch (e) {
    pdfMergeError = true;
  }
}

async function onPdfFileArrived(f) {
  if (pdfMergeError || !activeMergedPdf) return;
  receivedPdfs[f.id] = f.bytes;
  await processPendingPdfs();
}

async function processPendingPdfs() {
  if (pdfMergeError || !activeMergedPdf) return;
  while (nextPdfOrderIndex < state.order.length) {
    var id = state.order[nextPdfOrderIndex];
    if (!receivedPdfs[id]) {
      break;
    }
    var bytes = receivedPdfs[id];
    delete receivedPdfs[id];
    nextPdfOrderIndex++;
    try {
      var src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      var pages = await activeMergedPdf.copyPages(src, src.getPageIndices());
      for (var p = 0; p < pages.length; p++) {
        activeMergedPdf.addPage(pages[p]);
      }
      src = null;
    } catch (e) {
      pdfMergeError = true;
      break;
    }
    await new Promise(function (r) { setTimeout(r, 0); });
  }
}

async function downloadSinglePdf() {
  // LIMITATION (stated plainly): Figma returns one single-page PDF per
  // frame. We merge those pages in selection order with pdf-lib. Vector
  // content is preserved when pdf-lib can parse the page; if a page fails
  // to parse we fall back to zipping the individual PDFs.
  var files = orderedFiles();
  try {
    if (pdfMergeError || !activeMergedPdf) {
      throw new Error('PDF merge assembly unavailable');
    }
    await processPendingPdfs();
    var out = await activeMergedPdf.save();
    download(new Blob([out], { type: 'application/pdf' }), 'frames.pdf');
    activeMergedPdf = null;
    receivedPdfs = {};
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
    activeMergedPdf = null;
    receivedPdfs = {};
  }
}
