/**
 * The page contract — everything a compiled page and the runtime must agree
 * on, defined once and imported by both sides: the site compiler writes it
 * (`@marrow/site` chrome + builder), the runtime client reads it.
 *
 *  - **Hooks.** Every chrome element the runtime looks up carries
 *    `data-m="<hook id>"`. Classes style; hooks carry behaviour, so a class
 *    can be renamed for looks without breaking a feature and vice versa.
 *    Diagram (stage) hooks are owned by `@marrow/visual` and re-exported here.
 *  - **Root state.** The `<html>` attributes (`data-theme`, `data-chrome`, …)
 *    and the one function that writes the URL-driven ones before first paint
 *    and on every `hashchange`.
 *  - **Payload.** The JSON embedded in `<script id="marrow-data">`, typed from
 *    the model through explicit key lists, plus its encoder and decoder.
 *  - **Embed protocol.** The postMessage names a host page and the diagram
 *    exchange.
 *
 * DOM-free: importable from Node (the site compiler) and tree-shaken into the
 * browser bundles.
 */
import type { Device, Link, Topology, Zone } from '@marrow/model';
import type { Scene } from '@marrow/scene';
import { ON_OFF_PARTS, type ModularUiOptions } from './hash.js';

export { STAGE_ATTR, STAGE_HOOKS } from '@marrow/visual';

// ─── hooks ──────────────────────────────────────────────────────────────────

/** The attribute every chrome hook is written to. */
export const HOOK_ATTR = 'data-m';

/** The two kinds of compiled page: a diagram stage, or the inventory document. */
export type PageKind = 'stage' | 'inventory';

export interface HookSpec {
  /** Element the hook must sit on — checked by `localName` at lookup. */
  tag: 'element' | 'input' | 'select' | 'ul' | 'canvas' | 'svg' | 'g';
  /** `one`: at most one per page (`find` / `maybe`). `many`: any number (`findAll`). */
  count: 'one' | 'many';
  /** Page kinds that always carry the hook. Empty means conditional —
   *  emitted only for some topologies or output shapes. */
  on: readonly PageKind[];
}

const BOTH = ['stage', 'inventory'] as const;
const STAGE = ['stage'] as const;
const INVENTORY = ['inventory'] as const;
const NONE = [] as const;

/**
 * Every hook the runtime queries, grouped by feature. Adding an id here and
 * `hookAttr(id)` in the chrome markup is the whole wiring; the boot test
 * proves each `on` page kind carries it. Entries are plain literals (no
 * helper calls) so bundles that never touch the registry — the pre-boot
 * script — tree-shake it away.
 */
