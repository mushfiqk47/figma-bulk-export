var thumbObserver = null;
var pendingThumbIds = {};

function initThumbObserver() {
  if (typeof IntersectionObserver === 'undefined') return;
  if (thumbObserver) {
    thumbObserver.disconnect();
  }
  var scrollContainer = $('frameList') ? $('frameList').parentElement : null;
  thumbObserver = new IntersectionObserver(function (entries) {
    var toRequest = [];
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var id = entry.target.getAttribute('data-frame-id');
        if (id && !state.thumbs[id] && !pendingThumbIds[id]) {
          pendingThumbIds[id] = true;
          toRequest.push(id);
        }
        if (id && state.thumbs[id]) {
          thumbObserver.unobserve(entry.target);
        }
      }
    });
    if (toRequest.length > 0 && inFigma) {
      send({ type: 'get-thumbnails', ids: toRequest });
    }
  }, {
    root: scrollContainer,
    rootMargin: '120px 0px 120px 0px'
  });
}

function observeRow(rowEl, frameId) {
  if (!rowEl || !frameId) return;
  rowEl.setAttribute('data-frame-id', frameId);
  if (state.thumbs[frameId]) return;
  if (thumbObserver) {
    thumbObserver.observe(rowEl);
  } else {
    requestThumbnails();
  }
}

function revokeThumbUrls() {
  if (!state.thumbs) return;
  for (var k in state.thumbs) {
    if (state.thumbs.hasOwnProperty(k) && state.thumbs[k]) {
      try {
        URL.revokeObjectURL(state.thumbs[k]);
      } catch (e) {}
    }
  }
  state.thumbs = {};
  pendingThumbIds = {};
}

function requestThumbnails() {
  if (!inFigma) return;
  var need = [];
  state.frames.forEach(function (f) {
    if (!state.thumbs[f.id] && !pendingThumbIds[f.id]) {
      pendingThumbIds[f.id] = true;
      need.push(f.id);
    }
  });
  if (need.length > 0) {
    send({ type: 'get-thumbnails', ids: need });
  }
}

