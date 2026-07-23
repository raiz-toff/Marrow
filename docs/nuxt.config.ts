// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['shadcn-docs-nuxt'],
  devtools: { enabled: true },

  site: {
    // Absolute URL is required for OG images. Override with NUXT_SITE_URL.
    url: 'https://marrow-docs.vercel.app',
    name: 'Marrow',
  },

  // Diagrams default to the dark "ops" theme; the docs follow.
  colorMode: { preference: 'dark', fallback: 'dark' },

  app: {
    head: {
      link: [
        // favicon.svg recolours itself per the OS theme; .ico is the fallback.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: [{ code: 'en', name: 'English', language: 'en-US' }],
  },

  // Bare section paths are not pages — send them to the section's first page
  // instead of 404ing anyone who trims a URL.
  routeRules: {
    '/getting-started': { redirect: '/getting-started/installation' },
    '/guides': { redirect: '/guides/authoring' },
    '/reference': { redirect: '/reference/schema' },
    '/agents': { redirect: '/agents/golden-loop' },
    '/contributing': { redirect: '/contributing/overview' },
    '/decisions': { redirect: '/decisions/overview' },
  },

  nitro: {
    prerender: {
      // A published asset, not a page — the crawler must not follow it.
      ignore: ['/schema.json'],
    },
  },

  compatibilityDate: '2024-07-06',
});
