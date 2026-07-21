# Icon pack licenses & attribution

## Committed packs (redistributed with this repo)

- **generic** — original Marrow assets. MIT (same as the project).
- **k8s** — Kubernetes icons from
  [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons),
  licensed **CC-BY-4.0**. Attribution: The Kubernetes Authors.
- **affinity** — network icons from
  [ecceman/affinity](https://github.com/ecceman/affinity), licensed **MIT**.
  Attribution: ecceman.

## Not committed (provided per-user, not redistributed)

Each of these vendors grants use of their icons **in architecture diagrams** —
which is what Marrow's built HTML embeds — but does **not** grant redistribution
of the icon library itself. So their SVGs are gitignored and obtained by each
user directly. Only the pack `manifest.json` (metadata: ids, keywords, file
paths) is committed, so `validate` and `icons search` still work.

- **aws** — AWS Architecture Icons (aws.amazon.com/architecture/icons), AWS Site
  Terms. Install: `marrow icons fetch aws`.
- **azure** — Azure architecture icons (learn.microsoft.com), Microsoft terms.
  Install: `marrow icons fetch azure`.
- **gcp** — Google Cloud product icons (cloud.google.com/icons), Google terms.
  Install: `marrow icons fetch gcp`.
- **cisco** — Cisco network topology icons, © Cisco Systems. Free to use in
  network diagrams, but not redistributed here. There is no vendor download
  endpoint for these; to enable the pack, place SVGs matching
  `icon-packs/cisco/manifest.json` under `icon-packs/cisco/svg/` (for example,
  exported from draw.io's Cisco shape libraries). Devices referencing a Cisco
  icon still validate; they render as a placeholder until the SVGs are present.

See `../icon-sources.json` for the vendor download details used by
`marrow icons fetch`.