export const HOOKS = {
  // page skeleton
  'chrome.root': { tag: 'element', count: 'one', on: BOTH },
  'chrome.commandBar': { tag: 'element', count: 'one', on: BOTH },
  'stage.root': { tag: 'element', count: 'one', on: STAGE },
  'stage.tooltip': { tag: 'element', count: 'one', on: STAGE },
  // camera controls
  'camera.controls': { tag: 'element', count: 'one', on: STAGE },
  'camera.zoomIn': { tag: 'element', count: 'one', on: STAGE },
  'camera.zoomOut': { tag: 'element', count: 'one', on: STAGE },
  'camera.fit': { tag: 'element', count: 'one', on: STAGE },
  'minimap.root': { tag: 'element', count: 'one', on: STAGE },
  // sidebar
  'sidebar.panel': { tag: 'element', count: 'one', on: BOTH },
  'sidebar.toggle': { tag: 'element', count: 'many', on: BOTH },
  'sidebar.close': { tag: 'element', count: 'one', on: BOTH },
  'sidebar.navLink': { tag: 'element', count: 'many', on: INVENTORY },
  'sidebar.groupHead': { tag: 'element', count: 'many', on: NONE },
  'settings.seg': { tag: 'element', count: 'many', on: INVENTORY },
  // menubar
  'menubar.root': { tag: 'element', count: 'one', on: BOTH },
  'menubar.trigger': { tag: 'element', count: 'many', on: BOTH },
  // search / command center
  'search.open': { tag: 'element', count: 'many', on: BOTH },
  'spotlight.root': { tag: 'element', count: 'one', on: BOTH },
  'spotlight.input': { tag: 'input', count: 'one', on: BOTH },
  'spotlight.list': { tag: 'ul', count: 'one', on: BOTH },
  // theme
  'theme.toggle': { tag: 'element', count: 'many', on: BOTH },
  'theme.option': { tag: 'element', count: 'many', on: BOTH },
  // inspector
  'inspector.panel': { tag: 'element', count: 'one', on: BOTH },
  'inspector.handle': { tag: 'element', count: 'one', on: BOTH },
  'inspector.title': { tag: 'element', count: 'one', on: BOTH },
  'inspector.desc': { tag: 'element', count: 'one', on: BOTH },
  'inspector.close': { tag: 'element', count: 'one', on: BOTH },
  'inspector.tabs': { tag: 'element', count: 'one', on: BOTH },
  'inspector.tab': { tag: 'element', count: 'many', on: BOTH },
  'inspector.body': { tag: 'element', count: 'one', on: BOTH },
  'inspector.pane': { tag: 'element', count: 'many', on: BOTH },
  // dialogs
  'about.dialog': { tag: 'element', count: 'one', on: BOTH },
  'about.title': { tag: 'element', count: 'one', on: BOTH },
  'about.desc': { tag: 'element', count: 'one', on: BOTH },
  'about.body': { tag: 'element', count: 'one', on: BOTH },
  'about.close': { tag: 'element', count: 'one', on: BOTH },
  'shortcuts.dialog': { tag: 'element', count: 'one', on: BOTH },
  'shortcuts.close': { tag: 'element', count: 'one', on: BOTH },
  // phone chrome (< 768 px): the bottom tab bar, the top strip, and the page
  // picker in the sidebar sheet (Site pages only)
  'mobile.bar': { tag: 'element', count: 'one', on: BOTH },
  'mobile.pages': { tag: 'element', count: 'one', on: BOTH },
  'mobile.search': { tag: 'element', count: 'one', on: BOTH },
  'mobile.fit': { tag: 'element', count: 'one', on: STAGE },
  'mobile.menu': { tag: 'element', count: 'one', on: BOTH },
  'mobile.strip': { tag: 'element', count: 'one', on: STAGE },
  'mobile.title': { tag: 'element', count: 'one', on: STAGE },
  'mobile.theme': { tag: 'element', count: 'one', on: STAGE },
  'mobile.selector': { tag: 'select', count: 'one', on: NONE },
  // inventory page
  'inventory.filter': { tag: 'input', count: 'one', on: INVENTORY },
  'inventory.view': { tag: 'element', count: 'many', on: INVENTORY },
  'inventory.table': { tag: 'element', count: 'many', on: INVENTORY },
  'inventory.row': { tag: 'element', count: 'many', on: INVENTORY },
  'inventory.sort': { tag: 'element', count: 'many', on: INVENTORY },
  'inventory.pager': { tag: 'element', count: 'many', on: INVENTORY },
  'inventory.tab': { tag: 'element', count: 'many', on: NONE },
  'inventory.group': { tag: 'element', count: 'many', on: NONE },
  'inventory.sub': { tag: 'element', count: 'many', on: NONE },
  'inventory.scroll': { tag: 'element', count: 'many', on: NONE },
  'inventory.resizeRow': { tag: 'element', count: 'many', on: NONE },
  'inventory.resizeCol': { tag: 'element', count: 'many', on: NONE },
} as const satisfies Record<string, HookSpec>;

export type HookId = keyof typeof HOOKS;
/** Hooks that occur at most once per page — the ones `find` / `maybe` accept. */
export type OneHook = { [K in HookId]: (typeof HOOKS)[K]['count'] extends 'one' ? K : never }[HookId];

/** Markup side: `data-m="id"`, for the chrome's template strings. */
export function hookAttr(id: HookId): string {
  return `${HOOK_ATTR}="${id}"`;
}

/** Query side: `[data-m="id"]`. */
export function hookSelector(id: HookId): string {
  return `[${HOOK_ATTR}="${id}"]`;
}

// ─── element parameters ─────────────────────────────────────────────────────

/** Built-in inspector tabs, in display order (`data-tab` on `inspector.tab`). */
export const BUILTIN_TABS = ['overview', 'interfaces', 'neighbors', 'metadata', 'config'] as const;
export type BuiltinTab = (typeof BUILTIN_TABS)[number];

/** Menubar menus (`data-menu` on `menubar.trigger`). */
export const MENUS = ['view', 'export', 'help'] as const;
export type Menu = (typeof MENUS)[number];

/** Inventory views (`data-tab` on `inventory.tab`, `data-view` on `inventory.view`). */
const INVENTORY_VIEWS = ['zones', 'all'] as const;
export type InventoryView = (typeof INVENTORY_VIEWS)[number];

/** Parameters the chrome writes on hooked elements and the runtime reads. */
export const ATTR = {
  tab: 'data-tab',
  menu: 'data-menu',
  view: 'data-view',
  label: 'data-label',
  setting: 'data-setting',
  value: 'data-value',
  themeVal: 'data-theme-val',
  sheet: 'data-sheet',
  sheetSnap: 'data-sheet-snap',
  id: 'data-id',
  search: 'data-search',
} as const;
export type ParamKey = keyof typeof ATTR;

