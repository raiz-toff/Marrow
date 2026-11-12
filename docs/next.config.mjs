import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['@marrow/ui'],
  // LAN hosts allowed to reach the dev server's HMR and assets (Next blocks cross-origin dev requests by default)
  allowedDevOrigins: ['10.10.20.110', '10.10.30.38', 'coder', 'localhost', '127.0.0.1'],
  async rewrites() {
    // Legacy shadcn clients request /r/styles/<style>/<name>.json.
    return [{ source: '/r/styles/:style/:name.json', destination: '/r/:name.json' }];
  },
  async redirects() {
    return [
      // the demo studio moved into the showcase
      { source: '/demo', destination: '/docs/showcase/studio', permanent: true },
      { source: '/docs/demo', destination: '/docs/showcase/studio', permanent: true },
      {
        source: '/getting-started',
        destination: '/docs/getting-started/quickstart',
        permanent: false,
      },
      {
        source: '/guides',
        destination: '/docs/guides/authoring',
        permanent: false,
      },
      {
        source: '/components',
        destination: '/docs/components',
        permanent: false,
      },
      {
        source: '/reference',
        destination: '/docs/reference/schema',
        permanent: false,
      },
      {
        source: '/agents',
        destination: '/docs/agents/golden-loop',
        permanent: false,
      },
      {
        source: '/decisions',
        destination: '/docs/decisions/overview',
        permanent: false,
      },
    ];
  },
};

export default withMDX(config);
