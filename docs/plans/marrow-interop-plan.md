# Marrow interop plan: the compiler between the tools engineers already run

*Status: Proposed. Phase 0 (this document, ADR drafts 0010–0012, static visual
audit) is complete. No later phase starts without its own approved
implementation plan.*

## Goal

Reposition Marrow from "an agent writes YAML for one person" to **"point Marrow
at what your tools already produce, get an engineering-grade diagram."**

Marrow does not replace Packet Tracer, Wireshark, NetBox, or Visio. It reads
their artifacts, merges them into one topology, and compiles a diagram that can
be shared without explanation.

```text
show run / show cdp ─┐
Packet Tracer CLI   ─┤
Wireshark .pcapng   ─┼─► marrow import ─► net.discovered.yaml ─┐
NetBox export       ─┤      (adapters)     (machine-owned)     ├─► marrow build ─► diagram / site
containerlab/GNS3   ─┤                                         │
draw.io             ─┘                   net.yaml (human-owned)┘
                                         tier, zone, notes, story
```

Positioning: *diagrams that stay true because they are regenerated from your
network, not redrawn from memory.*

## Competitive position

| Existing tool | What it does | Gap Marrow fills |
| --- | --- | --- |
| draw.io / Visio / Lucidchart | Hand-drawn | Rots after the first change; no source of truth |
| NetBox topology plugins | Live graph inside NetBox | Needs a running NetBox; no offline shareable artifact |
| SolarWinds NTM, Auvik, LibreNMS maps | Live SNMP discovery | Commercial or server-bound; output trapped in the platform |
| Batfish | Config analysis | Analysis engine, not a diagram product |
| containerlab `graph`, GNS3 | Lab views | Single source; not publication-grade |
| Mermaid / nwdiag / `diagrams` | Diagram-as-code | No ingest; author types everything |

Each column has a competitor. The differentiation is the combination:
**multi-source ingest + offline compiled artifact + diagram-as-code + agent loop.**

## Decisions this plan depends on

| ADR | Status | Effect |
| --- | --- | --- |
| [ADR-0010](../content/7.decisions/11.0010-importers-may-infer.md) | Proposed | Importers may infer, with provenance; the compiler still never infers |
| [ADR-0011](../content/7.decisions/12.0011-discovered-and-overlay-files.md) | Proposed | `extends:` overlay; re-import never destroys human edits |
| [ADR-0012](../content/7.decisions/13.0012-agent-optional-import-path.md) | Proposed | Amends ADR-0002: import → build works with no agent |

## Ethics constraint

Packet Tracer `.pkt` / `.pka` files are not decrypted. The format is obfuscated,
and reverse-engineering it conflicts with the Cisco Packet Tracer EULA. Packet
Tracer support goes through CLI output that Packet Tracer itself produces
(`show running-config`, `show cdp neighbors detail`). The same adapter covers
real IOS hardware.

## Open questions

1. **First audience.** Recommended: CCNA students and working Cisco engineers.
2. **License / business model.** Recommended: stay MIT for now.
3. **Visual verification access.** Phase 0 was a static audit from code. Phase 1
   needs rendered output: either permission to run `npm run snapshot`, or
   screenshots from the user.
4. **Next.js surface.** Recommended: a thin `@marrow/react` embed of a
   pre-compiled diagram, not a viewer rewrite.

## Phases

Each phase gets its own implementation plan and explicit approval.

### Phase 0: Credibility groundwork (complete)

- This plan saved to `docs/plans/`.
- ADR-0010, ADR-0011, ADR-0012 drafted as Proposed.
- Static visual audit from source (findings below).
- README / docs voice scan: no banned vocabulary found; no edits required.

### Phase 1: Engineering style (first code)

Driven by the Phase 0 audit findings:

