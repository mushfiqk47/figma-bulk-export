---
name: html-to-responsive
description: Transforms static, fixed-coordinate, or SVG-wrapped HTML exported from Figma into semantic, modern, fluid, and fully responsive HTML and CSS across all screen sizes (mobile, tablet, desktop, ultrawide). Use whenever converting exported design mockups, static HTML frames, or fixed artboard code into production-ready responsive web pages.
---

# HTML to Responsive: Modern Web Layout Refactoring

This skill teaches autonomous coding agents how to take **static, fixed-coordinate, or SVG-wrapped HTML exports from Figma** and refactor them into **clean, semantic, production-grade, 100% responsive HTML & CSS** that effortlessly adapts to any device viewport (from 320px mobile screens to 4K displays).

---

## 1. Why Native Figma HTML Exports Are Not Responsive

Figma is an absolute-coordinate vector design canvas, not a web browser. When plugins export HTML, they encounter structural limitations:
1. **Canvas Coordinates vs. Document Flow:** Figma positions elements with rigid Cartesian coordinates (`x, y, width, height`). Web browsers rely on dynamic document flow, Flexbox wrapping, and CSS Grid.
2. **Fixed Viewport Artboards:** A Figma desktop frame is typically drawn at a fixed 1440px width, while mobile is a separate 375px frame. A direct export of one frame has no awareness of breakpoints, media queries, or column collapse.
3. **SVG & Absolute Div Fallbacks:** Automated exporters produce either:
   - An SVG snapshot embedded in HTML (pixel-perfect at designed resolution, but scales down uniformly like an image rather than reflowing text and reordering columns).
   - An "absolute div soup" (`position: absolute; left: 420px; top: 180px; width: 360px;`), which shatters into overlapping text on any different screen size.

**The Agent's Role:** Bridge the gap between Figma's visual design and the browser's fluid layout engine by extracting the design tokens and hierarchy, then authoring a modern, semantic, mobile-first responsive architecture.

---

## 2. Core Transformation Principles

### 2.1 The "Never" Rules
* **NEVER keep fixed pixel container widths:** Replace `width: 1440px;` with `max-width: 1280px; width: 100%; margin-inline: auto; padding-inline: clamp(1rem, 4vw, 2rem);`.
* **NEVER use `position: absolute` for layout:** Use Flexbox and CSS Grid. Only retain `position: absolute` for badges pinned to avatars, floating modal overlays, or decorative background watermarks.
* **NEVER use fixed text sizes without fluid limits:** Replace `font-size: 64px;` with `font-size: clamp(2rem, 5vw + 0.5rem, 4rem);`.
* **NEVER cause horizontal scrolling on mobile:** The page at `320px` width must have zero horizontal overflow.
* **NEVER leave non-semantic generic containers:** Convert anonymous `<div>` trees into semantic HTML5 landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`.

### 2.2 The "Always" Rules
* **ALWAYS design Mobile-First:** Write default CSS for screens 320px–480px, then enhance upward using `min-width` media queries:
  - Base: Mobile phone (`< 640px`)
  - `@media (min-width: 640px)`: Small tablet / large phone landscape
  - `@media (min-width: 768px)`: Tablet portrait / iPad
  - `@media (min-width: 1024px)`: Laptop / Desktop
  - `@media (min-width: 1280px)`: Large desktop
* **ALWAYS use CSS Grid with `auto-fit` for card groups:**
  ```css
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
    gap: clamp(1rem, 2.5vw, 2rem);
  }
  ```
  This single pattern automatically reflows from 1 column on mobile to 2 columns on tablet to 3–4 columns on desktop without brittle media queries.
* **ALWAYS enforce accessible touch targets:** Buttons, interactive links, and inputs must have a minimum interactive target of `44px × 44px` on mobile.

---

## 3. Step-by-Step Refactoring Procedure

When given an exported HTML file (or SVG bundle), follow these phases sequentially:

### Phase 1: Visual & Token Extraction
1. **Read the Source:** Inspect the exported HTML file, SVG markup, and linked stylesheets.
2. **Catalog Design Tokens:**
   - **Color Palette:** Extract background colors, surface card colors, primary inks, secondary muted inks, border colors, and brand accents into CSS custom variables (`:root`).
   - **Typography Hierarchy:** Identify Heading 1, Heading 2, Subtitle, Body, Caption, and Badge sizes and weights.
   - **Radii & Shadows:** Map corner border-radii (`--radius-sm`, `--radius-md`, `--radius-lg`) and elevations.
3. **Asset Inventory:** Identify raster images (PNG, JPG, WebP) and vector icons (SVGs). Ensure vector icons are clean inline SVGs or linked SVG symbols.

### Phase 2: Semantic Document Restructuring
Convert the flat or nested `div` structure into semantic HTML:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Project Title</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <!-- Semantic Header & Navigation -->
  <header class="site-header">
    <div class="container header-inner">
      <a href="#" class="brand-logo">...</a>
      <button class="nav-toggle" aria-expanded="false" aria-label="Toggle navigation">
        <span class="hamburger"></span>
      </button>
      <nav class="site-nav" id="siteNav">
        <ul class="nav-links">...</ul>
        <div class="nav-actions">...</div>
      </nav>
    </div>
  </header>

  <!-- Main Content Landmark -->
  <main>
    <section class="hero-section">
      <div class="container hero-grid">
        <div class="hero-content">...</div>
        <div class="hero-media">...</div>
      </div>
    </section>

    <section class="features-section">
      <div class="container">
        <div class="section-header">...</div>
        <div class="cards-grid">...</div>
      </div>
    </section>
  </main>

  <!-- Semantic Footer Landmark -->
  <footer class="site-footer">
    <div class="container footer-grid">...</div>
  </footer>

  <script src="js/main.js"></script>
</body>
</html>
```

