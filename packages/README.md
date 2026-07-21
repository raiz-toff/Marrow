# Marrow internals

Agent-authored YAML in → a self-contained, offline, interactive network-diagram
site out. This document maps the monorepo for contributors. User-facing docs are
in the [root README](../README.md); the agent operating guide is in
[AGENTS.md](../AGENTS.md).

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

Supporting trees at the repo root:

```
icon-packs/      drop-in icon packs (manifest.json + svg/) — affinity, k8s, generic (committed);
                 aws, azure, gcp, cisco (user-provided; see icon-packs/LICENSES.md)
fixtures/        valid/invalid/corpus/v1 topologies driving the test suite
```

## Build & test

```
npm install
npm run build            # tsc -b + bundle the runtime client
npm test                 # 244 tests (vitest)
```

## Design rules

- One validation code path; every diagnostic is machine-readable with code,
  path, line/col, snippet, hint, and did-you-mean.
- Unknown keys are errors (except `x-`-prefixed annotations, which are ignored).
- Meaning is **declared** in YAML, never guessed from names.
- Determinism everywhere; builds must be reproducible byte-for-byte.
