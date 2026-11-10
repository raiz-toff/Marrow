import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IconCatalog } from '@marrow/icons';
import { layoutTopology, type LayoutOptions, type NodeMeta } from '@marrow/layout';
import { lintScene, type LintIssue, type LintReport } from '@marrow/lint';
import { byId, compareIds, type Density, type Topology } from '@marrow/model';
import { renderCanvasHost, renderScene, type IconSource } from '@marrow/render-svg';
import {
  DEVICE_KEYS,
  getRuntimeSource,
  LINK_KEYS,
  PAGE_DATA_KEYS,
  pickDefined,
  SEARCH_GLOBAL,
  TOPOLOGY_KEYS,
  ZONE_KEYS,
  type EmbeddedData,
  type PageKind,
  type SearchIndexDoc,
} from '@marrow/runtime';
import type { Scene } from '@marrow/scene';
import type { Brand } from './brand.js';
import { collapseEndpoints } from './collapse.js';
import { indexZones, inventoryBody, overviewTopology, pageOf, zoneTopology, deviceTopology, type PageTopo, type ZoneIndex } from './pages.js';
import { planSite, type OutputShape, type SitePlan } from './planner.js';
import { renderChrome, type ChromeOptions, type Crumb, type NavLink } from './chrome.js';
import { buildStylesheet, SITE_CSS } from './styles.js';
import type { ThemeConfig } from './tokens.js';

/** SVG carries pages to this many rendered nodes; canvas takes over above. */
export const SVG_NODE_LIMIT = 250;
/** No single page may exceed this many rendered nodes — the planner splits instead. */
export const PAGE_NODE_LIMIT = 1200;

/**
 * Size caps for one compile. Above either, `createSiteBuilder` refuses the
 * topology with a `TopologyTooLargeError` instead of running the V8 heap out.
 * Measured on whole-zone slices of the 15.6k-device global-enterprise input
 * (its shape is the worst seen: every device earns a page): 1.25k devices →
 * 34 s / 0.73 GB peak RSS, 2.5k → 59 s / 1.09 GB, 5k → 85 s / 1.79 GB and
 * 368 MB of output; the full file exhausts the ~4 GB default V8 heap after
 * 200 s. 5,000 devices keeps that worst shape under half the default heap.
 * Links are capped at twice that (the input averages 1.5 links per device).
 */
export const MAX_DEVICES = 5000;
export const MAX_LINKS = 10_000;

/** Thrown by `createSiteBuilder` for a topology over `MAX_DEVICES` / `MAX_LINKS`. */
export class TopologyTooLargeError extends Error {
  override readonly name = 'TopologyTooLargeError';
  readonly summary: string;
  readonly remedy = 'split it into several topology files (e.g. one per region or site) and build each';
  constructor(
    readonly devices: number,
    readonly links: number,
  ) {
    const summary = `topology too large to compile: ${devices} devices (cap ${MAX_DEVICES}), ${links} links (cap ${MAX_LINKS})`;
    super(summary);
    this.summary = summary;
    this.message = `${summary} — ${this.remedy}`;
  }
}

/** The size-cap verdict for a topology, or undefined when it fits. */
export function topologySizeError(t: Topology): TopologyTooLargeError | undefined {
  return t.devices.length > MAX_DEVICES || t.links.length > MAX_LINKS
    ? new TopologyTooLargeError(t.devices.length, t.links.length)
    : undefined;
}

/**
 * Thrown when a page's laid-out scene has L1 geometry defects. The layout is
 * computed (ADR-0001), so this is a compiler defect — the message says so,
 * names the layout in effect and the two things an author can do about it.
 */
