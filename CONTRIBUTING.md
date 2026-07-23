# Contributing to Marrow

Thanks for your interest — issues and pull requests are welcome.

## Getting set up

Requires **Node.js ≥ 24**.

```bash
git clone https://github.com/raiz-toff/Marrow.git
cd Marrow
npm install
npm run compile
npm test          # 244 tests should pass
```

Optional icon packs (aws/azure/gcp) are fetched from the vendors on demand and
are **not** required to build or run the tests:

```bash
npm run marrow -- icons fetch --yes
```

## Development loop

The design of Marrow is documented on the docs site, which lives in this repo:
[architecture](docs/content/6.contributing/2.architecture.md),
[package map](docs/content/6.contributing/3.packages.md), and
[testing](docs/content/6.contributing/4.testing.md). The agent operating guide is
[AGENTS.md](AGENTS.md). In short:

1. Make your change in the relevant `packages/*` module.
2. `npm run compile` to recompile the toolchain.
3. `npm test` — add or update tests for any behavior you change.
4. For anything that affects rendered output, eyeball it:
   `npm run marrow -- snapshot fixtures/valid/small-office.yaml -o /tmp/x.png`.

## Ground rules for changes

- **Determinism is a hard requirement.** Builds must be reproducible
  byte-for-byte; don't introduce nondeterministic ordering, timestamps, or
  randomness into build output.
- **Diagnostics stay machine-readable.** New validation errors carry a code,
  path, line/col, a fix hint, and did-you-mean suggestions where useful.
- **Never hand-edit** generated trees: `output/`, `**/dist/`, or fetched vendor
  icon SVGs.
- **Icons:** don't commit AWS/Azure/GCP icon SVGs — those are user-fetched for
  licensing reasons (see [icon-packs/LICENSES.md](icon-packs/LICENSES.md)). The
  `cisco` pack *is* committed: it is jgraph's Apache-2.0 draw.io stencils, not
  Cisco artwork, and it carries an Atlassian-marketplace restriction documented
  in that file. Only add icons under a permissive/attributed license, with
  attribution.

## Pull requests

- Keep PRs focused; one logical change per PR.
- Ensure `npm run compile && npm test` is green — CI runs the same on every PR.
- Describe the user-visible effect and how you verified it.

## Reporting bugs & requesting features

Use the GitHub issue templates. For a bug, a minimal `.yaml` that reproduces it
is the single most helpful thing you can include.

## Documentation

The docs site is the canonical reference and lives in [`docs/`](docs/):

```bash
npm run docs           # dev server
npm run docs:build     # static build → docs/.output/public
```

If you change the schema, the CLI surface, or the diagnostic registry, update
`docs/content/4.reference/` in the same PR. Root files (`README.md`,
`AGENTS.md`, `packages/README.md`) deliberately point at the site rather than
restating it — keep it that way.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold it.

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
