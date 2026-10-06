# Bulk export

Export the frames you select on the canvas as PNG, JPG, SVG or PDF. No build step, no network, plain JavaScript.

## Previews

| 1. Empty State | 2. Selection & Previews |
| :---: | :---: |
| <img src="src/Product%20images/01_empty_selection.png" width="300" alt="Empty selection state" /> | <img src="src/Product%20images/02_frames_selected.png" width="300" alt="Frames selected with thumbnails" /> |

| 3. PNG / JPG Settings | 4. PDF Merge Settings |
| :---: | :---: |
| <img src="src/Product%20images/03_raster_export_settings.png" width="300" alt="Raster format and scale settings" /> | <img src="src/Product%20images/04_pdf_export_settings.png" width="300" alt="PDF mode side-by-side options" /> |

## Files you import

- `manifest.json` — api 1.0.0, `editorType: figma`, `documentAccess: dynamic-page`, `networkAccess: { allowedDomains: ["none"] }`.
- `code.js` — sandbox: posts the canvas selection only (FRAME / COMPONENT / COMPONENT_SET plus skipped count), generates fast thumbnail previews on demand, exports sequentially with `getNodeByIdAsync` + `node.exportAsync`.
- `ui.html` — full UI built with Sora typography, dark/light theming, with JSZip 3.10.1 + pdf-lib 1.17.1 inlined (works 100% offline).
- `README.md` — this file.

Build sources (not needed for import, kept for transparency): `src/` + `vendor/` + `build_ui.js` regenerate `ui.html` via `node build_ui.js`.

## Import via manifest

1. In Figma desktop app: Plugins > Development > Import plugin from manifest.
2. Select the `manifest.json` in this folder.
3. On the canvas, select the frames you want.
4. Run: Plugins > Development > Bulk export.
5. The plugin lists only that selection with thumbnail previews. Uncheck anything to skip it, Continue, pick format/scale, and Export.
6. After export the plugin stays on the done screen. Back or Export more returns to the selection (refreshed).

## Notes and limits

- **Live Previews**: Selected frames automatically fetch and render miniature visual thumbnails in the selection list.
- **Canvas Selection Tracking**: The list mirrors your canvas selection only. Non-frame layers are counted and skipped with one hint line.
- **Raster Scaling**: PNG and JPG support `None`, `0.5x`, `1x`, `2x`, `3x`, and `4x`. SVG and PDF ignore scale.
- **Side-by-side PDF Options**: 
  - *One PDF for all frames*: Figma returns single-page PDFs per frame and merges them into one `frames.pdf` in selection order with pdf-lib. If a vector page fails to parse, it falls back to zipping individual PDFs safely.
  - *One PDF per frame*: Each frame downloads as its own individual PDF.
- **Naming & Packaging**: 1 file downloads directly; 2+ files zip cleanly with JSZip. Filenames follow sanitized frame names with scale suffixes (`@2x`, `@3x`) when applicable.
- **Theming**: Native Figma theming (`figma-light` / `figma-dark`) with system `prefers-color-scheme` fallback.
- **Offline**: Zero network dependencies, zero telemetry. Fully sandboxed and secure.
