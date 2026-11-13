/**
 * Chrome — the interface around the diagram: command bar, sidebar, inspector,
 * camera controls, dialogs and the page skeleton that holds them.
 *
 * The markup lives in the site compiler (never in the runtime bundle, which
 * must stay small — ADR-0004); every element the runtime binds to carries a
 * page-contract hook (`hookAttr(...)` → `data-m="…"`). Classes here are for
 * styling only. Feature markup is in `./chrome/*`; this module composes it.
 */
import type { WatermarkConfig } from '@marrow/model';
import { DATA_SCRIPT_ID, encodePageData, getPrebootSource, hookAttr, ROOT_ATTR, type EmbeddedData } from '@marrow/runtime';
import type { Brand } from './brand.js';
import { brandLine, brandNote } from './chrome/brand-mark.js';
import { fibreLockup } from './chrome/fibre.js';
import { aboutDialog, shortcutsDialog, spotlight } from './chrome/dialogs.js';
import { I } from './chrome/icons.js';
import { cameraControls, commandBar, inspector, mobileBar, mobileStrip } from './chrome/panels.js';
import { sidebar } from './chrome/sidebar.js';
import { escapeHtml as esc } from '@marrow/visual';
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

export interface ChromeOptions {
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
  /** The payload the runtime reads; serialized here with `encodePageData`. */
  data: EmbeddedData;
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
  watermark?: WatermarkConfig;
}

/** The watermark's attribution line (ADR-0018). Phones show only this line,
 *  in place of the title; wider screens keep the title and hide it. */
const WM_ATTRIBUTION = `<em class="m-wm-attr">${fibreLockup(9)}</em>`;

export function renderChrome(o: ChromeOptions): string {
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
    ? `<main class="m-stage" ${hookAttr('stage.root')}>\n${o.stage}\n<div class="m-tooltip" ${hookAttr('stage.tooltip')} hidden></div>\n</main>`
    : `<main class="m-doc">${o.body ?? ''}</main>`;
  const wm = o.watermark ?? {};
  const wmEnabled = wm.enabled ?? true;
  const wmMode = wm.mode ?? 'full';
  const wmAttrs: string[] = [`data-mode="${wmMode}"`];
  if (wm.font) wmAttrs.push(`data-font="${wm.font}"`);
  if (wm.casing) wmAttrs.push(`data-casing="${wm.casing}"`);
  const wmStyle = wm.opacity !== undefined ? ` style="opacity:${wm.opacity};"` : '';

  let wmText = esc(o.title);
  const wmSub = o.subtitle ? `<small>${esc(o.subtitle)}</small>` : '';
  if (wmMode === 'minimal' || wmMode === 'blueprint') {
    wmText = `fig. 01 — ${esc(o.title)}`;
  }

  const watermark =
    o.stage && wmEnabled && wmMode !== 'off'
      ? `<div class="m-watermark" ${wmAttrs.join(' ')}${wmStyle} aria-hidden="true"><span>${wmText}</span>${wmSub}${WM_ATTRIBUTION}</div>`
      : '';
  /* the top strip always carries a mark: the company logo + brand name when
     configured, the Marrow product mark otherwise */
  const note = brandNote(o);
  const backdrop = o.stage
    ? `<div class="m-backdrop" aria-hidden="true"><span class="m-backdrop-text">${brandLine(o)}</span>${note !== undefined ? `<span class="m-backdrop-note">${esc(note)}</span>` : ''}</div>`
    : '';
  /* one chrome for every page: unified command bar, workspace row,
     sidebar, inspector with tabs, status bar, and mobile bottom nav */
  const isSingle = !o.navLinks || o.navLinks.length === 0;

  // `theme: auto` follows the viewer's OS scheme: the page ships a dark
  // default plus data-theme-mode="auto", the pre-boot script resolves it
  // before first paint (no flash), then the runtime keeps it live and lets an
  // embedding host override it. Non-auto themes ship a fixed attribute.
  const auto = o.theme === 'auto';
  const themeAttr = auto ? 'dark' : esc(o.theme);
  const modeAttr = auto ? ` ${ROOT_ATTR.themeMode}="auto"` : '';
  const chromeAttr = o.chrome === 'minimal' ? ` ${ROOT_ATTR.chrome}="minimal"` : '';
  const watermarkAttr =
    !wmEnabled || wmMode === 'off' ? ` ${ROOT_ATTR.watermark}="off"` : wmMode !== 'full' ? ` ${ROOT_ATTR.watermark}="${wmMode}"` : '';

  return `<!DOCTYPE html>
<html lang="en" ${ROOT_ATTR.theme}="${themeAttr}"${modeAttr}${chromeAttr}${watermarkAttr} ${ROOT_ATTR.root}="${esc(o.rootPrefix)}" ${ROOT_ATTR.page}="${esc(o.page)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generator" content="marrow-v2">
<title>${esc(o.title)} — Marrow</title>
<script>${getPrebootSource()}</script>
${css}
</head>
<body${o.stage ? '' : ' class="m-doc-body"'}>
<div id="marrow-chrome" ${hookAttr('chrome.root')} data-single-file="${isSingle ? 'true' : 'false'}" data-view-mode="default">
${backdrop}
${sidebar(o)}
<div class="m-sidebar-backdrop"></div>
<div class="m-main-column">
${commandBar(o, crumbs)}
${o.stage ? `${mobileStrip(o)}\n` : ''}<div class="m-stage-body">
<div class="m-stage-wrap">
${main}
${watermark}
${o.stage ? `<div class="m-minimap" ${hookAttr('minimap.root')} hidden></div>` : ''}
${o.stage ? cameraControls() : ''}
</div>
${inspector(o)}
</div>
${mobileBar(o)}
</div>
</div>
${aboutDialog()}
${shortcutsDialog()}
${spotlight()}
<script type="application/json" id="${DATA_SCRIPT_ID}">${encodePageData(o.data)}</script>
${scripts}
</body>
</html>`;
}
