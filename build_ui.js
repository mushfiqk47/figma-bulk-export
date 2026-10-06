const fs = require('fs');
const head = fs.readFileSync('src/part_head.html', 'utf8');
const body = fs.readFileSync('src/part_body.html', 'utf8');
const p1 = fs.readFileSync('src/app_p1.js', 'utf8');
const p2 = fs.readFileSync('src/app_p2.js', 'utf8');
const p3 = fs.readFileSync('src/app_p3.js', 'utf8');
const p4a = fs.readFileSync('src/app_p4a.js', 'utf8');
const p4b = fs.readFileSync('src/app_p4b.js', 'utf8');
const jszip = fs.readFileSync('vendor/jszip.min.js', 'utf8');
const pdflib = fs.readFileSync('vendor/pdf-lib.min.js', 'utf8');
const app = [p1, p2, p3, p4a, p4b].join('\n');
const html = head + body
  + '<script>\n/* JSZip 3.10.1 (MIT) + pdf-lib 1.17.1 (MIT), inlined for offline use. */\n'
  + jszip + '\n</script>\n<script>\n' + pdflib + '\n</script>\n<script>\n' + app + '\n</script>\n</body>\n</html>\n';
fs.writeFileSync('ui.html', html);
console.log('ui.html bytes=' + Buffer.byteLength(html));