// ─── <html> root state ──────────────────────────────────────────────────────

/** `<html>` state attributes, keyed by their dataset name. */
export const ROOT_ATTR = {
  theme: 'data-theme',
  themeMode: 'data-theme-mode',
  chrome: 'data-chrome',
  inspector: 'data-inspector',
  minimap: 'data-minimap',
  controls: 'data-controls',
  watermark: 'data-watermark',
  root: 'data-root',
  page: 'data-page',
  zoom: 'data-zoom',
  labels: 'data-labels',
  ports: 'data-ports',
  motion: 'data-motion',
} as const;
export type RootKey = keyof typeof ROOT_ATTR;

export interface RootState {
  theme: 'dark' | 'light';
  /** `auto`: follow the viewer's OS scheme. */
  themeMode: 'auto';
  chrome: 'minimal';
  inspector: 'off';
  minimap: 'off';
  controls: 'off';
  watermark: 'off' | 'minimal' | 'subtle' | 'blueprint';
  /** '' for root pages, '../' one level deep. */
  root: string;
  /** Site-root-relative path of this page. */
  page: string;
  zoom: 'far' | 'mid' | 'near';
  labels: string;
  ports: string;
  motion: string;
}

/** Anything with a dataset — `document.documentElement`, or a plain object in tests. */
export interface RootLike {
  dataset: DOMStringMap;
}

export function readRoot<K extends RootKey>(root: RootLike, key: K): RootState[K] | undefined {
  return root.dataset[key] as RootState[K] | undefined;
}

export function writeRoot<K extends RootKey>(root: RootLike, key: K, value: RootState[K] | undefined): void {
  if (value === undefined) delete root.dataset[key];
  else root.dataset[key] = value;
}

/**
 * The one writer of the URL-driven root attributes. Runs in the pre-boot
 * `<head>` script (before first paint, so embed and kiosk modes never flash
 * full chrome) and again in the runtime on every `hashchange`. Options the
 * URL does not mention leave the attribute as the page shipped it.
 */
export function applyModularParams(root: RootLike, o: ModularUiOptions): void {
  if (o.chrome === 'minimal') writeRoot(root, 'chrome', 'minimal');
  else if (o.chrome === 'full') writeRoot(root, 'chrome', undefined);
  for (const k of ON_OFF_PARTS) {
    if (o[k] === 'off') writeRoot(root, k, 'off');
    else if (o[k] === 'on') writeRoot(root, k, undefined);
  }
  if (o.theme !== undefined) writeRoot(root, 'theme', o.theme);
}

// ─── globals, storage, embed protocol ───────────────────────────────────────

/** `<script type="application/json" id="…">` holding the payload. */
export const DATA_SCRIPT_ID = 'marrow-data';
/** `window[READY_FLAG] === true` once the runtime has booted and painted. */
export const READY_FLAG = '__MARROW_READY__';
/** `window[SEARCH_GLOBAL]` — the cross-page search index (site shape only). */
export const SEARCH_GLOBAL = '__MARROW_SEARCH';

/** One entry of the cross-page search index. */
export interface SearchIndexDoc {
  id: string;
  name: string;
  ip?: string;
  zone?: string;
  tier?: string;
  role?: string;
  /** canonical page for this device, site-root-relative */
  page: string;
}

/** View settings persisted per viewer. `minimap` is shown/hidden (`on`/`off`);
 *  `minimap-collapsed` is folded to its icon (`1`/`0`) — two settings, two keys. */
export type StorageName = 'theme' | 'labels' | 'ports' | 'motion' | 'minimap' | 'minimap-collapsed' | 'sidebar';
export function storageKey(name: StorageName): string {
  return `marrow-${name}`;
}

/** postMessage names between a host page and an embedded diagram. */
export const EMBED = { theme: 'marrow:theme', ready: 'marrow:ready' } as const;
/** The hash a host appends for kiosk / embed chrome. */
export const EMBED_HASH = '#embed=true';

export type EmbedMessage =
  | { type: typeof EMBED.theme; theme: 'dark' | 'light' | 'auto' }
  | { type: typeof EMBED.ready };

export function isEmbedMessage(x: unknown): x is EmbedMessage {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as { type?: unknown; theme?: unknown };
  if (m.type === EMBED.ready) return true;
  return m.type === EMBED.theme && (m.theme === 'dark' || m.theme === 'light' || m.theme === 'auto');
}

// ─── payload ────────────────────────────────────────────────────────────────

/**
 * Explicit key lists, so the payload cannot grow silently when the model
 * does: a new model field ships to the browser only when it is added here.
 * Order is serialization order.
 */
