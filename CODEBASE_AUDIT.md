# Marrow Codebase Technical Audit

## 1. Directory & File Tree

### Root & Package Structure (Up to 3 levels, excluding build artifacts, node_modules, and raw SVGs)

```text
Marrow/
├── .agents/
│   └── skills/
│       ├── domain-modeling/
│       ├── grill-with-docs/
│       ├── grilling/
│       ├── marrow-setup/
│       ├── marrow-topology/
│       └── technical-documentation/
├── .claude/
│   └── skills -> ../.agents/skills   (Symlink to .agents/skills)
├── docs/                      (Nuxt Content documentation site)
│   ├── app.config.ts
│   ├── content/
│   │   ├── 1.getting-started/
│   │   ├── 3.guides/
│   │   ├── 4.reference/
│   │   ├── 6.contributing/
│   │   ├── 7.decisions/       (ADRs 0001 through 0012)
│   │   └── 8.glossary.md
│   ├── nuxt.config.ts
│   └── plans/
│       ├── marrow-interop-plan.md
│       └── marrow-v2-plan.md
├── fixtures/                  (Test topologies)
│   ├── invalid/
│   └── valid/
│       ├── campus-three-tier.yaml
│       └── small-office.yaml
├── icon-packs/                (Vector icon collections)
│   ├── affinity/              (manifest.json + svg/)
│   ├── cisco/                 (manifest.json + svg/)
│   ├── generic/               (manifest.json + svg/)
│   └── k8s/                   (manifest.json + svg/)
├── input/                     (Source YAML for local testing)
│   ├── branch-hq.yaml
│   ├── feature-showcase.v2.yaml
│   ├── global-enterprise.yaml
│   └── multivendor_discovery.v2.yaml
├── legacy-v1/                 (Archived Python v1 codebase)
│   ├── engine/
│   │   ├── discovery/         (parsers.py, crawler.py)
│   │   └── ingestors/         (drawio.py)
│   ├── main.py
│   └── server.py
├── output/                    (Compiled test HTML output)
├── packages/                  (Core TypeScript workspace)
│   ├── cli/
│   │   └── src/               (index.ts, config.ts, import-v1.ts, packs.ts)
│   ├── diagnostics/
│   │   └── src/               (codes.ts, diagnostic.ts, format.ts, snippet.ts, suggest.ts)
│   ├── icons/
│   │   └── src/               (catalog.ts, fetch.ts, generate.ts, manifest.ts, search.ts)
│   ├── layout/
│   │   └── src/               (classify.ts, compose.ts, elk.ts, portchips.ts, presets.ts, router.ts, size.ts, tidy.ts, zones.ts)
│   ├── lint/
│   │   └── src/               (index.ts)
│   ├── metrics/
│   │   └── src/               (fonts.ts, measure.ts)
│   ├── model/
│   │   └── src/               (index.ts)
│   ├── render-svg/
│   │   └── src/               (index.ts, chip.ts, glyphs.ts)
│   ├── runtime/
│   │   └── src/
│   │       ├── client/        (main.ts, canvas-engine.ts, camera.ts, inspector.ts, link.ts, search.ts, state.ts)
│   │       └── index.ts
│   ├── scene/
│   │   └── src/               (box.ts, geom.ts, index.ts, link.ts)
│   ├── schema/
│   │   └── src/               (endpoint.ts, keys.ts, locate.ts, normalize.ts, validate.ts, zodSchema.ts)
│   ├── server/
│   │   └── src/               (index.ts, inject.ts)
│   └── site/
│       └── src/               (brand.ts, builder.ts, collapse.ts, pages.ts, planner.ts, shell.ts, styles.ts)
├── scripts/                   (Build, bundle, and setup scripts)
├── AGENTS.md                  (Agent operating instructions)
├── CLAUDE.md                  (Claude CLI cheat-sheet)
├── CONTEXT.md                 (Domain terminology guide)
├── DEV_SCRATCHPAD.md          (Live scratchpad)
├── package.json               (Monorepo workspace manifest)
├── tsconfig.base.json
└── vitest.config.ts
```

### Largest Source Files by Line Count

