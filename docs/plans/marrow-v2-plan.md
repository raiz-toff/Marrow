# Marrow v2 — Ground-Up Architecture Plan

*Status: proposal for approval. No code exists yet. Everything in v1 stays untouched
until this plan is approved; v2 is built fresh, in its own directory structure.*

This plan is the output of a 9-agent research pass: an autopsy of the current
engine, live web research on rendering technology / layout engines / language
choice / UX patterns (verified against July 2026 versions and licenses), three
competing architecture proposals written under different priorities, and a
final judged merge. Sources and raw research are preserved separately.

---

## 1. What we are building

An agent tool that compiles a declarative network topology YAML description into
a self-contained, offline HTML network diagram. The user opens `index.html`
directly in any browser with zero network access and zero local runtime installs.
Small topologies compile to a single self-contained HTML file. Larger topologies
compile to an interlinked static site comprising overview, zone-specific, and
device-specific pages, inventory tables, and pre-indexed search.

The agent is the sole author. There is no GUI editor. The agent writes YAML,
the compiler handles layout and asset generation, and the agent inspects the
rendered output via headless snapshot to verify correctness.

```
 user describes            agent writes           compiler builds         user opens
 their network      ───►   topology YAML   ───►   a diagram folder  ───►  index.html
 (chat, notes,             (validated,            (layout, pages,         (offline,
  configs, scans)           auto-checked)          search, themes)         interactive)
```

---

## 2. Why v1 cannot be patched: technical debt and failure modes

An analysis of all five layout engines in v1 revealed critical architectural limitations:

- **Four of the five layout engines have fundamental design flaws.** One engine
  intentionally overlaps nodes for density and is exempt from overlap validation.
  Another fails to place nodes when networks deviate from expected shapes, silently
  falling back to coordinates from an unrelated engine. Layout coordinates rely on
  arbitrary constants without accounting for rendered text label widths.
- **Edge routing lacks obstacle avoidance.** Lines cross directly through intermediate
  nodes because routing executes client-side in the browser without bounding-box awareness.
- **Non-deterministic layout across environments.** Output varies depending on whether
  Node.js is locally present in the environment.
- **Underutilized graph library overhead:** vis-network introduces 682 KB of bundle
  size while serving only pan/zoom interaction; all visible lines are hand-rendered over it.
- **Monolithic embedded runtime:** A 2,067-line JavaScript block is embedded directly
  within an HTML template, preventing unit testing and static linting.
- **External font leak:** The v1 output attempts to load external web fonts from Google
  Fonts, breaking air-gapped and strict offline requirements.
- **Redundant icon inlining:** Icons are inlined separately for every node instance.
  Ten identical switches duplicate the SVG payload ten times (~1 MB HTML payload for
  a 30-node network).

Concepts retained from v1: the agent-first feedback loop (validate → preview → snapshot → build),
structured diagnostic error hints, deterministic build discipline, cable/role vocabulary
registries, semantic zoom capabilities, and self-contained HTML output artifacts.

**Core design principle for v2: A single validated layout pipeline replaces multiple
partial engines, enforced by automated geometric quality gates (build fails on node overlaps).**

---

## 3. The seven big decisions

### Decision 1 — Language: TypeScript, end to end

Plain-English reasoning:

- The finished product *is* a web page. Web pages run JavaScript. If the
  compiler is also JavaScript/TypeScript, the code that builds the diagram and
  the code that displays it share one language and one set of types — a whole
  category of bugs ("compiler and viewer disagree about the data") becomes
  impossible.
- The best layout engine in the world for this exact job (**ELK**, see
  Decision 3) only exists in JavaScript. Choosing Rust, Go, or Python means
  giving up the one dependency this product cannot afford to lose — and
  hand-rolled layout is *exactly* how v1 ended up with broken diagrams.
- Compile speed is a non-issue: pages are laid out independently and in
  parallel; the target is under half a second from "agent saves YAML" to
  "browser repainted."

