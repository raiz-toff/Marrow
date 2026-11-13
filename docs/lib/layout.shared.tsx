import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';
import { PixelArt } from '@/components/pixel-art';
import { LOCKUP } from '@/components/pixel-sprites';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <PixelArt sprite={LOCKUP} scale={2} label={appName} className="shrink-0" />,
    },
    links: [
      {
        text: 'Documentation',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Showcase',
        url: '/docs/showcase',
        active: 'nested-url',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
