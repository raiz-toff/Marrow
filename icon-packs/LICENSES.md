# Icon pack licenses & attribution

## Committed packs (redistributed with this repo)

- **generic** — original Marrow assets. MIT (same as the project).
- **k8s** — Kubernetes icons from
  [kubernetes/community](https://github.com/kubernetes/community/tree/master/icons),
  licensed **CC-BY-4.0**. Attribution: The Kubernetes Authors.
- **affinity** — network icons from
  [ecceman/affinity](https://github.com/ecceman/affinity), licensed **MIT**.
  Attribution: ecceman.
- **cisco** — network topology shapes from the **draw.io** stencil libraries
  (`stencils/cisco/`, `stencils/cisco_safe/`, `stencils/cisco19.xml` in
  [jgraph/drawio](https://github.com/jgraph/drawio)), licensed **Apache-2.0**.
  Attribution: JGraph Ltd. **Not** Cisco's own artwork — see the note below.

### The `cisco` pack carries one extra restriction

These are jgraph's own vector re-creations of Cisco-style topology shapes, not
copies of Cisco's icon library, so they are redistributable under Apache-2.0.
But `stencils/LICENSE` in the drawio repo adds a condition on top of Apache-2.0
that travels with the artwork and any derivative — explicitly including
*"conversions to other formats"*, which is what an SVG export of a stencil is:

> The icon sets and stencil libraries included in this software, and any
> derivatives thereof (including conversions to other formats, traced
> reproductions, substantially similar visual representations, or AI-generated
> images created using these icons as reference or training input), may not be
> used as software assets in, distributed for use with, or incorporated into
> Atlassian products or products distributed through the Atlassian marketplace
> or plugin ecosystem, without explicit written permission.

Consequences:

- **`icon-packs/cisco/` is not MIT** like the rest of Marrow. It is
  Apache-2.0 plus the clause above, and downstream users inherit both.
- **Do not use Marrow's `cisco` pack to build an Atlassian marketplace app**
  (a Confluence or Jira plugin) without permission from JGraph. Every other
  use is fine.
- **Trademark is a separate question.** Apache-2.0 §6 grants no trademark
  rights. The pack is named `cisco` because that is the visual language network
  engineers read, not because Cisco endorses or licenses it.

Provenance was verified by matching all 973 SVGs against the drawio stencil
sources: 820 match a named stencil shape, of which 811 also match on normalized
path geometry. Every file in the pack carries the mxGraph renderer signature and
none contains embedded raster or vendor metadata.

**Filenames were normalized, artwork was not.** 295 files arrived with export
placeholder names (`rect_47.svg`, `icon12.svg`) that made them unfindable via
`icons search`. They were renamed from drawio's own stencil names where those
exist — cisco19 defines each tile as `rect;prIcon=l2_switch` with the label
"L2 Switch" — and by inspection where they don't (jgraph left the cisco_safe
Business/IOT/Tech icon sets unnamed at source). The SVG contents are untouched.

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

See `../icon-sources.json` for the vendor download details used by
`marrow icons fetch`.
