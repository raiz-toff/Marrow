# Security Policy

## Reporting a vulnerability

If you believe you've found a security issue in Marrow, please report it
privately rather than opening a public issue.

- Use GitHub's **[Report a vulnerability](https://github.com/raiz-toff/Marrow/security/advisories/new)**
  (Security → Advisories) to open a private report, **or**
- Contact the maintainer directly.

Please include enough to reproduce: the input YAML (or a minimal reduction), the
command you ran, and what you observed versus expected.

We'll acknowledge the report, investigate, and coordinate a fix and disclosure
timeline with you.

## Scope notes

Marrow compiles untrusted YAML into HTML. The build path deliberately:

- treats topology YAML as data (no code execution from input), and
- inlines/escapes user-supplied strings so embedded data cannot break out of the
  generated page (covered by tests).

Reports about untrusted-input handling in the build/render path are especially
welcome.