| File Path | Lines | Raw Size | Function |
| :--- | :--- | :--- | :--- |
| `packages/runtime/src/client/main.ts` | 1,978 | 82.9 KB | Monolithic in-browser interactive controller (camera, inspector, search, keyboard, SVG/PNG export) |
| `packages/site/src/styles.ts` | 960 | 53.7 KB | Inlined CSS string (`SITE_CSS`) defining themes, animations, layout chrome, and print styles |
| `packages/schema/src/validate.ts` | 723 | 27.9 KB | AST CST traverser, source snippet builder, referential integrity & error validator |
| `packages/runtime/src/client/canvas-engine.ts` | 712 | 26.0 KB | Canvas 2D immediate-mode rendering engine for scale tier (>250 nodes) |
| `packages/cli/src/index.ts` | 551 | 19.6 KB | CLI argument parser, command dispatch, Playwright snapshot runner |
| `packages/site/src/pages.ts` | 525 | 16.7 KB | Sub-topology splitting, device page generation, zone page extraction |
| `packages/site/src/shell.ts` | 489 | 18.4 KB | HTML shell string builder (topbar, dock, inspector HTML, search modal) |
| `packages/site/src/builder.ts` | 419 | 16.2 KB | Multi-page compiler, single-file compiler, MiniSearch index builder |
| `packages/server/src/index.ts` | 411 | 15.3 KB | Native HTTP/SSE dev server, incremental page rebuild watcher |

---

## 2. Package & Dependency Footprint

### Runtime & Language
* **Language**: TypeScript 5.6.0 (Target: ES2022, Module: NodeNext)
* **Runtime**: Node.js `>= 24` (ESM native `"type": "module"`)
* **Monorepo Manager**: npm workspaces (`packages/*`, `docs`)

### Root Dependencies (`package.json`)
* **`devDependencies`**:
  * `@types/node`: `^24.13.3`
  * `esbuild`: `^0.28.1` (Bundles runtime client into `dist/runtime.js`)
  * `playwright`: `^1.61.1` (Headless browser automation for `snapshot`)
  * `typescript`: `^5.6.0`
  * `vitest`: `^3.0.0` (Test runner across all packages)

### Workspace Dependencies by Subsystem

| Subsystem | Exact Package & Version | Internal Package | Role |
| :--- | :--- | :--- | :--- |
| **YAML Parsing** | `yaml: ^2.5.0` | `@marrow/schema`, `@marrow/cli` | CST parsing with `LineCounter` for exact line/column tracking |
| **Schema Validation** | `zod: ^4.0.0` | `@marrow/schema` | Schema definition and type inference (`zodSchema.ts`) |
| **Layout Placement** | `elkjs: ^0.12.0` | `@marrow/layout` | Layered hierarchy node placement (runs in Node.js at build time) |
| **Edge Routing** | `libavoid-js: 0.5.0-beta.5` | `@marrow/layout` | Orthogonal edge routing around node obstacles (runs in Node.js at build time) |
| **Screenshot / Snapshot** | `playwright: ^1.61.1` | Root / `@marrow/cli` | Spawns headless Chromium to capture PNG renderings |
| **Dev Server** | *Zero external dependencies* | `@marrow/server` | Hand-rolled using `node:http`, `node:fs.watch`, and Server-Sent Events (SSE) |
| **Icon Unpacking** | `fflate: ^0.8.3` | `@marrow/icons` | Unzips fetched vendor icon archives |
| **Runtime Client** | *Zero runtime dependencies* | `@marrow/runtime` | Bundled by esbuild into a single ~20 KB IIFE (`dist/runtime.js`) |

---

## 3. CLI Commands & Execution Flow

### Implemented Commands (`packages/cli/src/index.ts`)

| Command | Entry Handler | Description |
| :--- | :--- | :--- |
| `marrow validate <file...>` | `cmdValidate()` | Validates schema syntax, references, and icon existence. Supports `--json`. |
| `marrow build <file>` | `cmdBuild()` | Compiles YAML into a single HTML file (`--single`) or multi-page directory (`output/<name>/`). |
| `marrow serve <path>` | `cmdServe()` | Starts local dev server (`127.0.0.1:5200`) with SSE live-reload and `/api/*`. |
| `marrow snapshot <file>` | `cmdSnapshot()` | Compiles diagram to temporary HTML, renders in Playwright Chromium, emits PNG. |
| `marrow import <v1.yaml>` | `cmdImport()` | Converts legacy Python v1 YAML files to v2 format. |
| `marrow icons search <query>`| `cmdIcons()` | Queries local icon catalog by keyword. |
| `marrow icons fetch <pack>` | `cmdIcons()` | Downloads AWS/Azure/GCP vendor icon packs. |
| `marrow schema` | `cmdSchema()` | Emits JSON Schema generated from Zod definition. |

### End-to-End Data Flow (`.yaml` to `.html`)

