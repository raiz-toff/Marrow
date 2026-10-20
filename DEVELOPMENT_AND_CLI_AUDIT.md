# Marrow Architecture, Development Runtime, and CLI Stability Audit

> **Target Audience:** Autonomous reasoning agents and systems architects auditing Marrow's developer tooling, execution runtime, network bindings, and CLI surface.
> **Scope:** Repository root `/home/raj/Documents/Projects/Marrow` (Commit baseline `813aa97`).

---

## 1. Executive Summary & Monorepo Topology

Marrow is an agent-driven network topology studio that compiles declarative YAML definitions (`input/*.yaml`) into standalone, interactive, offline HTML/SVG network diagrams. The architecture is structured as a TypeScript monorepo with strict package boundaries:

```
packages/
├── cli/          # Command-line router, argument parser, configuration loader
├── schema/       # Zod grammar, AST normalization, linting/validation rules (MRW-*)
├── model/        # Canonical TypeScript domain types & interfaces
├── layout/       # ELK (Eclipse Layout Kernel) graph layout, portchips, density metrics
├── render-svg/   # SVG canvas generation, node/edge geometries, blueprint export
├── site/         # Single-page bundler, multi-page site generator, theme tokens, UI chrome
├── runtime/      # Inlined client-side engine (Canvas, pan/zoom camera, inspector HUD)
├── server/       # Dev server (node:http, SSE live-reload, file watcher, incremental cache)
├── icons/        # Icon pack catalog, vendor fetchers, fuzzy search index
└── diagnostics/  # Unified diagnostic engine and reporting formatters
```

---

## 2. Dev Server Deep-Dive: `npm run dev` / `marrow serve`

The development server is implemented in `packages/server/src/index.ts` and invoked via `packages/cli/src/index.ts` (`cmdServe`). It provides an agent-friendly, hot-reloading preview environment.

### 2.1 Network & Socket Bindings

| Property | Default Value | CLI Flag Override | Notes |
| :--- | :--- | :--- | :--- |
| **Protocol** | `HTTP/1.1` | N/A | Implemented using native `node:http.createServer` (zero external framework overhead). |
| **Listen Host** | `127.0.0.1` | `--host <addr>` (e.g., `0.0.0.0` via `npm run dev:lan`) | Binds strictly to loopback by default; LAN binding must be explicitly opted into. |
| **Port** | `5200` | `--port <number>` | Throws unhandled `EADDRINUSE` if occupied (no automatic fallback to 5201+). |
| **Push Channel** | Server-Sent Events (SSE) | N/A | Endpoint: `/api/events`, `Content-Type: text/event-stream`, `Cache-Control: no-store`. |
| **Keep-Alive** | Active HTTP Keep-Alive | N/A | Headers: `Connection: keep-alive`. No periodic heartbeat ping comments sent. |

### 2.2 Process State, Memory, & Concurrency Model

The server maintains a single centralized in-memory `State` object:

```typescript
interface State {
  dir: string;                    // Working directory containing YAML files
  current: string;                // Absolute path of actively previewed YAML file
  stamp: number;                  // Monotonically increasing rebuild generation counter
  diagnostics: Diagnostic[];      // Diagnostics from the most recent validation pass
  valid: boolean;                 // Validation status (true if zero error-severity diagnostics)
  mode: 'single' | 'site';        // 'single' (<100 devices) or 'site' (partitioned hierarchy)
  brand?: Brand;                  // Global brand parameters
  themeConfig?: ThemeConfig;      // Dark/light tokens and link style tokens
  layout?: LayoutConfig;          // Density presets ('compact' | 'standard' | 'spacious')
  build?: BuildResult;            // Cached single-page build result
  lastGoodHtml?: string;          // Last successfully compiled HTML (with live client injected)
  builder?: SiteBuilder;          // Active incremental site builder (site mode only)
  cache: SiteCache;               // Map<string, CachedPage> keyed by content hashes
  lastChanged: number;            // Number of pages invalidated during last rebuild
  lastRebuildMs: number;          // Wall-clock milliseconds taken for layout and compilation
  building: Promise<unknown>;     // Sequential promise queue lock
}
```

