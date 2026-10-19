import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IconCatalog } from '@marrow/icons';
import { layoutTopology, type LayoutOptions, type NodeMeta } from '@marrow/layout';
import { lintScene, type LintReport } from '@marrow/lint';
import type { Topology } from '@marrow/model';
import { renderCanvasHost, renderScene, type IconSource } from '@marrow/render-svg';
import { getRuntimeSource } from '@marrow/runtime';
import type { Scene } from '@marrow/scene';
import type { Brand } from './brand.js';
import { collapseEndpoints } from './collapse.js';
import { indexZones, inventoryBody, overviewTopology, pageOf, zoneTopology, deviceTopology, type PageTopo, type ZoneIndex } from './pages.js';
import { planSite, type SitePlan } from './planner.js';
import { renderShell, type Crumb, type NavLink } from './shell.js';
import { buildStylesheet, SITE_CSS } from './styles.js';
import type { ThemeConfig } from './tokens.js';

/** SVG carries pages to this many rendered nodes; canvas takes over above. */
export const SVG_NODE_LIMIT = 250;
/** No single page may exceed this many rendered nodes — the planner splits instead. */
export const PAGE_NODE_LIMIT = 1200;

export interface BuildOptions {
  icons: IconCatalog;
  layout?: LayoutOptions;
  /** Override tier selection (tests, comparisons). */
  forceRenderer?: 'svg' | 'canvas';
  /** Global branding from brand/brand.html — the single source for the mark. */
  brand?: Brand;
  /** Global theme and design token overrides. */
  themeConfig?: ThemeConfig;
  /** Embed / kiosk modularity: 'minimal' hides topbar & dock, 'full' preserves all chrome. */
  chrome?: 'full' | 'minimal';
  embed?: boolean;
}

export interface BuildResult {
  html: string;
  scene: Scene;
  lint: LintReport;
}

export interface SiteBuildResult {
  /** site-root-relative path → file content */
  files: Map<string, string>;
  plan: SitePlan;
  /** per-page node counts + renderer tier for reporting/budget checks */
  pageStats: Array<{ page: string; nodes: number; edges: number; tier: 'svg' | 'canvas' }>;
}

export interface PageStats {
  nodes: number;
  edges: number;
  tier: 'svg' | 'canvas';
}

/** One memoized page. Keyed by site-root-relative path in a SiteCache. */
export interface PageCacheEntry {
  hash: string;
  content: string;
  scene?: Scene;
  stats?: PageStats;
}

/** Lives OUTSIDE the builder (e.g. in the dev server) so memoized pages
 *  survive across rebuilds; pass it back into each new createSiteBuilder. */
export type SiteCache = Map<string, PageCacheEntry>;

export interface SiteBuilder {
  plan: SitePlan;
  /** All servable site-root-relative paths, pages first, then assets. */
  paths(): string[];
  /** True when this path is a page/asset of this site. */
  has(path: string): boolean;
  /** Fingerprint of the site shape (nav + page set + shared chrome inputs). */
  shapeHash: string;
  /** Previously built pages whose inputs changed. Pages never built are NOT
   *  listed — nothing can be displaying them, so nothing needs a reload. */
  changedPages(): string[];
  /** Build (or reuse) one page/asset. Undefined for unknown paths. */
  buildPage(path: string): Promise<PageCacheEntry | undefined>;
  /** Build everything — identical output to the classic buildSite(). */
  buildAll(): Promise<SiteBuildResult>;
}

interface StagePageDef {
  kind: 'stage';
  topo: () => PageTopo;
  crumbs: Crumb[];
  rootPrefix: string;
  hero?: string;
}

interface DocPageDef {
  kind: 'inventory';
}

type PageDef = StagePageDef | DocPageDef;

/**
 * Incremental site compiler. Same output as buildSite() page-for-page, but
 * each page is built lazily and memoized on a content hash of its inputs —
 * an edit relayouts only the pages it actually feeds.
 */