export const TOPOLOGY_KEYS = [
  'name',
  'description',
  'author',
  'revision',
  'date',
  'about',
  'titleBlock',
  'theme',
  'inspector',
] as const satisfies readonly (keyof Topology)[];

export const DEVICE_KEYS = [
  'id',
  'name',
  'icon',
  'tier',
  'zone',
  'role',
  'status',
  'mgmtIp',
  'haPairWith',
  'note',
  'config',
  'stack',
  'customFields',
  'sections',
  'interfaces',
] as const satisfies readonly (keyof Device)[];

export const LINK_KEYS = [
  'id',
  'from',
  'to',
  'kind',
  'speed',
  'lag',
  'mode',
  'vlans',
  'nativeVlan',
  'encap',
  'protocol',
  'lacp',
  'status',
  'animated',
  'label',
  'note',
  'customFields',
  'sections',
] as const satisfies readonly (keyof Link)[];

export const ZONE_KEYS = ['id', 'name'] as const satisfies readonly (keyof Zone)[];

/**
 * What `pickDefined` returns: the picked keys, where any key whose value may
 * be `undefined` or `false` becomes optional (it is dropped when it is) — so
 * a `boolean` field arrives as an optional `true`.
 */
export type Defined<T, K extends keyof T> = {
  [P in K as undefined extends T[P] ? never : false extends T[P] ? never : P]: T[P];
} & {
  [P in K as undefined extends T[P] ? P : false extends T[P] ? P : never]?: Exclude<T[P], undefined | false>;
};

export type PageDevice = Defined<Device, (typeof DEVICE_KEYS)[number]>;
export type PageLink = Defined<Link, (typeof LINK_KEYS)[number]>;
export type PageZone = Defined<Zone, (typeof ZONE_KEYS)[number]>;

/** The JSON payload every compiled page embeds. */
export type EmbeddedData = Defined<Topology, (typeof TOPOLOGY_KEYS)[number]> & {
  /** Which runtime path boots: a diagram stage or the inventory document. */
  kind: PageKind;
  /** Site-root-relative path of this page ('index.html' for a Single file). */
  page: string;
  zonesCount: number;
  /** Device ids with a dedicated page — only when no search index ships. */
  devicePages?: string[];
  /** The device a device page centres on. */
  hero?: string;
  /** Scale-tier pages only: the geometry the canvas engine draws. */
  scene?: Scene;
  devices: PageDevice[];
  links: PageLink[];
  zones: PageZone[];
};

/** Top-level payload keys in serialization order (kept byte-stable across releases). */
export const PAGE_DATA_KEYS = [
  'name',
  'scene',
  'description',
  'author',
  'revision',
  'date',
  'about',
  'titleBlock',
  'zonesCount',
  'theme',
  'page',
  'kind',
  'inspector',
  'devicePages',
  'hero',
  'devices',
  'links',
  'zones',
] as const satisfies readonly (keyof EmbeddedData)[];

// every payload key is serialized — a key added to EmbeddedData without a slot here fails to compile
type Unlisted = Exclude<keyof EmbeddedData, (typeof PAGE_DATA_KEYS)[number]>;
const allPayloadKeysListed: [Unlisted] extends [never] ? true : Unlisted = true;
void allPayloadKeysListed;

/** Copy `keys` from `obj` in list order, dropping `undefined` and `false`. */
export function pickDefined<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Defined<T, K> {
  const out: Partial<Record<K, unknown>> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== false) out[k] = v;
  }
  return out as unknown as Defined<T, K>;
}

export class PageContractError extends Error {
  constructor(
    readonly kind: 'data-missing' | 'data-malformed',
    message: string,
  ) {
    super(`marrow: ${message}`);
    this.name = 'PageContractError';
  }
}

/** Serialize for `<script type="application/json">`: `<` escaped so a note
 *  or config containing "</script>" cannot break out. */
export function encodePageData(d: EmbeddedData): string {
  return JSON.stringify(d).replace(/</g, '\\u003c');
}

export function decodePageData(text: string | null | undefined): EmbeddedData {
  if (!text) throw new PageContractError('data-missing', 'embedded data missing');
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch (err) {
    throw new PageContractError('data-malformed', `embedded data is not JSON (${(err as Error).message})`);
  }
  const p = d as Partial<EmbeddedData> | null;
  if (
    typeof p !== 'object' ||
    p === null ||
    (p.kind !== 'stage' && p.kind !== 'inventory') ||
    !Array.isArray(p.devices) ||
    !Array.isArray(p.links) ||
    !Array.isArray(p.zones)
  ) {
    throw new PageContractError('data-malformed', 'embedded data does not match the page contract');
  }
  return p as EmbeddedData;
}
