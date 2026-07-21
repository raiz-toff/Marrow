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

An agent tool that turns a YAML description of a network into a **folder** —
a small, beautiful, self-contained website for that one network. The user
double-clicks `index.html` and gets a stunning interactive diagram that works
with zero internet, zero installs. Small networks get one gorgeous page. Big
networks get an interlinked site — overview, zone pages, device pages,
inventory, search — that can grow to 100+ pages without falling apart.

The agent is the only author. No GUI editor. The agent writes YAML, the
compiler does everything else, and the agent can *see* the result and fix it.

```
 user describes            agent writes           compiler builds         user opens
 their network      ───►   topology YAML   ───►   a diagram folder  ───►  index.html
 (chat, notes,             (validated,            (layout, pages,         (offline,
  configs, scans)           auto-checked)          search, themes)         interactive)
```

---

## 2. Why v1 cannot be patched (the 60-second autopsy)

The research agent read every layout engine in v1. The headline findings:

- **Four of the five layout engines are broken by design.** One literally
  overlaps nodes on purpose ("overlap slightly for density") and is *exempted*
  from the overlap-fixer. Another places nothing at all if the network doesn't
  have a specific shape, and silently borrows coordinates from a different
  engine. Magic numbers everywhere; nothing accounts for label width.
- **Edges are drawn blind.** Lines are drawn straight through nodes because
  routing happens in the browser with zero awareness of what's in the way.
- **The same YAML can produce different diagrams on different machines**
  (layout depends on whether Node.js happens to be installed).
- **We pay for a 682 KB graph library and then bypass it.** vis-network is
  used only for pan/zoom; every visible line is hand-drawn on top of it.
- **A 2,067-line JavaScript blob lives inside an HTML template** — untestable,
  unlintable.
- **"Offline" isn't.** The output secretly loads fonts from Google's servers.
- **Icons are embedded once per node**, so ten identical switches embed the
  same image ten times (~1 MB HTML for a 30-node network).

