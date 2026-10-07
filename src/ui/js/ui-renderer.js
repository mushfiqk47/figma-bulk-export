function updateSelectionHeader() {
  var noFrames = state.frames.length === 0;
  var noneChecked = state.order.length === 0;
  $('emptyState').hidden = !noFrames;
  $('selTools').style.display = noFrames ? 'none' : 'flex';
  $('countBadge').textContent = selCount() + ' selected';
  $('subtitle').textContent = noFrames ? 'Nothing selected yet.' : 'Select frames on the canvas to export.';
  $('btnContinue').disabled = noneChecked;
  var sk = $('skipHint');
  if (sk) {
    if (state.skipped > 0 && !noFrames) {
      sk.hidden = false;
      sk.textContent = state.skipped + (state.skipped === 1 ? ' selected layer is not exportable and was skipped.' : ' selected layers are not exportable and were skipped.');
    } else {
      sk.hidden = true;
      sk.textContent = '';
    }
  }
}

function renderList() {
  var list = $('frameList');
  if (!list) return;

  var currentRows = {};
  var existing = list.querySelectorAll('.row');
  for (var e = 0; e < existing.length; e++) {
    var rowId = existing[e].id.replace(/^row-/, '');
    currentRows[rowId] = existing[e];
  }

  var activeIds = {};
  var frag = document.createDocumentFragment();

  state.frames.forEach(function (f) {
    activeIds[f.id] = true;
    var lab = currentRows[f.id];

    if (!lab) {
      lab = document.createElement('label');
      lab.className = 'row';
      lab.id = 'row-' + f.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state.checked[f.id];
      cb.onchange = function () {
        toggle(f.id, cb.checked);
      };

      var th = document.createElement('div');
      th.className = 'thumb';
      th.id = 'th-' + f.id;
      if (state.thumbs[f.id]) {
        var img = document.createElement('img');
        img.src = state.thumbs[f.id];
        img.alt = '';
        th.appendChild(img);
      } else {
        var icon = document.createElement('span');
        icon.className = 'th-ph';
        icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="1.5" width="11" height="11" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 9.5L4.5 6.5L8 10L10 8L12.5 10.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        th.appendChild(icon);
      }

      var m = document.createElement('span');
      m.className = 'm';
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = f.name;
      var s = document.createElement('span');
      s.className = 's';
      s.textContent = (f.page || '') + fmtWH(f);
      m.appendChild(n);
      m.appendChild(s);

      var st = document.createElement('span');
      st.className = 'st';
      st.id = 'st-' + f.id;
      st.textContent = state.checked[f.id] ? 'Selected' : '';

      lab.appendChild(cb);
      lab.appendChild(th);
      lab.appendChild(m);
      lab.appendChild(st);

      frag.appendChild(lab);
      observeRow(lab, f.id);
    } else {
      var cbExisting = lab.querySelector('input[type="checkbox"]');
      if (cbExisting && cbExisting.checked !== !!state.checked[f.id]) {
        cbExisting.checked = !!state.checked[f.id];
      }
      var nExisting = lab.querySelector('.n');
      if (nExisting && nExisting.textContent !== f.name) {
        nExisting.textContent = f.name;
      }
      var sExisting = lab.querySelector('.s');
      var sVal = (f.page || '') + fmtWH(f);
      if (sExisting && sExisting.textContent !== sVal) {
        sExisting.textContent = sVal;
      }
      var stExisting = document.getElementById('st-' + f.id);
      if (stExisting) {
        stExisting.textContent = state.checked[f.id] ? 'Selected' : '';
      }
      var thExisting = document.getElementById('th-' + f.id);
      if (thExisting && state.thumbs[f.id] && !thExisting.querySelector('img')) {
        thExisting.innerHTML = '';
        var thImg = document.createElement('img');
        thImg.src = state.thumbs[f.id];
        thImg.alt = '';
        thExisting.appendChild(thImg);
      }
      frag.appendChild(lab);
      observeRow(lab, f.id);
    }
  });

  for (var rId in currentRows) {
    if (!activeIds[rId]) {
      if (thumbObserver) thumbObserver.unobserve(currentRows[rId]);
      currentRows[rId].remove();
    }
  }

  list.appendChild(frag);
  updateSelectionHeader();
}

function toggle(id, on) {
  if (on && !state.checked[id]) {
    state.checked[id] = true;
    state.order.push(id);
  }
  if (!on && state.checked[id]) {
    delete state.checked[id];
    state.order = state.order.filter(function (x) {
      return x !== id;
    });
  }
  var row = document.getElementById('row-' + id);
  if (row) {
    var cb = row.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = !!state.checked[id];
  }
  var st = document.getElementById('st-' + id);
  if (st) st.textContent = state.checked[id] ? 'Selected' : '';
  updateSelectionHeader();
}

function renderSettings() {
  var htmlBtn = $('btnFmtHtml');
  if (htmlBtn) htmlBtn.hidden = false;

  var btns = document.querySelectorAll('#fmtSeg button');
  for (var i = 0; i < btns.length; i++) {
    btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-fmt') === state.format ? 'true' : 'false');
  }
  var sb = document.querySelectorAll('#scaleRow button');
  for (var j = 0; j < sb.length; j++) {
    var attr = sb[j].getAttribute('data-scale');
    var isSel = (attr === 'none' && state.scale === 'none') || (parseFloat(attr) === state.scale);
    sb[j].setAttribute('aria-pressed', isSel ? 'true' : 'false');
  }
  var raster = state.format === 'PNG' || state.format === 'JPG';
  $('qualityGroup').hidden = !raster;
  $('pdfGroup').hidden = state.format !== 'PDF';
  var hg = $('htmlGroup');
  if (hg) hg.hidden = state.format !== 'HTML';

  var hr = document.querySelectorAll('input[name="htmlmode"]');
  for (var h = 0; h < hr.length; h++) {
    hr[h].checked = hr[h].value === state.html;
  }

  if (state.format === 'HTML') {
    if (state.html === 'bundle') $('btnExport').textContent = selCount() === 1 ? 'Export Web Bundle (.zip)' : 'Export ' + selCount() + ' Web Bundles (.zip)';
    else $('btnExport').textContent = selCount() === 1 ? 'Export 1 HTML file' : 'Export ' + selCount() + ' HTML files (.zip)';
  } else if (state.format === 'PDF' && state.pdf === 'single') {
    $('btnExport').textContent = 'Export 1 PDF';
  } else {
    $('btnExport').textContent = 'Export ' + selCount() + (selCount() === 1 ? ' file' : ' files');
  }
  $('btnExport').disabled = selCount() === 0;
}

function show(which) {
  ['screenSelect', 'screenSettings', 'screenProgress'].forEach(function (id) {
    $(id).hidden = id !== which;
  });
  $('footSelect').hidden = which !== 'screenSelect';
  $('footSettings').hidden = which !== 'screenSettings';
  $('footDone').hidden = which !== 'screenProgress';
  var nb = $('btnNavBack');
  if (nb) nb.hidden = which !== 'screenSettings';
  var logo = $('brandLogo');
  if (logo) logo.hidden = which === 'screenSettings';
}
