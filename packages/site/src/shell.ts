import type { Brand } from './brand.js';
import { buildStylesheet, SITE_CSS } from './styles.js';
import type { ThemeConfig } from './tokens.js';

/** Breadcrumb segment; no href = current page. */
export interface Crumb {
  label: string;
  href?: string;
}

export interface NavLink {
  label: string;
  href: string;
  /** right-aligned count badge (device count etc.) */
  count?: number;
  kind?: 'overview' | 'zone' | 'inventory';
}

export interface ShellOptions {
  title: string;
  stats: string;
  crumbs: Crumb[];
  /** '' for root pages, '../' for pages one level deep. */
  rootPrefix: string;
  /** Site-root-relative path of this page, e.g. 'zones/building-a.html'. */
  page: string;
  theme: string;
  /** Main content: an SVG stage or a content body (inventory). */
  stage?: string;
  body?: string;
  /** Watermark sub-line (topology description). */
  subtitle?: string;
  /** Global branding from brand/brand.html — the single source for the mark. */
  brand?: Brand;
  /** JSON payload for the runtime (already serialized + escaped). */
  dataJson: string;
  /** inline: single-file export. external: shared assets/ (site mode). */
  assets: { mode: 'inline'; runtime: string } | { mode: 'external' };
  /** sidebar page navigation, site-root-relative */
  navLinks?: NavLink[];
  /** About block content: layout preset + renderer tier */
  about?: { layout?: string; renderer?: string };
  /** Global theme and design token overrides. */
  themeConfig?: ThemeConfig;
  /** Embed / kiosk modularity: 'minimal' hides topbar & dock, 'full' preserves all chrome. */
  chrome?: 'full' | 'minimal';
  embed?: boolean;
  watermark?: import('@marrow/model').WatermarkConfig;
  /** Layout archetype inspired by Fumadocs: locked to 'spacious'. */
  layout?: 'spacious';
}

/** One icon language for all chrome: Lucide geometry — a 24-unit grid,
 *  stroke 2, round caps/joins — rendered at 16px (12–14px in dense spots). */