export function createSiteBuilder(
  topology: Topology,
  options: BuildOptions,
  cache: SiteCache = new Map(),
): SiteBuilder {
  const plan = planSite(topology);
  const zi = indexZones(topology, plan);
  const zoneNameFor = new Map(topology.zones.map((z) => [z.id, z.name]));
  const deviceName = new Map(topology.devices.map((d) => [d.id, d.name]));
  const navLinks: NavLink[] = [
    { label: 'Overview', href: 'index.html', kind: 'overview' as const, count: topology.devices.length },
    ...plan.zonePages.map((p) => ({
      label: zoneNameFor.get(p.zoneId) ?? p.zoneId,
      href: `zones/${p.zoneId}.html`,
      kind: 'zone' as const,
      count: p.devices,
    })),
    { label: 'Inventory', href: 'inventory.html', kind: 'inventory' as const, count: topology.devices.length },
  ];

  // everything that feeds EVERY page's chrome — part of every page hash, so a
  // nav count change or theme flip correctly invalidates the whole site
  const sharedInputs = JSON.stringify({
    name: topology.name,
    theme: topology.theme,
    description: topology.description ?? null,
    navLinks,
    devicePages: plan.devicePages,
    forceRenderer: options.forceRenderer ?? null,
  });
  const shapeHash = sha1(sharedInputs);

  // page definitions, in the classic buildSite() emit order
  const defs = new Map<string, PageDef>();
  if (plan.zonePages.length > 0) {
    defs.set('index.html', {
      kind: 'stage',
      topo: () => overviewTopology(topology, plan, zi),
      crumbs: [{ label: topology.name }],
      rootPrefix: '',
    });
  } else {
    defs.set('index.html', {
      kind: 'stage',
      topo: () => ({ topology, nodeMeta: new Map<string, NodeMeta>() }),
      crumbs: [{ label: topology.name }],
      rootPrefix: '',
    });
  }
  for (const page of plan.zonePages) {
    defs.set(`zones/${page.zoneId}.html`, {
      kind: 'stage',
      topo: () => zoneTopology(topology, page.zoneId, plan, zi),
      crumbs: [{ label: topology.name, href: 'index.html' }, { label: zoneNameFor.get(page.zoneId) ?? page.zoneId }],
      rootPrefix: '../',
    });
  }
  for (const deviceId of plan.devicePages) {
    const top = zi.topZoneOf.get(deviceId);
    const crumbs: Crumb[] = [{ label: topology.name, href: 'index.html' }];
    if (top !== undefined) crumbs.push({ label: zoneNameFor.get(top) ?? top, href: `zones/${top}.html` });
    crumbs.push({ label: deviceName.get(deviceId) ?? deviceId });
    defs.set(`devices/${deviceId}.html`, {
      kind: 'stage',
      topo: () => deviceTopology(topology, deviceId, plan, zi),
      crumbs,
      rootPrefix: '../',
      hero: deviceId,
    });
  }
  defs.set('inventory.html', { kind: 'inventory' });

  const assetContent = (path: string): string | undefined => {
    if (path === 'assets/styles.css') return options.themeConfig ? buildStylesheet(options.themeConfig) : SITE_CSS;
    if (path === 'assets/runtime.js') return getRuntimeSource();
    if (path === 'assets/search-data.js') return searchDataJs(topology, plan, zi);
    return undefined;
  };
  const assetPaths = ['assets/styles.css', 'assets/runtime.js', 'assets/search-data.js'];

  const pageHash = (path: string, def: PageDef): string => {
    if (def.kind === 'inventory') return sha1(sharedInputs + '\0inventory\0' + JSON.stringify(topology));
    const page = def.topo();
    const meta = [...page.nodeMeta.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sha1(
      sharedInputs +
        '\0' +
        JSON.stringify({ path, crumbs: def.crumbs, rootPrefix: def.rootPrefix, hero: def.hero ?? null, topology: page.topology, meta }),
    );
  };

  const buildStage = async (path: string, def: StagePageDef): Promise<PageCacheEntry> => {
    const page = def.topo();
    const collapsed = collapseEndpoints(page.topology, { activateAbove: 120 });
    const { svg, scene, tier } = await renderPage(collapsed, options, page.nodeMeta);
    const content = renderShell({
      title: def.crumbs.at(-1)?.label ?? topology.name,
      stats: `${scene.nodes.length} devices · ${scene.edges.length} links`,
      crumbs: def.crumbs,
      rootPrefix: def.rootPrefix,
      page: path,
      theme: topology.theme,
      stage: svg,
      ...(topology.description !== undefined ? { subtitle: topology.description } : {}),
      ...(options.brand !== undefined ? { brand: options.brand } : {}),
      ...(options.themeConfig !== undefined ? { themeConfig: options.themeConfig } : {}),
      ...(options.chrome !== undefined ? { chrome: options.chrome } : {}),
      ...(options.embed !== undefined ? { embed: options.embed } : {}),
      dataJson: embeddedData(collapsed, {
        page: path,
        // devicePages omitted — derived client-side from the shared search index
        hero: def.hero,
        scene: tier === 'canvas' ? scene : undefined,
      }),
      assets: { mode: 'external' },
      navLinks,
      about: { layout: archetypeLabel(scene.archetype), renderer: rendererLabel(tier) },
    });
    return { hash: '', content, scene, stats: { nodes: scene.nodes.length, edges: scene.edges.length, tier } };
  };

  const buildInventory = (): PageCacheEntry => {
    const content = renderShell({
      title: `Inventory — ${topology.name}`,
      stats: `${topology.devices.length} devices`,
      crumbs: [{ label: topology.name, href: 'index.html' }, { label: 'Inventory' }],
      rootPrefix: '',
      page: 'inventory.html',
      theme: topology.theme,
      body: inventoryBody(topology, plan, zi, (id) => iconSource(options.icons).svg(id)),
      ...(options.brand !== undefined ? { brand: options.brand } : {}),
      ...(options.themeConfig !== undefined ? { themeConfig: options.themeConfig } : {}),
      ...(options.chrome !== undefined ? { chrome: options.chrome } : {}),
      ...(options.embed !== undefined ? { embed: options.embed } : {}),
      // full device+link payload: the inventory drawer shows device details in place
      // (devicePages omitted — derived client-side from the shared search index)
      dataJson: embeddedData(topology, { page: 'inventory.html' }),
      assets: { mode: 'external' },
      navLinks,
    });
    return { hash: '', content };
  };

  const buildPage = async (path: string): Promise<PageCacheEntry | undefined> => {
    const asset = assetContent(path);
    if (asset !== undefined) return { hash: '', content: asset };
    const def = defs.get(path);
    if (!def) return undefined;
    const hash = pageHash(path, def);
    const hit = cache.get(path);
    if (hit && hit.hash === hash) return hit;
    const entry = def.kind === 'inventory' ? buildInventory() : await buildStage(path, def);
    entry.hash = hash;
    cache.set(path, entry);
    return entry;
  };

  return {
    plan,
    shapeHash,
    paths: () => [...defs.keys(), ...assetPaths],
    has: (path) => defs.has(path) || assetPaths.includes(path),
    changedPages: () =>
      [...defs.entries()]
        .filter(([path, def]) => cache.has(path) && cache.get(path)!.hash !== pageHash(path, def))
        .map(([path]) => path),
    buildPage,
    buildAll: async () => {
      const files = new Map<string, string>();
      const pageStats: SiteBuildResult['pageStats'] = [];
      for (const [path, def] of defs) {
        const entry = (await buildPage(path))!;
        files.set(path, entry.content);
        if (def.kind === 'stage' && entry.stats) {
          pageStats.push({ page: path, nodes: entry.stats.nodes, edges: entry.stats.edges, tier: entry.stats.tier });
        }
      }
      for (const path of assetPaths) files.set(path, assetContent(path)!);
      return { files, plan, pageStats };
    },
  };
}

/** Compile the multi-page site: overview + zone pages + device pages + inventory. */
export async function buildSite(topology: Topology, options: BuildOptions): Promise<SiteBuildResult> {
  return createSiteBuilder(topology, options).buildAll();
}

// ─── shared internals (also used by buildSingleFile) ────────────────────────

export async function renderPage(
  t: Topology,
  options: BuildOptions,
  nodeMeta: Map<string, NodeMeta> | undefined,
): Promise<{ svg: string; scene: Scene; lint: LintReport; tier: 'svg' | 'canvas' }> {
  const layoutOptions: LayoutOptions = { ...(options.layout ?? {}) };
  if (nodeMeta) layoutOptions.nodeMeta = nodeMeta;
  const scene = await layoutTopology(t, layoutOptions);
  const lint = lintScene(scene);
  if (!lint.clean) {
    throw new Error(
      `geometry lint failed (${lint.l1.length} L1 defects):\n` + lint.l1.map((i) => `  - ${i.message}`).join('\n'),
    );
  }
  if (scene.nodes.length > PAGE_NODE_LIMIT) {
    throw new Error(`page renders ${scene.nodes.length} nodes — over the ${PAGE_NODE_LIMIT} hard cap; split into zones`);
  }
  const tier = options.forceRenderer ?? (scene.nodes.length > SVG_NODE_LIMIT ? 'canvas' : 'svg');
  const rendered =
    tier === 'canvas'
      ? renderCanvasHost(scene, { icons: iconSource(options.icons) })
      : renderScene(scene, { icons: iconSource(options.icons) });
  return { svg: rendered.svg, scene, lint, tier };
}

export function archetypeLabel(archetype: string | undefined): string {
  switch (archetype) {
    case 'zoned':
      return 'Zoned mosaic';
    case 'tiered':
      return 'Layered tiers';
    case 'hub-spoke':
      return 'Hub & spoke';
    case 'ring':
      return 'Ring';
    case 'mesh':
      return 'Mesh';
    default:
      return 'Layered';
  }
}

export function rendererLabel(tier: 'svg' | 'canvas'): string {
  return tier === 'canvas' ? 'Canvas (scale tier)' : 'SVG (hero tier)';
}

function iconSource(icons: IconCatalog): IconSource {
  return {
    svg: (id) => {
      const entry = icons.get(id);
      if (!entry) return undefined;
      try {
        return readFileSync(join(entry.packDir, entry.file), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}

export function statsOf(t: Topology): string {
  return `${t.devices.length} devices · ${t.links.length} links${t.zones.length ? ` · ${t.zones.length} zones` : ''}`;
}

function searchDataJs(topology: Topology, plan: SitePlan, zi: ZoneIndex): string {
  const searchDocs = topology.devices
    .map((d) => ({
      id: d.id,
      name: d.name,
      ...(d.mgmtIp !== undefined ? { ip: d.mgmtIp } : {}),
      ...(d.zone !== undefined ? { zone: d.zone } : {}),
      ...(d.tier !== undefined ? { tier: d.tier } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      page: pageOf(d.id, plan, zi),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return `window.__MARROW_SEARCH=${JSON.stringify({ docs: searchDocs }).replace(/</g, '\\u003c')};\n`;
}

export function embeddedData(
  t: Topology,
  extra: { page: string; devicePages?: string[]; hero?: string | undefined; scene?: Scene | undefined },
): string {
  const payload = {
    name: t.name,
    ...(extra.scene !== undefined ? { scene: extra.scene } : {}),
    ...(t.description !== undefined ? { description: t.description } : {}),
    ...(t.author !== undefined ? { author: t.author } : {}),
    ...(t.revision !== undefined ? { revision: t.revision } : {}),
    ...(t.date !== undefined ? { date: t.date } : {}),
    ...(t.about !== undefined ? { about: t.about } : {}),
    ...(t.titleBlock !== undefined ? { titleBlock: t.titleBlock } : {}),
    zonesCount: t.zones.length,
    theme: t.theme,
    page: extra.page,
    ...(t.inspector !== undefined ? { inspector: t.inspector } : {}),
    // The full device-page manifest is NOT embedded per page: the runtime derives
    // it from the shared search index (see devicePageIds). Emitted only when a
    // caller has no search asset to fall back on.
    ...(extra.devicePages !== undefined ? { devicePages: extra.devicePages } : {}),
    ...(extra.hero !== undefined ? { hero: extra.hero } : {}),
    devices: t.devices.map((d) => ({
      id: d.id,
      name: d.name,
      icon: d.icon,
      ...(d.tier !== undefined ? { tier: d.tier } : {}),
      ...(d.zone !== undefined ? { zone: d.zone } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      status: d.status,
      ...(d.mgmtIp !== undefined ? { mgmtIp: d.mgmtIp } : {}),
      ...(d.haPairWith !== undefined ? { haPairWith: d.haPairWith } : {}),
      ...(d.note !== undefined ? { note: d.note } : {}),
      ...(d.config !== undefined ? { config: d.config } : {}),
      ...(d.stack !== undefined ? { stack: d.stack } : {}),
      ...(d.customFields !== undefined ? { customFields: d.customFields } : {}),
      ...(d.sections !== undefined ? { sections: d.sections } : {}),
      interfaces: d.interfaces,
    })),
    links: t.links.map((l) => ({
      id: l.id,
      from: l.from,
      to: l.to,
      ...(l.kind !== undefined ? { kind: l.kind } : {}),
      ...(l.speed !== undefined ? { speed: l.speed } : {}),
      ...(l.lag !== undefined ? { lag: l.lag } : {}),
      ...(l.mode !== undefined ? { mode: l.mode } : {}),
      ...(l.vlans !== undefined ? { vlans: l.vlans } : {}),
      ...(l.nativeVlan !== undefined ? { nativeVlan: l.nativeVlan } : {}),
      ...(l.encap !== undefined ? { encap: l.encap } : {}),
      ...(l.protocol !== undefined ? { protocol: l.protocol } : {}),
      ...(l.lacp !== undefined ? { lacp: l.lacp } : {}),
      status: l.status,
      ...(l.animated ? { animated: true } : {}),
      ...(l.label !== undefined ? { label: l.label } : {}),
      ...(l.note !== undefined ? { note: l.note } : {}),
      ...(l.customFields !== undefined ? { customFields: l.customFields } : {}),
      ...(l.sections !== undefined ? { sections: l.sections } : {}),
    })),
    zones: t.zones.map((z) => ({ id: z.id, name: z.name })),
  };
  // `<` escaped so a note/config containing "</script>" cannot break out.
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
