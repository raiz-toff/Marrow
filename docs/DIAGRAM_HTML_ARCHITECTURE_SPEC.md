# MARROW DIAGRAM HTML: ARCHITECTURE & DESIGN PROTOCOL SPECIFICATION

**Document Revision:** 2.0.0  
**Classification:** Technical Architecture & Design Reference  
**Scope:** Marrow Standalone Diagram HTML Engine, Vector Renderer, Spatial Layout, and Client Runtime  
**Intended Audience:** System Architects, Design Engineers, AI Agents, Integration Engineers  

---

## 1. Executive Summary & Design Mission

Marrow compiles declarative network topology definitions (`input/*.yaml`) into **100% self-contained, zero-dependency, offline-first interactive HTML diagrams**.

The standalone HTML file produced by Marrow is an integrated application and vector document. It contains zero external CDN links, zero remote font calls, and zero tracking scripts. When opened directly from a local filesystem (`file://`) or embedded inside an `<iframe>`, it provides workstation-grade CAD interaction (fluid pan, zoom, spatial filtering, device inspection, search, and vector export).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MARROW COMPILATION PIPELINE                       │
│                                                                             │
│  Topology YAML ──► Schema & Diagnostics ──► Spatial Layout ──► SVG Renderer │
│  (input/*.yaml)     (@marrow/schema)       (@marrow/layout)    (@marrow/    │
│                                                                render-svg)  │
│                                                                      │      │
│  Client Runtime ──► Esbuild IIFE Bundle ─────────────────────────────┤      │
│  (@marrow/runtime)  (dist/runtime.js)                                │      │
│                                                                      ▼      │
│                                                            HTML Shell Site  │
│                                                            (@marrow/site)   │
│                                                                      │      │
│                                                                      ▼      │
│                                                              Standalone     │
│                                                              HTML Document  │
│                                                              (*.html)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Document DOM Tree & Spatial Layout Hierarchy

The generated HTML adheres to a strict hierarchical tree where chrome (controls, navigation, HUD) floats on isolated z-planes above the infinite vector canvas.

### 2.1 DOM Structure

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark" data-root="" data-page="index.html">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>[Topology Name] — Marrow</title>
  <style>/* Inlined SITE_CSS (~50 KB unminified, complete design system) */</style>
</head>
<body class="[m-doc-body if inventory]">

  <!-- LAYER 0: Canvas Viewport Frame -->
  <main class="m-stage" role="region" aria-label="Network topology stage">
    <svg class="m-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Inlined Dot Grid Pattern -->
        <pattern id="m-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" class="m-grid-dot"/>
        </pattern>
        <!-- Namespaced SVG Icon Sprite (<symbol id="ic-...">) -->
        <symbol id="ic-cisco-routers-isr-4000" viewBox="0 0 100 100">...</symbol>
      </defs>

      <!-- Infinite Canvas Group (Transformed by pan/zoom matrix) -->
      <g class="m-canvas-transform">
        <rect class="m-grid" width="100000" height="100000" fill="url(#m-grid)"/>

        <!-- 1. Enclosure Zones & Boundary Panels -->
        <g class="m-layer-zones">
          <g class="m-zone" data-zone="campus-core">...</g>
        </g>

        <!-- 2. Physical & Logical Links (Edges) -->
        <g class="m-layer-edges">
          <!-- Double-rail trunks, single-rail links, midpoint chips -->
          <path class="m-edge m-mode-trunk" d="M..."/>
          <path class="m-edge-rail" d="M..."/>
          <g class="m-edge-chip">...</g>
        </g>

        <!-- 3. Port Chips (Collided-free resolved badges) -->
        <g class="m-layer-ports">
          <g class="m-portlabel" data-node="sw-01">...</g>
        </g>

        <!-- 4. Device Nodes -->
        <g class="m-layer-nodes">
          <g class="m-node m-status-up" data-node="core-01" tabindex="0">
            <rect class="m-chip" rx="13"/>
            <use href="#ic-cisco-routers-isr-4000"/>
            <circle class="m-led"/>
            <text class="m-label">core-01</text>
          </g>
        </g>
      </g>
    </svg>
  </main>

  <!-- LAYER 4: Watermark -->
  <div class="m-watermark" aria-hidden="true">TOPOLOGY NAME</div>

  <!-- LAYER 20: Persistent Topbar & Breadcrumbs -->
  <nav class="m-breadcrumbs" aria-label="Breadcrumb">...</nav>

  <!-- LAYER 25: Device & Link Inspector Drawer -->
  <aside class="m-inspector" hidden>...</aside>

  <!-- LAYER 26: Collapsible Navigation & Metadata Sidebar -->
  <aside class="m-sidebar">...</aside>

  <!-- LAYER 30: Quick Search Command Dock -->
  <div class="m-dock">...</div>

  <!-- LAYER 31: Floating Sidebar Trigger Chip -->
  <div class="m-rail-wrap">
    <button class="m-chip-btn m-sidebar-btn" type="button">...</button>
  </div>

  <!-- LAYER 40: Spotlight Modal Palette (Cmd+K) -->
  <div class="m-spotlight" hidden>...</div>

  <!-- DATA PAYLOAD: Complete Serialized Topology Model -->
  <script>window.__MARROW_DATA__ = { ... };</script>

  <!-- RUNTIME: Self-Contained Client Interaction Engine -->
  <script>/* Inlined runtime.js IIFE */</script>
</body>
</html>
```

---

## 3. Visual Design System & Design Tokens

Marrow utilizes a strict neutral zinc scale derived from the Shadcn / Radix design tokens. Color is reserved exclusively for **hardware status**, **selection**, and **link semantics**. Chrome recedes; the topology is the hero.

### 3.1 Color Palette & CSS Variables

| Token | Dark Mode (`ops`) | Light Mode (`print`) | Functional Description |
| :--- | :--- | :--- | :--- |
| `--bg` | `#09090b` (Zinc 950) | `#fafafa` (Zinc 50) | Base canvas background |
| `--bg-raise` | `#27272a` (Zinc 800) | `#f4f4f5` (Zinc 100) | Elevated surface (dropdowns, chips) |
| `--panel` | `#18181b` (Zinc 900) | `#ffffff` (Pure White) | Sidebars, drawers, modals |
| `--line` | `#27272a` (Zinc 800) | `#e4e4e7` (Zinc 200) | Structural borders, card outlines |
| `--line-strong`| `#3f3f46` (Zinc 700) | `#d4d4d8` (Zinc 300) | Focused borders, active divider rails |
| `--ink` | `#fafafa` (Zinc 50) | `#18181b` (Zinc 900) | Primary high-contrast text |
| `--ink-dim` | `#a1a1aa` (Zinc 400) | `#71717a` (Zinc 500) | Secondary metadata, port names |
| `--ink-faint`| `#71717a` (Zinc 500) | `#a1a1aa` (Zinc 400) | Disabled elements, keyboard hints |
| `--m-accent` | `#3b82f6` (Blue 500) | `#2563eb` (Blue 600) | Active selection, link paths |
| `--up` | `#22c55e` (Green 500)| `#16a34a` (Green 600)| Operational device / interface LED |
| `--degraded` | `#f59e0b` (Amber 500)| `#d97706` (Amber 600)| Warning, failover active, single link down |
| `--down` | `#ef4444` (Red 500) | `#dc2626` (Red 600) | Unreachable device, severed edge |
| `--planned` | `#71717a` (Zinc 500) | `#a1a1aa` (Zinc 400) | Staged / provisioning state |
| `--grid-dot` | `#1c1c1f` | `#e4e4e7` | Precision grid dots (24px pitch) |

### 3.2 Typography System

- **Font Family**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (zero remote downloads, zero layout shift).
- **Type Scale**:
  - `20px` / Weight 600: Topbar title, Inspector drawer device names.
  - `14px` / Weight 500: Inspector labels, modal headers, search inputs.
  - `12px` / Weight 500: Device chip labels, zone titles (uppercase tracking `0.1em`).
  - `11px` / Weight 600: Port chip labels, aggregate pills (`×24`), status indicators.
  - `10px` / Monospace: IP addresses, MAC addresses, VLAN tags, interface IDs.

### 3.3 Geometry & Radii Standards
- `--radius-sm`: `6px` (Badges, Kbd chips, port pills)
- `--radius`: `8px` (Buttons, input boxes, dropdowns)
- `--radius-lg`: `12px` (Inspector drawer, stage viewport, modals)
- `--radius-chip`: `13px` (Device hardware chips, 64×64px standard)

---

## 4. Vector Geometry & Spatial Layout Engine

Marrow avoids forced-directed physics loops (which wobble unpredictably). Spatial layout is computed **deterministically** via `@marrow/layout` before rendering.

### 4.1 Device Nodes (Hardware Chips)
- **Standard Dimensions**: `64px × 64px` rounded rect (`rx="13"`).
- **Hero Nodes**: Highlighted critical equipment rendered with a distinct accent ring (`stroke: var(--ring); stroke-width: 1.5;`).
- **Status LED**: 4.2px radius circle positioned at upper-right coordinate `(x + w - 3.8, y + 3.8)`. Features a 2px stroke matching canvas background for visual isolation.
- **Label Pinning**: SVG labels use `textLength` constraint attributes to prevent text from overflowing its allocated layout boundary regardless of local system font metrics.

```
       ┌───────────────────────────────┐
       │ ┌───────────────────────────┐ │
       │ │                           │ │
       │ │     [ 48x48 SVG Icon ]    │O│ ◄── Status LED (Green/Amber/Red)
       │ │                           │ │
       │ └───────────────────────────┘ │
       └───────────────────────────────┘
              core-sw-01 (Label)
```

### 4.2 Wire Routing & Filleted Orthogonal Paths
Cables are not straight diagonal lines; they follow **orthogonal Manhattan routing** with filleted curve bends:
- **Fillet Radius**: `8px` standard bend radius (`roundedPath` quadratic curve calculation).
- **Trunk Cables (802.1Q)**: Rendered as a **Double Rail**. An outer high-bandwidth casing (`stroke-width: 4.5px`) carved with a background-colored inner center line (`stroke-width: 1.7px`), producing an aerospace double-track visual.
- **LAG Bundles (Port Channels)**: Carries an oval midpoint badge (e.g. `LACP Po1` or `×4`).
- **Tunnels (IPsec / GRE / VXLAN)**: Rendered with precise metric dashed strokes (`--dash-tunnel: 0.02 0.014`).
- **Live Traffic Animation (`.m-flow`)**: Optional SVG stroke animation depicting packet transit direction without third-party canvas animation overhead.

### 4.3 Port Chips & Collision Resolution
- Port chips (e.g. `Gi1/0/1`, `Ten0/1`) are placed outside the device chip along the entry trajectory of each link.
- Spatial collisions between parallel interfaces are resolved at compile-time: overlapping ports are either stacked or merged into an aggregated summary pill (`Po1 · 2 ports`).

---

## 5. UI Components & Interaction Protocol

### 5.1 The Canvas Stage (`.m-stage`)
- **Default Framing**: In desktop standalone mode, the stage sits inset:
  - `top: 52px` (below breadcrumb strip)
  - `left: 20px`, `right: 20px`, `bottom: 20px`
- **Embedded / Viewport Mode**: When container width/height is constrained, or query param `?embed=true` is set:
  - Inset shifts to `0 0 0 0` with `border: none; border-radius: 0;`.
  - Margin dead space is 100% eliminated.

### 5.2 Floating Chrome & Rail Button (`.m-chip-btn`)
- **Visual Design**: Frosted glassmorphic pill button (`background: color-mix(in srgb, var(--panel) 85%, transparent)` with `backdrop-filter: blur(8px)` and `border: 1px solid var(--line)`).
- **State**: Never renders as a stark solid white block. Recedes elegantly into the background until hovered.
- **Action**: Slides out the metadata navigation drawer.

### 5.3 Quick Search Dock (`.m-dock`) & Command Center (`Cmd+K`)
- **Top Dock**: Sits tucked at the top center of the viewport. Drops down on hover or focus.
- **Command Spotlight Modal (`.m-spotlight`)**:
  - Trigger: `Cmd + K` (Mac) or `Ctrl + K` (Windows/Linux) or `/`.
  - Scope: Searches device hostnames, roles, IP addresses, VLAN IDs, and link descriptions.
  - Action: Arrow keys to select; pressing `Enter` closes the modal, smoothly animates the camera to the device coordinate, and flashes a momentary accent pulse halo.

### 5.4 The Inspector Drawer (`.m-inspector`)
A slide-over engineering panel pinned to the right edge (`width: 356px`):
- **Header**: Device Title, Icon Glyph, Operational Status badge, Management IP.
- **Tabs**:
  1. **Overview**: Zone, Tier, Role, HA Pairing partner with jump link.
  2. **Interfaces**: Table detailing Port, Status, Speed, Mode (Trunk/Access), VLAN assignment.
  3. **Neighbors**: Adjacent devices connected via physical links (1-click navigation).
  4. **Config**: Collapsible running-configuration viewer with monospace typography.

### 5.5 Floating Bottom Island Dock (`.m-hud`)
A glassmorphic control pill centered at the bottom of the stage:
- **Fit View (`F`)**: Automatically centers and calculates optimal zoom bounds (framing 82% of viewport).
- **Zoom In / Out (`+` / `-`)**: Incremental optical scaling.
- **Toggle Port Chips**: Hides/shows interface badges to reduce visual density.
- **Toggle Flow Animation**: Starts/pauses packet flow stroke motion.
- **Export Menu**: Instant 1-click export to standalone **SVG** or high-resolution **PNG**.

---

## 6. Embedding & Responsive Behavior Protocol

Marrow diagrams are designed to embed cleanly into third-party dashboards, documentation platforms (Next.js, Nuxt, Docusaurus, VitePress), and wikis.

### 6.1 Embedding via Iframe
```html
<iframe
  src="/path/to/diagram.html?embed=true"
  width="100%"
  height="600"
  frameborder="0"
  style="border-radius: 12px; border: 1px solid #27272a;"
  loading="lazy">
</iframe>
```

### 6.2 Responsive Thresholds & Level-of-Detail (LOD)
The runtime dynamically updates classes on `.m-stage` based on zoom magnification and viewport bounds:

| Viewport / Zoom State | LOD Level | Visual Adaptations |
| :--- | :--- | :--- |
| **Macro Zoom** (`scale < 0.45`) | `lod-macro` | Port chips hidden; device labels dimmed; link casings simplified; zone titles prominent. |
| **Standard View** (`0.45 ≤ scale ≤ 1.4`) | `lod-normal` | Standard operational view: icons visible, labels visible, trunk chips displayed. |
| **Micro View** (`scale > 1.4`) | `lod-micro` | Full engineering telemetry: individual port chips, IP annotations, MAC labels rendered at full clarity. |
| **Compact Embed** (`viewport width < 600px` or `height < 450px`) | `m-compact` | Chrome margins set to 0; breadcrumbs hidden; watermark hidden; bottom dock compressed. |

---

## 7. Zero-Dependency Modularity & Extension Guidelines

To preserve Marrow's golden rule of modularity and avoid codebase fragmentation:

1. **Zero External Runtime Dependencies**:
   - The runtime must never load scripts or fonts from external CDNs.
   - All icons reside in the `<defs>` sprite; all styles reside in `SITE_CSS`.
2. **Deterministic Pre-Computation**:
   - Never compute spatial coordinates or collision resolution inside the client JavaScript. All coordinates (`x`, `y`, `points`) are calculated at build time by `@marrow/layout`.
   - The client runtime only manages matrix transformation (`translate(x, y) scale(k)`), class toggling, and event dispatch.
3. **Strict CSS Token Adherence**:
   - Never hardcode raw hex colors in component code. All colors must reference CSS custom properties (`var(--line)`, `var(--panel)`, `var(--ink)`).
4. **Agent-Friendly Diagnostics**:
   - If an imported topology or custom SVG asset violates constraints, compiler warnings (e.g. `MRW-W106`, `MRW-E010`) provide direct remediation commands rather than silent failures.

---
*End of Protocol Specification.*