#### The Sequential Serialization Queue (`enqueue`)
ELK layout calculations are computationally intensive and CPU-bound. To prevent race conditions between incoming HTTP requests and background file rebuilds:
```typescript
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = state.building.then(fn);
  state.building = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};
```
* **Implication:** Concurrent requests for uncached site pages or rapid rebuild triggers are strictly serialized. While this guarantees deterministic state transitions, an expensive layout on a large topology (e.g., 500+ devices taking 1.5–3 seconds) will stall subsequent HTTP requests until the layout cycle resolves.

### 2.3 Filesystem Watchers & Debouncing

1. **Input Directory Watcher**:
   - Watcher: Native `node:fs.watch(state.dir, callback)`
   - Filter: Only triggers for filenames matching `/\.ya?ml$/i`
   - Debounce Window: **90 milliseconds** per file using a `timers = new Map<string, NodeJS.Timeout>()`.
   - Action on Current File: Calls `rebuild()`.
   - Action on Inactive File: Emits SSE `event: files\ndata: <filename>\n\n` to inform connected clients of available topologies.
2. **Global Config Watcher**:
   - Watches `marrow.config.yaml` if resolved.
   - Debounce Window: 90 milliseconds.
   - Action: Purges the entire `state.cache.clear()` and triggers a full rebuild to apply updated brand/theme tokens across all pages.

### 2.4 Dev Server HTTP & REST API Specification

| Route / Method | Content-Type | Payload / Response | Behavior |
| :--- | :--- | :--- | :--- |
| `GET /api/events` | `text/event-stream` | SSE Stream | Subscribes to live server events: `connected`, `invalid`, `valid`, `reload`, `files`. Client is registered into `sseClients: Set<ServerResponse>`. |
| `GET /api/status` | `application/json` | `{ file, stamp, valid, errors, warnings, mode, pages, changed, rebuildMs }` | High-level diagnostic summary for external tools/status bars. |
| `GET /api/validate` | `application/json` | Full `JsonReport` | Complete array of diagnostics with file line/col numbers, severity, and remediation hints. |
| `GET /api/scene` | `application/json` | Computed `Scene` JSON | Layout geometry (nodes, bounding boxes, ports, routes, edges). Returns 404 if no valid build exists. |
| `GET /api/files` | `application/json` | `{ files: string[], current: string }` | Lists all `.yaml` files in the watched directory and identifies the current active file. |
| `GET /api/current` | `application/json` | `{ current: string }` | Returns the basename of the active topology file. |
| `POST /api/current` | `application/json` | Body: `{"file": "topo.yaml"}` | Switches active file, invalidates current build cache, and triggers an immediate rebuild. |
| `GET /` or `GET /index.html` | `text/html` | Standalone HTML | Serves the main diagram view with `LIVE_CLIENT` script injected right before `</body>`. If invalid, serves a formatted error page. |
| `GET /?file=<name>` | `text/html` | Standalone HTML | Query parameter switch: Switches `state.current`, rebuilds, and renders requested topology. |
| `GET /zones/*.html` `GET /devices/*.html` | `text/html` | Partitioned HTML | (Site mode only). Built lazily on first request and memoized in `state.cache`. |
| `GET /search.json` | `application/json` | Search Index | (Site mode only). Cross-diagram index covering devices, interfaces, IPs, tags, and zones. |

### 2.5 Live Client Injection & Browser Reactivity

In `packages/server/src/inject.ts`, the server injects an inline `<script>` and `<style>` block before `</body>`:
* **Reactivity Mechanism**: Native browser `EventSource('/api/events')`.
* **Selective Page Reloading**:
  - The `reload` event carries `{ stamp: number, pages: string[] | null }`.
  - In single-page mode or global shape shifts, `pages` is `null` (all open tabs reload).
  - In multi-page site mode, only tabs whose `document.documentElement.dataset.page` is contained in `pages` trigger `location.reload()`.
* **State Preservation**: The browser URL hash (camera pan/zoom coordinates and active selection `#d=<device-id>`) is retained across reloads.
* **Error Banner**: If validation fails during editing, an `invalid` event is pushed. A floating CAD-styled glassmorphism banner (`.m-live-banner`) appears at the bottom of the screen displaying exact YAML line errors without tearing down the existing canvas diagram.

