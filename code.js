figma.showUI(__html__, { width: 420, height: 440, themeColors: true });

var CONTAINER_TYPES = {
  FRAME: true,
  COMPONENT: true,
  COMPONENT_SET: true,
  INSTANCE: true,
  SECTION: true,
  GROUP: true
};

function getExportableNode(n) {
  if (!n) return null;
  // If node itself is an exportable frame/container type
  if (CONTAINER_TYPES[n.type]) {
    return n;
  }
  // If user selected a child layer inside a frame/container, climb up to find the enclosing frame
  var curr = n.parent;
  while (curr && curr.type !== 'PAGE' && curr.type !== 'DOCUMENT') {
    if (CONTAINER_TYPES[curr.type]) {
      return curr;
    }
    curr = curr.parent;
  }
  // Standalone vector/shape/layer capable of direct export
  if (typeof n.exportAsync === 'function' && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
    return n;
  }
  return null;
}

function canvasSelection() {
  try { return figma.currentPage.selection || []; } catch (e) { return []; }
}

function selectedDetails(sel) {
  var out = [];
  var seen = {};
  var list = sel || canvasSelection();
  var pg = '';
  try { pg = figma.currentPage ? figma.currentPage.name : ''; } catch (e) {}

  for (var i = 0; i < list.length; i++) {
    var target = getExportableNode(list[i]);
    if (target && !seen[target.id]) {
      seen[target.id] = true;
      var w = 0, h = 0;
      try { w = Math.round(target.width || 0); h = Math.round(target.height || 0); } catch (e) {}
      var nm = 'Untitled';
      try { nm = String(target.name || 'Untitled'); } catch (e) {}
      out.push({ id: target.id, name: nm, width: w, height: h, page: pg });
    }
  }
  return out;
}

function postFrames() {
  var sel = canvasSelection();
  var details = selectedDetails(sel);
  figma.ui.postMessage({
    type: 'frames',
    selected: details.map(function (d) { return d.id; }),
    selectedFrames: details,
    skipped: Math.max(0, sel.length - details.length)
  });
}

// Debounce rapid canvas selection updates (e.g. marquee drag selection)
var selectionTimer = null;
function schedulePostFrames() {
  if (selectionTimer) return;
  selectionTimer = setTimeout(function () {
    selectionTimer = null;
    postFrames();
  }, 16);
}

figma.on('selectionchange', schedulePostFrames);
figma.on('currentpagechange', schedulePostFrames);

// dynamic-page disallows documentchange without loadAllPagesAsync.
// selectionchange and currentpagechange handle active canvas state.

function buildSettings(format, scale) {
  var s = Number(scale) || 1;
  if (format === 'PNG') {
    return { format: 'PNG', constraint: { type: 'SCALE', value: s } };
  }
  if (format === 'JPG') {
    return { format: 'JPG', constraint: { type: 'SCALE', value: s } };
  }
  if (format === 'SVG') {
    return { format: 'SVG' };
  }
  return { format: 'PDF' };
}

// ==========================================
// REAL FIGMA-TO-DOM & CSS COMPILER (PATH 1)
// ==========================================

function uint8ToBase64(u8) {
  if (!u8 || u8.length === 0) return '';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var len = u8.length;
  var extra = len % 3;
  var mainLen = len - extra;
  var parts = [];

  for (var i = 0; i < mainLen; i += 3) {
    var chunk = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2];
    parts.push(
      chars[(chunk >> 18) & 63] +
      chars[(chunk >> 12) & 63] +
      chars[(chunk >> 6) & 63] +
      chars[chunk & 63]
    );
  }

  if (extra === 1) {
    var chunk = u8[mainLen];
    parts.push(chars[(chunk >> 2) & 63] + chars[(chunk << 4) & 63] + '==');
  } else if (extra === 2) {
    var chunk = (u8[mainLen] << 8) | u8[mainLen + 1];
    parts.push(chars[(chunk >> 10) & 63] + chars[(chunk >> 4) & 63] + chars[(chunk << 2) & 63] + '=');
  }

  return parts.join('');
}

function parseFigmaColor(c, a) {
  if (!c) return 'transparent';
  var r = Math.round((c.r || 0) * 255);
  var g = Math.round((c.g || 0) * 255);
  var b = Math.round((c.b || 0) * 255);
  var opacity = typeof a === 'number' ? Math.round(a * 100) / 100 : 1;
  return opacity < 1 ? 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')' : 'rgb(' + r + ', ' + g + ', ' + b + ')';
}

function findImageFill(fills) {
  if (!Array.isArray(fills)) return null;
  for (var i = fills.length - 1; i >= 0; i--) {
    var f = fills[i];
    if (f && f.visible !== false && f.type === 'IMAGE') return f;
  }
  return null;
}

function parseFills(fills) {
  if (!Array.isArray(fills) || fills.length === 0) return null;
  for (var i = fills.length - 1; i >= 0; i--) {
    var f = fills[i];
    if (!f || f.visible === false) continue;
    if (f.type === 'SOLID') {
      return { type: 'color', value: parseFigmaColor(f.color, f.opacity) };
    }
    if (f.type === 'GRADIENT_LINEAR') {
      var stops = (f.gradientStops || []).map(function (s) {
        return parseFigmaColor(s.color, s.color.a) + ' ' + Math.round((s.position || 0) * 100) + '%';
      }).join(', ');
      return { type: 'gradient', value: 'linear-gradient(180deg, ' + stops + ')' };
    }
  }
  return null;
}

function sanitizeClassName(name, defaultName) {
  var s = String(name || defaultName || 'layer')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!s || /^[0-9]/.test(s)) s = (defaultName || 'el') + '-' + s;
  return s.slice(0, 32) || 'el';
}

