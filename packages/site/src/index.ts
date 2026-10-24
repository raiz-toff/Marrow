import type { Topology } from '@marrow/model';
import { getRuntimeSource } from '@marrow/runtime';
import {
  archetypeLabel,
  embeddedData,
  renderPage,
  rendererLabel,
  statsOf,
  type BuildOptions,
  type BuildResult,
} from './builder.js';
import { collapseEndpoints } from './collapse.js';
import { renderShell } from './shell.js';

export { collapseEndpoints } from './collapse.js';
export { hasBrand, isSafeLink, sanitizeLogo, type Brand } from './brand.js';
export { planSite, SITE_DEVICE_THRESHOLD, SITE_ZONE_THRESHOLD, type SitePlan } from './planner.js';
export {
  buildSite,
  createSiteBuilder,
  PAGE_NODE_LIMIT,
  SVG_NODE_LIMIT,
  type BuildOptions,
  type BuildResult,
  type PageCacheEntry,
  type PageStats,
  type SiteBuildResult,
  type SiteBuilder,
  type SiteCache,
} from './builder.js';
export { buildStylesheet, SITE_CSS } from './styles.js';
export {
  generateThemeCss,
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  DEFAULT_DARK_STATUS,
  DEFAULT_LIGHT_STATUS,
  DEFAULT_LINK_TOKENS,
  type ThemeConfig,
  type PaletteTokens,
  type StatusTokens,
  type LinkStyleTokens,
} from './tokens.js';
export { renderShell, type ShellOptions } from './shell.js';

/** Compile ONE self-contained page (small networks / forced single mode). */
export async function buildSingleFile(topology: Topology, options: BuildOptions): Promise<BuildResult> {
  const t = collapseEndpoints(topology);
  const { svg, scene, lint, tier } = await renderPage(t, options, undefined);
  const html = renderShell({
    title: t.name,
    stats: statsOf(t),
    crumbs: [{ label: t.name }],
    rootPrefix: '',
    page: 'index.html',
    theme: t.theme,
    stage: svg,
    ...(t.description !== undefined ? { subtitle: t.description } : {}),
    ...(t.watermark !== undefined ? { watermark: t.watermark } : {}),
    ...(options.brand !== undefined ? { brand: options.brand } : {}),
    ...(options.themeConfig !== undefined ? { themeConfig: options.themeConfig } : {}),
    ...(options.chrome !== undefined ? { chrome: options.chrome } : {}),
    ...(options.embed !== undefined ? { embed: options.embed } : {}),
    ...(options.shellLayout !== undefined ? { layout: options.shellLayout } : {}),
    dataJson: embeddedData(t, { page: 'index.html', devicePages: [], scene: tier === 'canvas' ? scene : undefined }),
    assets: { mode: 'inline', runtime: getRuntimeSource() },
    about: { layout: archetypeLabel(scene.archetype), renderer: rendererLabel(tier) },
  });
  return { html, scene, lint };
}