```text
input.yaml
    │
    ▼
1. YAML Parse & Validate (@marrow/schema: validateSource)
   ├── Parse CST via `yaml` with LineCounter
   ├── Type check via `zodSchema.ts`
   ├── Cross-reference checks (device IDs, zone IDs, link endpoints)
   └── Icon existence validation against catalog
    │
    ▼ returns normalized Topology object (@marrow/model)
    │
2. Topology Clustering (@marrow/site: collapseEndpoints)
   └── Detects high-density endpoint leaf nodes and groups them into stacks (e.g. "×24")
    │
    ▼
3. Geometry Layout (@marrow/layout: layoutTopology)  [BUILD TIME ONLY]
   ├── Classify topology archetype (layered, zoned, hub-spoke, ring, mesh, polar)
   ├── Size nodes content-aware based on label font metrics (@marrow/metrics)
   ├── ELK.js places nodes and assigns tier coordinates
   ├── libavoid-js computes orthogonal polyline routes avoiding obstacles
   └── Tidy pass snaps edges to grid and aligns parallel links
    │
    ▼ returns Scene object (@marrow/scene)
    │
4. Geometry Linter (@marrow/lint: lintScene)  [BUILD TIME ONLY]
   ├── L1 Checks: fails build if node boxes overlap or edge segments pierce foreign nodes
   └── L3 Checks: checks for excessive edge crossings and aspect ratio warnings
    │
    ▼
5. Output Assembly (@marrow/site: buildSingleFile / buildSite)
   ├── @marrow/render-svg generates SVG DOM markup string for small/medium scenes (<=250 nodes)
   │   (or generates canvas host for scenes >250 nodes)
   ├── Subsets and inlines only the SVGs actually used into an inline SVG sprite
   ├── Inlines pre-bundled runtime script (@marrow/runtime: dist/runtime.js)
   ├── Inlines CSS stylesheet (@marrow/site: SITE_CSS)
   ├── Inlines topology data and search index into <script type="application/json" id="marrow-data">
   └── Inlines global branding (if configured)
    │
    ▼
output.html (Self-contained, zero-dependency offline file)
```

**ELK and `libavoid` Isolation**: Neither ELK nor `libavoid` is bundled into the client HTML. Both run strictly in Node.js at build time. The client HTML receives only static vector coordinates (`<polyline points="...">`, `<rect x="..." y="...">`).

---

## 4. Current YAML Schema & Error Codes

### Complete Working YAML Example (`fixtures/valid/campus-three-tier.yaml`)

```yaml
marrow: 2
name: Campus Three-Tier
description: Classic core/distribution/access campus with an HA core and LAG uplinks
theme: dark
x-designer-note: keep the core pair visually mirrored

zones:
  - id: campus
    name: Campus
  - id: core
    name: Core
    parent: campus
  - id: building-a
    name: Building A
    parent: campus
  - id: datacenter
    name: Datacenter
    parent: campus

devices:
  - id: core-sw-01
    name: Core Switch 1
    icon: cisco/switches/layer-3-switch
    tier: core
    zone: core
    ha_pair_with: core-sw-02
    mgmt_ip: 10.255.0.1
    hero: true
    interfaces:
      - name: Te1/0/1
        description: HA inter-switch link
        vlan: 1
      - name: Te1/0/10
        description: Uplink to Building A
  - id: core-sw-02
    name: Core Switch 2
    icon: cisco/switches/layer-3-switch
    tier: core
    zone: core
    ha_pair_with: core-sw-01
    mgmt_ip: 10.255.0.2
  - id: dist-a-01
    name: Distribution A1
    icon: cisco/switches/multilayer-remote-switch
    tier: distribution
    zone: building-a
  - id: acc-a-11
    name: Access A-11
    icon: cisco/switches/workgroup-switch
    tier: access
    zone: building-a
  - id: dc-sw-01
    name: Datacenter Switch
    icon: cisco/switches/layer-3-switch
    tier: distribution
    zone: datacenter
  - id: srv-app-01
    name: App Server
    icon: cisco/servers/file-server
    tier: endpoint
    zone: datacenter

links:
  - from: core-sw-01:Te1/0/1
    to: core-sw-02:Te1/0/1
    kind: dac
    speed: 40G
    lag: po1
    mode: trunk
    vlans: "1-4094"
  - from: core-sw-01:Te1/0/2
    to: core-sw-02:Te1/0/2
    kind: dac
    speed: 40G
    lag: po1
  - from: core-sw-01:Te1/0/10
    to: dist-a-01:Te1/1/1
    kind: fiber
    speed: 40G
    mode: routed
    protocol: ospf
  - from: core-sw-01:Te1/0/12
    to: dc-sw-01:Te1/1/1
    kind: fiber
    speed: 100G
    animated: true
  - from: dist-a-01:Gi1/0/1
    to: acc-a-11:Gi0/48
    kind: fiber
    speed: 10G
    mode: trunk
  - from: dc-sw-01:Gi1/0/10
    to: srv-app-01:eno1
    kind: copper
    speed: 10G
    mode: access
    vlans: "20"
```

