import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: ['@marrow/ui'],
  async redirects() {
    return [
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