export class GeometryDefectError extends Error {
  override readonly name = 'GeometryDefectError';
  /** Offending device/link ids, deduplicated, in defect order. */
  readonly ids: string[];
  readonly defects: LintIssue[];
  readonly archetype: string;
  readonly density: string;
  readonly scale: number;
  /** The message's three lines: what failed, the layout in effect, what to try. */
  readonly summary: string;
  readonly detail: string;
  readonly remedy: string;
  constructor(
    readonly page: string,
    scene: Scene,
    lint: LintReport,
  ) {
    const ids = [...new Set(lint.l1.flatMap((i) => i.ids))];
    const kinds = [...new Set(lint.l1.map((i) => i.kind))].join(', ');
    const archetype = scene.archetype ?? 'flat';
    const density = scene.density ?? 'standard';
    const scale = scene.scale ?? 1;
    const remedy =
      density !== 'standard' || scale !== 1
        ? 'try `density: standard` and `scale: 1` in the topology header, or report it with this YAML file attached'
        : 'try `density: spacious` in the topology header, or report it with this YAML file attached';
    const summary = `geometry lint failed on ${page}: ${lint.l1.length} L1 defect${lint.l1.length === 1 ? '' : 's'} (${kinds}) — a compiler-side layout defect, not an error in your YAML`;
    const detail = `layout: ${archetype}, density ${density}, scale ${scale}; offending ids: ${ids.join(', ')}`;
    super(`${summary}\n  ${detail}\n  ${remedy}`);
    this.summary = summary;
    this.detail = detail;
    this.ids = ids;
    this.defects = lint.l1;
    this.archetype = archetype;
    this.density = density;
    this.scale = scale;
    this.remedy = remedy;
  }
}

/**
 * Build-wide layout defaults — the `layout:` block of marrow.config.yaml.
 * Each value applies only where the topology does not declare its own.
 */
export interface LayoutDefaults {
  density?: Density;
  scale?: number;
}

export interface BuildOptions {
  icons: IconCatalog;
  /** Layout-engine options (routing, metrics). Not the config file's `layout:` block — that is `defaults`. */
  layout?: LayoutOptions;
  /** Density/scale used when the topology declares none. Applied to a shallow
   *  copy inside the compiler; the caller's topology is never mutated. */
  defaults?: LayoutDefaults;
  /** Force an output shape (`--single`). Absent → the planner decides (ADR-0008). */
  shape?: OutputShape;
  /** Override tier selection (tests, comparisons). */
  forceRenderer?: 'svg' | 'canvas';
  /** Global branding from brand/brand.html — the single source for the mark. */
  brand?: Brand;
  /** Global theme and design token overrides. */
  themeConfig?: ThemeConfig;
  /** Embed / kiosk modularity: 'minimal' hides topbar & dock, 'full' preserves all chrome. */
  chrome?: 'full' | 'minimal';
  embed?: boolean;
  /** Chrome layout archetype: locked to 'spacious'. */
  chromeLayout?: 'spacious';
}

export interface PageStats {
  nodes: number;
  edges: number;
  tier: 'svg' | 'canvas';
}

/** Everything one `buildAll()` emits, for either output shape. */
export interface BuildOutput {
  /** output-root-relative path → file content. A Single file is just `index.html`. */
  files: Map<string, string>;
  plan: SitePlan;
  /** per-page node counts + renderer tier for reporting/budget checks */
  pageStats: Array<{ page: string } & PageStats>;
}

/** One built page or asset, memoized by path in a SiteCache. Diagram pages
 *  also carry their scene, lint report and stats; the inventory page and the
 *  shared assets carry content only. */
export interface PageCacheEntry {
  hash: string;
  content: string;
  scene?: Scene;
  lint?: LintReport;
  stats?: PageStats;
}

/** Lives OUTSIDE the builder (e.g. in the dev server) so memoized pages
 *  survive across rebuilds; pass it back into each new createSiteBuilder. */
export type SiteCache = Map<string, PageCacheEntry>;

