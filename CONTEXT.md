# Marrow — domain language

Marrow compiles a described **topology** into a **diagram**: a self-contained,
offline, interactive HTML artifact.

The full glossary — every term, its precise definition, and the words to avoid —
is maintained on the documentation site:

**→ [docs/content/docs/(marrow)/glossary.mdx](docs/content/docs/(marrow)/glossary.mdx)** (published at `/docs/glossary`)

That file is canonical. Keep it, not this one, up to date when the language
changes.

The three distinctions that cause the most confusion, repeated here because
they come up constantly:

- **Zone** is *where a device is*. **Tier** is *what role it plays*. They are orthogonal.
- **Port** is geometry (where a cable attaches). **Interface** is documentation (what the inspector shows). They need not agree.
- **Topology** is the description. **Scene** is the computed geometry. **Diagram** is the compiled artifact. Never use one for another.
- **Scene** is geometry. **Visual language** is how that geometry is painted. **Chrome** is the interface around the diagram (never "shell").

Architectural decisions are recorded in
[docs/content/docs/decisions/](docs/content/docs/decisions/), published at `/docs/decisions`.
