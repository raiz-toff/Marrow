# Icon pack licenses & attribution

Committed packs:

- **cisco** — Cisco network topology icons, © Cisco Systems. Free to use in
  network diagrams; sourced via draw.io's shape libraries.
- **generic** — original Marrow assets.
- **k8s** — Kubernetes icons from
  [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons),
  licensed **CC-BY-4.0**. Attribution: The Kubernetes Authors.
- **affinity** — network icons from
  [ecceman/affinity](https://github.com/ecceman/affinity), licensed **MIT**.
  Attribution: ecceman.

NOT committed (fetched per-user from official vendor servers via
`marrow icons fetch`; see `../icon-sources.json`):

- **aws** — AWS Architecture Icons (aws.amazon.com/architecture/icons), AWS Site Terms.
- **azure** — Azure architecture icons (learn.microsoft.com), Microsoft terms.
- **gcp** — Google Cloud product icons (cloud.google.com/icons), Google terms.

All vendors grant use of their icons **in architecture diagrams** — which is
what Marrow's built HTML embeds. Redistribution of the icon libraries
themselves is not granted, which is why the three cloud packs are gitignored
and fetched by each user directly.