---

## 3. Comprehensive CLI Tools & Utilities Audit

Marrow routes all commands through `packages/cli/src/index.ts`. All subcommands follow strict POSIX conventions via `node:util.parseArgs`.

### Command Matrix

```
marrow <command> [arguments] [flags]
```

| Command | Arguments | Flags | Stability Level | Primary Function & Behavior |
| :--- | :--- | :--- | :---: | :--- |
| **`marrow validate`** | `<file...>` | `--json`<br>`--no-icons`<br>`--packs <dir>` | **HIGH** (Production) | Validates syntax, Zod schema rules, and semantic references (HA pairs, link ports, duplicate IDs, loopback interfaces). Returns exit code `0` for valid, `1` for validation errors, `2` for I/O errors. Supports batch multi-file input. |
| **`marrow build`** | `<file>` | `-o, --out <path>`<br>`--single`<br>`--embed`<br>`--chrome <minimal\|full>`<br>`--packs <dir>`<br>`--config <file>` | **HIGH** (Production) | Compiles YAML into static production assets. If topology exceeds device/zone thresholds, it automatically partitions into a multi-page site folder (`output/<name>-site/`) unless `--single` is supplied. `--embed` strips navigation chrome and HUD for iframe/kiosk integration. |
| **`marrow serve`** | `[file-or-dir]` | `--port <n>` (5200)<br>`--host <ip>` (127.0.0.1)<br>`--packs <dir>`<br>`--config <file>` | **HIGH** (Development) | Starts HTTP server with SSE live-reload. Defaults to `./input` directory. Automatically switches between single-page and multi-page site server. |
| **`marrow snapshot`**| `<file>` | `-o, --out <path>`<br>`--focus <id>`<br>`--theme <dark\|light>`<br>`--width <n>` (1440)<br>`--height <n>` (900)<br>`--json`<br>`--packs <dir>`<br>`--config <file>` | **MEDIUM** (Environmental) | Spawns headless Playwright Chromium, compiles topology to temporary HTML in `os.tmpdir()`, navigates to hash `#d=<id>`, waits for render settling, captures PNG, and unlinks temp HTML. |
| **`marrow import`** | `<v1-file>` | `-o, --out <path>`<br>`--packs <dir>` | **HIGH** (Migration) | Translates legacy Marrow v1 YAML schema to v2 syntax. Generates synthetic port chips, normalizes tier hierarchies, and runs validation on output. |
| **`marrow icons search`**| `<query...>` | `--json`<br>`--max <n>` (20)<br>`--packs <dir>` | **HIGH** (Production) | Sub-millisecond fuzzy search across all discovered icon pack manifests. Accepts single keyword or batch multi-query (e.g. `icons search switch firewall router --json`). |
| **`marrow icons packs`** | None | `--packs <dir>` | **HIGH** (Production) | Discovers and reports icon pack search root and total loaded icons. |
| **`marrow icons index`** | `[pack]` | `--packs <dir>` | **HIGH** (Production) | Crawls `icon-packs/<pack>/svg/`, resolves filename collisions (`device.svg` vs `Device.svg` -> `device-2`), and generates standard `manifest.json`. |
| **`marrow icons fetch`** | `[pack...]` | `--yes`<br>`--packs <dir>` | **MEDIUM** (Network-bound) | Fetches vendor packs (AWS, Azure, GCP) from official vendor URLs into `icon-packs/`. Requires explicit TTY interactive confirmation or `--yes` flag. |
| **`marrow schema`** | None | None | **HIGH** (Production) | Outputs the complete JSON Schema definition for the Marrow v2 topology grammar to `stdout`. |

### Auxiliary Repository Tooling

* **`npm run compile`**: Runs `tsc -b` across all TypeScript packages and invokes `esbuild` to bundle `@marrow/runtime` into `dist/runtime.js`.
* **`npm run setup`** (`scripts/setup.mjs`): End-to-end interactive onboarding wizard. Verifies Node 24+, runs `npm install`, compiles packages, checks icon packs, prompts for organization branding, and writes `marrow.config.yaml`.
* **`npm run demos`** (`docs/scripts/build-demos.mjs`): Deterministic compilation script that validates and builds all `docs/demos/*.yaml` into `docs/public/demo/*.html` (both full and embed variants).
* **`npm run docs` / `npm run docs:build`**: Nuxt 3 documentation portal located in `docs/`.

