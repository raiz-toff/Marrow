# Marrow internals

Agent-authored YAML in → a self-contained, offline, interactive network-diagram
site out. The contributor documentation is on the docs site, which lives in this
repository under [`../docs/content/6.contributing/`](../docs/content/6.contributing/):

| | |
| --- | --- |
| [Architecture](../docs/content/6.contributing/2.architecture.md) | The compile pipeline, stage by stage, and the design invariants |
| [Package map](../docs/content/6.contributing/3.packages.md) | What lives in each package, and where to make a given change |
| [Testing](../docs/content/6.contributing/4.testing.md) | The suite, the fixture corpus, and verifying visual work |
| [Adding an icon pack](../docs/content/6.contributing/5.adding-an-icon-pack.md) | Directory layout, manifest generation, licensing |

User-facing docs: [root README](../README.md). Agent operating guide:
[AGENTS.md](../AGENTS.md). Contribution process: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Package map

```
packages/
├─ diagnostics   error/warning format, codes (MRW-Exxx), snippets, suggestions
├─ model         the normalized in-memory topology every module speaks
├─ scene         the geometric contract (boxes, polylines) + geometry helpers
├─ metrics       deterministic text measurement (static glyph tables)
├─ icons         icon packs: manifest, generator, search, suggestions
├─ schema        YAML parse → strict validation (line/col, did-you-mean) → model
├─ layout        classify → place (ELK / compose / polar / circle) → route (libavoid)
├─ lint          geometry linter: L1 fails builds, L2 auto-repairs, L3 advises
├─ render-svg    scene → SVG (hero tier) or canvas host (scale tier)
├─ runtime       the ~20 KB client: camera, inspector, spotlight, minimap, export
├─ site          collapse, page planner, single-file + multi-page compiler
├─ server        dev server: watch, rebuild, SSE live reload, /api
└─ cli           the marrow command
```

## Build & test

```
npm install
npm run compile            # tsc -b + bundle the runtime client
npm test                 # 244 tests (vitest)
```

## Design rules

- One validation code path; every diagnostic is machine-readable with code,
  path, line/col, snippet, hint, and did-you-mean.
- Unknown keys are errors (except `x-`-prefixed annotations, which are ignored).
- Meaning is **declared** in YAML, never guessed from names.
- Determinism everywhere; builds must be reproducible byte-for-byte.
- Every visual change lands in `render-svg` **and** the canvas engine **and**
  `site/styles.ts` — never just one.
- No framework dependencies in the viewer: the chrome is shadcn/ui *ported* to
  vanilla CSS and TypeScript, because output must stay single-file and offline.
