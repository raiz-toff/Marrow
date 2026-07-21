# Marrow

**Turn a description of your network into an interactive diagram that lives on your own site — no login wall, no SaaS lock-in.**

Marrow compiles topology YAML into a **self-contained, offline, interactive
HTML** network diagram (a single file, or a multi-page site for large networks).
The output has pan/zoom, an inspector, search, a minimap, and PNG/SVG export
baked in — and it's just files you can drop into any docs site, wiki, or static
host.

[![CI](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml/badge.svg)](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why Marrow

Most network-diagram tools make you either **draw by hand** (draw.io, Lucidchart)
or **hand-code a DSL that emits a static image** (Graphviz, Mermaid, `diagrams`).
Marrow is different on two axes:

- **You declare structure, not layout.** You state what things *are* — `tier`,
  `zone`, `ha_pair_with` — and Marrow computes one correct layout for you
  (layered, zoned mosaic, hub-and-spoke, ring, mesh). No dragging boxes.
- **The output is interactive and yours.** One HTML file, works offline, embeds
  anywhere. No account required to *view* it — unlike hosted tools that trap the
  interactive version behind their platform.

You can author the YAML **by hand**, or drive the whole loop from an AI coding
agent (Marrow ships a [Claude Code](https://claude.com/claude-code) skill — see
[AGENTS.md](AGENTS.md)).

## Quick start

Requires **Node.js ≥ 24**.

```bash
git clone https://github.com/raiz-toff/Marrow.git
cd Marrow
npm run setup
```

`npm run setup` installs dependencies, compiles the toolchain, optionally
downloads the aws/azure/gcp icon packs, and then offers to **make it yours** —
your organization's name and footer note, a default theme and accent color, and
a drop-in icon pack for your own logos. It finishes by building a sample diagram
so you know the whole pipeline works. It's safe to re-run after every `git pull`.

Prefer to do it by hand?

```bash
npm install && npm run build
npm run marrow -- icons fetch --yes        # optional: aws / azure / gcp

npm run marrow -- validate fixtures/valid/small-office.yaml
npm run marrow -- build    fixtures/valid/small-office.yaml
open output/small-office.html              # a single, shareable file
```

Live-preview with hot reload while you edit:

```bash
npm run marrow -- serve fixtures/valid/small-office.yaml
```

## A tiny topology

```yaml
marrow: 2
name: Small Office
theme: dark

zones:
  - id: office
    name: Office LAN

devices:
  - id: core-sw-01
    name: Core Switch
    icon: affinity/tile/switch-multilayer   # search real ids: marrow icons search switch
    tier: core
    zone: office
  - id: srv-01
    name: File Server
    icon: affinity/tile/server
    tier: endpoint
    zone: office

links:
  - from: core-sw-01:Gi1/0/1
    to: srv-01:eno1
    speed: 10G
```

`validate` catches every reference/typo with a line number, a fix hint, and
"did you mean" suggestions. `build` turns it into HTML. See a fuller example in
[`fixtures/valid/`](fixtures/valid/) and the complete schema in
[AGENTS.md](AGENTS.md).

## Commands

```
npm run marrow -- validate <file...> [--json]        # schema + reference check
npm run marrow -- build    <file> [--single] [-o out] # single file or site folder
npm run marrow -- serve    <file-or-dir> [--host 0.0.0.0] [--port 5200]
npm run marrow -- snapshot <file> [-o out.png]        # render to an image
npm run marrow -- import   <v1-file> [-o out.yaml]    # bring legacy YAML forward
npm run marrow -- icons search <keyword>              # find real icon ids
npm run marrow -- icons fetch [pack...] [--yes]       # install aws/azure/gcp
```

## Branding

Settings that are the same on **every** diagram live in one file,
[`marrow.config.yaml`](marrow.config.yaml):

```yaml
brand:
  name: Acme Networks
  note: Proprietary & Confidential
  logo: brand/logo.svg                      # inlined at build time
  link: https://acme.example.com            # logo + name link here
  github: https://github.com/acme/network   # small source mark
```

It applies globally — the sidebar footer, the inspector drawer, and the brand
strip along the top of every page. `npm run setup` fills it in for you.

Topology files describe a *network*; this file describes who it belongs to, so
branding is **not** settable per-diagram — that separation is deliberate.

- SVG logos are inlined (use `fill="currentColor"` to follow the light/dark
  theme); PNG/JPG/WEBP/GIF are embedded as `data:` URIs. Diagrams stay
  self-contained either way, and external URLs are stripped at build time.
- `link` and `github` are http(s)-only *hyperlinks*, never resource loads —
  diagrams still render fully offline; nothing is fetched unless someone clicks.
- Point at a different file with `marrow build <file> --config other.yaml`.

## Icons

Marrow ships these packs in-repo (freely redistributable):

| Pack | Source | License |
| --- | --- | --- |
| `affinity` | [ecceman/affinity](https://github.com/ecceman/affinity) | MIT |
| `k8s` | [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons) | CC-BY-4.0 |
| `generic` | original Marrow assets | MIT |

These packs are **not redistributed** — each user fetches them from the vendor's
own servers (their terms permit use in diagrams, not redistribution):

| Pack | How to get it | License |
| --- | --- | --- |
| `aws` | `marrow icons fetch aws` | [AWS Site Terms](https://aws.amazon.com/architecture/icons/) |
| `azure` | `marrow icons fetch azure` | [Microsoft terms](https://learn.microsoft.com/en-us/azure/architecture/icons/) |
| `gcp` | `marrow icons fetch gcp` | [Google terms](https://cloud.google.com/icons) |
| `cisco` | provide your own SVGs (e.g. from draw.io shape libraries) into `icon-packs/cisco/svg/` | © Cisco |

Full attribution and details: [icon-packs/LICENSES.md](icon-packs/LICENSES.md).

## How it's built

Marrow is a TypeScript monorepo under `packages/*`: a strict YAML schema with
agent-grade diagnostics, an ELK + libavoid layout/routing pipeline, a geometry
linter, an SVG renderer plus a canvas tier for scale, and a ~20 KB runtime
client. Contributor-facing internals live in
[packages/README.md](packages/README.md); the agent operating guide is in
[AGENTS.md](AGENTS.md). Run the suite with `npm test` (244 tests).

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and our
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE) © 2026 rajkumar. Icon packs are licensed by their respective
owners — see [icon-packs/LICENSES.md](icon-packs/LICENSES.md).
