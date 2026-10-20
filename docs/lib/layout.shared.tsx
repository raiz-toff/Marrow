import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';
import { MarrowIcon } from '@/app/layout.client';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <MarrowIcon className="size-5" />
          <span className="font-medium">{appName}</span>
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
