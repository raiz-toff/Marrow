export default defineAppConfig({
  shadcnDocs: {
    site: {
      name: 'Marrow',
      description:
        'Marrow compiles topology YAML into self-contained, offline, interactive HTML network diagrams. Declare structure; the engine computes the layout.',
    },
    theme: {
      // The generated diagrams use shadcn conventions on the ZINC scale — pure
      // neutrals, no blue cast in the chrome — with one blue accent reserved for
      // selection, focus and active states, and --radius: 8px.
      // See packages/site/src/styles.ts; assets/css/marrow.css pins the rest.
      customizable: false,
      color: 'zinc',
      radius: 0.5,
    },
    header: {
      title: 'Marrow',
      // The wordmark carries the name — showing the title too would say it twice.
      showTitle: false,
      border: true,
      darkModeToggle: true,
      logo: { light: '/wordmark.svg', dark: '/wordmark-dark.svg' },
      nav: [
        { title: 'Docs', to: '/getting-started/installation', showLinkIcon: false },
        { title: 'Reference', to: '/reference/schema', showLinkIcon: false },
        { title: 'For agents', to: '/agents/golden-loop', showLinkIcon: false },
        { title: 'Decisions', to: '/decisions/overview', showLinkIcon: false },
      ],
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/raiz-toff/Marrow',
        target: '_blank',
      }],
    },
    aside: {
      useLevel: true,
      collapse: false,
    },
    main: {
      breadCrumb: true,
      showTitle: true,
      // `:path` resolves to the page's path under content/, so this lands the
      // reader in GitHub's editor on the exact source file.
      editLink: {
        enable: true,
        pattern: 'https://github.com/raiz-toff/Marrow/edit/main/docs/content/:path',
        text: 'Edit this page',
        icon: 'lucide:square-pen',
        placement: ['docsFooter', 'toc'],
      },
    },
    footer: {
      credits: 'MIT © 2026 rajkumar — Marrow is a compiler, not a SaaS.',
      links: [{
        icon: 'lucide:github',
        to: 'https://github.com/raiz-toff/Marrow',
        target: '_blank',
      }],
    },
    toc: {
      enable: true,
      title: 'On this page',
      links: [{
        title: 'Star on GitHub',
        icon: 'lucide:star',
        to: 'https://github.com/raiz-toff/Marrow',
        target: '_blank',
      }, {
        title: 'Report an issue',
        icon: 'lucide:circle-dot',
        to: 'https://github.com/raiz-toff/Marrow/issues',
        target: '_blank',
      }],
    },
    search: {
      enable: true,
      inAside: false,
    },
  },
});