Runtime: **Node.js LTS is the contract** (everything must run on plain Node);
Bun is used as an optional speed-up and for single-binary packaging, isolated
so it can be swapped out without touching the core. (Research flagged that
"Bun 2.x" claims need verifying — so we don't bet the architecture on it.)

Python's only remaining role: none in v2 core. The SSH network-discovery
crawler can stay a separate peripheral that emits YAML — it feeds the
compiler, it is not part of it.

### Decision 2 — Layout is computed at build time, never in the browser

Diagram node positions and edge routes are computed once by the compiler at build
time and embedded into the HTML document as static scene data. The browser runtime
serves solely as a renderer.

Advantages of build-time layout:
- Instant and deterministic initial paint without runtime force-directed physics
  settling movements.
- Identical rendering across environments: identical input YAML generates byte-identical
  diagram data across all host operating systems, verified by automated double-build tests.
- Zero client bundle bloat: layout compilation engines (ELK, libavoid) execute headlessly
  during compilation and are excluded from client payloads.

### Decision 3 — Unified layout pipeline: ELK placement, libavoid routing, post-process refinement

```
        ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
YAML ─► │  classify  │─► │   place    │─► │   route    │─► │    lint    │─► scene
        │ what shape │   │ ELK layered│   │  libavoid  │   │ overlap=   │   data
        │ is this    │   │ (tiers,    │   │ (edges walk│   │ build FAIL │
        │ network?   │   │  zones,    │   │  around    │   │ + auto-fix │
        │            │   │  ports)    │   │  nodes)    │   │ + warnings │
        └────────────┘   └────────────┘   └────────────┘   └────────────┘
```

- **ELK (Eclipse Layout Kernel)** — Provides hierarchical layered layout
  (core, distribution, and access tiers), **per-port attachment coordinates**
  (uplinks top, downlinks bottom), and orthogonal edge routing. Executes headless
  at build time under safe open licenses.
- **libavoid** — Dedicated geometric edge router. Routes edges around obstacles
  with defined lane spacing. Executes headless at build time (LGPL compliant; no
  library code is bundled into client output).
- **Graphviz (WASM)** — Secondary layout engine utilized for specialized topologies
  (radial hub-and-spoke and organic mesh configurations).
- **Topology archetypes** — The topology classifier selects a layout preset per page:
  hierarchical three-tier, zoned campus, hub-and-spoke, or mesh. Explicit YAML
  declarations (`tier:`, `ha_pair_with:`, `zone:`) take precedence over heuristic
  inference.
- **Automated geometry linting:** Post-layout geometric inspection validates coordinates:
  - **Level 1 (build failure):** Any node/label collision, edge crossing through a node body,
    or unattached port.
  - **Level 2 (automated correction):** Label displacement adjustments, edge segment rerouting.
  - **Level 3 (advisory warnings):** Elevated edge-crossing counts, unbalanced canvas aspect ratios.

  Zero-overlap invariant: Level-1 geometry errors halt the build.

Post-processing pipeline: Custom post-layout passes (grid alignment, symmetric paired-device
positioning, parallel link bus routing, deterministic label placement) provide the final
visual refinement beyond raw engine coordinates.

### Decision 4 — Scale-dependent dual rendering pipeline (SVG / WebGL)

No single browser rendering engine satisfies both maximum visual fidelity at low node
counts and 60 FPS performance at 1,000 nodes. The compiler selects the rendering engine
per page based on active element count:

```
 Rendered elements on page              Renderer                  Capabilities
 ──────────────────────────────         ────────────────────      ─────────────────────
 up to ~60                              SVG (vector graphics)     Node glow, tier cascade
                                                                  animations, animated link
                                                                  flows, infinite resolution
 ~60 – 250 (max ~600 edges)             SVG renderer              Level-of-detail gating on
                                                                  complex visual effects
 ~250 – 1,500                           WebGL (via Sigma.js)      Hardware-accelerated
                                                                  rendering, intact icons
 more than ~1,500                       Multi-page site split     Partitioned into overview
                                                                  and drill-down sub-pages
```

Architectural invariants:

- Threshold evaluation is based on **active rendered elements** (post cluster-collapse)
  rather than raw device count. A 500-device network whose access switches collapse into
  stack nodes renders as ~80 visual elements, qualifying for SVG vector rendering.
- Both renderers consume the **identical scene data format** and share the **identical
  UI controls** (search, inspector panel, minimap, themes, keyboard shortcuts). Only the
  underlying drawing implementation differs. Zone drill-down pages in large networks retain
  the SVG vector pipeline.
- Threshold limits are defined via configuration constants guarded by automated
  frame-rate regression tests.

Rejected alternatives: vis-network (deprecated, unmaintained), G6 (400 KB runtime footprint,
limited layout customization), tldraw (commercial licensing restrictions).
paid libraries (can't redistribute freely).

### Decision 5 — The output is a folder: a mini-website per diagram

Every build produces one folder containing everything:

```
output/acme-hq/
├─ index.html            ◄ the hero overview — open this
├─ zones/
│  ├─ campus-a.html        one page per zone/site
│  ├─ campus-b.html
│  └─ datacenter.html
├─ devices/
│  ├─ core-sw-01.html      "device 360" pages: 1-hop mini-diagram,
│  └─ dist-sw-02.html       interfaces, VLANs, config, notes
├─ inventory.html          sortable/filterable table of everything
└─ assets/
   ├─ runtime.js           one shared interactive engine
   ├─ styles.css           themes (dark ops / light print)
   ├─ sprite.svg           only the icons this network actually uses
   ├─ search-index.js      prebuilt search of every device/IP/VLAN/note
   └─ data/…               per-page diagram data
```

- **Works from double-click.** Everything is engineered for `file://` (no
  web server): no network fetches at all, links are relative, deep links use
  `#hash` fragments. An automated test opens the site with networking
  *blocked* and fails the build if it makes even one request.
- **Scales from 1 page to 100+.** Small network → just `index.html`
  (self-contained, everything inlined — still a single shareable file).
  Big network → the page planner splits by zone, auto-splits oversized zones,
  merges tiny ones, and reports its plan. Hard budget: no page over ~250
  rendered elements. Device pages are generated for core/distribution gear
  and anything carrying notes/config; access-layer detail lives in the
  side panel (otherwise a real network blows past any page ceiling).
- **Every boundary is a door, not a wall.** A zone page shows ghosted stub
  nodes for neighbors in other zones — click one and you're on that zone's
  page, camera focused on that device.
- **Search everywhere.** One prebuilt index; press Ctrl/⌘-K on any page and
  jump to any device, interface, IP, VLAN, or note across the whole site.

### Decision 6 — The YAML schema: strict, versioned, built for an agent author

- Files start `marrow: 2`. The validator accepts any 2.x and ships an
  auto-migration command for future major versions.
- **Strict mode:** unknown keys are *errors*, with "did you mean…?"
  suggestions. Icon names validate against the icon catalog — a typo is an
  error with ranked suggestions, never (as in v1) a silent grey box.
- **Every error tells the agent exactly what and where:** a stable error
  code, the YAML line and column, a snippet, a plain message, and a fix
  hint — all machine-readable. One validation code path (v1 had two that
  disagreed).
- **Meaning is declared, never guessed:** `tier:`, `ha_pair_with:`, `lag:`,
  `link.ports:` are schema fields. Inference can *suggest*, never decide.
- **Visual styling and camera control declared in schema:**
  `hero:` (camera focus target), `animated:` (link traffic flow indicator), `style.accent`,
  `collapse: auto|open|closed` on groups, `note:`/`config:` payloads rendered
  into device inspector and sub-pages.
- A JSON Schema artifact is generated from the same source and embedded in
  the agent's authoring skill — schema docs can never drift from the code.

### Decision 7 — The agent gets eyes

The loop that makes this an *agent* tool rather than a compiler with a CLI:

```
      ┌──────────────────────────────────────────────────────────┐
      │                                                          │
      ▼                                                          │
 agent writes YAML ─► validate ─► build ─► SNAPSHOT ─► looks ────┘
                       (errors      (lint    (agent      wrong?
                        with line    gates)   receives    fix YAML,
                        numbers)              actual      not pixels
                                              rendered
                                              image +
                                              scene data)
                              looks right ─► user's browser has
                                             already live-reloaded
```

- `marrow snapshot` renders a page to an image the agent can look at, plus
  machine-readable scene data (`/api/scene`) it can reason over. The agent
  never has to say "it should look right" — it checks.
- The dev server is tiny (~200 lines, no framework): watch the YAML →
  rebuild only affected pages → push reload over a WebSocket. Camera position
  and selection survive the reload. Target: save-to-repainted under 500 ms.
- v1's good API survives: `/api/status`, `/api/validate`, file switching.

---

## 4. System map — the modules

Small independent packages with one-way dependencies (each layer only knows
the ones above it). This is what "modular from the ground up" means concretely:
you can replace the renderer, add an icon pack, or add a layout preset without
touching anything else.

```
┌────────────────────────────────────────────────────────────────────┐
│  cli            commands: new · validate · build · serve ·        │
│                 snapshot · icons · migrate                        │
├────────────────────────────────────────────────────────────────────┤
│  server         dev server: watch, incremental rebuild,           │
│                 live-reload, /api/* for the agent                 │
├────────────────────────────────────────────────────────────────────┤
│  site           page planner (what pages exist), site compiler,   │
│                 search-index builder, single-file exporter        │
├────────────────────────────────────────────────────────────────────┤
│  render-svg     SVG vector renderer (small/medium pages)          │
│  render-gl      WebGL renderer (large pages, Sigma.js)            │
│  runtime-core   shared: camera, ⌘K search, inspector panel,       │
│                 minimap, themes, keyboard nav, deep links         │
│                 (UI chrome built as Preact components — a 4 KB    │
│                 React-compatible framework, pre-rendered at       │
│                 build time; the diagram itself is custom-drawn)   │
├────────────────────────────────────────────────────────────────────┤
│  layout         classify → preset → ELK/Graphviz place →          │
│                 libavoid route → polish passes                    │
│  lint           the geometry linter (L1 fail / L2 repair / L3     │
│                 warn) — also the test oracle                      │
├────────────────────────────────────────────────────────────────────┤
│  model          the normalized in-memory network (devices, ports, │
│                 links, zones) — every module speaks this          │
│  metrics        text/label measurement from precomputed font      │
│                 tables (deterministic on every machine)           │
│  icons          icon packs: manifest, normalize, dedupe,          │
│                 per-page subsetting, keyword search               │
├────────────────────────────────────────────────────────────────────┤
│  schema         YAML parsing, Zod validation, normalization —     │
│                 the single source of truth                        │
│  diagnostics    the error/warning object format (zero deps —      │
│                 everything emits these)                           │
└────────────────────────────────────────────────────────────────────┘
```

Icon extensibility, concretely: an icon pack is a folder of SVGs plus a
small manifest file (id, title, keywords, category). Drop a new vendor pack
in, run one command, and the icons are searchable, validated, and subset
into outputs. Nothing else changes. All icons get a uniform "chip" treatment
(theme-aware background tile, status LED, badge slots) so mixed vendors still
look like one family.

---

## 5. Visual experience and interaction specification

**Initial load sequence (<1.5 s):** Background and container frame paint
instantly (<100 ms) → camera settles into bounded viewport fit → zones fade in →
nodes cascade by tier (core first, distribution second, access third, ~30 ms stagger) →
edges render. Geometry is computed prior to render; node coordinates do not shift during
load. Honors user `prefers-reduced-motion` settings and is skippable via click.

**Semantic zoom — defined levels of detail:**

```
 zoomed out  ─────────────────────────────────────────────►  zoomed in

 SITE               ZONE                DEVICE              INTERFACE
 Zone bounding      Device icons,       Full labels, IPs,   Port-level
 boxes, aggregate   names, primary      status badges,      attachment,
 counts, bundled    inter-zone links,   link speeds         cable IDs,
 trunks             VLAN colors                             per-link notes
```

Labels transition opacity across zoom thresholds without abrupt pop-in. Edge
bundles resolve into individual member links across defined zoom scales.

**Interaction model:**
- Hover device: highlights immediate 1-hop topology neighborhood and dims unlinked nodes.
- Click node: opens inspector side panel displaying device attributes, interface
  tables, VLAN associations, configuration snippets, and operational notes, with link to
  device-360 page.
- Ctrl/⌘-K: executes spotlight search index; selecting a search hit moves camera viewport
  to target element.
- Automatic stack collapse: groups containing 8+ leaf devices collapse into stack summary
  nodes with count badges; expandable on demand.
- Minimap: renders automatically for topologies exceeding ~30 nodes.
- URL hash fragments: camera viewport and selected node state persist in shareable deep links.
- Keyboard navigation: fully accessible via keyboard; operational states encode color and geometric shape.

**Themes:** Dark "ops" theme by default (high-contrast dark canvas, dotted grid,
translucent zone boundaries, selection glow) and light "print/doc" theme with dedicated
CSS print styles. Both themes are built-in and switchable at runtime.

**Dropped/deferred consciously:** isometric 3D-ish mode (later, it's a
render-time transform), in-browser YAML editing (the agent is the editor),
client-side re-layout (never — determinism dies), drag-persistence in the
browser (drags are session-only; permanence = agent writes `pin:` to YAML).

---

## 6. Quality gates — what "done" means, automatically

Every one of these is a CI check that blocks a release, not a hope:

1. **Zero geometry defects** — linter Level-1 = 0 on a 40-network test corpus.
2. **Determinism** — build twice, compare bytes; must be identical (also
   across OSes).
3. **Truly offline** — site opens with networking blocked; zero requests.
4. **Never crashes on bad input** — fuzzed/adversarial YAML must always
   produce a structured, located error, never a stack trace.
5. **Visual regression** — screenshot comparisons across tiers × themes.
6. **Size budgets** — single file ≤ ~900 KB at 50 nodes; multi-page ≤ ~300 KB
   unique payload per page; runtime ≤ 60 KB (SVG tier) / 120 KB (GL tier).
7. **Speed budgets** — first paint < 100 ms; 500-node site fully rendered
   < 1.5 s; panning at 60 fps; save-to-repainted < 500 ms.
8. **Animation performance gate** — entrance animations are benchmarked for
   frame timing (median frame time < 18 ms, targeting 60 FPS).
9. **The agent gate** — a scripted end-to-end eval: agent authors a topology
   from a text brief, hits injected errors, repairs them using only the
   diagnostics, and ships a linter-clean site. If an AI can't drive it
   blind, the contract isn't done.

---

## 7. Roadmap — six phases, each with an exit door

No dates; each phase has a hard exit criterion and the next phase doesn't
start until it passes.

| Phase | Builds | Exit criterion |
|---|---|---|
| **P0 Contracts** | schema, validator, diagnostics, model, icon manifest | the scripted agent-repair eval passes on validation alone |
| **P1 Geometry** | layout pipeline, router, linter, metrics, determinism | 40-fixture corpus: linter-clean, byte-identical double builds |
| **P2 SVG vector renderer** | SVG renderer, runtime-core, themes, single-file export | 30-node network passes visual regression, animation frame-rate gate (<18 ms), and offline gate |
| **P3 Agent loop** | dev server, live reload, `/api/*`, `marrow snapshot` | agent authors → sees → repairs a diagram end-to-end, unaided |
| **P4 Scale** | WebGL renderer, collapse/clustering, page planner, multi-page site, search | a 500-node network ships as a readable, searchable site meeting all budgets |
| **P5 Breadth** | hub-spoke/mesh presets, second icon pack, PNG/SVG export, print, accessibility pass, morph-reload polish, re-port discovery & Draw.io ingestors onto the new model | feature parity with v1's inputs, exceeding it everywhere else |

Strategic ordering rationale: **the agent loop (P3) precedes large-scale graph handling (P4)**
— ensuring an agent can reliably author, inspect, and self-heal topologies up to 30 nodes
is prioritized before multi-page scale and WebGL rendering.

---

## 8. Open items to verify before coding (flagged by the research judge)

1. Bun version claims in research were shaky — hence Node-LTS-as-contract.
   Confirm Bun's actual state before advertising single-binary builds.
2. Benchmark SVG at 250–300 nodes on mid-range hardware before blessing the
   tier threshold (it's one constant either way).
3. Verify the libavoid WASM binding exposes per-port connection pins and is
   maintained; it's load-bearing. Have the LGPL build-time-only position
   sanity-checked.
4. Spike Sigma.js icon-atlas limits at high DPI (per-page icon subsetting
   likely makes this a non-issue — a page uses 10–25 icon types).
5. Treat every performance number in this plan as a budget to validate, not
   a fact.

---

## Appendix — decision summary on one screen

| Question | Decision |
|---|---|
| Language | TypeScript everywhere; Node LTS contract, Bun optional |
| Layout | Build-time only: ELK places, libavoid routes, custom polish, geometry linter gates |
| Rendering | SVG ≤ ~250 rendered elements, WebGL (Sigma.js) above; shared controls |
| UI chrome | Preact components (4 KB), pre-rendered; diagram custom-drawn |
| Input | YAML `marrow: 2`; strict; line/column errors with fix hints; presentation authorable |
| Output | Folder-per-diagram static site (1 → 100+ pages); single-file export; `file://`-proof |
| Search | Prebuilt MiniSearch index, Ctrl/⌘-K everywhere |
| Icons | Drop-in packs + manifest; per-page subsetting; uniform chip treatment |
| Agent loop | validate → build → snapshot (agent sees pixels) → repair; live-reload server |
| Old code | Nothing reused; concepts carried: agent loop, error hints, vocab catalog, single-file artifact |
