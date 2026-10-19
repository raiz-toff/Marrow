# Marrow Viewport Shell & Responsive Layout Architecture Specification

> **Target Audience**: Human Architects & Reasoning AI Agents  
> **Status**: Approved Production Specification (Purged of Non-Existent Features)  
> **Topic**: Viewport Shell, Responsive Layout Geometry, HTML Skeleton & Touch/Pointer Model

---

## 1. Executive Summary & Design Engineering Philosophy

Marrow compiles declarative network topology YAML into interactive, self-contained offline SVG network diagrams. A Marrow diagram is an **operational CAD drawing and source-of-truth topology viewer**.

### Grounded Workstation Console vs. Floating Game HUD
* **The Problem with Floating HUDs**: Scattering floating pills and floating search docks across screen corners creates visual noise, occludes top spine routers when zoomed out, and overlaps bottom leaf devices.
* **The Grounded Workstation Solution**:
  1. **Top Command Bar (48px)**: Anchors diagram title, site breadcrumbs, device/link metrics, search trigger (`Ctrl+K`), and export tools.
  2. **Grounded Bottom Status Bar (28px)**: Anchors active device/link selection, live world pointer coordinates ($X, Y$), camera zoom percentage, view fitting, and minimap toggle.
  3. **Full-Bleed Vector Stage (`position: fixed; inset: 0`)**: Diagram occupies 100% of the viewport behind the chrome, with mathematical safe margins calculating unobstructed space.
  4. **Dedicated Left Sidebar (`Ctrl+B`)**: Houses the **Site Navigation Tree** (Overview, Zones with device count badges, and Inventory) on multi-page sites. On single-file diagrams (`--single`), it is suppressed or collapsed by default.
  5. **Dedicated Right Inspector Drawer**: Displays real device attributes declared in the schema: Management IP, HA Pair, Interfaces table, Neighbor links, Custom Fields/Sections, and Config snippets.
  6. **Zero Non-Existent Features**: No fabricated layer "lenses" or arbitrary runtime filter tabs. Every control directly connects to Marrow's compiler output and YAML schema.

---

## 2. Problems in Previous Layouts & Solutions

| Component | Previous Problem | Marrow Production Solution |
| :--- | :--- | :--- |
| **Top Navigation** | Floating pill at `top: 60px; left: 50%` drifted over the diagram, occluding top spine devices. | Grounded **Top Command Bar (48px)** at `top: 0; left: 0; right: 0`. Diagram canvas stays 100% unobstructed below `y: 48px`. |
| **Search & Discovery** | Floating search pill lacked room for hints and was unreachable on mobile. | Desktop: Integrated search button in the top bar opening **Spotlight Command Palette (`Ctrl+K` / `/`)**. Mobile: Dedicated bottom-nav thumb tab. |
| **Site Navigation (`Ctrl+B`)** | Floating hamburger button popped open an unanchored sidebar that awkwardly pushed or occluded the canvas. | Dockable **Left Sidebar (`.m-sidebar`)** displaying the site zone hierarchy with device counts. On `--single` files, it collapses by default for 100% canvas width. |
| **Camera & Zoom Dock** | Floating dock at bottom-center overlapped bottom leaf switches and cable labels. | Integrated into the **Grounded Status Bar (28px)** at the very bottom, modeled after CAD/VS Code instrument panels. |
| **Minimap Radar** | Fixed bottom-right position collided with the right inspector drawer whenever a device was clicked. | **Reactive Offset**: Elevated to `bottom: 40px`, driven by `--inspector-offset: 380px` when inspector is open, shifting smoothly via CSS `right: calc(14px + var(--inspector-offset))`. |
| **Mobile Experience** | Desktop layout crammed onto a 390px phone screen. Text became unreadable; tap targets were < 20px; side drawers covered 100% of the diagram. | **Re-Engineered Mobile Console**: Compact 44px topbar, 100% touch canvas with 1-finger pan and 2-finger pinch, floating thumb-zone Re-center button, **4-tab bottom navigation**, and a **Pull-Up Bottom Sheet** with 3 snap points (`peek` 84px, `half` 52vh, `full` 92vh). |
| **Swipe Handle Leak** | Mobile bottom-sheet drag handle was rendered unconditionally on desktop. | Scoped strictly with CSS: `display: none` on desktop/tablet, `display: block` exclusively within `@media (max-width: 767px)`. |