---

## 4. Stability Scorecard & Invariant Analysis

| Component | Stability Rating | Strengths | Known Failure Modes & Vulnerabilities |
| :--- | :---: | :--- | :--- |
| **Validation Engine** (`schema`) | **9.8 / 10** | Deterministic Zod parsing; clean exit code contract (0/1/2); robust line/column mapping; adversarial test coverage. | Highly resilient. Edge case: Extremely large YAML files (>20,000 lines) may cause heavy AST memory allocation during regex matching. |
| **Dev Server** (`server`) | **8.7 / 10** | Native Node HTTP (fast, zero dependencies); efficient SSE; serialized build queue prevents layout concurrency crashes; incremental page cache. | 1. No automatic port fallback on `EADDRINUSE`.<br>2. `fs.watch` on Linux does not watch subdirectories recursively.<br>3. Native string replacement for client injection (`html.replace('</body>')`) vulnerable to malformed bodies. |
| **Site Builder** (`site`) | **9.4 / 10** | Deterministic output; content-hash memoization; automatic tier/zone partitioning; clean embedding modes. | Large diagrams with complex cross-zone links can produce high edge crossings if ELK constraints conflict. |
| **Icon Indexer & Catalog** (`icons`) | **9.2 / 10** | In-memory indexing; regex-safe search; collision avoidance; fallback walking. | `icons fetch` is reliant on upstream third-party CDNs and zip archives remaining accessible. |
| **Headless Snapshotter** (`snapshot`) | **7.5 / 10** | High-fidelity headless rendering identical to browser; JSON metadata emission. | 1. Fixed timeouts (`waitForTimeout(450)` / `waitForTimeout(1100)`) cause flakiness on low-CPU CI workers.<br>2. Depends on Chromium runtime installation.<br>3. Temp HTML cleanup can leave orphaned files on unhandled SIGKILL. |

---

## 5. Architectural Vectors & Potential Problems for Reasoning Agents to Probe

When assigning a secondary agent to audit, stress-test, or find bugs in Marrow's tooling, the following specific vectors represent the most fruitful targets:

### Vector A: Dev Server Port Collision & Lifecycle Teardown
* **Location:** `packages/server/src/index.ts` (`server.listen()`)
* **Behavior:** When `port 5200` is already in use, `server.listen()` emits an unhandled rejection, causing `cmdServe` to exit with code 2.
* **Audit Question:** Should the server feature an auto-retry or next-port allocation strategy (`5200` -> `5201`) with clear terminal feedback, or provide explicit port-kill options?

### Vector B: `fs.watch` OS Specifics & Non-Recursive Watching
* **Location:** `packages/server/src/index.ts` (lines 220–233)
* **Behavior:** `watch(state.dir)` is invoked without `{ recursive: true }` because Node's recursive option has historically had platform-inconsistent behavior across Linux vs macOS/Windows.
* **Audit Question:** If a user organizes their topologies into subdirectories inside `input/` (e.g. `input/dc1/core.yaml`), file modifications in subdirectories are silently ignored by the watcher.

### Vector C: Snapshot Rendering Synchronization (Fixed Timeout vs Event Gate)
* **Location:** `packages/cli/src/index.ts` (lines 433)
* **Behavior:** `await page.waitForTimeout(values.focus ? 1100 : 450);` uses an arbitrary delay to wait for pan/zoom transitions and layout settling.
* **Audit Question:** On heavily loaded machines or large topologies (100+ nodes), 450ms is frequently insufficient for the DOM to settle and images/SVGs to decode, resulting in blank or half-rendered PNGs. Should the client runtime emit a `window.__MARROW_READY__` flag or CustomEvent that Playwright awaits via `page.waitForFunction`?

### Vector D: HTML Client Injection via String Replacement
* **Location:** `packages/server/src/index.ts` (`injectLive`)
* **Behavior:** `html.replace('</body>', `${LIVE_CLIENT}\n</body>`)` performs a literal match on `</body>`.
* **Audit Question:** If a topology description, metadata field, or custom brand HTML contains the string literal `</body>` inside a markdown code block or comment, `injectLive` will inject the script prematurely, corrupting the document markup.

