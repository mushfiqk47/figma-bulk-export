const fs = require('fs');
const path = require('path');

function read(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath), 'utf8');
}

const head = read('src/ui/templates/head.html');
const themeCss = read('src/ui/styles/theme.css');
const mainCss = read('src/ui/styles/main.css');
const body = read('src/ui/templates/body.html');

const jsModules = [
  'src/ui/js/state.js',
  'src/ui/js/thumbnails.js',
  'src/ui/js/ui-renderer.js',
  'src/ui/js/exporter.js',
  'src/ui/js/packaging.js',
  'src/ui/js/pdf-merger.js',
  'src/ui/js/main.js'
].map(read).join('\n\n');

const jszip = read('vendor/jszip.min.js');
const pdflib = read('vendor/pdf-lib.min.js');

const html = head + '\n<style>\n'
  + themeCss + '\n'
  + mainCss + '\n</style>\n</head>\n<body>\n'
  + body + '\n'
  + '<script>\n/* JSZip 3.10.1 (MIT) + pdf-lib 1.17.1 (MIT), inlined for offline use. */\n'
  + jszip + '\n</script>\n<script>\n'
  + pdflib + '\n</script>\n<script>\n(function(){\n\'use strict\';\n\n'
  + jsModules + '\n\n})();\n</script>\n</body>\n</html>\n';

fs.writeFileSync(path.join(__dirname, 'ui.html'), html);
console.log('ui.html bytes=' + Buffer.byteLength(html));