| Finding (from source) | Location | Proposed change |
| --- | --- | --- |
| Default theme is `dark` | `packages/schema/src/zodSchema.ts:81` | Default to `light` (print-first); `dark` stays available |
| Palette is shadcn zinc + blue-500 | `packages/site/src/styles.ts:20-49` | Neutral engineering palette; accent reserved for status and selection |
| Entrance animation: zone fade, node scale cascade, edge draw-in at 0.7 s | `styles.ts:194-212` | Static on open; motion only on interaction |
| Infinite "marching ants" on `animated: true` links | `styles.ts:202, 212` | Keep, but off in exports and print |
| Export has no legend and no title | `runtime/src/client/main.ts:1109-1142` | Embed legend (built from used modes) and title block in PNG/SVG |
| Port labels exist at link ends but are hidden unless zoomed near | `styles.ts:534-537` | Show port labels in exports by default |
| Floating, framed stage with dotted grid and drop shadow | `styles.ts:82-97` | Flat canvas option for exports |
| No drawing metadata in schema | `packages/model/src/index.ts:120-129` | Optional `revision`, `author`, `date` keys |

All visual changes land in `render-svg`, the canvas engine, and
`site/styles.ts` together (per `packages/README.md`).

### Phase 2: Cisco CLI adapter (Packet Tracer + real IOS)

| IOS input | Marrow model field |
| --- | --- |
| `hostname R1` | `device.id`, `device.name` |
| `interface …` + `description` | `interfaces[].name`, `.description` |
| `switchport mode trunk` / `switchport trunk allowed vlan 10,20` | `link.mode: trunk`, `link.vlans` |
| `switchport trunk native vlan 99` | `link.nativeVlan` |
| `switchport access vlan 20` | `link.mode: access`, `link.vlans: "20"` |
| `channel-group 1 mode active` | `link.lag: po1`, `link.lacp: active` |
| `ip address 10.0.12.1 255.255.255.252` | `interfaces[].ip`; matching /30 or /31 peers → `mode: routed` |
| `router ospf 1` + `network … area 0` | `link.protocol: ospf` |
| `interface Tunnel0` + `tunnel mode gre` | `link.mode: tunnel`, `encap: gre` |
| `show cdp neighbors detail` / `show lldp neighbors detail` | Link endpoints |

Input: a single terminal session log, split on IOS prompts (`R1#`,
`SW-02(config)#`), or a folder with one file per device. The CDP/LLDP parsers
port from `legacy-v1/engine/discovery/parsers.py`.

### Phase 3: Wireshark adapter

Pure-TypeScript `.pcap` / `.pcapng` parsing:

| Frame | Identifier | Yields |
| --- | --- | --- |
| LLDP | EtherType `0x88CC` | Chassis ID (TLV 1), Port ID (2), System Name (5), Capabilities (7), Mgmt Addr (8) |
| CDP | SNAP PID `0x2000`, dst `01:00:0c:cc:cc:cc` | Device ID, Port ID, Platform, Native VLAN (`0x000a`) |
| STP / RSTP BPDU | dst `01:80:c2:00:00:00` | Root bridge ID |
| OSPF Hello | IP proto `89` | Router ID, area, neighbor list |
| ARP | EtherType `0x0806` | IP ↔ MAC |
| 802.1Q | TPID `0x8100` | VLANs seen |

Limitation: one capture shows one LLDP/CDP hop. Full topology needs one capture
per segment, a SPAN session, or a merge with Phase 2 data.

### Phase 4: Source-of-truth and lab adapters

containerlab (`*.clab.yml`), GNS3 (`.gns3`), EVE-NG (`.unl`),
NetBox / Nautobot (REST; token from env var, never written to YAML), and
draw.io (port of `legacy-v1/engine/ingestors/drawio.py`).

### Phase 5: Outputs for existing workflows

draw.io / Mermaid export (one-way), `@marrow/react` embed component, and a
CI recipe that regenerates the discovered file from a config-backup repo.
Visio `.vsdx` is deferred.

## Non-goals

- Decrypting `.pkt` / `.pka` or any format whose license forbids it.
- Live SSH/SNMP crawling inside the compiler.
- A canvas editor.
- A Next.js rewrite of the viewer (output stays single-file and offline, ADR-0004).