### Error Code System

Diagnostics are unified in `@marrow/diagnostics`. Every error contains `code`, `message`, `severity`, source `range` (line/column), `snippet` (formatted 3-line terminal display), and optional `hint` / `suggestions`.

| Code | Severity | Description | How It Is Calculated |
| :--- | :--- | :--- | :--- |
| `MRW-E001` | Error | YAML syntax error | Emitted when `yaml.parseDocument` throws a syntax error. |
| `MRW-E002` | Error | Document root must be a mapping | Checked against root CST node type. |
| `MRW-E003` | Error | Missing marrow version | Checks existence of root `marrow` key. |
| `MRW-E004` | Error | Unsupported marrow version | Triggered if `marrow != 2`. |
| `MRW-E005` | Error | Unknown key | Compares keys against allowed schema whitelist; runs Levenshtein distance for suggestions. |
| `MRW-E006` | Error | Invalid type | Emitted when scalar or sequence type mismatches schema expectations. |
| `MRW-E007` | Error | Missing required field | Emitted if device `id`, device `icon`, or link `from`/`to` is absent. |
| `MRW-E008` | Error | Duplicate identifier | Tracked via `Set<string>` during device/zone scanning. |
| `MRW-E009` | Error | Unknown device reference | Emitted when link `from` or `to` refers to an unregistered device. |
| `MRW-E010` | Error | Unknown icon | Cross-referenced against icon catalog manifest; suggests closest valid icon IDs. |
| `MRW-E011` | Error | Invalid value | Emitted when enums (`tier`, `kind`, `speed`, `mode`, `status`) contain illegal values. |
| `MRW-E012` | Error | Invalid identifier | Regex check: must match `^[a-z0-9][a-z0-9._-]*$`. |
| `MRW-E013` | Error | Unknown zone reference | Device `zone` does not match declared zone list. |
| `MRW-E014` | Error | Invalid link endpoint | Missing colon separator or invalid port format. |
| `MRW-E016` | Error | Zone hierarchy cycle | Graph cycle detection across parent zone relationships. |
| `MRW-W101` | Warning | Port used by multiple links | Flags physical contention when the same `device:port` is used more than once. |
| `MRW-W102` | Warning | Empty zone | A zone exists with zero assigned devices. |
| `MRW-W103` | Warning | Isolated device | Device has zero connected links. |
| `MRW-W104` | Warning | Self-link | Link connects a device to itself. |
| `MRW-W105` | Warning | Link semantics mismatch | e.g. `encap` specified on a non-tunnel link. |

### Geometry Linter Errors (`@marrow/lint`)
Executed on the post-layout scene.
* **Level 1 (Hard Build Failure)**:
  * `node-overlap`: Two device bounding boxes intersect.
  * `edge-through-node`: An edge polyline segment passes through a foreign node rectangle.
  * `detached-endpoint`: An edge endpoint does not touch its assigned node boundary.
* **Level 3 (Advisory Warnings)**:
  * `crossings`: Number of edge-crossing intersections exceeds acceptable density threshold.
  * `aspect-ratio`: Computed canvas dimensions exceed extreme width/height ratio.

---

## 5. The HTML Viewer & Theme Architecture

### Construction Method
* Constructed via **pure TypeScript string interpolation / template literals** (`renderShell` in `packages/site/src/shell.ts` and `renderScene` in `packages/render-svg/src/index.ts`).
* No React, Vue, Vite, or external bundlers run during diagram compilation.
* Runtime JavaScript (~20 KB pre-compiled IIFE from `packages/runtime/dist/runtime.js`) and CSS (`packages/site/src/styles.ts`) are directly inlined into `<script>` and `<style>` tags.
* Topology data is serialized into `<script type="application/json" id="marrow-data">`.

