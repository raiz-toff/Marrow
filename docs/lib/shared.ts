import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Marrow';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'raiz-toff',
  repo: 'Marrow',
  branch: 'main',
};

export function getSection(path: string | undefined) {
  if (!path) return 'marrow';
  const [dir] = path.split('/', 1);
  if (!dir) return 'marrow';
  return (
    {
      components: 'components',
      agents: 'agents',
      decisions: 'decisions',
      '(marrow)': 'marrow',
      '(studio)': 'marrow',
    }[dir] ?? 'marrow'
  );
}

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