---

## 3. Responsive Screen Tier Engineering

### Tier A: Desktop Workstation (`>= 1024px`)
* **Layout Structure**: 
  - Grounded Top Command Bar (48px fixed height)
  - Full-Bleed Vector Stage (`position: fixed; inset: 0`)
  - Left Sidebar (260px width, `Ctrl+B`) showing Site Zone tree (Overview, Zones with device counts)
  - Right Inspector Drawer (380px width, opens on device or link click)
  - Grounded Bottom Status Bar (28px fixed height)
  - Reactive Minimap (Bottom-right, shifting left via `--inspector-offset`)
* **Interaction Paradigm**:
  - Mouse wheel zoom centered on cursor coordinates
  - Click-and-drag infinite canvas panning
  - Right-click CAD context menu at pointer location (Inspect, Focus, Trace, Copy IP, Copy SSH)
  - Monospace tabular data for interfaces and metadata

### Tier B: Tablet Surface (`768px – 1023px`)
* **Layout Structure**:
  - Top Command Bar automatically truncates intermediate breadcrumbs (shows current Zone/Pod only)
  - Right Inspector shifts from a docked flex column to an **ergonomic slide-over overlay drawer** (340px) with backdrop scrim, preserving canvas visibility.
  - Left Sidebar becomes a slide-over drawer.
* **Interaction Paradigm**:
  - Minimum 44×44px touch tap targets
  - Stylus and 2-finger pinch-to-zoom support
  - Palm rejection on canvas touch events

### Tier C: Mobile Phone (`< 768px`, 360px – 430px)
* **Layout Structure**:
  1. **Compact Mobile Topbar (44px)**: Logo mark + Pod title + Search trigger + Theme toggle.
  2. **100% Full-Viewport Stage**: Zero desktop clutter.
  3. **Floating Thumb-Zone FAB**: 44×44px circular button at bottom-right (`bottom: 72px; right: 16px`) for instant 1-tap view fitting.
  4. **Mobile Bottom Navigation Bar (56px + iOS safe area)**:
     - `[Canvas]`: Closes all drawers, gives 100% focus to diagram.
     - `[Search]`: Opens instant full-screen search modal with virtual keyboard autofocus.
     - `[Pages]`: Opens Site Navigation drawer on multi-page sites.
     - `[Details]`: Opens device inspection sheet.
  5. **3-Snap-Point Bottom Sheet (`data-sheet-snap`)**:
     - Controlled via `data-sheet-snap="peek | half | full"` on `.m-inspector`:
       - **`peek` (`84px`)**: Displays switch hostname, status dot, model, and IP, keeping 85% of the canvas visible above so engineers can trace connections.
       - **`half` (`52vh`)**: Default open state when tapping "Details" or clicking a node.
       - **`full` (`92vh`)**: Auto-expands when tapping dense tabs (Interfaces, Metadata, Config) or dragging up on the grab handle.
* **Interaction Paradigm**:
  - One-finger fluid drag pan
  - Two-finger pinch-to-zoom with continuous center point tracking
  - Tap device to immediately peek bottom sheet

---

## 4. The HTML Skeleton & Slot Architecture (Real Marrow Schema)