export interface SiteBuilder {
  /** The planner's verdict; `plan.mode` is the output shape. */
  plan: SitePlan;
  /** All HTML pages, in emit order (`index.html` first). A Single file has exactly one. */
  pages(): string[];
  /** All servable output-root-relative paths: pages first, then assets (a Single file has none). */
  paths(): string[];
  /** True when this path is a page/asset of this output. */
  has(path: string): boolean;
  /** Fingerprint of the output shape and every input shared by all pages
   *  (nav, page set, chrome options). A change means every page changed. */
  shapeHash: string;
  /** Previously built pages whose inputs changed. Pages never built are NOT
   *  listed — nothing can be displaying them, so nothing needs a reload. */
  changedPages(): string[];
  /** Build (or reuse) one page/asset. Undefined for unknown paths. */
  buildPage(path: string): Promise<PageCacheEntry | undefined>;
  /** Build every file of the output. */
  buildAll(): Promise<BuildOutput>;
  /**
   * Lay out and lint every diagram page without rendering — what `marrow
   * validate` checks so it rejects exactly what a build would. One entry per
   * failing page; empty when every page is L1-clean.
   */
  geometryDefects(): Promise<GeometryDefectError[]>;
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
 * The compile entry — one for both output shapes. Applies the build-wide
 * defaults, asks the planner for the shape (unless `options.shape` forces
 * one) and returns a builder for its pages. A Single file is the degenerate
 * plan: one page, `index.html`, with styles and the runtime inlined.
 *
 * Each page is built lazily and memoized on a content hash of its inputs —
 * an edit relayouts only the pages it actually feeds. Output is
 * byte-identical for identical input (ADR-0007).
 */
export function createSiteBuilder(
  input: Topology,
  options: BuildOptions,
  cache: SiteCache = new Map(),
): SiteBuilder {
  const tooLarge = topologySizeError(input);
  if (tooLarge) throw tooLarge;
  const topology = withDefaults(input, options.defaults);
  const plan = planSite(topology, options.shape);
  const single = plan.mode === 'single';
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
  const chrome = chromeOptions(options);

  // everything that feeds EVERY page — part of every page hash, so a nav
  // count change, theme flip, rebrand or shape switch invalidates the lot
  const sharedInputs = JSON.stringify({
    shape: plan.mode,
    name: topology.name,
    theme: topology.theme,
    description: topology.description ?? null,
    watermark: topology.watermark ?? null,
    navLinks,
    devicePages: plan.devicePages,
    forceRenderer: options.forceRenderer ?? null,
    layout: options.layout ?? null,
    chrome,
  });
  const shapeHash = sha1(sharedInputs);

  // page definitions, in emit order
  const defs = new Map<string, PageDef>();
  defs.set('index.html', {
    kind: 'stage',
    topo:
      plan.zonePages.length > 0
        ? () => overviewTopology(topology, plan, zi)
        : () => ({ topology, nodeMeta: new Map<string, NodeMeta>() }),
    crumbs: [{ label: topology.name }],
    rootPrefix: '',
  });
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
  if (!single) defs.set('inventory.html', { kind: 'inventory' });

  const assetContent = (path: string): string | undefined => {
    if (single) return undefined;
    if (path === 'assets/styles.css') return options.themeConfig ? buildStylesheet(options.themeConfig) : SITE_CSS;
    if (path === 'assets/runtime.js') return getRuntimeSource();
    if (path === 'assets/search-data.js') return searchDataJs(topology, plan, zi);
    return undefined;
  };
  const assetPaths = single ? [] : ['assets/styles.css', 'assets/runtime.js', 'assets/search-data.js'];

  // How a page is packaged. A Single file inlines styles + runtime, has no
  // nav, and — with no search-data asset to derive it from — embeds the
  // (empty) device-page manifest. Site pages share external assets.
  const packaging: Pick<ChromeOptions, 'assets' | 'navLinks'> = single
    ? { assets: { mode: 'inline', runtime: getRuntimeSource() } }
    : { assets: { mode: 'external' }, navLinks };

  const pageHash = (path: string, def: PageDef): string => {
    if (def.kind === 'inventory') return sha1(sharedInputs + '\0inventory\0' + JSON.stringify(topology));
    const page = def.topo();
    const meta = [...page.nodeMeta.entries()].sort((a, b) => compareIds(a[0], b[0]));
    return sha1(
      sharedInputs +
        '\0' +
        JSON.stringify({ path, crumbs: def.crumbs, rootPrefix: def.rootPrefix, hero: def.hero ?? null, topology: page.topology, meta }),
    );
  };

  const buildStage = async (path: string, def: StagePageDef): Promise<PageCacheEntry> => {
    const page = def.topo();
    const collapsed = collapseEndpoints(page.topology);
    const { svg, scene, lint, tier } = await renderPage(path, collapsed, options, page.nodeMeta);
    const content = renderChrome({
      title: def.crumbs.at(-1)?.label ?? topology.name,
      // a Single file has no inventory page: its header counts the whole topology
      stats: single ? statsOf(collapsed) : `${scene.nodes.length} devices · ${scene.edges.length} links`,
      crumbs: def.crumbs,
      rootPrefix: def.rootPrefix,
      page: path,
      theme: topology.theme,
      stage: svg,
      ...(topology.description !== undefined ? { subtitle: topology.description } : {}),
      ...(topology.watermark !== undefined ? { watermark: topology.watermark } : {}),
      ...chrome,
      data: embeddedData(collapsed, {
        kind: 'stage',
        page: path,
        // site pages derive the device-page manifest from the shared search index
        ...(single ? { devicePages: [] } : {}),
        hero: def.hero,
        scene: tier === 'canvas' ? scene : undefined,
      }),
      ...packaging,
      about: { layout: archetypeLabel(scene.archetype), renderer: rendererLabel(tier) },
    });
    return { hash: '', content, scene, lint, stats: { nodes: scene.nodes.length, edges: scene.edges.length, tier } };
  };

  const buildInventory = (): PageCacheEntry => {
    const content = renderChrome({
      title: `Inventory — ${topology.name}`,
      stats: `${topology.devices.length} devices`,
      crumbs: [{ label: topology.name, href: 'index.html' }, { label: 'Inventory' }],
      rootPrefix: '',
      page: 'inventory.html',
      theme: topology.theme,
      body: inventoryBody(topology, plan, zi, (id) => iconSource(options.icons).svg(id)),
      ...chrome,
      // full device+link payload: the inventory drawer shows device details in place
      // (devicePages omitted — derived client-side from the shared search index)
      data: embeddedData(topology, { kind: 'inventory', page: 'inventory.html' }),
      ...packaging,
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
    pages: () => [...defs.keys()],
    paths: () => [...defs.keys(), ...assetPaths],
    has: (path) => defs.has(path) || assetPaths.includes(path),
    changedPages: () =>
      [...defs.entries()]
        .filter(([path, def]) => cache.has(path) && cache.get(path)!.hash !== pageHash(path, def))
        .map(([path]) => path),
    buildPage,
    buildAll: async () => {
      const files = new Map<string, string>();
      const pageStats: BuildOutput['pageStats'] = [];
      for (const path of defs.keys()) {
        const entry = (await buildPage(path))!;
        files.set(path, entry.content);
        if (entry.stats) pageStats.push({ page: path, ...entry.stats });
      }
      for (const path of assetPaths) files.set(path, assetContent(path)!);
      return { files, plan, pageStats };
    },
    geometryDefects: async () => {
      const failures: GeometryDefectError[] = [];
      for (const [path, def] of defs) {
        if (def.kind !== 'stage') continue;
        const page = def.topo();
        const { scene, lint } = await layoutPage(collapseEndpoints(page.topology), options, page.nodeMeta);
        if (!lint.clean) failures.push(new GeometryDefectError(path, scene, lint));
      }
      return failures;
    },
  };
}

/** Fill in build-wide layout defaults on a shallow copy; the input is never mutated. */
function withDefaults(t: Topology, defaults: LayoutDefaults | undefined): Topology {
  const density = t.density ?? defaults?.density;
  const scale = t.scale ?? defaults?.scale;
  if (density === t.density && scale === t.scale) return t;
  return {
    ...t,
    ...(density !== undefined ? { density } : {}),
    ...(scale !== undefined ? { scale } : {}),
  };
}

/** Chrome options shared by every page of a build. */
function chromeOptions(options: BuildOptions): Pick<ChromeOptions, 'brand' | 'themeConfig' | 'chrome' | 'embed' | 'layout'> {
  return {
    ...(options.brand !== undefined ? { brand: options.brand } : {}),
    ...(options.themeConfig !== undefined ? { themeConfig: options.themeConfig } : {}),
    ...(options.chrome !== undefined ? { chrome: options.chrome } : {}),
    ...(options.embed !== undefined ? { embed: options.embed } : {}),
    ...(options.chromeLayout !== undefined ? { layout: options.chromeLayout } : {}),
  };
}

// ─── shared internals ───────────────────────────────────────────────────────

/** Layout + geometry lint for one page — shared by rendering and `geometryDefects()`. */
async function layoutPage(
  t: Topology,
  options: BuildOptions,
  nodeMeta: Map<string, NodeMeta> | undefined,
): Promise<{ scene: Scene; lint: LintReport }> {
  const layoutOptions: LayoutOptions = { ...(options.layout ?? {}) };
  if (nodeMeta) layoutOptions.nodeMeta = nodeMeta;
  const scene = await layoutTopology(t, layoutOptions);
  return { scene, lint: lintScene(scene) };
}

async function renderPage(
  path: string,
  t: Topology,
  options: BuildOptions,
  nodeMeta: Map<string, NodeMeta> | undefined,
): Promise<{ svg: string; scene: Scene; lint: LintReport; tier: 'svg' | 'canvas' }> {
  const { scene, lint } = await layoutPage(t, options, nodeMeta);
  if (!lint.clean) throw new GeometryDefectError(path, scene, lint);
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

function archetypeLabel(archetype: string | undefined): string {
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

function rendererLabel(tier: 'svg' | 'canvas'): string {
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

function statsOf(t: Topology): string {
  return `${t.devices.length} devices · ${t.links.length} links${t.zones.length ? ` · ${t.zones.length} zones` : ''}`;
}

function searchDataJs(topology: Topology, plan: SitePlan, zi: ZoneIndex): string {
  const searchDocs = topology.devices
    .map((d): SearchIndexDoc => ({
      id: d.id,
      name: d.name,
      ...(d.mgmtIp !== undefined ? { ip: d.mgmtIp } : {}),
      ...(d.zone !== undefined ? { zone: d.zone } : {}),
      ...(d.tier !== undefined ? { tier: d.tier } : {}),
      ...(d.role !== undefined ? { role: d.role } : {}),
      page: pageOf(d.id, plan, zi),
    }))
    .sort(byId);
  return `window.${SEARCH_GLOBAL}=${JSON.stringify({ docs: searchDocs }).replace(/</g, '\\u003c')};\n`;
}

/**
 * The page payload (see the page contract in @marrow/runtime): explicit key
 * lists pick what ships, `undefined`/`false` fields are dropped, and
 * `PAGE_DATA_KEYS` fixes the serialization order so output stays byte-stable.
 */
function embeddedData(
  t: Topology,
  extra: { kind: PageKind; page: string; devicePages?: string[]; hero?: string | undefined; scene?: Scene | undefined },
): EmbeddedData {
  const data: EmbeddedData = {
    ...pickDefined(t, TOPOLOGY_KEYS),
    zonesCount: t.zones.length,
    ...pickDefined(extra, ['kind', 'page', 'devicePages', 'hero', 'scene']),
    devices: t.devices.map((d) => pickDefined(d, DEVICE_KEYS)),
    links: t.links.map((l) => pickDefined(l, LINK_KEYS)),
    zones: t.zones.map((z) => pickDefined(z, ZONE_KEYS)),
  };
  // the full device-page manifest is NOT embedded per page: the runtime
  // derives it from the shared search index (see devicePageIds) — only
  // callers with no search asset pass `devicePages`
  return pickDefined(data, PAGE_DATA_KEYS);
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
