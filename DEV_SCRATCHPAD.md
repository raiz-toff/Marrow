# Agent Tooling Dev Scratchpad

<!-- Paste or write notes, raw outputs, configs, or prompt briefs below. -->

## Queued Documentation Tasks (Post-Layout / UI Polish)
- [x] **Document Example Topologies (`input/`)**:
  - `branch-hq.yaml`: Dual-router branch office topology with active/standby IPsec tunnels, edge firewalls, and branch core switches. Documented in `docs/content/3.guides/1.authoring.md`.
  - `feature-showcase.v2.yaml`: Kitchen-sink showcase illustrating tiers, zones, status LEDs, LAG bundles, VLAN chips, hero highlight, port chips, custom fields, sections, density presets, and scale multiplier. Documented in `docs/content/3.guides/1.authoring.md`.
  - `global-enterprise.yaml`: Large-scale multi-datacenter / multi-cloud enterprise topology demonstrating collapse, clustering, and high-density node performance. Documented in `docs/content/3.guides/1.authoring.md`.
  - `multivendor_discovery.v2.yaml`: Real-world multivendor enterprise layout (Cisco, Fortinet, Arista, Linux) parsed from discovery/CDP data. Documented in `docs/content/3.guides/1.authoring.md`.
  - Documented CLI workflows for users and agents to validate, build, and serve topologies.
- [x] **Document Defects 1–5 Architectural Decisions & User Guides**:
  - ADR-0013: Design token contract and theme overrides (`docs/content/7.decisions/14.0013-design-token-contract-and-theme-overrides.md`).
  - ADR-0014: Density presets and layout metrics (`docs/content/7.decisions/15.0014-density-presets-and-layout-metrics.md`).
  - ADR-0015: Modular UI chrome and embed modes (`docs/content/7.decisions/16.0015-modular-ui-chrome-and-embed-modes.md`).
  - ADR-0016: Extensible metadata and inspector sections (`docs/content/7.decisions/17.0016-extensible-metadata-and-inspector-tabs.md`).
  - ADR-0017: Configurable blueprint export chrome (`docs/content/7.decisions/18.0017-configurable-blueprint-export-chrome.md`).
  - Updated Decision Index (`docs/content/7.decisions/1.overview.md`).
  - Updated Output Guide with blueprint exports, title blocks, and auto-legends (`docs/content/3.guides/6.output.md`).
  - Updated Layout Guide with density & scale (`docs/content/3.guides/3.layout.md`).
  - Updated Branding Guide with design tokens & live hot reload (`docs/content/3.guides/5.branding.md`).
  - Updated Embedding Guide with embed/kiosk query and hash flags (`docs/content/3.guides/7.embedding.md`).
  - Updated Authoring Guide with custom fields, sections, link inspection, and blueprint metadata (`docs/content/3.guides/1.authoring.md`).
  - Updated Agent Rules (`docs/content/5.agents/3.rules.md`) and Topology Authoring Skill (`.agents/skills/marrow-topology/SKILL.md`).

## Implementation Log: Phase 1 & Phase 2 (Modular Design Token System)

### Overview
Addressed Defect 1: Eliminated hardcoded theme palettes and link styles by introducing a unified Design Token Contract (`tokens.ts`) and extending `marrow.config.yaml` schema with validation gates.

---

