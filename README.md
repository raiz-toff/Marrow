# Marrow v2

Ground-up rewrite of Marrow per [docs/plans/marrow-v2-plan.md](../docs/plans/marrow-v2-plan.md).
Agent-authored YAML in → a self-contained, offline, interactive network-diagram
site out. Nothing here reuses v1 code.

## Status

All phases **P0–P5 complete**: contracts · geometry (ELK + libavoid + linter) ·
hero SVG renderer · agent loop (serve/snapshot) · scale (zone compose, collapse,
page planner, multi-page site, canvas tier) · breadth (radial presets, icon
packs, exports, keyboard nav, v1 import).

## Layout

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
├─ runtime       the 20 KB client: camera, inspector, spotlight, minimap, export
├─ site          collapse, page planner, single-file + multi-page compiler
├─ server        dev server: watch, rebuild, SSE live reload, /api
└─ cli           the marrow command
icon-packs/      drop-in icon packs (manifest.json + svg/) — cisco, aws, azure, gcp, k8s, affinity, generic
fixtures/        valid/invalid/corpus/v1 topologies driving the 209-test suite
```

## Commands

```
npm install && npm run build && npm run gen:icons
npm run marrow -- icons fetch    # aws/azure/gcp packs, downloaded from the vendors (not committed)
npm test
npm run marrow -- validate <file...> [--json]       # agent-grade diagnostics
npm run marrow -- build <file> [--single] [-o out]  # single file or site folder
npm run marrow -- serve <file-or-dir> [--host 0.0.0.0] [--port 5200]
npm run marrow -- snapshot <file> [-o out.png] [--focus <id>]   # agent's eyes
npm run marrow -- import <v1-file> [-o out.yaml]    # v1 / discovery bridge
npm run marrow -- icons search <keyword>
npm run marrow -- icons fetch [pack...] [--yes]     # install vendor packs from official sources
```

## Rules (from the plan)

- One validation code path; every diagnostic is machine-readable with
  code, path, line/col, snippet, hint, did-you-mean.
- Unknown keys are errors (except `x-` prefixed annotations, which are ignored).
- Meaning is declared in YAML, never guessed from names.
- Determinism everywhere; builds must be reproducible byte-for-byte.