```html
<div id="marrow-shell" data-single-file="false" data-view-mode="default">

  <!-- 1. Unified Command Bar (Adapts 48px -> 44px via CSS) -->
  <header class="m-command-bar">
    <div class="m-header-left">
      <!-- Sidebar Trigger (Ctrl+B) - Multi-page sites -->
      <button class="m-icon-btn m-sidebar-btn" type="button" aria-label="Toggle sidebar">
        <slot name="sidebar-icon"><!-- Hamburger (Ctrl+B) --></slot>
      </button>
      <slot name="brand-mark"><!-- Marrow vector mark --></slot>
      <nav class="m-breadcrumbs" aria-label="Breadcrumb">
        <slot name="breadcrumbs"><!-- Site / Zone / Page --></slot>
      </nav>
    </div>

    <div class="m-header-right">
      <!-- Search Trigger (Ctrl+K) -->
      <button class="m-search-btn" type="button" aria-label="Search">
        <slot name="search-icon"></slot>
        <span class="m-desk-only">Search devices…</span>
        <kbd class="m-desk-only">Ctrl K</kbd>
      </button>

      <!-- Stats chip -->
      <div class="m-stats-chip m-desk-only">
        <slot name="topology-stats"><!-- 12 Devices · 24 Links --></slot>
      </div>

      <!-- Theme Switch -->
      <button class="m-icon-btn m-theme-btn" type="button" aria-label="Toggle theme">
        <slot name="theme-icon"></slot>
      </button>

      <!-- Vector CAD Export -->
      <button class="m-btn-export m-desk-only" type="button" aria-label="Export CAD">
        <slot name="export-action">Export</slot>
      </button>
    </div>
  </header>

  <!-- 2. Main Workspace Row -->
  <div class="m-workspace">

    <!-- Left Site Navigation Sidebar (Multi-Page Sites) -->
    <aside class="m-sidebar" id="slot-sidebar">
      <div class="m-sidebar-head">
        <slot name="sidebar-title">Navigation</slot>
        <button class="m-sidebar-close" type="button" aria-label="Close sidebar"></button>
      </div>
      <div class="m-sidebar-body">
        <slot name="site-zone-tree">
          <!-- Overview Page -->
          <!-- Zone Pages with device count badges e.g. Pod 1 Core [4] -->
          <!-- Inventory Page -->
        </slot>
      </div>
    </aside>

    <!-- Vector Drawing Stage -->
    <main class="m-stage" id="slot-stage">
      <svg class="m-svg-viewport">
        <!-- SVG Canvas Vector Group (<g id="camera-group">) -->
      </svg>
    </main>

    <!-- Minimap Radar (Elevated 40px, shifted via --inspector-offset) -->
    <div class="m-minimap" id="slot-minimap">
      <slot name="minimap-radar"></slot>
    </div>

    <!-- Floating Mobile Re-Center FAB -->
    <button class="m-mobile-fab" type="button" aria-label="Fit View">
      <slot name="mobile-fab-icon"></slot>
    </button>

    <!-- Right Telemetry Inspector Drawer (Real Schema Data) -->
    <aside class="m-inspector" id="slot-inspector" data-sheet-snap="half">
      <!-- Mobile Drag Handle (display:none on desktop) -->
      <div class="m-sheet-drag-handle"></div>

      <div class="m-inspector-head">
        <div class="m-inspector-id">
          <slot name="device-title"><!-- Hostname + Status Dot --></slot>
          <slot name="device-sub"><!-- Role · Tier · Zone --></slot>
          <slot name="device-mgmt-ip"><!-- Management IP (click to copy) --></slot>
        </div>
        <button class="m-inspector-close" type="button" aria-label="Close"></button>
      </div>

      <!-- Real Schema Inspector Tabs -->
      <nav class="m-inspector-tabs">
        <button class="m-tab-btn active" data-tab="overview">Overview</button>
        <button class="m-tab-btn" data-tab="interfaces">Interfaces (<span class="m-port-count"></span>)</button>
        <button class="m-tab-btn" data-tab="neighbors">Neighbors</button>
        <button class="m-tab-btn" data-tab="metadata">Metadata</button>
        <button class="m-tab-btn" data-tab="config">Config</button>
      </nav>

      <div class="m-inspector-body">
        <slot name="inspector-tab-content">
          <!-- Overview: Role, Tier, Zone, HA Pair, Notes -->
          <!-- Interfaces Table: Port, IP, VLAN, Description -->
          <!-- Neighbors Table: Connected Device, Port, Speed, Jump Focus -->
          <!-- Metadata Table: Custom Fields & Sections -->
          <!-- Config Snippet: Monospace block -->
        </slot>
      </div>
    </aside>

  </div>

  <!-- 3. Grounded Status Bar (28px Desktop & Tablet) -->
  <footer class="m-status-bar">
    <div class="m-status-left">
      <slot name="selection-summary"><!-- core-sw-01 (10.255.0.1) --></slot>
      <slot name="pointer-coordinates"><!-- X: 520, Y: 340 --></slot>
    </div>
    <div class="m-status-center">
      <slot name="camera-zoom-controls"><!-- [-] 100% [+] [Fit] --></slot>
    </div>
    <div class="m-status-right">
      <slot name="minimap-toggle"><!-- Toggle Minimap --></slot>
      <slot name="marrow-version"><!-- Marrow v2.4 --></slot>
    </div>
  </footer>

  <!-- 4. Mobile Bottom Navigation Bar (< 768px, 56px) -->
  <nav class="m-mobile-nav">
    <slot name="mob-tab-canvas">Canvas</slot>
    <slot name="mob-tab-search">Search</slot>
    <slot name="mob-tab-pages">Pages</slot>
    <slot name="mob-tab-details">Details</slot>
  </nav>

  <!-- 5. Global Overlays -->
  <div class="m-spotlight-backdrop"><!-- Ctrl+K Fuzzy Device/IP Search Modal --></div>
  <div class="m-context-menu"><!-- Right-click CAD Context Menu --></div>

</div>
```