What v1 got *right* (concepts we keep, code we don't): the agent-first loop
(validate → live preview → build), hint-rich machine-readable validation
errors, determinism discipline, the cable/role vocabulary catalog, semantic
zoom ambitions, and the single shareable HTML artifact.

**Lesson #1 of the rewrite: one great layout pipeline beats five half-built
ones, and quality must be *measured* (a build fails if anything overlaps),
not promised.**

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

The diagram's positions and every edge's path are calculated once, by the
compiler, and baked into the HTML as data. The browser only *draws*.

Why this matters:
- The diagram opens instantly and identically every time — no physics
  wobble/settling animation (v1's most amateur-looking trait).
- Same YAML in → pixel-identical diagram out, on any machine. This is
  enforced by an automated check that builds twice and compares bytes.
- The layout engines can be as big and slow as we like — they never ship to
  the user.

### Decision 3 — One layout pipeline: ELK places, libavoid routes, we polish

```
        ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
YAML ─► │  classify  │─► │   place    │─► │   route    │─► │    lint    │─► scene
        │ what shape │   │ ELK layered│   │  libavoid  │   │ overlap=   │   data
        │ is this    │   │ (tiers,    │   │ (edges walk│   │ build FAIL │
        │ network?   │   │  zones,    │   │  around    │   │ + auto-fix │
        │            │   │  ports)    │   │  nodes)    │   │ + warnings │
        └────────────┘   └────────────┘   └────────────┘   └────────────┘
```

- **ELK (Eclipse Layout Kernel)** — the only mature open engine with all
  three things network diagrams need: layered hierarchy (core / distribution
  / access as real layers), **per-port connection points** (uplinks leave the
  top of a switch, downlinks the bottom), and orthogonal (right-angled) edge
  routing. Actively maintained, license-safe. It runs headless at build time.
- **libavoid** — a dedicated industrial edge router (same engine family
  Inkscape uses). After placement, it routes every edge *around* obstacles
  with proper lane spacing. It's LGPL, which is fine because it runs only at
  build time — nothing of it ships in the output.
- **Graphviz (WASM)** — a secondary placer used only for special shapes:
  radial hub-and-spoke and organic meshes, where layered layout looks wrong.
- **Shape presets** — the classifier picks a preset per page:
  three-tier hierarchy · zoned campus · hub-and-spoke · mesh · mixed.
  Explicit YAML declarations (`tier:`, `ha_pair_with:`) always win over
  guessing; v1's guess-from-device-names trick is banned.
- **The geometry linter is the star.** After layout, an automated inspector
  checks the actual pixels:
  - **Level 1 (build fails):** any node/label overlap, any edge passing
    through a node, any detached port.
  - **Level 2 (auto-repair):** nudge labels, reroute a segment, then re-check.
  - **Level 3 (warnings):** excessive crossings, awkward aspect ratio.

  v1 *promised* no overlaps; v2 *refuses to ship* overlaps.

Research estimate worth remembering: ~60% of final layout quality comes from
our own polish passes (grid snapping, symmetric ordering of twin devices,
bundling parallel cables into buses, label placement) — the engines are the
foundation, not the finish.

### Decision 4 — Two renderers, chosen per page by scale

There is no single drawing technology that is both gorgeous at 10 nodes and
smooth at 1,000 — so the compiler picks per page, and the user never knows:

```
 rendered elements on the page          renderer                  character
 ──────────────────────────────         ────────────────────      ─────────────────────
 up to ~60                              SVG (vector graphics)     lush: glow, entrance
                                                                  animation, animated
                                                                  link flows, crisp at
                                                                  any zoom
 ~60 – 250 (max ~600 edges)             same SVG renderer,        still beautiful,
                                        effects gated by zoom     disciplined
 ~250 – 1,500                           WebGL (graphics card),    fast and smooth,
                                        via Sigma.js              icons intact
 more than ~1,500                       never one page — the      overview + drill-down
                                        site splits it up         pages (each lands back
                                                                  in a pretty tier)
```

Three details that make this work:

- The decision counts **what's actually drawn** (after clusters collapse),
  not raw device count — a 500-device network whose access switches collapse
  into stacks may render as 80 elements and get the gorgeous SVG treatment.
- Both renderers read the **same scene data** and share the **same controls**
  (search, inspector, minimap, themes, keyboard) — only the drawing code
  differs. Zone drill-down pages of a huge network still get the lush tier.
- The thresholds are single config constants guarded by automated
  frame-rate tests — if real hardware sustains more, we raise them in one
  commit.

Rejected alternatives, for the record: vis-network (feature-frozen, the
source of v1's look), one-library-for-everything G6 (400 KB in every file,
capped polish exactly where we differentiate), tldraw (watermark/license),
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
- **Presentation is part of the schema** — because wow must be authorable:
  `hero:` (what the camera features), `animated:` on links, `style.accent`,
  `collapse: auto|open|closed` on groups, `note:`/`config:` payloads that
  become device-page content.
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
│  render-svg     the "lush" renderer (small/medium pages)          │
│  render-gl      the "fast" renderer (large pages, Sigma.js)       │
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

## 5. The experience spec (the wow, made concrete)

**Opening a diagram (first 1.5 seconds):** background and frame paint
instantly (<100 ms) → camera starts slightly wide and settles into a
perfectly framed fit → zones fade in → nodes cascade in by tier (core first,
then distribution, then access, ~30 ms stagger) → edges draw themselves in.
All cosmetic — positions are final from the first frame; nothing shifts.
Honors reduced-motion settings; skippable with a click.

**Semantic zoom — each zoom level is designed, not just scaled:**

```
 zoomed out  ─────────────────────────────────────────────►  zoomed in

 SITE               ZONE                DEVICE              INTERFACE
 zone cards +       device icons +      full labels, IPs,   port-level
 counts + health;   names; links;      status badges,      attachment,
 fat bundled        VLAN colors        link speeds         cable IDs,
 trunks                                                    per-link notes
```

Labels fade in/out over zoom ranges (never pop). Edge bundles split into
member links as you cross a threshold.

**Interacting:**
- Hover a device → its neighborhood lights up, everything else dims.
- Click → right-side inspector panel: identity header, tabs for interfaces /
  VLANs / config / notes, neighbor links. "Open full page →" for the
  device-360 page.
- Ctrl/⌘-K → spotlight search; picking a result flies the camera there and
  dims everything else.
- Groups with 8+ leaf members pre-collapse into stack nodes ("×24" edges,
  worst-status badge); click to expand in place.
- Minimap appears automatically above ~30 nodes.
- Every view state is a shareable `#deep-link` (camera + selection).
- Full keyboard navigation; statuses always encoded as color *plus* shape.

**Themes:** dark "ops" theme by default (near-black blue canvas, dotted
grid, translucent zone panels, glow on selection — the screenshot-worthy
one) and a clean light "print/doc" theme with a real print stylesheet.
Both are first-class; the viewer toggles freely.

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
8. **The wow gate** — the entrance animation itself is frame-time tested
   (median frame < 18 ms). Polish as a tested invariant, not taste.
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
| **P2 Hero renderer** | SVG renderer, runtime-core, themes, single-file export | a 30-node network is genuinely beautiful; wow gate + offline gate pass |
| **P3 Agent loop** | dev server, live reload, `/api/*`, `marrow snapshot` | agent authors → sees → repairs a diagram end-to-end, unaided |
| **P4 Scale** | WebGL renderer, collapse/clustering, page planner, multi-page site, search | a 500-node network ships as a readable, searchable site meeting all budgets |
| **P5 Breadth** | hub-spoke/mesh presets, second icon pack, PNG/SVG export, print, accessibility pass, morph-reload polish, re-port discovery & Draw.io ingestors onto the new model | feature parity with v1's inputs, exceeding it everywhere else |

The deliberate ordering bet: **the agent loop (P3) lands before scale (P4)**
— a tool the agent can drive perfectly at 30 nodes is worth more than one
that handles 1,000 nodes blind.

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
