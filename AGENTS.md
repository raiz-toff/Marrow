# Marrow — Agent Operating Guide

**You are the editor.** Marrow has no GUI. A user describes a network in chat;
you author topology YAML in `input/`, compile it to a self-contained interactive
HTML diagram (or a multi-page site), and refine on feedback. This file tells you
how to drive the tool. It is the source of truth for AI agents working here.

## The golden loop

1. **Understand** — from whatever the user gives (a description, device configs,
   lab notes, a request to scan their network), identify: devices, hierarchy
   (core / distribution / access), zones/sites, links + ports, and the story the
   diagram should tell.
2. **Author** — write `input/<name>.yaml` (schema below).
3. **Validate** — `npm run marrow -- validate input/<name>.yaml`. Fix **every**
   error before continuing. Errors carry the exact line, a fix hint, and
   "did you mean" suggestions — use them; don't guess.
4. **Preview** (optional) — `npm run marrow -- serve input` gives the user a live
   URL that hot-reloads on every save.
5. **See** — `npm run marrow -- snapshot input/<name>.yaml -o /tmp/x.png` renders
   the diagram to an image. **Look at it.** Fix layout/story problems you can see.
6. **Build** — `npm run marrow -- build input/<name>.yaml` produces the shareable
   output (single file, or a folder site for large networks).

Never tell the user something is ready until step 3 passes with zero errors.

## Commands

Run from the repo root (`npm run marrow -- <args>`, or `node packages/cli/dist/index.js <args>`).

| Command | Purpose |
| --- | --- |
| `validate <file...> [--json]` | Schema + reference check. `--json` for machine-readable diagnostics. |
| `build <file> [--single] [-o OUT]` | Compile HTML. Auto-splits into a folder site above ~150 devices / 5 zones; `--single` forces one file. |
| `serve <file-or-dir> [--host 0.0.0.0] [--port N]` | Live preview server (hot reload). Serves exactly what `build` ships — large topologies get the full multi-page site (zone/device pages, inventory, search) with lazy, memoized page builds; an edit reloads only the pages it changed. `--host 0.0.0.0` exposes it on the LAN. |
| `snapshot <file> [-o OUT.png] [--focus ID] [--theme dark\|light]` | Render to PNG — **your eyes on the result**. |
| `import <v1-file> [-o OUT]` | Convert legacy v1 YAML (or discovery output) to v2. |
| `icons search <keyword>` | Find real icon IDs. **Always search before using an icon.** |
| `icons fetch [pack...] [--yes]` | Install the aws/azure/gcp packs from the vendors' official servers (not committed — see Icons). |
| `schema` | Emit the JSON Schema of the format. |

Build first if `dist/` is stale: `npm run build`.

## Schema (marrow 2)