### Phase 1: Design Token Contract (`@marrow/site`)
1. **New Token System File**: [`packages/site/src/tokens.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/tokens.ts)
   - **`PaletteTokens`**: `bg`, `panel`, `surface`, `line`, `subtle`, `ink`, `muted`, `faint`, `accent`, `accentHover`, `accentSubtle`, `accentInk`.
   - **`StatusTokens`**: `up`, `down`, `degraded`, `adminDown`, `unknown`.
   - **`LinkStyleTokens`**: `defaultStrokeWidth`, `tenGStrokeWidth`, `fortyGStrokeWidth`, `trunkStrokeWidth`, `slotStrokeWidth`, `stackStrokeWidth`.
   - **`ThemeConfig`**: Supports partial overrides for `dark`, `light`, and `links`.
   - **Defaults**:
     - `DEFAULT_DARK_PALETTE` (slate/zinc dark, blue accent `#3b82f6`).
     - `DEFAULT_LIGHT_PALETTE` (pure white canvas `#ffffff`, panel `#f8fafc`, blue accent `#2563eb`).
     - `DEFAULT_DARK_STATUS` / `DEFAULT_LIGHT_STATUS` (emerald `#22c55e`, rose `#ef4444`, amber `#f59e0b`, slate `#64748b`, zinc `#71717a`).
     - `DEFAULT_LINK_TOKENS` (default: 1.5, 10G: 2.5, 40G: 4.0, trunk: 3.0, slot: 1.0, stack: 5.0).
   - **`generateThemeCss(config?: ThemeConfig)`**: Generates CSS custom property root declarations dynamically merged with user overrides.

2. **Stylesheet Refactoring**: [`packages/site/src/styles.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/styles.ts)
   - Exported `buildStylesheet(config?: ThemeConfig): string`.
   - Replaced static `:root` token blocks with `generateThemeCss(config)`.
   - Converted hardcoded SVG edge stroke widths (`1.5`, `2.5`, `4`, `3`, `1`, `5`) to CSS custom properties:
     - `stroke-width: var(--edge-width-default, 1.5px)`
     - `stroke-width: var(--edge-width-10g, 2.5px)`
     - `stroke-width: var(--edge-width-40g, 4px)`
     - `stroke-width: var(--edge-width-trunk, 3px)`
     - `stroke-width: var(--edge-width-slot, 1px)`
     - `stroke-width: var(--edge-width-stack, 5px)`
   - **Visual Polish**: Fixed stark solid-white button defect on `.m-chip-btn`: updated with frosted glass styling (`background: color-mix(in srgb, var(--panel) 85%, transparent)`, `backdrop-filter: blur(8px)`, `border: 1px solid var(--line)`).

3. **Shell & Builder Plumbing**:
   - [`packages/site/src/shell.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/shell.ts): Added `themeConfig?: ThemeConfig` to `ShellOptions`. Injects `buildStylesheet(options.themeConfig)` into `<style>`.
   - [`packages/site/src/builder.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/builder.ts): Added `themeConfig?: ThemeConfig` to `BuildOptions`. Forwards it to `renderShell()`.
   - [`packages/site/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/index.ts): Exported token interfaces and default objects; forwards `options.themeConfig` in `buildSingleFile()`.

4. **Unit Tests**:
   - [`packages/site/test/tokens.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/test/tokens.test.ts): Verifies default CSS emission, custom override merging, and custom link stroke widths.

---

### Phase 2: Configuration & Validation Gate (`@marrow/cli` & `@marrow/server`)
1. **Schema Extension in `marrow.config.yaml`**: [`packages/cli/src/config.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/cli/src/config.ts)
   - Added `'theme'` to `ROOT_KEYS`.
   - Allowed fields:
     - `theme.dark`: Palette and status tokens (accepts snake_case or camelCase: `accent_hover`, `accentHover`, `admin_down`, `adminDown`, etc.).
     - `theme.light`: Palette and status tokens.
     - `theme.links`: `default_stroke`, `ten_g_stroke`, `forty_g_stroke`, `trunk_stroke`, `slot_stroke`, `stack_stroke`.
   - **CSS Injection & Malformed Value Protection**:
     - `SAFE_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|lab|color|color-mix|var)\([^;{}<>]+\)|[a-zA-Z_-]+)$/`
     - Blocks CSS injection attacks (disallowing `;`, `{`, `}`, `<`, `>`).
     - Link stroke widths strictly validated as positive finite numbers. Non-fatal warnings push to `problems[]`.
   - Exported `LoadedConfig.theme?: ThemeConfig`.

2. **CLI Commands Integration**: [`packages/cli/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/cli/src/index.ts)
   - Replaced `globalBrand()` with `globalConfig(explicit?: string): { brand?: Brand; themeConfig?: ThemeConfig }`.
   - Forwarded `themeConfig` into:
     - `cmdBuild`: `buildSite` and `buildSingleFile`.
     - `cmdServe`: `serve`.
     - `cmdSnapshot`: `buildSingleFile`.

3. **Dev Server Integration**: [`packages/server/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/server/src/index.ts)
   - Added `themeConfig?: ThemeConfig` to `ServeOptions`.
   - Forwarded `themeConfig` to single-page and multi-page builders in live rebuild loop.

4. **CLI Tests**: [`packages/cli/test/config.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/cli/test/config.test.ts)
   - Added tests verifying valid parsing of `theme.dark`, `theme.light`, and `theme.links`.
   - Added tests verifying rejection of CSS injection payloads and negative/invalid stroke widths.

---

### Phase 3: Runtime Bridge in `@marrow/runtime` (Canvas 2D Engine)
1. **Dynamic Token & Variable Extraction**: [`packages/runtime/src/client/canvas-engine.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/canvas-engine.ts)
   - Enhanced `ThemeColors` to include:
     - `accentInk`: Read from `--m-accent-ink` (with `#ffffff` fallback).
     - Link stroke widths: `edgeWidthDefault`, `edgeWidth10g`, `edgeWidth40g`, `edgeWidthTrunk`, `edgeWidthSlot`, `edgeWidthStack` parsed dynamically from CSS `--edge-width-*` properties via `parsePx()`.
     - Dash patterns: `dashDegraded` and `dashPlanned` parsed dynamically from `--dash-degraded` and `--dash-planned` via `parseDash()`.
   - Updated `themeColors()` fallbacks to match modern tokens (`#22c55e`, `#ef4444`, `#3b82f6`, `#09090b`, `#d4d4d8`).
2. **Synchronized Edge & Badge Rendering**:
   - `drawEdges()`: Replaced hardcoded numbers with token widths (`c.edgeWidthDefault`, `c.edgeWidth10g`, `c.edgeWidth40g`, `c.edgeWidthTrunk`, `c.edgeWidthStack`).
   - Replaced static dash patterns with `c.dashDegraded` and `c.dashPlanned`.
   - Node badge text fill: Replaced hardcoded `'#fff'` with dynamic `c.accentInk`.
   - `MutationObserver` on `[data-theme]` triggers `themeColors()` re-sample and instant redraw on theme changes.

---

### Phase 4: Verification & Snapshot Testing
1. **Runtime Token Parser Tests**: [`packages/runtime/test/canvas-styles.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/test/canvas-styles.test.ts)
   - Tested `parsePx` with pixel strings, unitless floats, whitespace, and negative/invalid fallback handling.
   - Tested `parseDash` with space-delimited, comma-delimited, and invalid/single-number dash patterns.
2. **Monorepo Build & Test Verification**:
   - `npm run compile`: Clean build across `@marrow/tokens`, `@marrow/site`, `@marrow/cli`, `@marrow/runtime`, `@marrow/server`.
   - `npm test`: Full 29 test suites passed (**293/293 tests green**).

---

### Bonus / Real-Time Ergonomics: Live `marrow.config.yaml` Hot-Reloading
1. **Config Watcher in `@marrow/server`**:
   - Added `configFile?: string` and dynamic `configLoader?: () => { brand?: Brand; themeConfig?: ThemeConfig }` to `ServeOptions`.
   - Attached `fs.watch` to the resolved `marrow.config.yaml` path.
   - On edit: clears page cache, re-invokes `configLoader()`, and re-triggers `rebuild()`.
   - Browser automatically receives the SSE reload event and updates the diagram live with zero server restarts!
2. **Integration in `@marrow/cli`**:
   - Passes `configFile` and `configLoader: () => globalConfig(configFile)` directly to `serve()`.

---

## Implementation Log: Defect 2 — Fixed Node Sizes & Font Metrics (Phases 1 & 2)

### Overview
Addressed Defect 2 by introducing high-level density presets (`compact` | `standard` | `spacious`) and an optional `scale` multiplier (0.4 to 2.5) across topology YAML and `marrow.config.yaml`, scaling icon chips, label font metrics, ELK layer/node spacing, zone padding, port chips, and both SVG and Canvas renderers.

---

### Phase 1: Model & Schema Contracts
1. **Model Definition**: [`packages/model/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/model/src/index.ts)
   - Exported `Density = 'compact' | 'standard' | 'spacious'` and `DENSITIES`.
   - Added `density?: Density; scale?: number;` to `Topology`.
2. **Schema & Normalization**:
   - [`packages/schema/src/keys.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/keys.ts): Registered `'density'` and `'scale'` in `ROOT_KEYS`.
   - [`packages/schema/src/zodSchema.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/zodSchema.ts): Validated with `asEnum(DENSITIES).default('standard')` and `z.number().min(0.4).max(2.5).default(1)`.
   - [`packages/schema/src/normalize.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/normalize.ts): Forwarded `density` and `scale` to normalized topology.
3. **Configuration & Dev Server Integration**:
   - [`packages/cli/src/config.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/cli/src/config.ts): Added `layout.density` and `layout.scale` to `marrow.config.yaml` parser.
   - [`packages/site/src/pages.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/pages.ts): Updated sub-topologies (`overviewTopology`, `zoneTopology`, `deviceTopology`) to preserve `density` and `scale` across multi-page sites.
   - [`packages/server/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/server/src/index.ts): Added `layout` to `ServeOptions` and `State`, applying config layout to live dev diagrams on hot-reload.

---

### Phase 2: Layout Metrics Engine & Dynamic Geometry Scaling
1. **Layout Metrics Contract**: [`packages/layout/src/metrics.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/metrics.ts)
   - Created `LayoutMetrics` and `resolveLayoutMetrics(density, scale)`.
   - Presets:
     - `compact`: Chip 48, labelSize 10, labelGap 4, maxLabelW 130, layerSpacing 60, nodeSpacing 32, padding 32, portChipH 14.
     - `standard`: Chip 64, labelSize 12, labelGap 6, maxLabelW 168, layerSpacing 88, nodeSpacing 48, padding 48, portChipH 16 (100% exact numerical baseline match).
     - `spacious`: Chip 80, labelSize 14, labelGap 8, maxLabelW 210, layerSpacing 116, nodeSpacing 64, padding 64, portChipH 18.
   - Multiplier: `scale` scales all metrics linearly when provided.
2. **Scene Contract Extensions**: [`packages/scene/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/scene/src/index.ts)
   - Added `labelSize?: number;` to `SceneNode`.
   - Added `density?: string; scale?: number;` to `Scene`.
3. **Layout Pipeline Refactoring**:
   - [`packages/layout/src/size.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/size.ts): `sizeNode(device, metrics)` calculates dynamic bounding boxes using metrics chip, font size, gap, and label width.
   - [`packages/layout/src/elk.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/elk.ts): Injects dynamic `layerSpacing`, `nodeSpacing`, `componentSpacing`, and `padding` into ELK options.
   - [`packages/layout/src/presets.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/presets.ts): `placePolar` and `placeCircle` scale `ringGap`, `minRadius`, and `hubGap`.
   - [`packages/layout/src/zones.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/zones.ts) & [`packages/layout/src/compose.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/compose.ts): Dynamic `zonePad` and `composeGap`.
   - [`packages/layout/src/portchips.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/portchips.ts): Dynamically sizes and places port chips (`portChipH`, `portChipChar`, `portChipPad`).
   - [`packages/layout/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/src/index.ts): Resolves `metrics = options.metrics ?? resolveLayoutMetrics(t.density, t.scale)` and annotates `SceneNode.labelSize`, `Scene.density`, and `Scene.scale`.
4. **Rendering Synchronization**:
   - [`packages/render-svg/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/render-svg/src/index.ts): Computes dynamic corner radius `rx`, icon insets, LED position/radius, badge position, and label font size (`style="font-size:${n.labelSize}px"`).
   - [`packages/runtime/src/client/canvas-engine.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/canvas-engine.ts): Updated `CScene.nodes` with `labelSize`; canvas drawing scales `rx`, icon insets, LED position/radius, badge position, and `g.font = "${labelSize}px system-ui, sans-serif"`.
   - [`packages/site/src/styles.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/styles.ts): `.m-label` font size bound to `var(--m-label-size, 12px)`.
5. **Testing**:
   - [`packages/layout/test/density.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/layout/test/density.test.ts): Unit tests verifying metric resolutions, sizing reductions in `compact`, expansions in `spacious`, scale multiplier scaling, and geometry linter cleanliness.

---

## Implementation Log: Defect 3 & Defect 4 — Modular UI Chrome & Inspector Drawer

### Overview
Addressed Defect 3 (Embed & Kiosk UI Modularity) and Defect 4 (Modular Inspector Drawer Tabs) with backwards compatibility, zero layout shifts, zero flash of unstyled content (FOUC), and support for arbitrary metadata structures.

---

### Defect 3: Embed & Kiosk Modularity (URL Query/Hash & Config)
1. **Zero-FOUC Head Pre-Boot Script**: [`packages/site/src/shell.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/shell.ts)
   - Injected `<script>` executed synchronously in `<head>` before first paint.
   - Parses both `location.search` (`?chrome=minimal`, `?inspector=off`, `?minimap=off`, `?theme=light`) and `location.hash` (`#embed=true`, `#inspector=off;minimap=off`).
   - Sets `data-chrome="minimal"`, `data-inspector="off"`, `data-minimap="off"`, and `data-theme` on `document.documentElement`.
   - Added `chrome?: 'full' | 'minimal'` and `embed?: boolean` to `ShellOptions` and `BuildOptions` ([`packages/site/src/builder.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/builder.ts)).

2. **Declarative Modular CSS Selectors**: [`packages/site/src/styles.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/styles.ts)
   - `html[data-chrome="minimal"]`: hides topbar breadcrumbs (`.m-breadcrumbs`), search dock (`.m-dock`, `.m-dock-hint`), sidebar rail button (`.m-rail-wrap`), backdrop (`.m-backdrop`), and sidebar (`.m-sidebar`).
   - Keeps pan/zoom (gesture drag, wheel, `.m-controls`), canvas/svg stage, and hover tooltips (`.m-tooltip`) fully active.
   - `html[data-inspector="off"] .m-inspector`: disables inspector drawer completely.
   - `html[data-minimap="off"] .m-minimap`: hides minimap.

3. **Runtime Synchronization**: [`packages/runtime/src/shared/hash.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/shared/hash.ts) & [`packages/runtime/src/client/main.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/main.ts)
   - Created `parseModularParams(search, hash)`: unit-tested utility to extract embed/chrome/inspector/minimap/theme flags from query and hash strings.
   - Added `syncModularParams(ctx)` in `boot()` and attached to `window.addEventListener('hashchange')` for dynamic parent host iframe updates without full reloads.
   - Updated `setupTheme()` to prioritize URL theme overrides over stored `localStorage` values.

---

### Defect 4: Modular Inspector Drawer Tabs & Custom Fields
1. **Data Model Contract**: [`packages/model/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/model/src/index.ts)
   - Added `CustomFieldValue`, `CustomFieldMap`, `CustomSectionContent`, `CustomSectionMap`.
   - Extended `Device` and `Link` interfaces with `customFields?: CustomFieldMap` and `sections?: CustomSectionMap`.

2. **Schema & Normalization**:
   - [`packages/schema/src/keys.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/keys.ts): Registered `'custom_fields'` and `'sections'` in `DEVICE_KEYS` and `LINK_KEYS`.
   - [`packages/schema/src/zodSchema.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/zodSchema.ts): Defined `customFieldsSchema` (record of primitives) and `customSectionsSchema` (record of string/markdown, object facts, or array of row objects).
   - [`packages/schema/src/normalize.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/normalize.ts): Mapped `d.custom_fields` $\to$ `device.customFields` and `d.sections` $\to$ `device.sections` (and links).

3. **Data Serialization & Runtime Bridge**:
   - [`packages/site/src/builder.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/builder.ts): Forwarded `customFields`, `sections`, and link `note` in `embeddedData()`.
   - [`packages/runtime/src/client/data.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/data.ts): Updated `DataDevice` and `DataLink` with `customFields`, `sections`, and `note`.

4. **Inspector Drawer Collapsible Section Renderer**: [`packages/runtime/src/client/main.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/main.ts)
   - Implemented `renderCustomSection(title, content)`:
     - **Array of Objects**: Renders an auto-formatted `<table class="m-table">` inside `.m-table-wrap` with derived column headers (ideal for BGP peers, firewall rules, MAC addresses).
     - **Key-Value Object**: Renders a `<dl class="m-facts">` list (ideal for serial numbers, rack locations, asset tags).
     - **Markdown String**: Safely parses markdown tables (`| col | col |`), bold, italics, inline code, and line breaks without external dependencies.
     - Collapsible: Wrapped in `<details class="m-inspector-section" open><summary><h3>${title}</h3><svg class="m-section-chevron">...</svg></summary>...`.
   - Implemented `fillLinkInspector(maps, link, onGoto)`: clicking an edge in SVG mode opens link details drawer with facts, notes, link swatch, custom fields, and custom sections.

5. **Drawer Styles**: [`packages/site/src/styles.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/styles.ts)
   - Styled `.m-inspector-section`, summary hover states, rotating `.m-section-chevron`, `.m-table-wrap`, and `.m-table` borders and typography.

6. **Unit Tests**:
   - [`packages/schema/test/normalize.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/test/normalize.test.ts): Verifies `custom_fields` and `sections` validation & normalization.
   - [`packages/site/test/site.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/test/site.test.ts): Verifies embed head script emission, minimal chrome data attribute, and custom metadata in `<script id="marrow-data">`.
   - [`packages/runtime/test/shared.test.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/test/shared.test.ts): Verifies `parseModularParams` across query string and hash combinations.

---

### Defect 5: Static Export (PNG/SVG) Configurable Blueprint Chrome
1. **Title Block & Metadata Model**: [`packages/model/src/index.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/model/src/index.ts)
   - Added `TitleBlock` interface (`title`, `author`, `date`, `revision`, `logo`).
   - Extended `Topology` with optional `author`, `revision`, `date`, and `titleBlock`.

2. **Schema & Normalization**:
   - [`packages/schema/src/keys.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/keys.ts): Registered `'author'`, `'revision'`, `'date'`, and `'title_block'` in `ROOT_KEYS`, and exported `TITLE_BLOCK_KEYS`.
   - [`packages/schema/src/zodSchema.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/zodSchema.ts): Defined `titleBlockSchema` and wired into `topologySchema`.
   - [`packages/schema/src/normalize.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/normalize.ts): Normalized title block metadata with fallbacks to topology root fields, brand defaults, and date.

3. **Data Serialization & Runtime Bridge**:
   - [`packages/site/src/builder.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/site/src/builder.ts): Forwarded `titleBlock` in `embeddedData()`.
   - [`packages/runtime/src/client/data.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/data.ts): Updated `EmbeddedData` with `DataTitleBlock`.
   - [`packages/runtime/src/shared/hash.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/shared/hash.ts): Added `exportTitle`, `exportLegend`, and `exportPorts` options to `ModularUiOptions`.

4. **Modular Blueprint Chrome Generator**: [`packages/runtime/src/client/main.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/runtime/src/client/main.ts)
   - **`renderTitleBlock(tb, x, y, w, h)`**: Renders a crisp engineering title block table (title, author, revision, date, logo) with theme token variables.
   - **`renderAutoLegend(links, x, y, maxW)`**: Scans active links on the diagram, aggregates unique modes/speeds/kinds (Trunk, Tunnel, Peering, 10G Fiber, etc.), and draws vector swatches matching live diagram styling.
   - **`standaloneSvg(ctx, options)`**:
     - Automatically expands the canvas bounding box with a 110px blueprint footer when title block or auto-legend are active.
     - Draws a subtle dividing dashed hairline.
     - Forces port labels (`.m-portlabel { opacity: 1 !important; }`) so interface ports are 100% visible on static export.
   - **`exportPng(ctx, options)`**: Rasterizes the complete blueprint SVG onto high-resolution 2x Retina canvas.

---

### Marrow Brand Standard & Live Visual Documentation
1. **Brand Standard**:
   - Replaced all legacy "Acme" / "Acme Networks" references across [`docs/content/3.guides/5.branding.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/5.branding.md), [`docs/content/4.reference/2.config.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/4.reference/2.config.md), [`docs/content/4.reference/1.schema.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/4.reference/1.schema.md), [`docs/content/3.guides/1.authoring.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/1.authoring.md), [`packages/schema/src/keys.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/schema/src/keys.ts), [`packages/cli/src/config.ts`](file:///home/coder/Production/Diagramming%20tool/Marrow/packages/cli/src/config.ts), and [`scripts/setup.mjs`](file:///home/coder/Production/Diagramming%20tool/Marrow/scripts/setup.mjs) with **Marrow** and the official Marrow arrowhead logo (`<svg ...>`).
   - Added strict agent rule: Never use generic placeholders like "Acme Networks" or generic globe icons.
2. **Visual & Interactive Documentation Components**:
   - Updated [`.agents/skills/technical-documentation/SKILL.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/.agents/skills/technical-documentation/SKILL.md) (Category E) and [`docs/content/5.agents/3.rules.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/5.agents/3.rules.md) to catalog all elements that must be visually demonstrated rather than described with text:
     - **Link Modes & Medium Strokes**: `<LinkSymbol mode="..." />` with speeds and link types.
     - **Hardware & Link Status**: `<StatusBadge status="..." />` with pulsing SVG LED halos.
     - **Device Anatomy**: Vendor icons, primary label, role badge, IP chip, hardware LED, HA pair bracket, port chips.
     - **Brand Header & Blueprint Chrome**: Marrow brand strip with logo mark, CAD title block, and dynamic auto-legend.
     - **Layout Archetypes & Routing**: Miniature vector schemas for Tiered, Ring, Mesh, Hub-and-Spoke, and Zoned.
     - **Density Presets**: Comparison grids for `compact`, `standard`, and `spacious`.
     - **Inspector Drawer & Custom Sections**: Collapsible drawers, key-value fact lists, and markdown/tables.
     - **Embedding & Kiosk Surfaces**: Comparison frames for standalone, `#embed=true`, and presentation kiosk.
     - **The Four-Layer Engine**: Exploded rendering pipeline stack.

3. **Live Demonstration Assets**:
   - Integrated [`docs/public/screenshots/link-inspector.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/link-inspector.png) into [`docs/content/3.guides/1.authoring.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/1.authoring.md).
   - Integrated [`docs/public/screenshots/device-inspector.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/device-inspector.png) into [`docs/content/3.guides/1.authoring.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/1.authoring.md).
   - Integrated [`docs/public/screenshots/feature-showcase.svg`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/feature-showcase.svg) and [`docs/public/screenshots/blueprint-export.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/blueprint-export.png) into [`docs/content/3.guides/6.output.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/6.output.md) and [ADR-0017](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/7.decisions/18.0017-configurable-blueprint-export-chrome.md).
   - Integrated [`docs/public/screenshots/embed-kiosk.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/embed-kiosk.png) into [`docs/content/3.guides/7.embedding.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/7.embedding.md).
   - Integrated [`docs/public/screenshots/command-center.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/command-center.png) into [`docs/content/2.getting-started/2.first-diagram.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/2.getting-started/2.first-diagram.md).
   - Created reference topology [`input/zoned-hierarchy.yaml`](file:///home/coder/Production/Diagramming%20tool/Marrow/input/zoned-hierarchy.yaml) showcasing multi-zone spatial clustering, vertical 5-tier progression, HA pairs, and curved spline routing. Verified with 0 errors via `npm run validate`.
   - Integrated [`docs/public/screenshots/zoned-hierarchy.png`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/public/screenshots/zoned-hierarchy.png) into [`docs/content/3.guides/2.zones-and-tiers.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/3.guides/2.zones-and-tiers.md) and [`docs/content/1.why.md`](file:///home/coder/Production/Diagramming%20tool/Marrow/docs/content/1.why.md) to visually demonstrate layout computed from declared structure.