---

## 5. Main System Token Mapping (`packages/site/src/tokens.ts`)

Every component strictly inherits Marrow's declared CSS custom properties:

```css
/* Grounded Bars */
.m-command-bar, .m-status-bar, .m-mobile-nav {
  background: var(--panel);
  border-color: var(--line);
  color: var(--ink);
}

/* Surfaces & Drawers */
.m-sidebar, .m-inspector, .m-minimap, .m-context-menu {
  background: var(--panel);
  border-color: var(--line);
  box-shadow: var(--shadow-drawer);
}

/* Secondary Panels & Elevated Cards */
.m-inspector-tabs, .m-spotlight-foot, .m-nav-tree-item:hover {
  background: var(--bg-raise);
  color: var(--ink-dim);
}

/* Accent & Selection Highlights */
.m-nav-tree-item.active, .m-spotlight-item.is-selected {
  background: var(--m-accent-subtle);
  color: var(--m-accent);
  border-color: color-mix(in srgb, var(--m-accent) 30%, transparent);
}

/* Operational Telemetry Dots */
.m-status-up   { color: var(--up); }
.m-status-down { color: var(--down); }
.m-status-warn { color: var(--degraded); }
```

---

## 6. Implementation Directives

### Directive 1: 3-Snap-Point Mobile Bottom Sheet (`< 768px`)
* Controlled via `data-sheet-snap="peek | half | full"` on `.m-inspector`:
  - `peek` (`84px`): Identity header, status LED, and management IP.
  - `half` (`52vh`): Default open state on device select.
  - `full` (`92vh`): Auto-expands on dense tab click (Interfaces, Config) or dragging up.

### Directive 2: Left Sidebar (`Ctrl+B`) & Single-File Rule
* In multi-page site mode: displays the Site Navigation Tree with zone count badges.
* In single-file mode (`--single`): `.m-sidebar` is collapsed by default (`margin-left: -260px`) so diagrams immediately render at 100% viewport width without wasted margin.

### Directive 3: Minimap Placement via CSS Variable Offset
* `.m-minimap` is placed at `bottom: 40px` and `right: calc(14px + var(--inspector-offset))`.
* `--inspector-offset` is set on `#marrow-shell` (`0px` when closed, `380px` when inspector is open on desktop).

### Directive 4: Single Unified Header Element
* A single `<header class="m-command-bar">` handles both desktop and mobile viewports via responsive CSS media queries. No duplicate DOM trees.

### Directive 5: Safe-Inset Camera Viewport Math
* `@marrow/runtime` `fitToScreen()` subtracts:
  - Top: `48px` (`44px` on mobile)
  - Bottom: `28px` (`56px` + safe-area on mobile, or active sheet height)
  - Left: `260px` (when `.m-sidebar` is open on desktop)
  - Right: `380px` (when `.m-inspector` is open on desktop)