```yaml
marrow: 2                      # required, the integer 2
name: Acme HQ                  # required
description: One-line summary  # optional; becomes the diagram watermark subtitle
theme: dark                    # dark | light   (default dark)
hero: core-sw-01               # optional; device the camera features on open
backdrop:                      # optional; branding in the page margin around the diagram
  text: Acme Networks          # brand line, top strip
  note: Proprietary & Confidential  # footer line, bottom strip

zones:                         # optional; group devices into sites/areas/VLANs
  - id: campus                 # required, kebab-case: [a-z0-9._-], starts alnum
    name: Campus               # optional (defaults to id)
    parent: null               # optional; nest zones by referencing another zone id
    collapse: auto             # auto | open | closed
    accent: "#7aa2ff"          # optional hex; tints the zone panel

devices:                       # the nodes
  - id: core-sw-01             # required, unique, kebab-case
    name: Core Switch 1        # optional (defaults to id)
    icon: cisco/switches/layer-3-switch   # REQUIRED — must exist (icons search)
    tier: core                 # core | distribution | access | edge | endpoint | management
    zone: campus               # optional; must be a declared zone id
    role: L3 core              # optional free text
    status: up                 # up | down | degraded | planned | unknown (default up)
    mgmt_ip: 10.0.0.1          # optional
    ha_pair_with: core-sw-02   # optional; declare HA pairs explicitly (both directions)
    hero: false                # optional; feature this device
    pin: { x: 100, y: 200 }    # optional; fix a position (else auto-laid-out)
    accent: "#7aa2ff"          # optional hex
    note: "Change freeze"      # optional; shown in the inspector + device page
    config: "hostname core1"   # optional; config snippet shown in the inspector
    interfaces:                # optional
      - name: Gi1/0/1
        description: uplink
        vlan: 10               # 1–4094
        ip: 10.0.0.1

links:                         # the cables
  - from: core-sw-01:Gi1/0/1   # "device-id:Port"  (port optional: "device-id")
    to: acc-sw-01:Gi0/48       # only the FIRST colon splits device from port
    kind: fiber                # copper | fiber | dac | wireless | virtual | wan | serial
    speed: 10G                 # 10M|100M|1G|2.5G|5G|10G|25G|40G|100G|400G
    lag: po1                   # links sharing a lag id between the same pair bundle
    status: up                 # up | down | degraded | planned (default up)
    animated: true             # flowing-dash effect (use sparingly)
    label: "vlan 20"           # optional edge label
    note: "packet loss 12%"    # optional
```

**Referential rules** (all enforced by `validate`): every zone/device reference
must exist; ids are unique; a port reused across links → warning (W101); an
unlinked device → warning (W103); an empty zone → warning (W102). Warnings are
advisory — usually worth fixing, never blocking.

**Private annotations:** any key you prefix with `x-` is preserved but ignored
(e.g. `x-owner: netops`). Unknown keys **without** that prefix are errors.

## How structure drives layout (you don't pick a layout — you declare structure)

Marrow computes **one** correct layout at build time from what you declare. To
get the shape you want, declare the right structure:

- **Two or more zones with devices** → zoned mosaic (each zone laid out on its
  own, packed neatly, no overlaps). Use zones for buildings, sites, VLANs, OT/IT.
- **Every device has a `tier`** → layered top-down: edge → core → distribution →
  access → endpoint. Use tiers for classic hierarchical networks.
- **One or two devices own most links** → hub-and-spoke (hub centered, spokes
  ringed). Great for WAN / branch networks. Keep spokes connected *only* to hubs.
- **A single cycle** → ring. **A dense small graph** → mesh.
- Otherwise → plain layered.

The chosen preset is shown in each diagram's sidebar ("About → Layout").
Meaning is **declared, never guessed** — set `tier:`, `zone:`, `ha_pair_with:`
rather than hoping the engine infers them from names.

**Legacy `x-v1-config` is inert.** Files brought forward with `import` may carry
an `x-v1-config:` block (`engines:`, `layouts:`, `output_filename:`) — that is
the archived v1 config, preserved only as a record. v1 rendered one variant per
engine × layout combo; v2 has no such mode and never reads that block. Only one
layout is ever produced, chosen by the rules above. Delete the block on sight
(or when editing the file) — it has zero effect and misleads readers into
expecting multiple layouts.

## Icons

Never invent icon IDs. Search the ~2,850-icon library:

```
npm run marrow -- icons search firewall
npm run marrow -- icons search "layer 3 switch"
```

IDs look like `<pack>/<category>/<name>`. A wrong/misspelled icon is a
validation **error** with ranked suggestions — but search first and avoid it.

| Pack | Icons | In repo? | Use for | Example |
| --- | --- | --- | --- | --- |
| `cisco` | ~980 | yes | on-prem network gear (default for routers/switches/firewalls) | `cisco/switches/layer-3-switch` |
| `aws` | ~790 | **fetched** | AWS services + resources | `aws/compute/amazon-ec2` |
| `azure` | ~710 | **fetched** | Azure services | `azure/networking/virtual-networks` |
| `gcp` | ~235 | **fetched** | Google Cloud (current style under `gcp/current/…`) | `gcp/current/gke` |
| `k8s` | 33 | yes (CC-BY-4.0) | Kubernetes components | `k8s/infrastructure-components/node` |
| `affinity` | 107 | yes (MIT) | vendor-neutral symbols (`symbol/` plain, `tile/` blue tile) | `affinity/symbol/firewall` |
| `generic` | 5 | yes | fallback vendor-neutral shapes | — |

