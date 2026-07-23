# Marrow documentation site

The canonical Marrow documentation. Built with [Nuxt Content](https://content.nuxt.com)
and [shadcn-docs-nuxt](https://github.com/ZTL-UwU/shadcn-docs-nuxt) (shadcn-vue).

```bash
npm run docs           # dev server   (from the repo root)
npm run docs:build     # static site → docs/.output/public
```

## Layout

```
content/          the docs, as MDC markdown; numeric prefixes set nav order
  _dir.yml          per-section title + icon
app.config.ts     site name, header nav, footer, TOC, search
nuxt.config.ts    site URL, dark-first colour mode, prerender rules
assets/css/       Marrow's palette, ported from packages/site/src/styles.ts
components/content/  component overrides (Alert)
public/           logos + the published JSON Schema (/schema.json)
plans/            the v2 architecture plan (not part of the site)
```

## Deploying to Vercel

- **Root Directory:** `docs`
- **Build Command:** `nuxt generate`
- **Output Directory:** `.output/public`
- **Install Command:** `npm install` at the repo root (this is an npm workspace)

Set `NUXT_SITE_URL` to the deployed origin so OG images resolve.

## House rules

Content is canonical here — `README.md`, `AGENTS.md`, and `packages/README.md`
point at this site rather than restating it. If you change the schema, the CLI
surface, or the diagnostic registry, update `content/4.reference/` in the same PR.
