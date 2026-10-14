# Marrow — Agent Operating Guide

**You are the editor.** Marrow has no GUI. A user describes a network in chat;
you author topology YAML in `input/`, compile it to a self-contained interactive
HTML diagram (or a multi-page site), and refine on feedback.

This file is the **operating procedure**. The **reference** — every key, flag,
and diagnostic code — lives in `docs/content/`, which is in this repository and
readable without a browser. Don't restate it here; link to it.

| You need | Read |
| --- | --- |
| The complete schema | [`docs/content/4.reference/1.schema.md`](docs/content/4.reference/1.schema.md) |
| Every CLI flag + exit codes | [`docs/content/4.reference/3.cli.md`](docs/content/4.reference/3.cli.md) |
| Every diagnostic code | [`docs/content/4.reference/4.diagnostics.md`](docs/content/4.reference/4.diagnostics.md) |
| Icon packs + licensing | [`docs/content/4.reference/5.icon-packs.md`](docs/content/4.reference/5.icon-packs.md) |
| Global config | [`docs/content/4.reference/2.config.md`](docs/content/4.reference/2.config.md) |
| How layout is chosen | [`docs/content/3.guides/3.layout.md`](docs/content/3.guides/3.layout.md) |
| Authoring judgment | [`docs/content/3.guides/1.authoring.md`](docs/content/3.guides/1.authoring.md) |
| Why the tool is like this | [`docs/content/7.decisions/`](docs/content/7.decisions/) |
| The domain vocabulary | [`CONTEXT.md`](CONTEXT.md) · [`docs/content/8.glossary.md`](docs/content/8.glossary.md) |

## The golden loop

1. **Understand** — from whatever the user gives (a description, device configs,
   lab notes, a request to scan their network), identify: devices, hierarchy
   (core / distribution / access), zones/sites, links + ports, and the story the
   diagram should tell.
2. **Author** — write `input/<name>.yaml`.
3. **Validate** — `npm run validate input/<name>.yaml`. Fix **every**
   error before continuing. Errors carry the exact line, a fix hint, and
   "did you mean" suggestions — use them; don't guess.
4. **Preview** (optional) — `npm run dev` gives the user a live
   URL that hot-reloads on every save.
5. **See** — `npm run snapshot -- input/<name>.yaml -o /tmp/x.png` renders
   the diagram to an image. **Look at it.** Fix layout/story problems you can see.
6. **Build** — `npm run build input/<name>.yaml` produces the shareable
   output (single file, or a folder site for large networks).

Never tell the user something is ready until step 3 passes with zero errors and
you have looked at the result.

## Commands

Run from the repo root. The table below names the raw CLI subcommands; the
common ones have npm shortcuts (`npm run validate|build|dev|snapshot|icons`),
and `npm run marrow <args>` reaches anything without one. `npm install`
compiles the toolchain — run `npm run compile` if `dist/` goes stale.

**Passing flags needs a `--` separator** — npm strips flag names otherwise, and
the result is a silent misparse rather than an error:

```
npm run validate input/net.yaml            # paths: fine as-is
npm run validate -- input/net.yaml --json   # flags: -- required
```

| Command | Purpose |
| --- | --- |
| `validate <file...> [--json]` | Schema + reference check. `--json` for machine-readable diagnostics. |
| `build <file> [--single] [-o OUT]` | Compile HTML. Auto-splits into a folder site above ~150 devices / 5 zones. |
| `serve <file-or-dir> [--host 0.0.0.0] [--port N]` | Live preview server (hot reload). |
| `snapshot <file> [-o OUT.png] [--focus ID] [--theme dark\|light]` | Render to PNG — **your eyes on the result**. |
| `import <v1-file> [-o OUT]` | Convert legacy v1 YAML to v2. |
| `icons search <keyword>` | Find real icon IDs. **Always search before using an icon.** |
| `icons fetch [pack...] [--yes]` | Install the aws/azure/gcp packs from the vendors. |
| `schema` | Emit the JSON Schema of the format. |

Exit codes: `0` valid · `1` validation errors · `2` usage or I/O error.

## The minimum you must know