### Vector E: SiteCache Invalidation Leaks Across Sessions
* **Location:** `packages/server/src/index.ts` (`State.cache`)
* **Behavior:** `state.cache` stores cached page entries across rebuilds. While keys not in `builder.has(key)` are deleted on line 193, switching between files using `GET /?file=other.yaml` clears the cache, but switching back requires a cold rebuild. Furthermore, if a user makes thousands of minor edits, check whether unreferenced AST objects in closures escape garbage collection.

### Vector F: Missing Keep-Alive / Heartbeat on SSE Connections
* **Location:** `packages/server/src/index.ts` (`/api/events`)
* **Behavior:** The SSE route does not emit periodic comment heartbeats (e.g. `: ping\n\n`).
* **Audit Question:** Proxies, load balancers, or browser dev tools with aggressive timeout policies may terminate the EventSource connection after 30–60 seconds of inactivity, causing reconnection churn.

---

## 6. How to Run the Verification & Diagnostic Tools

To execute checks or reproduce behaviors locally:

```bash
# 1. Compile all packages and runtime bundle
npm run compile

# 2. Run the complete test suite (31 test files, 312 tests)
npm test

# 3. Test dev server against sample topology
npm run dev -- fixtures/valid/small-office.yaml --port 5299

# 4. Run adversarial CLI tests specifically
npx vitest run packages/cli/test/adversarial-cli.test.ts

# 5. Run server integration tests
npx vitest run packages/server/test/server.test.ts
```

---

## 7. Architecture Decision Records (ADR) Reconciliation Matrix

Before applying architectural or CLI refinements, proposals must be reconciled against the accepted Architecture Decision Records in `docs/content/7.decisions/`.

| Proposal | Relevant ADR | Status & Evaluation | Architectural Invariant to Preserve |
| :--- | :--- | :--- | :--- |
| **Deterministic Readiness Handshake (`window.__MARROW_READY__`)** | **[ADR-0007](docs/content/7.decisions/8.0007-determinism-and-the-geometry-gate.md)** (Determinism & Geometry Gate) | **ACCEPTED / ALIGNED** | Directly reinforces ADR-0007. Eliminates arbitrary `waitForTimeout(450)` flakiness on CI. Client runtime emits `window.__MARROW_READY__ = true` only after ELK layout finishes, SVG font metrics resolve, and canvas animations complete. |
| **Worker Threads for ELK Layout** | **[ADR-0007](docs/content/7.decisions/8.0007-determinism-and-the-geometry-gate.md)** (Determinism & Geometry Gate) | **ACCEPTED WITH CONSTRAINTS** | Offloading layout to worker threads must guarantee **byte-identical output**. Thread task assignment must not introduce non-deterministic edge/node ordering. Layout configuration must pin `crossingMinimization.strategy: 'LAYER_SWEEP'`. |
| **Linux Native Recursive Watcher (`{ recursive: true }`)** | `package.json` (`engines.node: ">=24"`) | **ACCEPTED / ALIGNED** | Marrow requires Node >= 24, where `node:fs.watch(dir, { recursive: true })` is natively and reliably supported on Linux via inotify. Resolves nested topology tracking without adding third-party dependencies. |
| **In-Memory Routing for Snapshot (`page.setContent`)** | **[ADR-0004](docs/content/7.decisions/5.0004-self-contained-output.md)** (Self-contained output) | **ACCEPTED / ALIGNED** | Eliminates disk writes to `os.tmpdir()` and prevents orphaned temp files on process kill. Diagrams are already fully self-contained HTML (zero external resources), so `page.setContent(html)` works immediately in Playwright. |
| **Dual-Mode Port Resolution (`5200` -> `5201`)** | Agent CLI ergonomics (`AGENTS.md`) | **ACCEPTED / ALIGNED** | If `--port` is unspecified, catch `EADDRINUSE` and try sequential ports (`5200` to `5210`) with a warning. If `--port` is explicitly passed by user or script, fail fast with code 2. |
| **Last-Index Slicing for `injectLive`** | **[ADR-0004](docs/content/7.decisions/5.0004-self-contained-output.md)** (Self-contained output) | **ACCEPTED / ALIGNED** | Slicing at `html.lastIndexOf('</body>')` prevents premature injection when user markdown contains `</body>` and eliminates regex `$` pattern replacement corruption. |
| **15s SSE Heartbeat & `X-Accel-Buffering: no`** | Dev server protocol resilience | **ACCEPTED / ALIGNED** | Emits `: heartbeat\n\n` comments every 15s to keep connections alive across corporate proxies and Nginx without generating noise in client event handlers. |
| **YAML Alias Bomb Protection (`maxAliasCount: 100`)** | **[ADR-0006](docs/content/7.decisions/7.0006-strict-schema-with-escape-hatch.md)** (Strict schema) | **ACCEPTED / ALIGNED** | Configures YAML parser with `maxAliasCount: 100` to defend against exponential anchor expansion ("Billion Laughs" attack). |
| **Ship Vendor Icons Inside NPM Package** | **[ADR-0005](docs/content/7.decisions/6.0005-vendor-icon-packs-are-fetched.md)** (Vendor icon packs are fetched, not committed) | **REJECTED (LEGAL BOUNDARY)** | **Non-negotiable invariant.** Cloud vendors (AWS, Azure, GCP) allow their icons in architecture diagrams but legally forbid redistribution of the icon sets. Marrow **already bundles and commits** the core vendor-neutral packs (`affinity`, `k8s`, `generic`) for 100% offline usage. Vendor SVGs must remain fetched per-clone. |
| **SHA-256 Checksums in `icon-sources.json`** | **[ADR-0005](docs/content/7.decisions/6.0005-vendor-icon-packs-are-fetched.md)** | **ACCEPTED / ALIGNED** | Adding cryptographic hashes and pinned source URLs in `icon-sources.json` strengthens supply-chain integrity without violating redistribution bans. |
| **Bounded Keyed LRU Cache in Dev Server** | **[ADR-0008](docs/content/7.decisions/9.0008-page-split-thresholds.md)** (Page-split thresholds) | **ACCEPTED / ALIGNED** | Scope cache keys by `filepath:contentHash` with a maximum capacity (e.g. 50 pages) to prevent cold rebuilds when toggling files while preventing memory growth. |

