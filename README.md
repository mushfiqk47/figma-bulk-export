# Velto

Export multiple frames from your canvas quickly without repetitive manual exports.

Select any frames on your canvas, pick your desired format and scale, and download your assets directly as individual files, a clean ZIP archive, or a merged multi-page PDF document.

## Key Features

- **Live Canvas Previews**: View thumbnail previews of all selected frames directly in the plugin list.
- **Multi-Format Support**: Export to PNG, JPG, SVG, or PDF.
- **Multi-Page PDF Merge**: Combine selected frames into a single, ordered multi-page PDF document, or download each frame as its own individual PDF.
- **Custom Scaling**: Choose between None, 0.5x, 1x, 2x, 3x, and 4x resolution for raster formats (PNG and JPG).
- **Fast Offline Packaging**: Bundled with in-memory zip compression (STORE and DEFLATE) for near-instant downloads.
- **100% Private & Offline**: Zero external network calls, zero analytics, and zero tracking (`allowedDomains: ["none"]`). All processing happens locally on your machine.

## Previews

| 1. Empty State | 2. Selection & Previews |
| :---: | :---: |
| <img src="assets/screenshots/01_empty_selection.png" width="300" alt="Empty selection state" /> | <img src="assets/screenshots/02_frames_selected.png" width="300" alt="Frames selected with thumbnails" /> |

| 3. PNG / JPG Settings | 4. PDF Merge Settings |
| :---: | :---: |
| <img src="assets/screenshots/03_raster_export_settings.png" width="300" alt="Raster format and scale settings" /> | <img src="assets/screenshots/04_pdf_export_settings.png" width="300" alt="PDF mode side-by-side options" /> |

## Codebase Architecture

```
Figma Export Plugins/
├── manifest.json              # Plugin manifest (Figma 1.0.0 API)
├── code.js                    # Figma sandbox main thread (concurrent export pool & cancelable thumbnails)
├── ui.html                    # Offline standalone distribution bundle
├── build_ui.js                # Assembly script combining src/ui/ and vendor/ into ui.html
├── README.md                  # Plugin documentation
├── vendor/
│   ├── jszip.min.js           # JSZip 3.10.1 (MIT)
│   └── pdf-lib.min.js         # pdf-lib 1.17.1 (MIT)
├── assets/
│   ├── logo.svg               # Vector brand mark
│   └── screenshots/           # Documentation images
└── src/
    └── ui/
        ├── styles/
        │   ├── theme.css      # Design tokens, light & dark theme variables
        │   └── main.css       # Layout, components, buttons, focus outlines
        ├── templates/
        │   ├── head.html      # Meta, fonts, and header shell
        │   └── body.html      # App structure (Select, Settings, Progress views)
        └── js/
            ├── state.js       # App state, demo fallback, file planning
            ├── thumbnails.js  # Lazy loading observer & blob URL lifecycle
            ├── ui-renderer.js # List rendering, in-place toggling, settings sync
            ├── exporter.js    # Export dispatcher & IPC file collector
            ├── packaging.js   # Fast STORE/DEFLATE zip creation & downloads
            ├── pdf-merger.js  # pdf-lib multi-page document merger
            └── main.js        # Event listeners, theme detection, app boot
```

## Build command

If you modify source files in `src/ui/` or assets in `vendor/`, recompile the standalone `ui.html` bundle with:

```bash
node build_ui.js
```

The script inlines the modular HTML, CSS, JavaScript parts, and vendor libraries into `ui.html`.

## How to Use

1. **Select frames**: Select one or more frames, components, or component sets on your Figma canvas.
2. **Launch Velto**: Open **Plugins** > **Development** > **Velto**. Your selected frames appear instantly with live thumbnail previews.
3. **Configure & Export**: Pick your file format, scale, or PDF mode, then click **Export**.
4. **Done screen**: After export, stay on the completion screen, go **Back**, or click **Export more** to return with your canvas selection refreshed.

### Installation (Import via Manifest)

1. In the Figma desktop app, go to **Plugins** > **Development** > **Import plugin from manifest...**.
2. Select the [`manifest.json`](manifest.json) file in this directory.

## Notes and limits

- **Live Previews**: Selected frames render miniature visual thumbnails in the list via lazy viewport loading.
- **Canvas Selection Tracking**: The list mirrors your canvas selection only. Non-frame layers are counted and skipped with one hint line.
- **Raster Scaling**: PNG and JPG support None, 0.5x, 1x, 2x, 3x, and 4x. SVG and PDF ignore scale.
- **Side-by-side PDF Options**:
  - *One PDF for all frames*: Figma returns single-page PDFs per frame and merges them into one `frames.pdf` in selection order with pdf-lib. If a vector page fails to parse, it falls back to zipping individual PDFs safely.
  - *One PDF per frame*: Each frame downloads as its own individual PDF.
- **Naming & Packaging**: 1 file (single PDF or single image) downloads directly; 2+ files zip cleanly with JSZip (using STORE mode for instant downloads on compressed raster formats).
- **Theming**: Native Figma theming (`figma-light` / `figma-dark`) with system `prefers-color-scheme` fallback.
- **Offline**: Zero network dependencies, zero telemetry. Fully sandboxed and secure.
