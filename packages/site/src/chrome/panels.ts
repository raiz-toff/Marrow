/** The bars and panels around the stage: command bar, inspector drawer,
 *  camera controls and the mobile bottom bar. */
import { ATTR, BUILTIN_TABS, hookAttr, type BuiltinTab } from '@marrow/runtime';
import type { ChromeOptions } from '../chrome.js';
import { esc } from '../html.js';
import { brandFoot, brandLogo, brandName } from './brand-mark.js';
import { I } from './icons.js';

const TAB_LABEL: Record<BuiltinTab, string> = {
  overview: 'Overview',
  interfaces: 'Interfaces',
  neighbors: 'Neighbors',
  metadata: 'Custom Fields',
  config: 'Config',
};

export function commandBar(o: ChromeOptions, crumbs: string): string {
  return `<header class="m-command-bar" ${hookAttr('chrome.commandBar')}>
  <div class="m-header-left">
    <button class="m-icon-btn m-sidebar-btn" ${hookAttr('sidebar.toggle')} type="button" aria-label="Toggle navigation (Ctrl+B)" title="Toggle navigation (Ctrl+B)">
      ${I.panelLeft}
    </button>
    <div class="m-brand-mark">${brandLogo(o)}<span>${brandName(o)}</span></div>
    <span class="m-header-sep" aria-hidden="true">/</span>
    <nav class="m-breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav>
  </div>
  <div class="m-header-right">
    <button class="m-icon-btn m-search-btn m-desk-only" ${hookAttr('search.open')} type="button" aria-label="Search" title="Search devices, IPs, interfaces (Ctrl+K)">
      ${I.magnifier}<span>Search devices…</span><kbd>Ctrl K</kbd>
    </button>
    <div class="m-icon-btn m-theme-btn m-desk-only" ${hookAttr('theme.toggle')} role="group" aria-label="Toggle theme" title="Toggle color theme">
      <span class="m-theme-opt m-theme-sun" ${hookAttr('theme.option')} ${ATTR.themeVal}="light" aria-label="Light mode">${I.sun}</span>
      <span class="m-theme-opt m-theme-moon" ${hookAttr('theme.option')} ${ATTR.themeVal}="dark" aria-label="Dark mode">${I.moon13}</span>
    </div>
    <button class="m-icon-btn m-search-btn m-mob-only" ${hookAttr('search.open')} type="button" aria-label="Search">
      ${I.magnifier}
    </button>
    <button class="m-icon-btn m-theme-btn m-mob-only" ${hookAttr('theme.toggle')} type="button" aria-label="Toggle theme">
      ${I.moon}
    </button>
  </div>
</header>`;
}

export function inspector(o: ChromeOptions): string {
  const tabs = BUILTIN_TABS.map(
    (t, i) =>
      `    <button class="m-tab-btn${i === 0 ? ' active' : ''}" ${hookAttr('inspector.tab')} ${ATTR.tab}="${t}" type="button" role="tab" aria-selected="${i === 0}">${TAB_LABEL[t]}</button>`,
  ).join('\n');
  const panes = BUILTIN_TABS.map(
    (t, i) =>
      `    <div id="m-pane-${t}" class="m-inspector-pane${i === 0 ? ' active' : ''}" ${hookAttr('inspector.pane')}${i === 0 ? '' : ' hidden'}></div>`,
  ).join('\n');
  return `<aside class="m-inspector" ${hookAttr('inspector.panel')} ${ATTR.sheetSnap}="half" hidden>
  <div class="m-sheet-drag-handle" ${hookAttr('inspector.handle')} title="Drag or tap to expand"></div>
  <div class="m-inspector-head">
    <div class="m-inspector-id">
      <span class="m-inspector-title" ${hookAttr('inspector.title')}></span>
      <small class="m-inspector-desc" ${hookAttr('inspector.desc')}></small>
    </div>
    <button class="m-inspector-close" ${hookAttr('inspector.close')} type="button" aria-label="Close">${I.x}</button>
  </div>
  <div class="m-inspector-tabs" ${hookAttr('inspector.tabs')} role="tablist">
${tabs}
  </div>
  <div class="m-inspector-body" ${hookAttr('inspector.body')}>
${panes}
  </div>
  <div class="m-drawer-foot">${brandFoot(o)}</div>
</aside>`;
}

export function cameraControls(): string {
  return `<div class="m-controls" ${hookAttr('camera.controls')} aria-label="Camera controls">
  <button class="m-btn m-ctl-in" ${hookAttr('camera.zoomIn')} type="button" title="Zoom in (+)" aria-label="Zoom in">${I.plus}</button>
  <button class="m-btn m-ctl-out" ${hookAttr('camera.zoomOut')} type="button" title="Zoom out (−)" aria-label="Zoom out">${I.minus}</button>
  <button class="m-btn m-ctl-fit" ${hookAttr('camera.fit')} type="button" title="Fit view (F)" aria-label="Fit view">${I.maximize}</button>
  <span class="m-ctl-sep"></span>
  <button class="m-btn m-ctl-cmd m-search-btn" ${hookAttr('search.open')} type="button" title="Command center (Ctrl+K)" aria-label="Open command center">${I.command}</button>
</div>`;
}

export function mobileBar(o: ChromeOptions): string {
  return `<footer class="m-mobile-bar" aria-label="Mobile navigation">
  <div class="m-mob-left">
    ${brandLogo(o)}
    <span class="m-mob-brand">${brandName(o)}</span>
    <button class="m-mob-selector-btn" ${hookAttr('mobile.selector')} type="button" aria-label="Current topology">
      <span>${esc(o.title)}</span>
      <span class="m-mob-caret">▼</span>
    </button>
  </div>
  <div class="m-mob-right">
    <button class="m-icon-btn m-search-btn" ${hookAttr('search.open')} type="button" aria-label="Search">${I.magnifier}</button>
    <button class="m-icon-btn m-sidebar-btn" ${hookAttr('sidebar.toggle')} type="button" aria-label="Navigation">${I.panelLeft}</button>
    <button class="m-icon-btn m-theme-btn" ${hookAttr('theme.toggle')} type="button" aria-label="Toggle theme">${I.moon}</button>
  </div>
</footer>`;
}