### Phase 3: Fluid & Responsive CSS Architecture

Create a modular stylesheet (`css/style.css`) using this battle-tested foundation:

#### 1. Modern Reset & Fluid Base
```css
/* Box sizing & fluid foundation */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 100%;
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
}

body {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  color: var(--text-main);
  background-color: var(--bg-surface);
  overflow-x: hidden;
}

img, svg, picture, video {
  display: block;
  max-width: 100%;
  height: auto;
}

button, input, select, textarea {
  font: inherit;
}
```

#### 2. Design Tokens (`:root`)
```css
:root {
  /* Fluid Spacing Scale */
  --space-xs: clamp(0.25rem, 0.5vw, 0.5rem);
  --space-sm: clamp(0.5rem, 1vw, 0.75rem);
  --space-md: clamp(1rem, 2vw, 1.5rem);
  --space-lg: clamp(1.5rem, 3vw, 2.5rem);
  --space-xl: clamp(2.5rem, 5vw, 4rem);

  /* Fluid Typography Scale */
  --font-h1: clamp(2rem, 4vw + 1rem, 3.75rem);
  --font-h2: clamp(1.5rem, 2.5vw + 0.75rem, 2.5rem);
  --font-h3: clamp(1.25rem, 1.5vw + 0.5rem, 1.75rem);
  --font-body: clamp(0.9375rem, 0.2vw + 0.875rem, 1.0625rem);
  --font-small: clamp(0.8125rem, 0.2vw + 0.75rem, 0.875rem);

  /* Colors */
  --bg-surface: #ffffff;
  --bg-card: #f9fafb;
  --text-main: #111827;
  --text-muted: #4b5563;
  --line: #e5e7eb;
  --brand: #2563eb;
  --brand-hover: #1d4ed8;

  /* Geometry */
  --radius: 8px;
  --radius-lg: 16px;
  --max-content-width: 1200px;
}
```

#### 3. Responsive Container & Layout Patterns
```css
/* Centered fluid container */
.container {
  width: 100%;
  max-width: var(--max-content-width);
  margin-inline: auto;
  padding-inline: clamp(1rem, 3vw, 2rem);
}

/* Two-column Hero / Split Section */
.hero-grid {
  display: flex;
  flex-direction: column-reverse; /* Media first or text first on mobile */
  gap: var(--space-lg);
  align-items: center;
  padding-block: var(--space-xl);
}

@media (min-width: 768px) {
  .hero-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: var(--space-xl);
    align-items: center;
  }
}

/* Responsive Cards Grid */
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  margin-block: var(--space-lg);
}

@media (min-width: 640px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

#### 4. Mobile Navigation Toggle Pattern
```css
/* Mobile Navigation Drawer */
.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
}

.site-nav {
  display: none; /* Hidden on mobile by default */
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--line);
  padding: 1.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

.site-nav.is-open {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 768px) {
  .nav-toggle {
    display: none;
  }
  .site-nav {
    display: flex;
    position: static;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: auto;
    padding: 0;
    box-shadow: none;
    border: none;
  }
}
```

---

## 4. Multi-Device Verification Checklist

Before considering any HTML/CSS refactoring task complete, test against all 5 canonical viewports:

- [ ] **Mobile Narrow (320px – 375px):**
  - No horizontal scrollbars (`overflow-x: hidden`).
  - Headlines wrap cleanly without clipping.
  - Buttons and inputs span full width for easy thumb tapping.
  - All touch targets are at least `44px` high.
- [ ] **Mobile Standard (390px – 430px):**
  - Padding and margins breathe naturally.
  - Images preserve aspect ratios without distortion.
- [ ] **Tablet Portrait (768px – 834px):**
  - Multi-column sections expand to 2 columns.
  - Navigation switches from hamburger to horizontal bar (or stays hamburger if items exceed width).
- [ ] **Laptop / Desktop (1024px – 1440px):**
  - Grid sections expand to 3 or 4 columns.
  - Split heroes align text and media side-by-side with appropriate baseline centering.
  - Container caps max-width to preserve optimal line length (45–75 characters per line).
- [ ] **Ultrawide Displays (> 1920px):**
  - Content stays centered in the viewport with margin auto.
  - Background washes or headers bleed cleanly across the full viewport width while container content stays bounded.
