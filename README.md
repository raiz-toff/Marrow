<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/wordmark-dark.svg">
  <img src="docs/public/wordmark.svg" alt="Marrow" width="232" height="48">
</picture>

**Use any AI agent locally to compile declarative network topologies into self-contained, interactive, offline HTML, SVG, and PNG network diagrams.**

[![CI](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml/badge.svg)](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/badge/npm-marrow--cli-blue.svg)](https://www.npmjs.com/package/marrow-cli)

📖 **[Full Documentation](https://marrowdiagram.vercel.app)** · 🎯 **[Live Showcase](https://marrowdiagram.vercel.app/docs/showcase)** · ⚡ **[Quickstart](https://marrowdiagram.vercel.app/docs/getting-started/quickstart)** · 🧩 **[React / shadcn Components](https://marrowdiagram.vercel.app/docs/components)**

---

## Why this exists

> *"I got tired of spending hours dragging boxes and fixing bent lines by hand every time I built a new network lab.*
>
> *There are plenty of diagramming tools out there if you want to draw everything manually, and plenty of AI tools that spit out messy flowcharts—but nothing where I could just drop my configs or talk through a lab with an agent and get a diagram I actually wanted to look at.*
>
> *So I built Marrow. You describe the topology (or hand your agent the configs), the compiler figures out the layout and routing, and it outputs a single offline `.html` file. It holds the actual interface, VLAN, and config details inside it, looks clean in docs, and you can send the file to anyone without needing a server or an account.*
>
> *I built it for my own labs and documentation. Putting it out there in case it saves you some time too."*

---

## What makes Marrow different

* **You declare structure — the engine computes the layout**: You declare what devices *are* (`tier: core`, `zone: datacenter`, `ha_pair_with: core-02`) and how they connect. Marrow calculates optimal hierarchical placement, zone clustering, and collision-free curved spline routing. Zero coordinates in YAML.
* **Network-native link semantics**: Real 802.1Q double-rail trunks with VLAN chips (`10,20,30`), LACP port-channel bundles, IPsec / GRE / VXLAN overlay padlocks, and per-interface access chips.
* **Self-contained, offline interactive HTML**: Everything—vendor icons, layout styles, and the lightweight runtime—is embedded into a single `.html` file. It works offline on a plane, needs no server, and respects your privacy.
* **Configurable Blueprint & Static Export**: Export clean, publication-ready SVGs or high-resolution 2x Retina PNGs with engineering CAD title blocks, dynamic vector auto-legends, and visible interface port labels.
* **Modular UI & Embed Modes**: Run in full workstation mode with command bar, search palette (`Ctrl+K`), and device inspector, or embed minimal diagrams in docs, dashboards, or NOC monitors with `#chrome=minimal`.
* **shadcn/ui Component Registry**: Embed interactive compiled diagrams and render live link badges directly in your React / Next.js applications via `npx shadcn add`.
* **Agent-native compiler**: Built specifically for pair-programming with AI coding agents (Claude Code, Cursor, Cline, Antigravity, Windsurf, Aider). Structured JSON diagnostics (`--json`) and autonomous self-healing for minor update regressions.

---

## Quick start

### Option A: Install globally via npm

```bash
npm i -g marrow-cli

marrow validate net.yaml            # Verify syntax & reference integrity
marrow build net.yaml               # Compile to a self-contained net.html
marrow serve input/                 # Live preview with instant hot-reloading
marrow snapshot net.yaml -o out.png # High-res static PNG export
marrow icons search switch firewall # Find real vendor icon IDs
```

### Option B: Clone & run from source (Node.js ≥ 20)

```bash
git clone https://github.com/raiz-toff/Marrow.git
cd Marrow
npm run setup                       # Install dependencies, compile toolchain, fetch icon packs
```

Run from repository root:

```bash
npm run validate fixtures/valid/small-office.yaml
npm run build fixtures/valid/small-office.yaml
open output/small-office.html
```

---

## React & shadcn UI Component Suite

Marrow provides official, production-ready React / Next.js components through our **shadcn-compatible registry** (`registry.json`):

### 1. Marrow Diagram Embed (`<MarrowEmbed />`)
Embed interactive, compiled HTML diagrams directly into your web applications with automatic dark/light theme synchronization, fullscreen expansion, and minimal kiosk chrome:

```bash
npx shadcn@latest add https://marrowdiagram.vercel.app/r/topology-canvas.json
```

Or via GitHub shorthand:
```bash
npx shadcn@latest add raiz-toff/Marrow/topology-canvas
```

```tsx
import { MarrowEmbed } from "@/components/marrow/topology-canvas";

export function CampusTopology() {
  return (
    <MarrowEmbed
      src="/diagrams/campus.html"
      title="Campus Core Architecture"
      chrome="minimal"
      height="600px"
    />
  );
}
```

### 2. Cable & Link Badge (`<CableBadge />`)
Display physical/logical link modes (trunk, routed, tunnel, LAG), port line speeds (1G–400G), and animated traffic packet flow:

```bash
npx shadcn@latest add https://marrowdiagram.vercel.app/r/cable-badge.json
```

Or via GitHub shorthand:
```bash
npx shadcn@latest add raiz-toff/Marrow/cable-badge
```

```tsx
import { CableBadge } from "@/components/marrow/cable-badge";

export function LinkTelemetry() {
  return (
    <div className="flex items-center gap-3">
      <CableBadge mode="trunk" speed="100G" status="up" animated />
      <CableBadge mode="routed" speed="25G" status="up" />
      <CableBadge mode="tunnel" speed="10G" status="degraded" />
    </div>
  );
}
```

Explore full component props and live interactive previews in the **[Component Documentation](https://marrowdiagram.vercel.app/docs/components)**.

---

## A minimal topology

```yaml
marrow: 2
name: Small Office
theme: dark
density: standard                   # compact | standard | spacious

zones:
  - id: office
    name: Office LAN
    accent: "#3b82f6"

devices:
  - id: core-sw
    name: Core Switch
    icon: cisco/switches/layer-3-switch
    tier: core
    zone: office
    status: up
    mgmt_ip: 10.0.0.1
    custom_fields:
      Model: Catalyst 9300
      Serial: FOC2419012A

  - id: acc-sw
    name: Access Switch
    icon: cisco/switches/workgroup-switch
    tier: access
    zone: office

  - id: srv-01
    name: File Server
    icon: cisco/servers/server
    tier: endpoint
    zone: office

links:
  - from: core-sw:Te1/0/1
    to: acc-sw:Te1/0/48
    mode: trunk
    vlans: "10,20,30"
    speed: 10G
    kind: fiber

  - from: acc-sw:Gi1/0/1
    to: srv-01:eth0
    mode: access
    vlans: "10"
    speed: 1G
```

---

## Command reference

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Live hot-reloading preview server (`http://127.0.0.1:5200`) |
| `npm run dev:lan` | Bind dev server to `0.0.0.0` for local network access |
| `npm run validate <file...>` | Schema verification & reference check (exit code `0` required) |
| `npm run build <file> [-o OUT]` | Compile standalone HTML or multi-page site above ~150 devices |
| `npm run snapshot <file> [-o OUT.png]` | Headless visual verification & 2x Retina PNG export |
| `npm run icons search <query...>` | Batch search verified icon catalog (Cisco, AWS, Azure, GCP, K8s) |
| `npm run icons fetch [pack...]` | Fetch vendor icon packs (`aws`, `azure`, `gcp`) under vendor terms |
| `npm run marrow import <v1-file>` | Automatically migrate legacy v1 topology files forward to v2 |
| `npm test` | Run full test suite with Vitest (29 suites, 293 unit & layout tests) |
| `npm run compile` | Rebuild TypeScript compiler packages and runtime bundle |

*Note: Flags passed to npm scripts require the `--` separator (e.g. `npm run validate -- input/net.yaml --json`).*

---

## Verified icon catalog

Marrow bundles **cisco** (Apache-2.0), **affinity** (MIT), **k8s** (CC-BY-4.0), and **generic** (MIT) in the repository (~1,120 icons immediately available).

The **aws**, **azure**, and **gcp** packs are fetched on demand under vendor terms forbidding redistribution:

```bash
npm run marrow -- icons fetch --yes
```

Never guess icon identifiers. Query the verified catalog directly:

```bash
npm run marrow -- icons search switch router firewall server
```

---

## Documentation

Full documentation lives in [`docs/`](docs/) and is published at **[https://marrowdiagram.vercel.app](https://marrowdiagram.vercel.app)**:

* **[Quickstart](https://marrowdiagram.vercel.app/docs/getting-started/quickstart)** — Five-minute introduction to compiling your first diagram.
* **[Authoring Guide](https://marrowdiagram.vercel.app/docs/guides/authoring)** — Device hierarchy, link semantics, custom fields, and blueprint title blocks.
* **[Zones & Tiers](https://marrowdiagram.vercel.app/docs/guides/zones-and-tiers)** — Spatial clustering, boundary containers, and tier ordering.
* **[Embedding & Kiosk Modes](https://marrowdiagram.vercel.app/docs/guides/embedding)** — Embedding minimal diagrams in Notion, MkDocs, iframe hubs, or NOC monitors.
* **[React & shadcn Components](https://marrowdiagram.vercel.app/docs/components)** — Embedding diagrams and link badges in Next.js/React applications.
* **[Agent Workflow & Self-Healing](https://marrowdiagram.vercel.app/docs/agents/updates-and-self-healing)** — Operating router, update verification, and autonomous repair loops.
* **[Architecture Decisions (ADRs)](https://marrowdiagram.vercel.app/docs/decisions/overview)** — Design token contracts, density scaling, and CAD blueprint export specifications.

---

## License

[MIT](LICENSE) © 2026 rajkumar. Icon packs are licensed by their respective vendors — see [icon-packs/LICENSES.md](icon-packs/LICENSES.md).
