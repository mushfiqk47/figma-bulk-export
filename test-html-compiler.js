// One runnable check for the sandbox HTML compiler. No framework.
// Run: node test-html-compiler.js
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var src = fs.readFileSync(path.join(__dirname, 'code.js'), 'utf8');

var tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function T(type, name, extra) {
  var o = Object.assign(
    { type: type, name: name, visible: true, width: 100, height: 40, x: 0, y: 0, children: [] },
    extra || {}
  );
  o.exportAsync = async function (s) {
    if (s && s.format === 'SVG') {
      if (name === 'bad-vector') return new Uint8Array(tinyPng);
      return new TextEncoder().encode('<svg width="50" height="50"><rect width="100%" height="100%"/></svg>');
    }
    return new Uint8Array(tinyPng);
  };
  return o;
}

var sandbox = {
  __html__: '', TextEncoder: TextEncoder, TextDecoder: TextDecoder, Uint8Array: Uint8Array,
  setTimeout: setTimeout, clearTimeout: clearTimeout, Promise: Promise, console: console,
  figma: {
    showUI: function () {}, on: function () {},
    ui: { postMessage: function () {} },
    currentPage: { selection: [], name: 'Page 1' },
    getImageByHash: function () { return { getBytesAsync: async function () { return new Uint8Array(tinyPng); } }; }
  }
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

function check(cond, msg) {
  if (!cond) { console.error('FAIL: ' + msg); process.exit(1); }
  console.log('ok: ' + msg);
}

(async function () {
  // 1 + 3: vector PNG fallback never leaks binary, and needs no duplicate width attr
  var root = T('FRAME', 'P', { width: 1200, height: 800, layoutMode: 'VERTICAL', fills: [], children: [
    T('VECTOR', 'bad-vector', { width: 50, height: 50 }),
    T('FRAME', 'cta row', { width: 300, height: 60, children: [
      T('TEXT', 'l', { width: 100, height: 20, characters: 'Go', fontSize: 14,
        fontName: { family: 'Inter', style: 'Regular' }, fills: [], textAutoResize: 'WIDTH_AND_HEIGHT' })
    ] })
  ]});
  var out = await sandbox.compileNodeToRealHtml(root);
  check(out.bodyHtml.indexOf('�PNG') < 0, 'no binary leak in body');
  check(out.bodyHtml.indexOf('.png') >= 0, 'bad vector falls back to png');
  check(out.bodyHtml.indexOf('<div class="cta-row') >= 0, 'cta container stays div, not button');

  // % SVG keeps its single width attribute
  var svg = sandbox.prepareInlineSvg('<svg width="100%" height="50"></svg>', 'x', 50, 50);
  check((svg.match(/width="/g) || []).length === 1, 'no duplicate width on % svg');

  // 7-adjacent: rotation merges with CENTER translate into one transform
  var st = sandbox.getNodeLayoutStyles(
    { width: 160, height: 48, rotation: 45,
      constraints: { horizontal: 'CENTER', vertical: 'CENTER' },
      relativeTransform: [[1, 0, 100], [0, 1, 220]] },
    false, false, null, { width: 1200, height: 500 });
  var transforms = st.filter(function (s) { return s.indexOf('transform:') === 0; });
  check(transforms.length === 1 && transforms[0].indexOf('translate') >= 0 && transforms[0].indexOf('rotate') >= 0,
    'single merged transform: ' + transforms.join(''));

  console.log('ALL_HTML_CHECKS_PASS');
})().catch(function (e) { console.error('HARNESS FAIL:', e); process.exit(1); });
