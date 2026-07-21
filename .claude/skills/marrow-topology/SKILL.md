---
name: marrow-topology
description: >-
  Author or edit Marrow network-topology YAML and compile it to interactive
  offline HTML diagrams. Use whenever the user wants to create, change, or refine
  a network diagram — from a description, device configs, lab notes, discovery
  output, or a legacy v1 file. Covers the schema, icons, layout behavior, and the
  validate → preview → snapshot → build loop.
---

# Authoring Marrow topologies

You are the editor. Turn the user's intent into `input/<name>.yaml`, validate it,
show it, and build it. The authoritative reference is [AGENTS.md](../../../AGENTS.md)
at the repo root — this skill is the working checklist.

## Workflow

1. **Scope the network.** Identify devices, hierarchy/zones, links + ports, and
   the story. Ask only what you can't infer.
2. **Pick real icons first** — `npm run marrow -- icons search <keyword>`. Never
   invent an icon ID.
3. **Write `input/<name>.yaml`.** Copy the closest example below and adapt.
4. **Validate until clean** — `npm run marrow -- validate input/<name>.yaml`.
   Every error has a line, a hint, and suggestions. Fix them all. Read warnings.
5. **Look at it** — `npm run marrow -- snapshot input/<name>.yaml -o /tmp/x.png`,
   then open the PNG. Fix anything that reads wrong (missing zone, bad grouping,
   wrong hero). Iterate on the YAML, not the output.
6. **Preview live** (if the user wants it) — `npm run marrow -- serve input`,
   give them the URL; edits hot-reload.
7. **Build** — `npm run marrow -- build input/<name>.yaml` → `output/`.

## Icon packs — match the pack to the domain

Seven packs (~2,850 icons), all found via `icons search`: `cisco` (on-prem
network gear — the default), `aws`, `azure`, `gcp` (cloud services; current
GCP style lives under `gcp/current/…`), `k8s` (Kubernetes), `affinity`
(vendor-neutral — `affinity/symbol/…` plain, `affinity/tile/…` blue tile),
`generic` (fallback shapes). Cloud zones should use their vendor's icons
(`aws/compute/amazon-ec2`, `azure/networking/virtual-networks`,
`gcp/current/gke`), on-prem gear uses `cisco`, whitebox/mixed uses `affinity`.

The aws/azure/gcp packs are fetched per-clone, never committed (vendor terms).
If validate says a pack "is not installed", run
`npm run marrow -- icons fetch <pack> --yes` (see the `marrow-setup` skill).

## Structure drives layout — declare, don't hope

You never choose a layout; you declare structure and the compiler picks the right
one (shown in the diagram's sidebar → About → Layout):

| Want this shape | Declare this |
| --- | --- |
| Buildings / sites / VLANs side by side | ≥2 `zones` with devices in them |
| Classic core→dist→access hierarchy | a `tier` on every device |
| WAN hub / branch office star | one or two devices linked to all the rest (spokes touch only hubs) |
| Ring | a single cycle of links |
| Small dense fabric | a dense mesh of links |

## Worked examples

**Small tiered office** (→ layered top-down):
```yaml
marrow: 2
name: Small Office
theme: dark
devices:
  - { id: edge-rt, name: Edge Router, icon: cisco/routers/router, tier: edge }
  - { id: fw, name: Firewall, icon: cisco/security/firewall, tier: edge }
  - { id: core, name: Core Switch, icon: cisco/switches/layer-3-switch, tier: core }
  - { id: acc-1, name: Access 1, icon: cisco/switches/workgroup-switch, tier: access }
  - { id: srv, name: File Server, icon: cisco/servers/file-server, tier: endpoint }
links:
  - { from: edge-rt:Gi0/0, to: fw:outside, speed: 1G }
  - { from: fw:inside, to: core:Te1/0/1, speed: 10G }
  - { from: core:Gi1/0/10, to: acc-1:Gi0/48, kind: fiber, speed: 10G }
  - { from: core:Gi1/0/20, to: srv:eno1, speed: 10G }
```

**Multi-site campus** (→ zoned mosaic; zones become clickable pages when large):
```yaml
marrow: 2
name: Campus
zones:
  - { id: hq, name: Headquarters, accent: "#7aa2ff" }
  - { id: dc, name: Datacenter, accent: "#4fc3a1" }
devices:
  - { id: core-01, name: Core 1, icon: cisco/switches/layer-3-switch, tier: core, zone: hq, ha_pair_with: core-02 }
  - { id: core-02, name: Core 2, icon: cisco/switches/layer-3-switch, tier: core, zone: hq, ha_pair_with: core-01 }
  - { id: dc-sw, name: DC Switch, icon: cisco/switches/layer-3-switch, tier: distribution, zone: dc }
  - { id: db, name: DB Server, icon: cisco/servers/host, tier: endpoint, zone: dc }
links:
  - { from: core-01:Te1/0/1, to: core-02:Te1/0/1, kind: dac, speed: 40G, lag: po1 }
  - { from: core-01:Te1/0/2, to: core-02:Te1/0/2, kind: dac, speed: 40G, lag: po1 }
  - { from: core-01:Te1/0/10, to: dc-sw:Te1/1/1, kind: fiber, speed: 100G }
  - { from: dc-sw:Gi1/0/10, to: db:eno1, speed: 10G }
```

**WAN hub-and-spoke** (→ hub centered, branches ringed): one hub router, several
branch routers each linked only to the hub, `kind: wan`.

More references: `fixtures/valid/` and `fixtures/corpus/` are all validated
examples — read them for patterns (HA pairs, LAGs, nested zones, statuses).

## Branding the page (optional)

The diagram canvas renders inside a framed viewport; the page margin around it
is an author-brandable area. Add a top-level `backdrop:` block when the user
wants company branding or a confidentiality notice on the page:

```yaml
backdrop:
  text: Acme Networks               # brand line, top strip
  note: Proprietary & Confidential  # footer line, bottom strip
```

## Rules

- Validate to **zero errors** before telling the user it's ready.
- Search icons; never guess IDs.
- Declare `tier`/`zone`/`ha_pair_with`; don't rely on name inference.
- Edit `input/*.yaml` only — never `output/`, `icon-packs/**/svg/`, or `node_modules/`.
- Bring legacy v1 files forward with `npm run marrow -- import <file>` (don't
  author against `legacy-v1/`).
- Imported files may carry an `x-v1-config:` block (`engines:`/`layouts:`) —
  it's inert v1 leftovers, never read by v2 (which always derives one layout
  from declared structure). Delete it when you touch the file.
- Don't commit unless asked.
