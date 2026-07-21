# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **`npm run setup`** — one command to take a fresh clone (or a stale one after
  `git pull`) to a working state: dependencies, compiled toolchain, optional
  vendor icon packs, and an onboarding wizard for your branding, your accent
  colour, and a drop-in icon pack for your own logos. Idempotent and safe to
  re-run; `--yes` runs it non-interactively.
- **`marrow.config.yaml`** — global configuration for everything that is static
  across every diagram. Currently a `brand:` section (name, note, logo, link,
  github). Logos are given as a file path and inlined at build time: SVG as
  markup (so `currentColor` follows the theme), raster as a `data:` URI.
- `--config <file>` on `build`, `serve`, and `snapshot`.
- Optional `brand.link` and `brand.github` render the brand mark as a hyperlink
  and add a source-repo mark. Both are http(s)-only navigation links, never
  resource loads, so diagrams still render fully offline.
- `npm run icons:pack` to build an icon-pack manifest from a directory of SVGs,
  so proprietary/company artwork can be used as first-class icons.
- Inspector link cards now show a **miniature of the link as the canvas draws
  it** — stroke width from speed, colour and dash from status, plus the flow
  animation — next to the media type, speed, and LAG text.
- Open-source release scaffolding: MIT `LICENSE`, public `README`,
  `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, GitHub Actions CI, and
  issue/PR templates.

### Changed
- Branding is now **global only**. It is applied to the sidebar footer, the
  inspector drawer, and the brand strip along the top of every page.
- Example fixtures use the in-repo, permissively licensed `affinity` icon pack
  so diagrams render out-of-the-box on a fresh clone.
- The sidebar trigger moves to the panel's top-right corner while the sidebar is
  open, and animates with the panel instead of jumping.
- The `OFFLINE GATE` test now forbids external **resource** loads (`src`,
  `<link href>`) rather than all external URLs, so an `<a href>` the user opts
  into by clicking is allowed. Nothing is fetched to render a page.

### Removed
- **`backdrop:` is no longer part of the topology schema.** Branding was
  settable per-diagram and silently overrode the global configuration. A
  topology describes a network, not who owns it; set branding once in
  `marrow.config.yaml`. A leftover `backdrop:` key now reports an unknown-key
  error with a fix hint.
- The brand mark no longer appears in the sidebar *header* — the footer already
  carries one.
- Cisco icon SVGs are no longer redistributed in the repository. The pack
  manifest is retained, so topologies referencing Cisco icons still validate;
  supply your own SVGs under `icon-packs/cisco/svg/` to render them. See
  [icon-packs/LICENSES.md](icon-packs/LICENSES.md).

### Known issues
- Degraded and planned links render as **solid** lines on the canvas instead of
  dashed/dotted. Two causes stack: `.settled .m-edge` clears the dash at equal
  specificity but later in the stylesheet, and edges carry `pathLength="1"`,
  which normalises the path so a pixel dash pattern covers it entirely. The
  inspector's link swatch renders the intended vocabulary correctly.
