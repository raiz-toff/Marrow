# Marrow — Agent-Driven Network Topology Studio

Marrow compiles topology YAML into interactive, self-contained HTML network
diagrams. **You — the agent — are the editor.** There is no GUI: users describe
networks in chat, you author/edit YAML in `input/`, validate, and build.

The full operating guide (golden loop, commands, schema, layout behavior, rules)
lives in **[AGENTS.md](AGENTS.md)** — read it. Quick reference:

## Commands (run from repo root)

```
npm run build                                    # compile the TS toolchain (if dist/ is stale)
npm run marrow -- validate input/<name>.yaml     # ALWAYS before saying "ready"
npm run marrow -- build input/<name>.yaml        # → output/  (single file or folder site)
npm run marrow -- serve input --host 0.0.0.0     # live preview, hot-reload, LAN-visible (serves the real site for large topologies)
npm run marrow -- snapshot input/<name>.yaml -o /tmp/x.png   # your eyes on the result
npm run marrow -- icons search <keyword>         # find real icon IDs (never guess) — packs: cisco, aws, azure, gcp, k8s, affinity, generic
npm run marrow -- icons fetch --yes              # install aws/azure/gcp from the vendors (not committed; needed once per clone)
npm run marrow -- import <legacy-v1.yaml>         # bring old v1 YAML forward
npm test                                         # 209 tests
```

## Non-negotiables

- **Validate before claiming done** — zero errors or it's not ready. Errors carry
  line numbers, fix hints, and suggestions; use them.
- **Search icons; never invent IDs.**
- **Declare meaning** (`tier`, `zone`, `ha_pair_with`) — the engine never guesses
  structure from names. Structure drives layout (see AGENTS.md).
- **Never hand-edit** `output/`, `icon-packs/**/svg/`, or `node_modules/`.
- **Do not commit** unless asked.
- **`legacy-v1/`** is the archived Python v1 (reference only) — don't author or
  build from it.

## Skill

Load the **`marrow-topology`** skill (`.claude/skills/marrow-topology/`) when
creating or editing topology YAML — it packages the workflow, the condensed
schema, and worked examples.
