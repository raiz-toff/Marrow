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
2. **Pick real icons first** — `npm run marrow -- icons search "switch" "firewall" "router" --json`
   (supports batch multi-term search in one command). Never invent an icon ID.
3. **Write `input/<name>.yaml`.** Copy the closest example below and adapt.
4. **Validate until clean** — `npm run marrow -- validate input/<name>.yaml`.
   Every error has a line, a hint, and suggestions. Fix them all. Read warnings.
5. **Look at it** — `npm run marrow -- snapshot input/<name>.yaml -o /tmp/x.png`,
   then open the PNG. Fix anything that reads wrong (missing zone, bad grouping,
   wrong hero). Iterate on the YAML, not the output.
6. **Preview live** (if the user wants it) — `npm run marrow -- serve input`,
   give them the URL; edits hot-reload.
7. **Build** — `npm run marrow -- build input/<name>.yaml` → `output/`.

## Updating existing diagrams (preserve human context)

When updating an existing topology YAML file from new CLI outputs, discovery logs, or user instructions:
- **Always edit in-place**: Never regenerate or wipe out the YAML file from scratch.
- **Preserve human context**: Retain existing `tier`, `zone`, `ha_pair_with`, `hero`, `notes`, `config` snippets, custom labels, and visual accents (`style.accent`).
- **Targeted edits**: Only append newly discovered devices/links, or update changed interface and IP mappings.

## Authoring from Cisco IOS, Packet Tracer, or PCAP

When the user provides Cisco `show running-config`, `show cdp neighbors detail`, Packet Tracer logs, or packet captures, follow:
[references/cisco-cli-mapping.md](file:///home/coder/Production/Diagramming%20tool/Marrow/.agents/skills/marrow-topology/references/cisco-cli-mapping.md)

It maps switchport modes, VLAN sets, Port-Channels (`lag:`/`lacp:`), point-to-point `/30` routed links, and VPN tunnels directly into Marrow schema keys.

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

## Link semantics — declare what the cable carries

A link has two axes: the **medium** (`kind`, `speed`) and the **logical
function** (`mode`). Declare `mode` and the compiler draws a distinct symbol; the
exact detail rides a chip. This is what lets a diagram show trunks, VPNs, LACP,
and routing — network engineers need it.

| `mode:` | Symbol | Companion keys | Example |
| --- | --- | --- | --- |
| `access` | plain line | `vlans` | `{ mode: access, vlans: "10" }` |
| `trunk` | double rail | `vlans`, `native_vlan` | `{ mode: trunk, vlans: "10,20,30", native_vlan: 1 }` |
| `routed` | solid + chip | `protocol` | `{ mode: routed, protocol: ospf }` |
| `peering` | dotted | `protocol` | `{ mode: peering, protocol: ebgp, kind: wan }` |
| `tunnel` | dashed + 🔒 | `encap` | `{ mode: tunnel, encap: ipsec }` |
| `stack` | thick bar | — | `{ mode: stack, kind: dac }` |

- `encap`: `ipsec | gre | vxlan | wireguard | dmvpn | mpls | l2tp | geneve | ssl`
- `protocol`: `ospf | ebgp | ibgp | bgp | eigrp | isis | rip | static`
- **Aggregation** is orthogonal: give members a shared `lag: po1` (+ optional
  `lacp: active|passive|on|static|pagp`) and they bundle onto one strand chipped
  with the lag id. A LAG can be a trunk, access, or routed port-channel.
- Attributes that don't match the mode warn (`MRW-W105`) but don't block.

```yaml
links:
  # LACP port-channel carrying a trunk
  - { from: core-1:Te1/0/1, to: core-2:Te1/0/1, lag: po1, lacp: active, mode: trunk, kind: dac, speed: 40G }
  - { from: core-1:Te1/0/2, to: core-2:Te1/0/2, lag: po1, lacp: active, mode: trunk, kind: dac, speed: 40G }
  - { from: core-1:Gi1/0/1, to: acc-1:Gi0/48, mode: trunk, vlans: "10,20,30", native_vlan: 1, kind: fiber, speed: 10G }
  - { from: acc-1:Gi0/1, to: pc-1:eth0, mode: access, vlans: "10" }
  - { from: fw-a:tun0, to: fw-b:tun0, mode: tunnel, encap: ipsec }   # site-to-site VPN
  - { from: edge-rt, to: isp-rt, mode: peering, protocol: ebgp, kind: wan }
```

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

## Density and scaling (optional)

Adjust visual compactness and font sizing at the topology header:

```yaml
density: compact      # compact | standard | spacious (default: standard)
scale: 0.9           # multiplier 0.4 to 2.5 (default: 1.0)
```

Use `compact` for dense spine-and-leaf topologies (50+ nodes). Use `spacious` for executive presentations or kiosk screens.

## Custom fields and operational data

Enrich device and link inspection drawers with structured facts, operational tables, and markdown:

```yaml
devices:
  - id: core-01
    icon: cisco/switches/layer-3-switch
    tier: core
    custom_fields:
      Serial Number: "FOC2049102"
      Model: "Cisco Catalyst 9500"
      Management IP: "192.168.1.1"
    sections:
      BGP Neighbors:
        - Peer: "192.168.1.2"
          AS: 65001
          Status: "Established"
          Prefixes: 42
      Interface State: |
        | Interface | IP Address | Status |
        | Te1/0/1   | 10.1.1.1   | Up     |
```

Links also accept `custom_fields:` and `sections:`. Clicking any link in the SVG viewer opens a dedicated link inspector drawer.

## Branding (global configuration)

Branding is global and configured in `marrow.config.yaml` at the repository root, not in individual topology files (see ADR-0003):

```yaml [marrow.config.yaml]
brand:
  name: Acme Networks
  note: Proprietary & Confidential
theme:
  dark:
    accent: "#38bdf8"
  links:
    default_stroke: 1.5
    ten_g_stroke: 2.5
```

## Rules

- Validate to **zero errors** before telling the user it's ready.
- Search icons; never guess IDs.
- Declare `tier`/`zone`/`ha_pair_with`; don't rely on name inference.
- Edit `input/*.yaml` only — never `output/`, `icon-packs/**/svg/`, or `node_modules/`.
- Use `density:` and `scale:` for layout compactness; never use `pin:` to reposition nodes.
- Put inventory facts in `custom_fields:` and tables in `sections:`.
- Bring legacy v1 files forward with `npm run marrow -- import <file>` (don't
  author against `legacy-v1/`).
- Imported files may carry an `x-v1-config:` block (`engines:`/`layouts:`) —
  it's inert v1 leftovers, never read by v2 (which always derives one layout
  from declared structure). Delete it when you touch the file.
- Don't commit unless asked.