function determineTagName(node) {
  var name = (node.name || '').toLowerCase();
  if (node.type === 'TEXT') {
    var size = node.fontSize || 16;
    if (size >= 32) return 'h1';
    if (size >= 24) return 'h2';
    if (size >= 20) return 'h3';
    if (size >= 16 && (name.includes('title') || name.includes('heading'))) return 'h4';
    if (name.includes('label') || name.includes('badge')) return 'span';
    return 'p';
  }
  // Only leaf nodes become <button>: a container named e.g. "cta row" wrapping
  // divs/headings would emit <button><div>, which browsers auto-close and
  // repair, exploding the layout. Containers stay <div>.
  var hasKids = Array.isArray(node.children) && node.children.length > 0;
  if (!hasKids && (name.includes('button') || name.includes('btn') || name.includes('cta'))) return 'button';
  if (name.includes('header') || name.includes('navbar')) return 'header';
  if (name.includes('nav') || name.includes('menu')) return 'nav';
  if (name.includes('footer')) return 'footer';
  if (name.includes('section')) return 'section';
  if (name.includes('aside') || name.includes('sidebar')) return 'aside';
  if (name.includes('card') || name.includes('item')) return 'article';
  return 'div';
}

function escapeHtmlAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prepareInlineSvg(rawSvg, cls, w, h) {
  if (!rawSvg) return '';
  var s = String(rawSvg)
    .replace(/<\?xml[\s\S]*?\?>/i, '')
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .trim();

  var svgIdx = s.indexOf('<svg');
  if (svgIdx >= 0) {
    s = s.substring(svgIdx);
  }

  // Ensure xmlns is present
  if (!s.includes('xmlns="http://www.w3.org/2000/svg"')) {
    s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Ensure width and height attributes exist for crisp scaling
  if (!/width=["'][0-9]+(\.[0-9]+)?(px)?["']/.test(s) && w > 0) {
    s = s.replace('<svg', '<svg width="' + w + '"');
  }
  if (!/height=["'][0-9]+(\.[0-9]+)?(px)?["']/.test(s) && h > 0) {
    s = s.replace('<svg', '<svg height="' + h + '"');
  }

  // Ensure viewBox exists for proportional scaling
  if (!s.includes('viewBox=') && w > 0 && h > 0) {
    s = s.replace('<svg', '<svg viewBox="0 0 ' + w + ' ' + h + '"');
  }

  // Inject or merge class
  if (s.includes('class="')) {
    s = s.replace('class="', 'class="' + cls + ' ');
  } else {
    s = s.replace('<svg', '<svg class="' + cls + '"');
  }

  return s;
}

function getRelativePos(n) {
  if (n.relativeTransform && Array.isArray(n.relativeTransform) && n.relativeTransform.length >= 2) {
    return {
      x: Math.round(n.relativeTransform[0][2] || 0),
      y: Math.round(n.relativeTransform[1][2] || 0)
    };
  }
  return { x: Math.round(n.x || 0), y: Math.round(n.y || 0) };
}

function getConstraintStyles(n, parentW, parentH) {
  var styles = [];
  var c = n.constraints;
  if (!c) return styles;
  var pos = getRelativePos(n);
  var w = Math.round(n.width || 0);
  var h = Math.round(n.height || 0);

  if (c.horizontal === 'MAX') {
    var right = parentW - pos.x - w;
    styles.push('right: ' + Math.max(0, right) + 'px;');
    styles.push('left: auto;');
  } else if (c.horizontal === 'CENTER') {
    var cx = pos.x + w / 2;
    var offsetPct = (cx / parentW) * 100;
    styles.push('left: ' + offsetPct.toFixed(1) + '%;');
    styles.push('transform: translateX(-50%);');
  } else if (c.horizontal === 'STRETCH') {
    var right = parentW - pos.x - w;
    styles.push('left: ' + pos.x + 'px;');
    styles.push('right: ' + Math.max(0, right) + 'px;');
    styles.push('width: auto;');
  } else if (c.horizontal === 'SCALE' && parentW > 0) {
    styles.push('left: ' + ((pos.x / parentW) * 100).toFixed(2) + '%;');
    styles.push('width: ' + ((w / parentW) * 100).toFixed(2) + '%;');
  } else {
    styles.push('left: ' + pos.x + 'px;');
  }

  if (c.vertical === 'MAX') {
    var bottom = parentH - pos.y - h;
    styles.push('bottom: ' + Math.max(0, bottom) + 'px;');
    styles.push('top: auto;');
  } else if (c.vertical === 'CENTER') {
    var cy = pos.y + h / 2;
    var offsetPct = (cy / parentH) * 100;
    styles.push('top: ' + offsetPct.toFixed(1) + '%;');
    var hasTx = styles.some(function (s) { return s.includes('translateX'); });
    if (hasTx) {
      for (var si = 0; si < styles.length; si++) {
        if (styles[si].includes('translateX(-50%)')) {
          styles[si] = 'transform: translate(-50%, -50%);';
        }
      }
    } else {
      styles.push('transform: translateY(-50%);');
    }
  } else if (c.vertical === 'STRETCH') {
    var bottom = parentH - pos.y - h;
    styles.push('top: ' + pos.y + 'px;');
    styles.push('bottom: ' + Math.max(0, bottom) + 'px;');
    styles.push('height: auto;');
  } else if (c.vertical === 'SCALE' && parentH > 0) {
    styles.push('top: ' + ((pos.y / parentH) * 100).toFixed(2) + '%;');
    styles.push('height: ' + ((h / parentH) * 100).toFixed(2) + '%;');
  } else {
    styles.push('top: ' + pos.y + 'px;');
  }

  return styles;
}

function getNodeLayoutStyles(n, isRoot, parentHasAutoLayout, parentLayoutMode, parentNode) {
  var styles = [];
  var isAbsolute = (n.layoutPositioning === 'ABSOLUTE') || (!isRoot && !parentHasAutoLayout);

  var w = Math.round(n.width || 0);
  var h = Math.round(n.height || 0);

  if (isAbsolute && !isRoot) {
    styles.push('position: absolute;');
    var parentW = parentNode ? Math.round(parentNode.width || 0) : 0;
    var parentH = parentNode ? Math.round(parentNode.height || 0) : 0;

    if (n.constraints && parentW > 0 && parentH > 0) {
      var cStyles = getConstraintStyles(n, parentW, parentH);
      for (var ci = 0; ci < cStyles.length; ci++) {
        styles.push(cStyles[ci]);
      }
    } else {
      var pos = getRelativePos(n);
      styles.push('left: ' + pos.x + 'px;');
      styles.push('top: ' + pos.y + 'px;');
    }
  }

  if (isRoot) {
    styles.push('width: 100%;');
    styles.push('max-width: ' + (w || 1200) + 'px;');
    styles.push('margin-inline: auto;');
    if (h > 0) {
      styles.push('min-height: ' + h + 'px;');
    } else {
      styles.push('min-height: 100vh;');
    }
    styles.push('position: relative;');
    styles.push('overflow-x: hidden;');
    styles.push('overflow-y: visible;');
    return styles;
  }

  // Width / Horizontal sizing
  var isHugH = (n.layoutSizingHorizontal === 'HUG') || (n.type === 'TEXT' && n.textAutoResize === 'WIDTH_AND_HEIGHT');
  var isFillH = (n.layoutSizingHorizontal === 'FILL');

  if (isFillH) {
    if (isAbsolute) {
      styles.push('width: ' + w + 'px;');
    } else {
      styles.push('width: 100%;');
      if (parentLayoutMode === 'HORIZONTAL') {
        styles.push('flex: 1;');
        styles.push('min-width: 0;');
      } else if (parentLayoutMode === 'VERTICAL') {
        styles.push('align-self: stretch;');
      }
    }
  } else if (isHugH) {
    if (parentHasAutoLayout && parentLayoutMode === 'HORIZONTAL') {
      styles.push('flex-shrink: 0;');
    }
    if (Array.isArray(n.children) && n.children.length > 0) {
      styles.push('width: fit-content;');
    }
  } else {
    // FIXED / Default fixed dimension from Figma node
    if (w > 0 && !styles.some(function (s) { return s.startsWith('width:'); })) {
      styles.push('width: ' + w + 'px;');
      if (parentHasAutoLayout && parentLayoutMode === 'HORIZONTAL' && !isAbsolute) {
        styles.push('flex-shrink: 0;');
      }
    }
  }

  // Height / Vertical sizing
  var isHugV = (n.layoutSizingVertical === 'HUG') || (n.type === 'TEXT' && (n.textAutoResize === 'WIDTH_AND_HEIGHT' || n.textAutoResize === 'HEIGHT'));
  var isFillV = (n.layoutSizingVertical === 'FILL');

  if (isFillV) {
    if (isAbsolute) {
      styles.push('height: ' + h + 'px;');
    } else {
      styles.push('height: 100%;');
      if (parentLayoutMode === 'VERTICAL') {
        styles.push('flex: 1;');
        styles.push('min-height: 0;');
      } else if (parentLayoutMode === 'HORIZONTAL') {
        styles.push('align-self: stretch;');
      }
    }
  } else if (isHugV) {
    if (parentHasAutoLayout && parentLayoutMode === 'VERTICAL') {
      styles.push('flex-shrink: 0;');
    }
  } else {
    // FIXED / Default fixed dimension from Figma node
    if (h > 0 && !styles.some(function (s) { return s.startsWith('height:'); })) {
      if (Array.isArray(n.children) && n.children.length > 0 && !isAbsolute) {
        styles.push('min-height: ' + h + 'px;');
      } else {
        styles.push('height: ' + h + 'px;');
      }
      if (parentHasAutoLayout && parentLayoutMode === 'VERTICAL' && !isAbsolute) {
        styles.push('flex-shrink: 0;');
      }
    }
  }

  // Alignment within parent auto-layout
  if (n.layoutAlign === 'STRETCH') {
    styles.push('align-self: stretch;');
    if (parentLayoutMode === 'VERTICAL') {
      styles.push('width: 100%;');
    } else if (parentLayoutMode === 'HORIZONTAL') {
      styles.push('height: 100%;');
    }
  }
  if (typeof n.layoutGrow === 'number' && n.layoutGrow > 0) {
    styles.push('flex-grow: ' + n.layoutGrow + ';');
  }

  // Opacity
  if (typeof n.opacity === 'number' && n.opacity < 1 && n.opacity >= 0) {
    styles.push('opacity: ' + (Math.round(n.opacity * 100) / 100) + ';');
  }

  // Rotation: merge with any existing transform (e.g. CENTER constraint
  // translate). A second 'transform:' property would silently overwrite the
  // first in CSS, dropping the centering and shifting layout.
  if (typeof n.rotation === 'number' && Math.abs(n.rotation) > 0.1) {
    var rot = 'rotate(' + (-n.rotation).toFixed(1) + 'deg)';
    var merged = false;
    for (var ri = 0; ri < styles.length; ri++) {
      if (styles[ri].indexOf('transform:') === 0) {
        styles[ri] = styles[ri].replace(/;\s*$/, '') + ' ' + rot + ';';
        merged = true;
        break;
      }
    }
    if (!merged) styles.push('transform: ' + rot + ';');
  }

  return styles;
}

async function compileNodeToRealHtml(rootNode) {
  var cssRules = [];
  var assets = [];
  var usedClasses = {};
  var assetCounter = 1;

  function getUniqueClass(name, defaultPrefix) {
    var base = sanitizeClassName(name, defaultPrefix);
    if (!usedClasses[base]) {
      usedClasses[base] = 1;
      return base;
    }
    usedClasses[base]++;
    return base + '-' + usedClasses[base];
  }

  function hasAnyText(node) {
    if (node.type === 'TEXT') return true;
    if (Array.isArray(node.children)) {
      return node.children.some(hasAnyText);
    }
    return false;
  }

  async function walk(n, isRoot, parentHasAutoLayout, parentLayoutMode, parentNode) {
    if (!n || n.visible === false) return '';

    // Vector shapes / icons
    var isVectorType = (
      n.type === 'VECTOR' ||
      n.type === 'BOOLEAN_OPERATION' ||
      n.type === 'STAR' ||
      n.type === 'LINE' ||
      n.type === 'POLYGON' ||
      ((n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE' || n.type === 'GROUP') &&
       Math.max(n.width || 0, n.height || 0) <= 64 &&
       (!Array.isArray(n.children) || n.children.length <= 4) &&
       (String(n.name || '').toLowerCase().includes('icon') || String(n.name || '').toLowerCase().includes('logo') || String(n.name || '').toLowerCase().includes('ic_') || !hasAnyText(n)))
    );

    if (isVectorType && !isRoot) {
      var cls = getUniqueClass(n.name, 'icon');
      var assetFilename = 'assets/' + cls + '-' + assetCounter + '.svg';
      assetCounter++;
      var svgBytes = new Uint8Array(0);
      var svgText = '';
      try {
        if (typeof n.exportAsync === 'function') {
          var sOut = await n.exportAsync({ format: 'SVG' });
          if (typeof sOut === 'string') {
            svgText = sOut;
            svgBytes = new TextEncoder().encode(sOut);
          } else {
            svgBytes = sOut;
            svgText = new TextDecoder('utf-8').decode(sOut);
          }
        }
      } catch (e) {
        svgBytes = new Uint8Array(0);
        svgText = '';
      }
      // Validate: exportAsync can return binary (or throw-and-leave-garbage)
      // for nodes that fail SVG export. Inlining that as markup leaks raw
      // bytes into the page and breaks layout. Fall back to PNG instead.
      if (svgText.indexOf('<svg') < 0) {
        svgText = '';
        try {
          var pOut = await n.exportAsync({ format: 'PNG' });
          svgBytes = (typeof pOut === 'string') ? new TextEncoder().encode(pOut) : (pOut || new Uint8Array(0));
        } catch (e) {
          svgBytes = new Uint8Array(0);
        }
        assetFilename = assetFilename.replace(/\.svg$/, '.png');
      }
      var isSvgOk = svgText.indexOf('<svg') >= 0;
      var svgB64 = uint8ToBase64(svgBytes);
      var svgDataUri = 'data:' + (isSvgOk ? 'image/svg+xml' : 'image/png') + ';base64,' + svgB64;
      assets.push({
        path: assetFilename,
        name: cls,
        isSvg: isSvgOk,
        mime: isSvgOk ? 'image/svg+xml' : 'image/png',
        bytes: svgBytes,
        base64: svgB64,
        dataUri: svgDataUri,
        svgText: svgText
      });

      var w = Math.round(n.width || 24);
      var h = Math.round(n.height || 24);
      var iconStyles = getNodeLayoutStyles(n, false, parentHasAutoLayout, parentLayoutMode, parentNode);
      iconStyles.push('display: inline-block;');
      if (!iconStyles.some(function (s) { return s.startsWith('flex-shrink:'); })) {
        iconStyles.push('flex-shrink: 0;');
      }
      if (!iconStyles.some(function (s) { return s.startsWith('width:'); })) {
        iconStyles.push('width: ' + w + 'px;');
      }
      if (!iconStyles.some(function (s) { return s.startsWith('height:'); })) {
        iconStyles.push('height: ' + h + 'px;');
      }
      iconStyles.push('vertical-align: middle;');
      cssRules.push('.' + cls + ' {\n  ' + iconStyles.join('\n  ') + '\n}');
      if (svgText) {
        return prepareInlineSvg(svgText, cls, w, h);
      }
      return '<img src="' + assetFilename + '" class="' + cls + '" alt="' + escapeHtmlAttr(n.name || 'Icon') + '" width="' + w + '" height="' + h + '">';
    }

    // Standalone shape nodes (RECTANGLE, ELLIPSE) without image fills → styled div
    if ((n.type === 'RECTANGLE' || n.type === 'ELLIPSE') && !isRoot) {
      var shapeFill = findImageFill(n.fills);
      if (!shapeFill) {
        var shapeCls = getUniqueClass(n.name, n.type === 'ELLIPSE' ? 'circle' : 'rect');
        var shapeStyles = getNodeLayoutStyles(n, false, parentHasAutoLayout, parentLayoutMode, parentNode);
        var sw = Math.round(n.width || 0);
        var sh = Math.round(n.height || 0);
        shapeStyles.push('display: block;');
        var sFill = parseFills(n.fills);
        if (sFill) {
          if (sFill.type === 'color') shapeStyles.push('background-color: ' + sFill.value + ';');
          else if (sFill.type === 'gradient') shapeStyles.push('background: ' + sFill.value + ';');
        }
        if (n.type === 'ELLIPSE') {
          shapeStyles.push('border-radius: 50%;');
        } else if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
          shapeStyles.push('border-radius: ' + Math.round(n.cornerRadius) + 'px;');
        } else if (n.topLeftRadius || n.topRightRadius || n.bottomLeftRadius || n.bottomRightRadius) {
          shapeStyles.push('border-radius: ' + Math.round(n.topLeftRadius || 0) + 'px ' + Math.round(n.topRightRadius || 0) + 'px ' + Math.round(n.bottomRightRadius || 0) + 'px ' + Math.round(n.bottomLeftRadius || 0) + 'px;');
        }
        if (Array.isArray(n.strokes) && n.strokes.length > 0) {
          var sst = n.strokes[0];
          if (sst && sst.visible !== false && sst.type === 'SOLID') {
            var ssw = typeof n.strokeWeight === 'number' ? Math.round(n.strokeWeight) : 1;
            shapeStyles.push('border: ' + ssw + 'px solid ' + parseFigmaColor(sst.color, sst.opacity) + ';');
          }
        }
        if (Array.isArray(n.effects) && n.effects.length > 0) {
          var sShadowList = [];
          for (var sef = 0; sef < n.effects.length; sef++) {
            var sefItem = n.effects[sef];
            if (sefItem && sefItem.visible !== false && sefItem.type === 'DROP_SHADOW') {
              sShadowList.push(Math.round(sefItem.offset.x) + 'px ' + Math.round(sefItem.offset.y) + 'px ' + Math.round(sefItem.radius) + 'px ' + parseFigmaColor(sefItem.color, sefItem.color.a));
            }
          }
          if (sShadowList.length > 0) shapeStyles.push('box-shadow: ' + sShadowList.join(', ') + ';');
        }
        cssRules.push('.' + shapeCls + ' {\n  ' + shapeStyles.join('\n  ') + '\n}');
        return '<div class="' + shapeCls + '" role="presentation"></div>';
      }
    }

    // Leaf Image (node with an image fill and no children)
    var imgFill = findImageFill(n.fills);
    var isLeafImage = imgFill && !isRoot && (!Array.isArray(n.children) || n.children.length === 0);

    if (isLeafImage) {
      var imgCls = getUniqueClass(n.name, 'img');
      var imgFilename = 'assets/' + imgCls + '-' + assetCounter + '.png';
      assetCounter++;
      var imgBytes = null;
      if (imgFill.imageHash && typeof figma !== 'undefined' && typeof figma.getImageByHash === 'function') {
        try {
          var imgObj = figma.getImageByHash(imgFill.imageHash);
          if (imgObj && typeof imgObj.getBytesAsync === 'function') {
            imgBytes = await imgObj.getBytesAsync();
          }
        } catch (e) {}
      }
      if (!imgBytes || imgBytes.length === 0) {
        if (typeof n.exportAsync === 'function') {
          try {
            var pOut = await n.exportAsync({ format: 'PNG' });
            if (typeof pOut === 'string') imgBytes = new TextEncoder().encode(pOut);
            else imgBytes = pOut;
          } catch (e) {}
        }
      }
      if (!imgBytes) imgBytes = new Uint8Array(0);

      var mime = (imgBytes.length > 3 && imgBytes[0] === 0xFF && imgBytes[1] === 0xD8 && imgBytes[2] === 0xFF) ? 'image/jpeg' : 'image/png';
      var imgB64 = uint8ToBase64(imgBytes);
      var imgDataUri = 'data:' + mime + ';base64,' + imgB64;

      assets.push({
        path: imgFilename,
        name: imgCls,
        isSvg: false,
        mime: mime,
        bytes: imgBytes,
        base64: imgB64,
        dataUri: imgDataUri
      });

      var iw = Math.round(n.width || 100);
      var ih = Math.round(n.height || 100);
      var imgStyles = getNodeLayoutStyles(n, false, parentHasAutoLayout, parentLayoutMode, parentNode);
      imgStyles.push('display: block;');
      imgStyles.push('object-fit: ' + (imgFill.scaleMode === 'FIT' ? 'contain' : 'cover') + ';');
      imgStyles.push('object-position: center;');
      if (!imgStyles.some(function (s) { return s.startsWith('width:'); })) {
        imgStyles.push('width: ' + iw + 'px;');
      }
      if (!imgStyles.some(function (s) { return s.startsWith('height:'); })) {
        imgStyles.push('height: ' + ih + 'px;');
      }

      if (n.type === 'ELLIPSE') {
        imgStyles.push('border-radius: 50%;');
      } else if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
        imgStyles.push('border-radius: ' + Math.round(n.cornerRadius) + 'px;');
      } else if (n.topLeftRadius || n.topRightRadius || n.bottomLeftRadius || n.bottomRightRadius) {
        imgStyles.push('border-radius: ' + Math.round(n.topLeftRadius || 0) + 'px ' + Math.round(n.topRightRadius || 0) + 'px ' + Math.round(n.bottomRightRadius || 0) + 'px ' + Math.round(n.bottomLeftRadius || 0) + 'px;');
      }

      if (Array.isArray(n.strokes) && n.strokes.length > 0) {
        var st = n.strokes[0];
        if (st && st.visible !== false && st.type === 'SOLID') {
          var sw = typeof n.strokeWeight === 'number' ? Math.round(n.strokeWeight) : 1;
          imgStyles.push('border: ' + sw + 'px solid ' + parseFigmaColor(st.color, st.opacity) + ';');
        }
      }

      if (Array.isArray(n.effects) && n.effects.length > 0) {
        var sList = [];
        for (var ef = 0; ef < n.effects.length; ef++) {
          var efItem = n.effects[ef];
          if (efItem && efItem.visible !== false && efItem.type === 'DROP_SHADOW') {
            sList.push(Math.round(efItem.offset.x) + 'px ' + Math.round(efItem.offset.y) + 'px ' + Math.round(efItem.radius) + 'px ' + parseFigmaColor(efItem.color, efItem.color.a));
          }
        }
        if (sList.length > 0) imgStyles.push('box-shadow: ' + sList.join(', ') + ';');
      }

      cssRules.push('.' + imgCls + ' {\n  ' + imgStyles.join('\n  ') + '\n}');
      return '<img src="' + imgFilename + '" class="' + imgCls + '" alt="' + escapeHtmlAttr(n.name || 'Image') + '" width="' + iw + '" height="' + ih + '">';
    }

    // Text nodes
    if (n.type === 'TEXT') {
      var tag = determineTagName(n);
      var textCls = getUniqueClass(n.name, tag);
      var tStyles = getNodeLayoutStyles(n, false, parentHasAutoLayout, parentLayoutMode, parentNode);

      tStyles.push('margin: 0;');
      if (typeof n.fontSize === 'number') {
        tStyles.push('font-size: ' + Math.round(n.fontSize) + 'px;');
      }
      if (n.fontName && typeof n.fontName === 'object' && n.fontName.family) {
        tStyles.push('font-family: "' + n.fontName.family + '", -apple-system, BlinkMacSystemFont, sans-serif;');
      }
      if (n.fontName && typeof n.fontName === 'object' && typeof n.fontName.style === 'string') {
        var sLow = n.fontName.style.toLowerCase();
        if (sLow.includes('bold')) tStyles.push('font-weight: 700;');
        else if (sLow.includes('semi') || sLow.includes('medium')) tStyles.push('font-weight: 600;');
        else if (sLow.includes('light')) tStyles.push('font-weight: 300;');
        else tStyles.push('font-weight: 400;');
        if (sLow.includes('italic')) tStyles.push('font-style: italic;');
      }
      if (n.lineHeight && typeof n.lineHeight === 'object' && typeof n.lineHeight.value === 'number') {
        if (n.lineHeight.unit === 'PIXELS') {
          tStyles.push('line-height: ' + Math.round(n.lineHeight.value) + 'px;');
        } else if (n.lineHeight.unit === 'PERCENT') {
          tStyles.push('line-height: ' + (Math.round(n.lineHeight.value) / 100) + ';');
        }
      } else {
        tStyles.push('line-height: 1.4;');
      }
      if (n.textAutoResize === 'WIDTH_AND_HEIGHT' && !String(n.characters || '').includes('\n')) {
        tStyles.push('white-space: nowrap;');
      }
      if (n.letterSpacing && typeof n.letterSpacing === 'object' && typeof n.letterSpacing.value === 'number' && n.letterSpacing.value !== 0) {
        if (n.letterSpacing.unit === 'PIXELS') {
          tStyles.push('letter-spacing: ' + n.letterSpacing.value.toFixed(1) + 'px;');
        } else if (n.letterSpacing.unit === 'PERCENT') {
          tStyles.push('letter-spacing: ' + (n.letterSpacing.value / 100).toFixed(3) + 'em;');
        }
      }
      tStyles.push('overflow-wrap: break-word;');
      if (n.textAlignHorizontal) {
        var tAlign = { 'LEFT': 'left', 'CENTER': 'center', 'RIGHT': 'right', 'JUSTIFIED': 'justify' }[n.textAlignHorizontal];
        if (tAlign) tStyles.push('text-align: ' + tAlign + ';');
      }
      if (n.textCase === 'UPPER') {
        tStyles.push('text-transform: uppercase;');
      }
      if (n.textDecoration === 'UNDERLINE') {
        tStyles.push('text-decoration: underline;');
      }
      var tFill = parseFills(n.fills);
      if (tFill && tFill.type === 'color') {
        tStyles.push('color: ' + tFill.value + ';');
      }

      cssRules.push('.' + textCls + ' {\n  ' + tStyles.join('\n  ') + '\n}');
      var textRaw = String(n.characters || '');
      var textHtml = textRaw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      return '<' + tag + ' class="' + textCls + '">' + textHtml + '</' + tag + '>';
    }

    // Containers (FRAME, COMPONENT, INSTANCE, SECTION, GROUP)
    var cTag = isRoot ? 'main' : determineTagName(n);
    var cCls = getUniqueClass(n.name, isRoot ? 'page-container' : cTag);
    var cStyles = getNodeLayoutStyles(n, isRoot, parentHasAutoLayout, parentLayoutMode, parentNode);

    var hasAutoLayout = (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL');
    if (hasAutoLayout) {
      cStyles.push('display: flex;');
      cStyles.push('flex-direction: ' + (n.layoutMode === 'HORIZONTAL' ? 'row' : 'column') + ';');
      if (typeof n.itemSpacing === 'number' && n.itemSpacing > 0) {
        cStyles.push('gap: ' + Math.round(n.itemSpacing) + 'px;');
      }
      var pt = Math.round(n.paddingTop || 0);
      var pr = Math.round(n.paddingRight || 0);
      var pb = Math.round(n.paddingBottom || 0);
      var pl = Math.round(n.paddingLeft || 0);
      if (pt || pr || pb || pl) {
        cStyles.push('padding: ' + pt + 'px ' + pr + 'px ' + pb + 'px ' + pl + 'px;');
      }
      if (n.layoutWrap === 'WRAP') {
        cStyles.push('flex-wrap: wrap;');
        if (typeof n.counterAxisSpacing === 'number' && n.counterAxisSpacing > 0) {
          cStyles.push('row-gap: ' + Math.round(n.counterAxisSpacing) + 'px;');
        }
        if (n.counterAxisAlignContent === 'SPACE_BETWEEN') {
          cStyles.push('align-content: space-between;');
        }
      }
      var jMap = { 'MIN': 'flex-start', 'CENTER': 'center', 'MAX': 'flex-end', 'SPACE_BETWEEN': 'space-between', 'SPACE_EVENLY': 'space-evenly', 'SPACE_AROUND': 'space-around' };
      if (n.primaryAxisAlignItems && jMap[n.primaryAxisAlignItems]) {
        cStyles.push('justify-content: ' + jMap[n.primaryAxisAlignItems] + ';');
      }
      var aMap = { 'MIN': 'flex-start', 'CENTER': 'center', 'MAX': 'flex-end', 'BASELINE': 'baseline' };
      if (n.counterAxisAlignItems && aMap[n.counterAxisAlignItems]) {
        cStyles.push('align-items: ' + aMap[n.counterAxisAlignItems] + ';');
      } else {
        cStyles.push('align-items: flex-start;');
      }
    } else if (!isRoot) {
      // Non-auto-layout frames: padding support and explicit sizing
      var pt = Math.round(n.paddingTop || 0);
      var pr = Math.round(n.paddingRight || 0);
      var pb = Math.round(n.paddingBottom || 0);
      var pl = Math.round(n.paddingLeft || 0);
      if (pt || pr || pb || pl) {
        cStyles.push('padding: ' + pt + 'px ' + pr + 'px ' + pb + 'px ' + pl + 'px;');
      }
    }

    if (!isRoot && Array.isArray(n.children) && n.children.length > 0) {
      if (!cStyles.some(function (s) { return s.startsWith('position:'); })) {
        cStyles.push('position: relative;');
      }
    }

    // Container background image fill
    if (imgFill) {
      var bgCls = getUniqueClass(n.name, 'bg');
      var bgFilename = 'assets/' + bgCls + '-' + assetCounter + '.png';
      assetCounter++;
      var bgBytes = null;
      if (imgFill.imageHash && typeof figma !== 'undefined' && typeof figma.getImageByHash === 'function') {
        try {
          var bgObj = figma.getImageByHash(imgFill.imageHash);
          if (bgObj && typeof bgObj.getBytesAsync === 'function') {
            bgBytes = await bgObj.getBytesAsync();
          }
        } catch (e) {}
      }
      if (!bgBytes || bgBytes.length === 0) {
        if (typeof n.exportAsync === 'function') {
          try {
            var bOut = await n.exportAsync({ format: 'PNG' });
            if (typeof bOut === 'string') bgBytes = new TextEncoder().encode(bOut);
            else bgBytes = bOut;
          } catch (e) {}
        }
      }
      if (!bgBytes) bgBytes = new Uint8Array(0);

      var bgMime = (bgBytes.length > 3 && bgBytes[0] === 0xFF && bgBytes[1] === 0xD8 && bgBytes[2] === 0xFF) ? 'image/jpeg' : 'image/png';
      var bgB64 = uint8ToBase64(bgBytes);
      var bgDataUri = 'data:' + bgMime + ';base64,' + bgB64;

      assets.push({
        path: bgFilename,
        name: bgCls,
        isSvg: false,
        mime: bgMime,
        bytes: bgBytes,
        base64: bgB64,
        dataUri: bgDataUri
      });

      cStyles.push('background-image: url("' + bgFilename + '");');
      cStyles.push('background-size: ' + (imgFill.scaleMode === 'FIT' ? 'contain' : 'cover') + ';');
      cStyles.push('background-position: center;');
      cStyles.push('background-repeat: no-repeat;');
    } else {
      var bgFill = parseFills(n.fills);
      if (bgFill) {
        if (bgFill.type === 'color') cStyles.push('background-color: ' + bgFill.value + ';');
        else if (bgFill.type === 'gradient') cStyles.push('background: ' + bgFill.value + ';');
      }
    }

    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
      cStyles.push('border-radius: ' + Math.round(n.cornerRadius) + 'px;');
    } else if (n.topLeftRadius || n.topRightRadius || n.bottomLeftRadius || n.bottomRightRadius) {
      cStyles.push('border-radius: ' + Math.round(n.topLeftRadius || 0) + 'px ' + Math.round(n.topRightRadius || 0) + 'px ' + Math.round(n.bottomRightRadius || 0) + 'px ' + Math.round(n.bottomLeftRadius || 0) + 'px;');
    }

    if (Array.isArray(n.strokes) && n.strokes.length > 0) {
      var stFill = n.strokes[0];
      if (stFill && stFill.visible !== false && stFill.type === 'SOLID') {
        var sWeight = typeof n.strokeWeight === 'number' ? Math.round(n.strokeWeight) : 1;
        cStyles.push('border: ' + sWeight + 'px solid ' + parseFigmaColor(stFill.color, stFill.opacity) + ';');
      }
    }

    if (Array.isArray(n.effects) && n.effects.length > 0) {
      var shadowList = [];
      var blurVal = 0;
      for (var ef = 0; ef < n.effects.length; ef++) {
        var e = n.effects[ef];
        if (!e || e.visible === false) continue;
        if (e.type === 'DROP_SHADOW') {
          shadowList.push(Math.round(e.offset.x) + 'px ' + Math.round(e.offset.y) + 'px ' + Math.round(e.radius) + 'px ' + parseFigmaColor(e.color, e.color.a));
        } else if (e.type === 'INNER_SHADOW') {
          shadowList.push('inset ' + Math.round(e.offset.x) + 'px ' + Math.round(e.offset.y) + 'px ' + Math.round(e.radius) + 'px ' + parseFigmaColor(e.color, e.color.a));
        } else if (e.type === 'LAYER_BLUR' && typeof e.radius === 'number') {
          blurVal = Math.round(e.radius);
        } else if (e.type === 'BACKGROUND_BLUR' && typeof e.radius === 'number') {
          cStyles.push('backdrop-filter: blur(' + Math.round(e.radius) + 'px);');
          cStyles.push('-webkit-backdrop-filter: blur(' + Math.round(e.radius) + 'px);');
        }
      }
      if (shadowList.length > 0) {
        cStyles.push('box-shadow: ' + shadowList.join(', ') + ';');
      }
      if (blurVal > 0) {
        cStyles.push('filter: blur(' + blurVal + 'px);');
      }
    }

    if (n.clipsContent && !isRoot) {
      cStyles.push('overflow: hidden;');
    }

    if (cStyles.length > 0) {
      cssRules.push('.' + cCls + ' {\n  ' + cStyles.join('\n  ') + '\n}');
    }

    var childrenHtml = [];
    if (Array.isArray(n.children)) {
      for (var ch = 0; ch < n.children.length; ch++) {
        var childResult = await walk(n.children[ch], false, hasAutoLayout, n.layoutMode, n);
        if (childResult) childrenHtml.push(childResult);
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }

    var content = childrenHtml.length > 0 ? '\n  ' + childrenHtml.join('\n  ') + '\n' : '';
    return '<' + cTag + ' class="' + cCls + '">' + content + '</' + cTag + '>';
  }

  var bodyHtml = await walk(rootNode, true, false, null, null);
  return {
    bodyHtml: bodyHtml,
    cssRules: cssRules.join('\n\n'),
    assets: assets,
    title: rootNode.name || 'Page'
  };
}

var cancelThumbnails = false;

figma.ui.onmessage = async function (msg) {
  if (!msg) return;

  if (msg.type === 'ready') {
    postFrames();
    return;
  }

  if (msg.type === 'clear') {
    cancelThumbnails = true;
    try { figma.currentPage.selection = []; } catch (e) {}
    postFrames();
    return;
  }

  if (msg.type === 'get-thumbnails') {
    cancelThumbnails = false;
    var thumbIds = Array.isArray(msg.ids) ? msg.ids.slice() : [];
    var THUMB_CONCURRENCY = Math.min(2, Math.max(1, thumbIds.length));
    var thumbWorkers = [];

    for (var tw = 0; tw < THUMB_CONCURRENCY; tw++) {
      thumbWorkers.push((async function () {
        while (thumbIds.length > 0 && !cancelThumbnails) {
          var tId = thumbIds.shift();
          if (!tId) break;
          try {
            var tNode = await figma.getNodeByIdAsync(tId);
            if (cancelThumbnails) break;
            if (tNode && typeof tNode.exportAsync === 'function') {
              var tBytes = await tNode.exportAsync({
                format: 'PNG',
                constraint: { type: 'WIDTH', value: 88 }
              });
              if (!cancelThumbnails) {
                figma.ui.postMessage({ type: 'thumbnail', id: tId, bytes: tBytes });
              }
            }
          } catch (err) { /* ignore thumbnail failures */ }
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      })());
    }

    await Promise.all(thumbWorkers);
    return;
  }

  if (msg.type === 'export') {
    cancelThumbnails = true;
    var ids = Array.isArray(msg.ids) ? msg.ids : [];
    var format = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF', 'HTML'].indexOf(format) < 0) format = 'PNG';
    var rawScale = Number(msg.scale) || 1;
    var scale = rawScale;

    var total = ids.length;
    var queue = ids.map(function (id, idx) { return { id: id, index: idx }; });
    var CONCURRENCY = Math.min(2, Math.max(1, queue.length));
    var workers = [];
    var settings = buildSettings(format, scale);

    for (var w = 0; w < CONCURRENCY; w++) {
      workers.push((async function worker() {
        while (queue.length > 0) {
          var item = queue.shift();
          if (!item) break;
          var id = item.id;
          var idx = item.index;
          try {
            var node = await figma.getNodeByIdAsync(id);
            if (!node) {
              figma.ui.postMessage({ type: 'error', id: id, message: 'Node no longer exists.' });
              continue;
            }
            var name = 'Untitled';
            try { name = String(node.name || 'Untitled'); } catch (e) {}

            if (format === 'HTML') {
              var compiled = await compileNodeToRealHtml(node);
              figma.ui.postMessage({
                type: 'file',
                index: idx,
                total: total,
                id: id,
                name: name,
                bytes: new Uint8Array(0),
                isRealHtml: true,
                htmlData: compiled
              });
            } else {
              if (typeof node.exportAsync !== 'function') {
                figma.ui.postMessage({ type: 'error', id: id, message: 'Node cannot be exported.' });
                continue;
              }
              var out = await node.exportAsync(settings);
              var bytes;
              if (typeof out === 'string') {
                var enc = new TextEncoder();
                bytes = enc.encode(out);
              } else {
                bytes = out;
              }
              figma.ui.postMessage({ type: 'file', index: idx, total: total, id: id, name: name, bytes: bytes });
            }
          } catch (err) {
            var message = 'Export failed.';
            try { message = (err && err.message) ? String(err.message) : String(err); } catch (e) {}
            if (/larger than|too large|memory|4096|size/i.test(message)) {
              message = message + ' Try a smaller scale (1x or 2x).';
            }
            figma.ui.postMessage({ type: 'error', id: id, message: message });
          }
          // Yield to keep UI responsive between exports and allow IPC to flush
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      })());
    }

    await Promise.all(workers);
    figma.ui.postMessage({ type: 'done' });
    postFrames();
  }
};

// Dispatch initial selection immediately on startup
postFrames();