### Interactive Features Working in Output
1. **Pan & Zoom**: Pointer-drag panning, mouse-wheel zooming, fit-to-screen, and level-of-detail (LOD) transitions.
2. **Device Inspector**: Clicking a node opens a slide-out drawer displaying identity, status LED, interfaces table, IP addresses, VLANs, and configuration notes.
3. **Spotlight Search (⌘K / Ctrl+K)**: Instant client-side fuzzy filter across devices, management IPs, zones, and roles.
4. **Theme Toggling**: Dark ("ops" default) and light ("print") modes with CSS custom property variables (`--bg`, `--line`, `--ink`).
5. **Port Hovering**: Hovering links highlights connected device interfaces and displays port badges (`Gi0/1`, `Gi0/48`).
6. **Neighborhood Focus**: Hovering a device dims all unrelated elements to highlight adjacent subnets/connections.
7. **Minimap**: Automatically renders an interactive bottom-corner navigation thumbnail on topologies >30 nodes.
8. **Export**: Client-side PNG rasterization via Canvas and raw SVG vector download without network calls.

### Compiled File Size Footprint
* `multivendor_discovery.v2.html` (5 devices, 6 links): **87.8 KB**
* `branch-hq.html` (10 devices, 12 links): **129.8 KB**
* `global-enterprise.yaml` (Large scale multi-page site): **~250–300 KB** per page.

---

## 6. Agent Harness & Bloat Hotspots

### Existing Agent Files
* `AGENTS.md`: 166 lines. Core operating guide defining the "golden loop" (Understand → Author → Validate → Snapshot → Build).
* `CLAUDE.md`: 57 lines. Concise CLI cheat-sheet for running commands.
* `.agents/rules/technical-documentation.md`: Rules enforcing Diátaxis classification (Categories A–D) and anti-slop constraints.
* `.agents/skills/technical-documentation/SKILL.md`: Procedural documentation generation skill.
* `.agents/skills/domain-modeling/SKILL.md`: Active domain model maintainer.
* `.agents/skills/grilling/SKILL.md` & `grill-with-docs/SKILL.md`: Socratic plan stress-testing skills.
* `.claude/skills/marrow-topology/SKILL.md`: Marrow topology YAML authoring instructions.
* `.claude/skills/marrow-setup/SKILL.md`: Troubleshooting and setup skill.
* `DEV_SCRATCHPAD.md`: User-agent workpad.
* `skills-lock.json`: Skill tracking manifest.

### Bloat Hotspots, Fragility, & Architectural Debt

1. **Dead Legacy Python Monolith (`legacy-v1/`)**:
   * A complete historical Python v1 engine remains in the repository root (`legacy-v1/`).
   * Contains unmaintained code (`engine/discovery/crawler.py`, `engine/ingestors/drawio.py`, `server.py`).
   * Introduces confusion for agents and contributors despite being marked reference-only.

2. **Monolithic In-Browser Client (`packages/runtime/src/client/main.ts`)**:
   * 1,978 lines in a single unstructured file.
   * Couples DOM event binding, Canvas state, SVG camera manipulation, inspector UI rendering, search indexing, and export pipeline into one mutable state object (`Ctx`).

3. **Duplicated Dual-Engine Rendering Logic**:
   * Marrow maintains two completely separate renderers for the same primitives:
     * SVG vector generator: `packages/render-svg/src/index.ts` (string concatenation).
     * Canvas 2D engine: `packages/runtime/src/client/canvas-engine.ts` (Canvas API method calls).
   * Any change to link styling, stroke patterns, status badges, port chips, or zone hulls must be implemented twice by hand.

4. **Hardcoded CSS Inlined in TypeScript (`packages/site/src/styles.ts`)**:
   * 960 lines of raw CSS wrapped in a single exported TypeScript string constant (`SITE_CSS`).
   * No CSS preprocessing, zero linter protection, and difficult maintenance.

5. **Heavy Playwright Dependency for CLI Snapshots**:
   * Running `marrow snapshot` requires downloading and launching a full Chromium browser instance via Playwright just to rasterize local HTML to PNG.
   * Significantly bloats installation requirements and creates CI execution overhead.

6. **Redundant Dual Validation Passes in Schema Package**:
   * `packages/schema/src/validate.ts` (723 lines) manually walks YAML CST nodes to collect line/column numbers, error snippets, and unknown keys.
   * It then executes a secondary validation pass via Zod (`zodSchema.ts`). The two validation layers maintain duplicate knowledge of field requirements and types.

7. **Extraneous Nuxt Documentation Workspace (`docs/`)**:
   * A full Nuxt 3 documentation application resides inside the monorepo root with its own separate `node_modules`, build dependencies, and deployment configuration, increasing repository weight.