---

## 8. Hardening Implementation Roadmap

The table below sequences the hardening items by severity and component boundaries:

### Phase 1: High-Priority Determinism & Memory Fixes
1. **Snapshotter Handshake (`packages/runtime/src/client/main.ts` & `packages/cli/src/index.ts`)**:
   - Set `window.__MARROW_READY__ = true` upon canvas engine idle.
   - Replace `waitForTimeout(450)` with `await page.waitForFunction(() => window.__MARROW_READY__ === true, { timeout: 15000 })`.
   - Replace temporary file writing with `await page.setContent(built.html)`.
2. **HTML Injection Fix (`packages/server/src/index.ts`)**:
   - Replace `.replace('</body>', ...)` with `const idx = html.lastIndexOf('</body>')` and sub-slice injection.
3. **Dev Server Dual-Mode Port Binding (`packages/server/src/index.ts`)**:
   - Catch `EADDRINUSE` in `server.listen()`. If default port was requested, attempt incrementing up to 10 ports with a console warning before giving up.
4. **SSE Heartbeat & Buffering Headers (`packages/server/src/index.ts`)**:
   - Add `res.setHeader('X-Accel-Buffering', 'no')`.
   - Add `setInterval(() => res.write(': heartbeat\n\n'), 15000)` with `req.on('close')` cleanup.

### Phase 2: Platform & OS Portability
1. **Recursive Watcher (`packages/server/src/index.ts`)**:
   - Pass `{ recursive: true }` to `node:fs.watch(state.dir)` on Node >= 24 to handle subdirectories like `input/dc1/core.yaml`.
2. **YAML Alias Bomb Guard (`packages/schema/src/validate.ts`)**:
   - Configure `yaml.parse(source, { maxAliasCount: 100 })`.
3. **Keyed LRU Cache (`packages/server/src/index.ts`)**:
   - Retain cached page representations across file toggling, bounded by an LRU eviction limit.
