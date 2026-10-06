var inFigma = typeof parent !== 'undefined' && parent !== window;

function send(m) {
  try {
    parent.postMessage({ pluginMessage: m }, '*');
  } catch (e) {}
}

var $ = function (id) {
  return document.getElementById(id);
};

var state = {
  frames: [],
  checked: {},
  order: [],
  thumbs: {},
  format: 'PNG',
  scale: 2,
  pdf: 'single',
  running: false,
  finished: false,
  expected: 0,
  got: 0,
  files: [],
  fails: [],
  skipped: 0,
  pendingFrames: null
};

var DEMO = [
  { id: 'd1', name: 'Landing hero', width: 1440, height: 900, page: 'Page 1' },
  { id: 'd2', name: 'Pricing cards', width: 1200, height: 800, page: 'Page 1' },
  { id: 'd3', name: 'Mobile / home', width: 390, height: 844, page: 'Page 1' }
];

function fmtWH(f) {
  return (f.width && f.height) ? (' · ' + f.width + ' × ' + f.height) : '';
}

function selCount() {
  return state.order.length;
}

function effScale() {
  if (state.format !== 'PNG' && state.format !== 'JPG') return 1;
  if (state.scale === 'none') return 1;
  return Number(state.scale) || 1;
}

function ext() {
  return state.format === 'JPG' ? 'jpg' : state.format === 'PNG' ? 'png' : state.format === 'SVG' ? 'svg' : 'pdf';
}

function sanitize(n) {
  var s = String(n || 'Untitled').trim() || 'Untitled';
  s = s.replace(/[\\/:*?"<>|]/g, '-');
  s = s.replace(/\s+/g, ' ').trim();
  return s.slice(0, 100) || 'Untitled';
}

function suffix() {
  if (state.format !== 'PNG' && state.format !== 'JPG') return '';
  if (state.scale === 'none') return '';
  var s = effScale();
  return s !== 1 ? ('@' + s + 'x') : '';
}

function planFiles() {
  var used = {};
  var out = [];
  for (var i = 0; i < state.order.length; i++) {
    var id = state.order[i];
    var f = null;
    for (var k = 0; k < state.frames.length; k++) {
      if (state.frames[k].id === id) {
        f = state.frames[k];
        break;
      }
    }
    var base = sanitize(f ? f.name : 'Frame') + suffix() + '.' + ext();
    if (used[base] === undefined) {
      used[base] = 1;
      out.push({ id: id, file: base });
    } else {
      used[base]++;
      var dot = base.lastIndexOf('.');
      out.push({ id: id, file: base.slice(0, dot) + '-' + used[base] + base.slice(dot) });
    }
  }
  return out;
}
