import type { Brand } from './brand.js';
import { SITE_CSS } from './styles.js';

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
}

/** One icon language for all chrome: Lucide geometry — a 24-unit grid,
 *  stroke 2, round caps/joins — rendered at 16px (12–14px in dense spots). */
const ic = (paths: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const I = {
  hamburger: ic('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  magnifier: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 14),
  moon: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
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
      ? `<style>${SITE_CSS}</style>`
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
  const watermark = o.stage
    ? `<div class="m-watermark" aria-hidden="true"><span>${esc(o.title)}</span>${o.subtitle ? `<small>${esc(o.subtitle)}</small>` : ''}</div>`
    : '';
  /* the top strip always carries a mark: the company logo + brand name when
     configured, the Marrow product mark otherwise */
  const brandLine = `${brandLogo(o)}<span>${brandName(o)}</span>`;
  const note = brandNote(o);
  const backdrop = o.stage
    ? `<div class="m-backdrop" aria-hidden="true"><span class="m-backdrop-text">${brandLine}</span>${note !== undefined ? `<span class="m-backdrop-note">${esc(note)}</span>` : ''}</div>`
    : '';
  /* one chrome for every page: floating SidebarTrigger chip, fixed
     breadcrumb bar, hover search dock (view settings live in ⌘K) */
  const rail = `<div class="m-rail-wrap">
<button class="m-chip-btn m-sidebar-btn" type="button" data-title="Panel" aria-label="Toggle panel">${I.hamburger}</button>
</div>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${esc(o.theme)}" data-root="${esc(o.rootPrefix)}" data-page="${esc(o.page)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="marrow-v2">
<title>${esc(o.title)} — Marrow</title>
${css}
</head>
<body${o.stage ? '' : ' class="m-doc-body"'}>
${backdrop}
${rail}
<nav class="m-breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav>
<div class="m-dock">
  <button class="m-searchpill m-search-btn" type="button" aria-label="Search">
    ${I.magnifier}<span>Search devices…</span><kbd>Ctrl K</kbd>
  </button>
  <button class="m-dock-hint m-search-btn" type="button" aria-label="Search">${I.magnifier}<span>Search</span><kbd>Ctrl K</kbd></button>
</div>
${sidebar(o)}
${main}
${watermark}
<aside class="m-inspector" hidden>
  <div class="m-inspector-head">
    <div class="m-inspector-id">
      <span class="m-inspector-title"></span>
      <small class="m-inspector-desc"></small>
    </div>
    <button class="m-inspector-close" type="button" aria-label="Close">${I.x}</button>
  </div>
  <div class="m-inspector-body"></div>
  <div class="m-drawer-foot">${brandFoot(o)}</div>
</aside>
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
${o.stage ? `<div class="m-minimap" hidden></div>\n<div class="m-controls">\n  <button class="m-btn m-ctl-in" type="button" title="Zoom in" aria-label="Zoom in">${I.plus}</button>\n  <button class="m-btn m-ctl-out" type="button" title="Zoom out" aria-label="Zoom out">${I.minus}</button>\n  <button class="m-btn m-ctl-fit" type="button" title="Fit view" aria-label="Fit view">${I.maximize}</button>\n  <span class="m-ctl-sep"></span>\n  <button class="m-btn m-ctl-cmd m-search-btn" type="button" title="Command center" aria-label="Open command center">${I.command}</button>\n</div>` : ''}
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
  <div class="m-side-id"><strong>${esc(o.title)}</strong><small>${esc(o.stats)}</small></div>
</div>`;
  const pages =
    o.navLinks && o.navLinks.length > 0
      ? `<section><h4>Browse</h4><nav class="m-side-nav">${groupedNav(o.navLinks, o)}</nav></section>`
      : '';
  // quick settings live ONLY on the rail (stage pages); doc pages get a
  // theme control here since they have no rail
  const view = o.stage
    ? `<section><h4>Legend</h4>
  <ul class="m-legend">
    <li><i class="m-dot" style="background:var(--up)"></i>up</li>
    <li><i class="m-dot" style="background:var(--degraded)"></i>degraded</li>
    <li><i class="m-dot" style="background:var(--down)"></i>down</li>
    <li><i class="m-dot" style="background:var(--planned)"></i>planned</li>
    <li><i class="m-line"></i>link</li>
    <li><i class="m-line m-line-dash"></i>degraded / planned</li>
  </ul>
</section>`
    : `<section><h4>View</h4>
  <div class="m-field"><span>Theme</span><div class="m-seg" data-setting="theme"><button data-value="dark" type="button">Dark</button><button data-value="light" type="button">Light</button></div></div>
</section>`;
  const aboutRows = [
    ...(o.about?.layout !== undefined ? [['Layout', o.about.layout] as const] : []),
    ...(o.about?.renderer !== undefined ? [['Renderer', o.about.renderer] as const] : []),
  ];
  const about =
    aboutRows.length > 0
      ? `<section><h4>About</h4><div class="m-side-nav">${aboutRows
          .map(
            ([k, v]) =>
              `<div class="m-side-row m-side-static"><span>${esc(String(k))}</span><em>${esc(String(v))}</em></div>`,
          )
          .join('')}</div></section>`
      : '';
  const hasNav = o.navLinks !== undefined && o.navLinks.length > 0;
  const menubar = `<nav class="m-menubar" role="menubar" aria-label="Application menu">
  <button type="button" data-menu="view" role="menuitem">View</button>
  <button type="button" data-menu="export" role="menuitem">Export</button>
  <button type="button" data-menu="help" role="menuitem">Help</button>
</nav>`;
  return `<aside class="m-sidebar${hasNav ? ' m-nav' : ''}">
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
