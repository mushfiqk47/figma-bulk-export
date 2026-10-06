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
}

function requestThumbnails() {
  if (!inFigma) return;
  var need = [];
  state.frames.forEach(function (f) {
    if (!state.thumbs[f.id]) need.push(f.id);
  });
  if (need.length > 0) {
    send({ type: 'get-thumbnails', ids: need });
  }
}