const ic = (paths: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const I = {
  panelLeft: ic('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 18),
  magnifier: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 14),
  moon: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  moon13: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 13),
  sun: ic(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    13,
  ),
  tag: ic(
    '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  ),
  plug: ic('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
  pulse: ic(
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  ),
  map: ic(
    '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  ),
  image: ic(
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  ),
  vector: ic('<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>'),
  network: ic(
    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="m5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    18,
  ),
  layers: ic(
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    18,
  ),
  panelRight: ic('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>', 18),
  magnifier18: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 18),
  home: ic(
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ),
  building: ic(
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  ),
  list: ic('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>'),
  /* The Marrow mark: the "rr" of the wordmark, the second shoulder resolving
     into an arrowhead. Monochrome here — the accent colour the docs logo uses
     can't survive in chrome that inherits currentColor. */
  logo: ic('<path d="M5 20V10a4 4 0 0 1 4-4"/><path d="M13 20V10"/><path d="M13 10a4 4 0 0 1 4-4h2"/><path d="m17.2 4.2 1.8 1.8-1.8 1.8"/>', 18),
  github: ic(
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    14,
  ),
  pin: ic(
    '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  ),
  x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  plus: ic('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  minus: ic('<path d="M5 12h14"/>'),
  maximize: ic(
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  ),
  chevronRight: ic('<path d="m9 18 6-6-6-6"/>', 12),
  command: ic('<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'),
};

const NAV_ICON: Record<string, string> = {
  overview: I.home,
  zone: I.building,
  inventory: I.list,
};

export function renderShell(o: ShellOptions): string {
  const css =
    o.assets.mode === 'inline'
      ? `<style>${o.themeConfig ? buildStylesheet(o.themeConfig) : SITE_CSS}</style>`
      : `<link rel="stylesheet" href="${o.rootPrefix}assets/styles.css">`;
  const scripts =
    o.assets.mode === 'inline'
      ? `<script>${o.assets.runtime}</script>`
      : `<script src="${o.rootPrefix}assets/search-data.js"></script>\n<script src="${o.rootPrefix}assets/runtime.js"></script>`;
  const crumbs = o.crumbs
    .map((c) =>
      c.href !== undefined
        ? `<a href="${o.rootPrefix}${esc(c.href)}">${esc(c.label)}</a>`
        : `<span class="m-crumb-here">${esc(c.label)}</span>`,
    )
    .join(`<span class="m-crumb-sep">${I.chevronRight}</span>`);
  const main = o.stage
    ? `<main class="m-stage">\n${o.stage}\n<div class="m-tooltip" hidden></div>\n</main>`
    : `<main class="m-doc">${o.body ?? ''}</main>`;
  const wm = o.watermark ?? {};
  const wmEnabled = wm.enabled ?? true;
  const wmMode = wm.mode ?? 'full';
  const wmAttrs: string[] = [`data-mode="${wmMode}"`];
  if (wm.font) wmAttrs.push(`data-font="${wm.font}"`);
  if (wm.casing) wmAttrs.push(`data-casing="${wm.casing}"`);
  const wmStyle = wm.opacity !== undefined ? ` style="opacity:${wm.opacity};"` : '';

  let wmText = esc(o.title);
  let wmSub = o.subtitle ? `<small>${esc(o.subtitle)}</small>` : '';
  if (wmMode === 'minimal' || wmMode === 'blueprint') {
    wmText = `fig. 01 — ${esc(o.title)}`;
  }

  const watermark = o.stage && wmEnabled && wmMode !== 'off'
    ? `<div class="m-watermark" ${wmAttrs.join(' ')}${wmStyle} aria-hidden="true"><span>${wmText}</span>${wmSub}</div>`
    : '';
  /* the top strip always carries a mark: the company logo + brand name when
     configured, the Marrow product mark otherwise */
  const brandLine = `${brandLogo(o)}<span>${brandName(o)}</span>`;
  const note = brandNote(o);
  const backdrop = o.stage
    ? `<div class="m-backdrop" aria-hidden="true"><span class="m-backdrop-text">${brandLine}</span>${note !== undefined ? `<span class="m-backdrop-note">${esc(note)}</span>` : ''}</div>`
    : '';
  /* one chrome for every page: unified command bar, workspace row,
     sidebar, inspector with tabs, status bar, and mobile bottom nav */
  const isSingle = !o.navLinks || o.navLinks.length === 0;

  const commandBar = `<header class="m-command-bar">
  <div class="m-header-left">
    <button class="m-icon-btn m-sidebar-btn" type="button" aria-label="Toggle navigation (Ctrl+B)" title="Toggle navigation (Ctrl+B)">
      ${I.panelLeft}
    </button>
    <div class="m-brand-mark">${brandLogo(o)}<span>${brandName(o)}</span></div>
    <span class="m-header-sep" aria-hidden="true">/</span>
    <nav class="m-breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav>
  </div>
  <div class="m-header-right">
    <button class="m-icon-btn m-search-btn m-desk-only" type="button" aria-label="Search" title="Search devices, IPs, interfaces (Ctrl+K)">
      ${I.magnifier}<span>Search devices…</span><kbd>Ctrl K</kbd>
    </button>
    <div class="m-icon-btn m-theme-btn m-desk-only" role="group" aria-label="Toggle theme" title="Toggle color theme">
      <span class="m-theme-opt m-theme-sun" data-theme-val="light" aria-label="Light mode">${I.sun}</span>
      <span class="m-theme-opt m-theme-moon" data-theme-val="dark" aria-label="Dark mode">${I.moon13}</span>
    </div>
    <button class="m-icon-btn m-search-btn m-mob-only" type="button" aria-label="Search">
      ${I.magnifier}
    </button>
    <button class="m-icon-btn m-theme-btn m-mob-only" type="button" aria-label="Toggle theme">
      ${I.moon}
    </button>
  </div>
</header>`;

  const inspector = `<aside class="m-inspector" data-sheet-snap="half" hidden>
  <div class="m-sheet-drag-handle" title="Drag or tap to expand"></div>
  <div class="m-inspector-head">
    <div class="m-inspector-id">
      <span class="m-inspector-title"></span>
      <small class="m-inspector-desc"></small>
    </div>
    <button class="m-inspector-close" type="button" aria-label="Close">${I.x}</button>
  </div>
  <div class="m-inspector-tabs" role="tablist">
    <button class="m-tab-btn active" data-tab="overview" type="button" role="tab" aria-selected="true">Overview</button>
    <button class="m-tab-btn" data-tab="interfaces" type="button" role="tab" aria-selected="false">Interfaces</button>
    <button class="m-tab-btn" data-tab="neighbors" type="button" role="tab" aria-selected="false">Neighbors</button>
    <button class="m-tab-btn" data-tab="metadata" type="button" role="tab" aria-selected="false">Custom Fields</button>
    <button class="m-tab-btn" data-tab="config" type="button" role="tab" aria-selected="false">Config</button>
  </div>
  <div class="m-inspector-body">
    <div id="m-pane-overview" class="m-inspector-pane active"></div>
    <div id="m-pane-interfaces" class="m-inspector-pane" hidden></div>
    <div id="m-pane-neighbors" class="m-inspector-pane" hidden></div>
    <div id="m-pane-metadata" class="m-inspector-pane" hidden></div>
    <div id="m-pane-config" class="m-inspector-pane" hidden></div>
  </div>
  <div class="m-drawer-foot">${brandFoot(o)}</div>
</aside>`;

  const controls = o.stage
    ? `<div class="m-controls" aria-label="Camera controls">
  <button class="m-btn m-ctl-in" type="button" title="Zoom in (+)" aria-label="Zoom in">${I.plus}</button>
  <button class="m-btn m-ctl-out" type="button" title="Zoom out (−)" aria-label="Zoom out">${I.minus}</button>
  <button class="m-btn m-ctl-fit" type="button" title="Fit view (F)" aria-label="Fit view">${I.maximize}</button>
  <span class="m-ctl-sep"></span>
  <button class="m-btn m-ctl-cmd m-search-btn" type="button" title="Command center (Ctrl+K)" aria-label="Open command center">${I.command}</button>
</div>`
    : '';

  // `theme: auto` follows the viewer's OS scheme. Resolve it in a tiny head
  // script BEFORE first paint (no flash), then the runtime keeps it live and
  // lets an embedding host override it. Non-auto themes ship a fixed attribute.
  const auto = o.theme === 'auto';
  const themeAttr = auto ? 'dark' : esc(o.theme);
  const modeAttr = auto ? ' data-theme-mode="auto"' : '';
  const isMinimal = o.chrome === 'minimal' || o.embed === true;
  const chromeAttr = isMinimal ? ' data-chrome="minimal"' : '';
  const watermarkAttr = (!wmEnabled || wmMode === 'off') ? ' data-watermark="off"' : (wmMode !== 'full' ? ` data-watermark="${wmMode}"` : '');
  const activeLayout = 'spacious';
  const layoutAttr = ` data-layout="spacious"`;

  // Modular pre-boot script: resolves URL query and hash parameters (#embed=true, ?chrome=minimal, ?inspector=off, ?minimap=off, ?theme=light)
  const headScript = `<script>try{var r=document.documentElement,q=new URLSearchParams(location.search),h=location.hash.slice(1),hp=new URLSearchParams(h.indexOf(';')>=0?h.replace(/;/g,'&'):h),g=function(k){return q.get(k)||hp.get(k)};if(g('embed')==='true'||g('embed')==='1'||g('chrome')==='minimal')r.dataset.chrome='minimal';if(g('inspector')==='off'||g('inspector')==='false')r.dataset.inspector='off';if(g('minimap')==='off'||g('minimap')==='false')r.dataset.minimap='off';r.dataset.layout='spacious';var t=g('theme');if(t==='light'||t==='dark')r.dataset.theme=t;else if(${auto}){var s=null;try{s=localStorage.getItem('marrow-theme')}catch(e){}if(s!=='dark'&&s!=='light')r.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}</script>`;

  const mobileBar = `<footer class="m-mobile-bar" aria-label="Mobile navigation">
  <div class="m-mob-left">
    ${brandLogo(o)}
    <span class="m-mob-brand">${brandName(o)}</span>
    <button class="m-mob-selector-btn" type="button" aria-label="Current topology">
      <span>${esc(o.title)}</span>
      <span class="m-mob-caret">▼</span>
    </button>
  </div>
  <div class="m-mob-right">
    <button class="m-icon-btn m-search-btn" type="button" aria-label="Search">${I.magnifier}</button>
    <button class="m-icon-btn m-sidebar-btn" type="button" aria-label="Navigation">${I.panelLeft}</button>
    <button class="m-icon-btn m-theme-btn" type="button" aria-label="Toggle theme">${I.moon}</button>
  </div>
</footer>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeAttr}"${modeAttr}${chromeAttr}${watermarkAttr}${layoutAttr} data-root="${esc(o.rootPrefix)}" data-page="${esc(o.page)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="marrow-v2">
<title>${esc(o.title)} — Marrow</title>
${headScript}
${css}
</head>
<body${o.stage ? '' : ' class="m-doc-body"'}>
<div id="marrow-shell"${layoutAttr} data-single-file="${isSingle ? 'true' : 'false'}" data-view-mode="default">
${backdrop}
${sidebar(o)}
<div class="m-sidebar-backdrop"></div>
<div class="m-main-column">
${commandBar}
<div class="m-stage-body">
<div class="m-stage-wrap">
${main}
${watermark}
${o.stage ? `<div class="m-minimap" hidden></div>` : ''}
${controls}
</div>
${inspector}
</div>
${mobileBar}
</div>
</div>
<div class="m-about-dialog" hidden>
  <div class="m-about-box" role="dialog" aria-modal="true" aria-labelledby="m-about-title">
    <div class="m-about-watermark" aria-hidden="true">
      <svg class="m-about-wm-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 20V10a4 4 0 0 1 4-4"/><path d="M13 20V10"/><path d="M13 10a4 4 0 0 1 4-4h2"/><path d="m17.2 4.2 1.8 1.8-1.8 1.8"/>
      </svg>
      <span>MARROW</span>
    </div>
    <div class="m-about-head">
      <div class="m-about-title-wrap">
        <h3 class="m-about-title" id="m-about-title"></h3>
        <p class="m-about-desc"></p>
      </div>
      <button class="m-about-close" type="button" aria-label="Close dialog">${I.x}</button>
    </div>
    <div class="m-about-body"></div>
    <div class="m-about-foot">
      <div class="m-about-credit">
        <a class="m-about-credit-link" href="https://marrowdiagram.vercel.app" target="_blank" rel="noopener noreferrer">
          <span class="m-about-credit-mark">${I.logo}</span>
          <span>Engineered with <strong>Marrow</strong> · Declarative Network Topology Compiler</span>
        </a>
        <a class="m-about-credit-gh" href="https://github.com/raiz-toff/Marrow" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" title="GitHub repository">${I.github}</a>
      </div>
    </div>
  </div>
</div>
<div class="m-shortcuts" hidden>
  <div class="m-shortcuts-box">
    <div class="m-shortcuts-head">
      <div><strong>Keyboard shortcuts</strong><small>Driving the diagram from the keys</small></div>
      <button class="m-shortcuts-close" type="button" aria-label="Close">${I.x}</button>
    </div>
    <div class="m-shortcuts-body">
      <h5>Search &amp; commands</h5>
      <div class="m-sc-row"><span>Command center</span><span class="m-sc-keys"><kbd>Ctrl K</kbd><kbd>/</kbd></span></div>
      <div class="m-sc-row"><span>Navigate results · open</span><span class="m-sc-keys"><kbd>↑</kbd><kbd>↓</kbd><kbd>↵</kbd></span></div>
      <h5>Camera</h5>
      <div class="m-sc-row"><span>Fit view</span><span class="m-sc-keys"><kbd>F</kbd><kbd>Ctrl 0</kbd></span></div>
      <div class="m-sc-row"><span>Zoom in / out</span><span class="m-sc-keys"><kbd>+</kbd><kbd>−</kbd><kbd>Ctrl +</kbd><kbd>Ctrl −</kbd></span></div>
      <div class="m-sc-row"><span>Pan · zoom</span><span class="m-sc-keys"><kbd>drag</kbd><kbd>scroll</kbd></span></div>
      <h5>Devices</h5>
      <div class="m-sc-row"><span>Open focused device</span><span class="m-sc-keys"><kbd>↵</kbd><kbd>Space</kbd></span></div>
      <div class="m-sc-row"><span>Walk connected neighbors</span><span class="m-sc-keys"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></span></div>
      <div class="m-sc-row"><span>Device / view options</span><span class="m-sc-keys"><kbd>right-click</kbd></span></div>
      <div class="m-sc-row"><span>Deselect · close</span><span class="m-sc-keys"><kbd>Esc</kbd></span></div>
      <h5>Panels</h5>
      <div class="m-sc-row"><span>Toggle sidebar</span><span class="m-sc-keys"><kbd>Ctrl B</kbd></span></div>
    </div>
  </div>
</div>
<div class="m-spotlight" hidden>
  <div class="m-spotlight-box">
    <div class="m-spotlight-head">${I.magnifier}<input type="text" placeholder="Search devices, IPs, interfaces…" aria-label="Search"></div>
    <ul></ul>
    <div class="m-spotlight-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
      <span><kbd>↵</kbd> open</span>
      <span><kbd>esc</kbd> close</span>
    </div>
  </div>
</div>
<script type="application/json" id="marrow-data">${o.dataJson}</script>
${scripts}
</body>
</html>`;
}

/** "Branch — Amsterdam" → ["Branch", "Amsterdam"]; null when there is no prefix. */
function navPrefix(label: string): [string, string] | null {
  for (const sepChar of [' — ', ' - ']) {
    const at = label.indexOf(sepChar);
    if (at > 0) return [label.slice(0, at), label.slice(at + sepChar.length)];
  }
  return null;
}

/**
 * Zone nav as a tree: zones sharing a name prefix ("Branch — X", "Building A
 * - Y") fold into a collapsible group (shadcn SidebarMenuSub) once there are
 * 3+ of them. The group holding the current page starts open; the rest start
 * collapsed. Purely presentational — layout semantics stay declared in YAML.
 */
function groupedNav(links: NavLink[], o: ShellOptions): string {
  const row = (l: NavLink, label: string): string =>
    `<a class="m-side-row${l.href === o.page ? ' active' : ''}" href="${o.rootPrefix}${esc(l.href)}" data-label="${esc(l.label)}">` +
    `<i>${NAV_ICON[l.kind ?? 'zone'] ?? I.building}</i><span>${esc(label)}</span>` +
    `${l.count !== undefined ? `<em>${l.count}</em>` : ''}</a>`;

  const sizeOf = new Map<string, number>();
  for (const l of links) {
    if (l.kind !== 'zone') continue;
    const p = navPrefix(l.label);
    if (p) sizeOf.set(p[0], (sizeOf.get(p[0]) ?? 0) + 1);
  }

  const emitted = new Set<string>();
  let out = '';
  for (const l of links) {
    const p = l.kind === 'zone' ? navPrefix(l.label) : null;
    if (!p || (sizeOf.get(p[0]) ?? 0) < 3) {
      out += row(l, l.label);
      continue;
    }
    const [prefix] = p;
    if (emitted.has(prefix)) continue;
    emitted.add(prefix);
    const members = links.filter((m) => m.kind === 'zone' && navPrefix(m.label)?.[0] === prefix);
    const open = members.some((m) => m.href === o.page);
    const total = members.reduce((sum, m) => sum + (m.count ?? 0), 0);
    out +=
      `<div class="m-side-group${open ? '' : ' collapsed'}">` +
      `<button class="m-side-row m-side-group-head" type="button" aria-expanded="${open}">` +
      `<i>${NAV_ICON['zone']}</i><span>${esc(prefix)}</span><em>${total}</em><b class="m-chev">${I.chevronRight}</b>` +
      `</button>` +
      `<div class="m-side-nav m-side-sub">${members.map((m) => row(m, navPrefix(m.label)?.[1] ?? m.label)).join('')}</div>` +
      `</div>`;
  }
  return out;
}

/* ── brand resolution ──────────────────────────────────────────────────────────
   Branding is GLOBAL and comes from brand/brand.html only. Topology YAML
   deliberately has no say: a diagram describes a network, not who owns it. */

/** The logo mark: the company logo when configured, the Marrow mark otherwise. */
function brandLogo(o: ShellOptions): string {
  return o.brand?.logo !== undefined ? `<span class="m-brand-logo">${o.brand.logo}</span>` : I.logo;
}

/** The brand name shown next to the logo. */
function brandName(o: ShellOptions): string {
  return esc(o.brand?.name ?? 'Marrow');
}

/** The footer note (confidentiality line), if any. */
function brandNote(o: ShellOptions): string | undefined {
  return o.brand?.note;
}

/** Company-customizable brand mark used in the sidebar and drawer footers.
 *  With brand.link set it becomes a hyperlink — navigation only, never a
 *  resource load, so the page still renders fully offline. */
function brandFoot(o: ShellOptions): string {
  const mark = `${brandLogo(o)}<span>${brandName(o)}</span>`;
  const linked =
    o.brand?.link !== undefined
      ? `<a class="m-brand-link" href="${esc(o.brand.link)}" target="_blank" rel="noopener noreferrer">${mark}</a>`
      : mark;
  const source =
    o.brand?.github !== undefined
      ? `<a class="m-brand-gh" href="${esc(o.brand.github)}" target="_blank" rel="noopener noreferrer"` +
        ` aria-label="Source repository" title="Source repository">${I.github}</a>`
      : '';
  return `${linked}${source}`;
}

function sidebar(o: ShellOptions): string {
  /* no brand mark here on purpose: the sidebar footer already carries one, and
     two logos in one panel reads as clutter */
  const header = `<div class="m-side-header">
  <div class="m-side-id"><strong class="m-side-title">Lab Overview</strong>${o.stats ? `<small class="m-side-stats">${esc(o.stats)}</small>` : ''}</div>
  <button class="m-icon-btn m-sidebar-close m-mob-only" type="button" aria-label="Close sidebar">${I.x}</button>
</div>`;
  const pages =
    o.navLinks && o.navLinks.length > 0
      ? `<section class="m-side-section"><h4>Browse</h4><nav class="m-side-nav">${groupedNav(o.navLinks, o)}</nav></section>`
      : '';
  // quick settings live ONLY on the rail (stage pages); doc pages get a
  // theme control here since they have no rail
  const view = o.stage
    ? `<section class="m-side-section"><h4>Legend</h4>
  <ul class="m-legend">
    <li><i class="m-dot" style="background:var(--up)"></i>up</li>
    <li><i class="m-dot" style="background:var(--degraded)"></i>degraded</li>
    <li><i class="m-dot" style="background:var(--down)"></i>down</li>
    <li><i class="m-dot" style="background:var(--planned)"></i>planned</li>
    <li><i class="m-line"></i>link</li>
    <li><i class="m-line m-line-dash"></i>degraded / planned</li>
  </ul>
</section>`
    : `<section class="m-side-section"><h4>View</h4>
  <div class="m-field"><span>Theme</span><div class="m-seg" data-setting="theme"><button data-value="dark" type="button">Dark</button><button data-value="light" type="button">Light</button></div></div>
</section>`;
  const aboutRows = [
    ...(o.about?.layout !== undefined ? [['Layout', o.about.layout] as const] : []),
    ...(o.about?.renderer !== undefined ? [['Renderer', o.about.renderer] as const] : []),
  ];
  const about =
    aboutRows.length > 0
      ? `<section class="m-side-section"><h4>About</h4><div class="m-side-nav">${aboutRows
          .map(
            ([k, v]) =>
              `<div class="m-side-row m-side-static"><span>${esc(String(k))}</span><em>${esc(String(v))}</em></div>`,
          )
          .join('')}</div></section>`
      : '';
  const hasNav = o.navLinks !== undefined && o.navLinks.length > 0;
  const isSingle = !hasNav;
  const menubar = `<nav class="m-menubar" role="menubar" aria-label="Application menu">
  <button class="m-tab-btn" type="button" data-menu="view" role="menuitem">View</button>
  <button class="m-tab-btn" type="button" data-menu="export" role="menuitem">Export</button>
  <button class="m-tab-btn" type="button" data-menu="help" role="menuitem">Help</button>
</nav>`;
  return `<aside class="m-sidebar${hasNav ? ' m-nav' : ''}${isSingle ? ' is-collapsed' : ''}" id="m-sidebar">
<div class="m-sidebar-inner">
${header}
${menubar}
${pages}
${view}
${about}
<div class="m-side-foot">${brandFoot(o)}</div>
</div>
</aside>`;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
