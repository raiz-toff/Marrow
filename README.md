<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/public/wordmark-dark.svg">
  <img src="docs/public/wordmark.svg" alt="Marrow" width="232" height="48">
</picture>

**Turn a description of your network into an interactive diagram that lives on your own site — no login wall, no SaaS lock-in.**

Marrow compiles topology YAML into a **self-contained, offline, interactive
HTML** network diagram (a single file, or a multi-page site for large networks).
The output has pan/zoom, an inspector, search, a minimap, and PNG/SVG export
baked in — and it's just files you can drop into any docs site, wiki, or static
host.

[![CI](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml/badge.svg)](https://github.com/raiz-toff/Marrow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

📖 **[Full documentation](https://marrow-docs.vercel.app)** — schema, CLI, guides, and the reasoning behind the design.

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

Then:

```bash
npm run validate fixtures/valid/small-office.yaml
npm run build    fixtures/valid/small-office.yaml
open output/small-office.html              # a single, shareable file
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
"did you mean" suggestions. `build` turns it into HTML.

## Commands

```
npm run dev                                 # live preview of input/, hot reload
npm run dev:lan                             # same, reachable from the LAN
npm run validate <file...>                  # schema + reference check
npm run build    <file>                     # single file or site folder
npm run snapshot <file>                     # render to an image
npm run icons search <keyword>              # find real icon ids
npm run marrow  import <v1-file>            # bring legacy YAML forward

# Flags need a `--` separator — npm strips flag names otherwise:
npm run build -- input/net.yaml --single -o out.html
npm run icons -- fetch --yes                # install aws/azure/gcp
```

Full flag reference: **[docs → CLI](https://marrow-docs.vercel.app/reference/cli)**.

## Documentation

The complete manual lives in [`docs/`](docs/) and is published as a site.

| | |
| --- | --- |
| [Getting started](https://marrow-docs.vercel.app/getting-started/installation) | Install, first diagram, live preview |
| [Guides](https://marrow-docs.vercel.app/guides/authoring) | Authoring, zones & tiers, layout, icons, branding, output, embedding |
| [Reference](https://marrow-docs.vercel.app/reference/schema) | Every key, flag, and diagnostic code |
| [For agents](https://marrow-docs.vercel.app/agents/golden-loop) | The golden loop and the rules |
| [Decisions](https://marrow-docs.vercel.app/decisions/overview) | Why the tool is shaped the way it is |
| [Glossary](https://marrow-docs.vercel.app/glossary) | The precise vocabulary |

Run it locally with `npm run docs`.

## Icons

Marrow ships `cisco` (Apache-2.0), `affinity` (MIT), `k8s` (CC-BY-4.0), and
`generic` (MIT) in-repo — about 1,120 icons that work on a fresh clone. The
`aws`, `azure`, and `gcp` packs are **fetched from the vendors**, whose terms
permit use in diagrams but not redistribution:

```bash
npm run marrow -- icons fetch --yes
```

The `cisco` pack is jgraph's Apache-2.0 [draw.io](https://github.com/jgraph/drawio)
stencils — Cisco-*style* shapes redrawn from scratch, not Cisco's own artwork.
It carries one restriction the rest of Marrow doesn't: it may not be used in
Atlassian marketplace products. See
[icon-packs/LICENSES.md](icon-packs/LICENSES.md).

Details: [docs → Icon packs](https://marrow-docs.vercel.app/reference/icon-packs).

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md), our
[Code of Conduct](CODE_OF_CONDUCT.md), and the
[architecture notes](https://marrow-docs.vercel.app/contributing/architecture).
Run the suite with `npm test` (244 tests).

## License

[MIT](LICENSE) © 2026 rajkumar. Icon packs are licensed by their respective
owners — see [icon-packs/LICENSES.md](icon-packs/LICENSES.md).