**Fetched packs (aws / azure / gcp) are NOT committed** — vendor terms allow
using the icons in diagrams but not redistributing the libraries. Each user
installs them from the vendors' official servers:

```
npm run marrow -- icons fetch            # all three, with a consent prompt
npm run marrow -- icons fetch aws --yes  # one pack, non-interactive
```

Sources and license pointers live in `icon-sources.json`; the packs are
gitignored. On a fresh clone, run the fetch once — `validate` tells you
exactly this ("pack not installed — run marrow icons fetch <pack>") if a
topology references a pack that isn't there. Icons embedded in built HTML
outputs are fine to share — that is the granted use.

Match the pack to the domain: cloud zones get cloud-vendor icons, on-prem gets
`cisco`, mixed/whitebox gets `affinity`. Common Cisco picks:
`cisco/switches/layer-3-switch`, `cisco/switches/workgroup-switch`,
`cisco/routers/router`, `cisco/security/firewall`, `cisco/servers/file-server`,
`cisco/servers/host`, `cisco/computer-and-peripherals/laptop`.

**Adding a pack:** drop SVGs into `icon-packs/<pack>/svg/<Category>/name.svg`
(descriptive kebab/word filenames — they become the search keywords), add the
pack to the `gen:icons` script in `package.json`, run `npm run gen:icons`.
Discovery is automatic — every folder in `icon-packs/` with a `manifest.json`
is loaded. Juniper/Fortinet publish stencils only in Visio format (`.vss(x)`);
convert via draw.io (import stencil → export SVG) before dropping them in.
Palo Alto has no public icon library.

## Output shapes

- **Single file** (`build`, small networks): one self-contained `.html` in
  `output/`. Works offline from a double-click.
- **Folder site** (`build`, ≥150 devices or >5 zones): a directory with
  `index.html` (overview), `zones/`, `devices/`, `inventory.html`, and shared
  `assets/` (runtime, styles, cross-page search). Also fully offline.

Every output is deterministic (same YAML → identical bytes), overlap-free
(a geometry linter fails the build otherwise), and self-contained (no network
requests when opened).

## Rules

- **Validate before claiming done.** Zero errors, or it's not ready.
- **Search icons; never guess.**
- **Declare meaning** (`tier`, `zone`, `ha_pair_with`) — don't rely on inference.
- **Never hand-edit** `output/`, `icon-packs/**/svg/`, or `node_modules/`.
- **One dev server per port** — check it's not already running before starting another.
- **Never write credentials** (SSH passwords, secrets) into YAML or committed files.
- **Don't commit** unless the user asks.
- **`legacy-v1/`** is the archived Python v1 — reference only; do not use it to
  author or build. Use `import` to bring old v1 YAML forward.

## Repo map

```
input/        topology YAML — the source of truth; edit these
output/       generated HTML (gitignored; never hand-edit)
packages/     the compiler (TypeScript monorepo):
  schema        YAML → validation → normalized model
  layout        classify → place (ELK/compose/polar) → route (libavoid) → lint
  render-svg    scene → SVG (hero tier) or canvas host (scale tier)
  runtime       the browser client (camera, inspector, spotlight, minimap…)
  site          collapse, page planner, single-file + multi-page compiler
  server        dev server (watch → rebuild → live reload) + /api
  cli           the `marrow` command
icon-packs/   drop-in icon packs (manifest.json + svg/) — cisco, aws, azure, gcp, k8s, affinity, generic
fixtures/     valid/invalid/corpus example topologies (good authoring references)
docs/plans/   the architecture plan
legacy-v1/    archived Python v1 (reference only)
```
