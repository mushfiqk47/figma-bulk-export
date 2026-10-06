# Bulk export

Export the frames you select on the canvas as PNG, JPG, SVG or PDF. No build step, no network, plain JavaScript.

## Files you import

- `manifest.json` — api 1.0.0, `editorType: figma`, `documentAccess: dynamic-page`, `networkAccess: { allowedDomains: ["none"] }`.
- `code.js` — sandbox: posts the canvas selection only (FRAME / COMPONENT / COMPONENT_SET plus a skipped count), re-posts on `selectionchange` / `currentpagechange`, clears via `{ type: 'clear' }`, exports sequentially with `getNodeByIdAsync` + `node.exportAsync`.
- `ui.html` — full UI with JSZip 3.10.1 + pdf-lib 1.17.1 inlined, works offline.
- `README.md` — this file.

Build sources (not needed for import, kept for transparency): `src/` + `vendor/` + `build_ui.js` regenerate `ui.html` via `node build_ui.js`.

## Import via manifest

1. In Figma desktop app: Plugins > Development > Import plugin from manifest.
2. Select the `manifest.json` in this folder.
3. On the canvas, select the frames you want.
4. Run: Plugins > Development > Bulk export.
5. The plugin lists only that selection. Uncheck anything to skip it, Continue, pick format, Export.
6. After export the plugin stays on the done screen. Back or Export more returns to the selection (refreshed).

## Notes and limits

- The list mirrors the canvas selection only. Non-frame layers are counted and skipped with one hint line.
- Raster scale: PNG/JPG use `{ type: "SCALE", value: scale }`. Quality toggle off forces 1x. SVG/PDF ignore scale.
- PDF single: Figma returns one single-page PDF per frame. The UI merges pages in selection order with pdf-lib `copyPages`. Vector pages are preserved when pdf-lib can parse them. If a page fails to parse, the UI falls back to a zip of individual PDFs and lists the reason instead of shipping a corrupt file.
- Filenames: sanitized frame name + `@2x` style suffix for raster scales other than 1x, deduped with `-2`, `-3`. Manifest list in step 2 matches downloaded names.
- 1 file downloads directly, 2+ files zip with JSZip. Combined PDF downloads as `frames.pdf`.
- Theming: `themeColors: true`. UI uses `var(--figma-color-*)` with fallbacks and mirrors `figma-light` / `figma-dark` from body to html, plus `prefers-color-scheme` fallback outside Figma.
- Demo mode: opening `ui.html` in a browser shows 2 demo frames so layout can be reviewed without Figma.

## Manual test checklist

1. Nothing selected: guidance line shows, Continue disabled.
2. Select 2 frames on canvas: plugin lists exactly those 2, in selection order.
3. Select a frame plus a text layer: frame listed, hint says 1 layer skipped.
4. 1 frame PNG 2x: one `@2x.png` directly, done screen stays until Back.
5. 3 frames PNG 3x: one `.zip` with 3 files, bar advances per file, no freeze, no jump after done.
6. SVG (2 frames): `.zip` with 2 `.svg` files, scale ignored.
7. PDF single (3 frames): one `frames.pdf`, 3 pages in selection order.
8. PDF each (3 frames): zip with 3 `.pdf` files, manifest names match.
9. Oversized failure (huge frame, 4x): rest continue, failure listed in red box with scale hint.
10. Export more: returns to the refreshed canvas selection; light/dark follows Figma theme.
