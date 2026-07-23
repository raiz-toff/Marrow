# Marrow — Agent-Driven Network Topology Studio

Marrow compiles topology YAML into interactive, self-contained HTML network
diagrams. **You — the agent — are the editor.** There is no GUI: users describe
networks in chat, you author/edit YAML in `input/`, validate, and build.

The operating guide (golden loop, commands, rules) lives in
**[AGENTS.md](AGENTS.md)** — read it. The complete reference — schema, CLI,
diagnostic codes, guides, and the decision records — lives in
**[docs/content/](docs/content/)**, in this repo, and is published as a site.
Quick reference:

## Commands (run from repo root)

```
npm run validate input/<name>.yaml           # ALWAYS before saying "ready"
npm run build input/<name>.yaml              # → output/  (single file or folder site)
npm run dev                                  # live preview of input/, hot-reload (serves the real site for large topologies)
npm run dev:lan                              # same, but reachable from the LAN (no auth — trusted networks only)
npm run snapshot input/<name>.yaml -o /tmp/x.png   # your eyes on the result
npm run icons search <keyword>               # find real icon IDs (never guess) — packs: cisco, aws, azure, gcp, k8s, affinity, generic
npm run icons fetch --yes                    # install aws/azure/gcp from the vendors (not committed; needed once per clone)
npm run marrow import <legacy-v1.yaml>       # bring old v1 YAML forward
npm test                                     # 244 tests
npm run docs                                 # the documentation site (dev)
npm run compile                              # recompile the TS toolchain (npm install does this for you)
```

File paths pass straight through. **Flags need a `--` separator** — npm strips
flag names otherwise and you get a silent misparse, not an error:

```
npm run snapshot input/x.yaml                    # fine
npm run snapshot -- input/x.yaml -o /tmp/x.png   # -- required: there's a flag
```

`npm run marrow <subcommand>` still reaches the raw CLI for anything without a
shortcut (`import`, `schema`).

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