```yaml
marrow: 2                      # required, the integer 2
name: Acme HQ                  # required
theme: dark                    # dark | light | auto   (default dark; auto follows the viewer's OS)
hero: core-sw-01               # optional; device the camera features on open

zones:
  - id: campus                 # kebab-case: [a-z0-9._-], starts alnum
    name: Campus

devices:
  - id: core-sw-01
    icon: cisco/switches/layer-3-switch   # REQUIRED — must exist (icons search)
    tier: core                 # core | distribution | access | edge | endpoint | management
    zone: campus
    ha_pair_with: core-sw-02   # declare on BOTH devices

links:
  - from: core-sw-01:Gi1/0/1   # "device-id:Port" — only the FIRST colon splits
    to: acc-sw-01:Gi0/48
    kind: fiber                # PHYSICAL medium: copper|fiber|dac|wireless|virtual|wan|serial
    speed: 10G                 # 10M|100M|1G|2.5G|5G|10G|25G|40G|100G|400G
    mode: trunk                # LOGICAL function: access|trunk|routed|tunnel|peering|stack
    vlans: "10,20,30"          # trunk VLANs (or the access VLAN); native_vlan: N for the untagged one
    # encap: ipsec|gre|vxlan|wireguard|dmvpn|mpls|l2tp|geneve|ssl   (mode: tunnel)
    # protocol: ospf|ebgp|ibgp|bgp|eigrp|isis|rip|static           (mode: routed | peering)
    # lag: po1 + lacp: active|passive|on|static|pagp               (aggregation, any mode)
```

`kind` is the cable; `mode` is what it carries. They compose — declare both.
Each `mode` renders a distinct symbol (trunk = double rail, tunnel = dashed + 🔒,
peering = dotted, stack = thick bar); the exact VLANs/encap/protocol/lag ride a
chip. See the [schema reference](docs/content/4.reference/1.schema.md#logical-link-modes).

Any key prefixed `x-` is preserved and ignored. Unknown keys **without** that
prefix are errors. Everything else — every optional key, every enum, the
referential rules — is in the
[schema reference](docs/content/4.reference/1.schema.md).

## Structure drives layout

You never pick a layout. Declare structure and the compiler picks one of six
archetypes (shown in each diagram's sidebar → About → Layout):

| Want this shape | Declare this |
| --- | --- |
| Buildings / sites / VLANs side by side | ≥ 2 `zones` with devices in them |
| Classic core→dist→access hierarchy | a `tier` on **every** device |
| WAN hub / branch star | 1–2 hubs; spokes touching **only** hubs |
| Ring | a single cycle of links |
| Small dense fabric | ≤ 16 devices, well-connected |

Meaning is **declared, never guessed** — the engine will not infer that
`core-sw-01` is a core switch. Exact selection rules and the routing/tidy/lint
pipeline: [`docs/content/3.guides/3.layout.md`](docs/content/3.guides/3.layout.md).

## Rules

- **Validate before claiming done.** Zero errors, or it's not ready.
- **Search icons; never guess.** `npm run icons search <keyword>`.
- **Declare meaning** (`tier`, `zone`, `ha_pair_with`) — don't rely on inference.
- **Look at the render.** `validate` proves the file is well-formed, not that the
  diagram is good.
- **Never hand-edit** `output/`, `icon-packs/**/svg/`, or `node_modules/`.
- **One dev server per port** — check nothing is on 5200 before starting another.
- **Never write credentials** (SSH passwords, community strings, secrets) into
  YAML. A built diagram is a shareable artifact; treat the file as public.
- **Don't commit** unless the user asks.
- **`legacy-v1/`** is the archived Python v1 — reference only. Use `import`.
- **Delete `x-v1-config:` on sight.** It is inert in v2 and misleads readers.

## Repo map

```
input/        topology YAML — the source of truth; edit these
output/       generated HTML (gitignored; never hand-edit)
packages/     the compiler (TypeScript monorepo) — see packages/README.md
icon-packs/   drop-in icon packs (manifest.json + svg/)
fixtures/     valid/invalid/corpus example topologies (good authoring references)
docs/         the documentation site (Nuxt Content) — the canonical reference
docs/plans/   the v2 architecture plan
legacy-v1/    archived Python v1 (reference only)
```

## Skills

- **`marrow-topology`** (`.claude/skills/marrow-topology/`) — load when creating
  or editing topology YAML. Workflow checklist, condensed schema, worked examples.
- **`marrow-setup`** (`.claude/skills/marrow-setup/`) — load when the toolchain
  isn't working: fresh clone, missing `dist/`, or "icon pack is not installed".
- **`technical-documentation`** (`.agents/skills/technical-documentation/`) — produce
  enterprise networking guides, Cisco/Wireshark runbooks, ADRs, and TypeScript/Next.js
  API references using the Diátaxis framework and strict anti-slop constraints.

