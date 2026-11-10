/**
 * The complete stylesheet for generated pages: two first-class themes
 * (dark "ops" default, light "print/doc"), entrance choreography, focus/
 * selection states, chrome (topbar, inspector, spotlight, minimap, controls),
 * LOD bands, reduced-motion support, and print styles. Inlined into every
 * output file — no external requests, ever.
 *
 * Design system: shadcn conventions on the ZINC scale — pure neutrals, no
 * blue cast in the chrome. One blue accent, reserved for selection, focus,
 * and active states only. The diagram is the hero; chrome recedes.
 *
 * Scales (do not invent values outside these):
 *   type    11 / 12 / 13 / 14 / 15 / 20 px; weights 400 / 500 / 600
 *   radius  --radius-sm 6 / --radius 8 / --radius-lg 12
 *   motion  .15s hovers · .3s reveals · .45s large slides
 *   z       stage 0 · watermark 4 · hud 20 · inspector 25 · drawer 26 ·
 *           topbar/dock 30 · rail 31 · spotlight 40
 */
import { visualCss } from '@marrow/visual';
import { generateThemeCss, type ThemeConfig } from './tokens.js';

export function buildStylesheet(config?: ThemeConfig): string {
  return `${generateThemeCss(config)}

${BASE_CSS}`;
}

const BASE_CSS = `
* { box-sizing: border-box; margin: 0; }
[hidden] { display: none !important; }
html, body { height: 100%; width: 100%; overflow: hidden; }
body {
  background: var(--bg-raise); color: var(--ink);
  font: 14px/1.45 -apple-system, system-ui, "Segoe UI", sans-serif;
  overflow: hidden;
  display: flex;
  padding: var(--shell-padding, 16px);
  box-sizing: border-box;
  user-select: none; -webkit-user-select: none;
  position: relative;
  transition: background .2s ease, padding .25s ease;
}
:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
/* shadcn focus ring: soft 3px halo on HTML controls (SVG keeps the outline) */
button:focus-visible, input:focus-visible, a:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 35%, transparent);
}

/* shadcn Kbd: muted chip, h-5, sans, min-w-5 — one style for every shortcut hint */
kbd {
  display: inline-flex; align-items: center; justify-content: center;
  height: 20px; min-width: 20px; padding: 0 5px; border-radius: 4px;
  background: var(--bg-raise); color: var(--ink-dim);
  font: 500 12px -apple-system, system-ui, "Segoe UI", sans-serif;
}

/* thin themed scrollbars (shadcn ScrollArea feel) */
* { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }

/* ── shell root & island: Fumadocs Spacious Master Island Architecture ── */
:root {
  --shell-padding: 16px;
  --card-radius: 16px;
  --radius-sm: 6px; --radius: 8px; --radius-lg: 12px;
  --topbar-height: 52px;
  --statusbar-height: 28px;
  --inspector-w: 360px;
  --sidebar-w: 260px;
  --sidebar-width: 260px;
  --mobile-nav-height: 52px;
  --frame-top: 52px; --frame-x: 20px; --frame-bottom: 20px; --frame-left: 20px;
}

/* Master Island Card: Encompasses Sidebar + Main Column */
#marrow-chrome {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--card-radius);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  transition: border-radius .25s ease, border .25s ease, box-shadow .25s ease;
}

/* Main Column: Header + Stage Body */
.m-main-column {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Stage Body: Flex row containing the stage canvas wrapper and docked TOC inspector */
.m-stage-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  position: relative;
  overflow: hidden;
}

/* Stage Wrap: Houses the canvas viewport, watermark, controls, minimap */
.m-stage-wrap {
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* Interactive Topology Stage Canvas */
.m-stage {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: grab;
  background: var(--bg);
  border: none;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.m-stage.m-grabbing { cursor: grabbing; }
.m-svg { width: 100%; height: 100%; display: block; touch-action: none; }
.m-canvas { width: 100%; height: 100%; display: block; touch-action: none; }
.m-sprite { position: absolute; width: 0; height: 0; overflow: hidden; }
.m-grid-dot { fill: var(--grid-dot); }
.m-grid { pointer-events: none; }

/* ── zones ── */
.m-zone-panel {
  fill: color-mix(in srgb, var(--m-zone-accent, var(--zone)) 9%, transparent);
  stroke: color-mix(in srgb, var(--m-zone-accent, var(--zone)) 42%, transparent);
  stroke-width: 1.2;
}
.m-zone-label {
  fill: color-mix(in srgb, var(--m-zone-accent, var(--zone)) 88%, var(--ink));
  font-size: 12px; font-weight: 600; letter-spacing: .1em;
  /* bg halo: the title layer sits above edges, so a crossing link is
     knocked out cleanly instead of slicing through the letters */
  paint-order: stroke; stroke: var(--bg); stroke-width: 3.5px; stroke-linejoin: round;
}

/* ── the visual language: edges, nodes, chips, state rules — generated by
      @marrow/visual from the same rule list the canvas tier folds ── */
${visualCss()}

/* focus mode: zones recede too (node/edge dimming is in the visual language above) */
.m-zone, .m-zone-titles { transition: opacity .25s; }
.focus-mode .m-zone { opacity: .35; }

/* ── entrance choreography ── */
.m-enter-zone { animation: mZoneIn .5s ease-out both; }
.m-enter-node {
  animation: mNodeIn .42s cubic-bezier(.22,.7,.28,1) both;
  animation-delay: var(--d, 0s);
  transform-box: fill-box; transform-origin: center;
}
/* edge draw-in and flow live in the visual language (px dashes, no reset needed) */
@keyframes mZoneIn { from { opacity: 0; } }
@keyframes mNodeIn { from { opacity: 0; transform: scale(.96) translateY(4px); } }
.settled .m-enter-zone, .settled .m-enter-node { animation: none; }

/* ── unified command bar: 48px desktop / 44px mobile ── */
.m-command-bar {
  height: var(--topbar-height);
  background: var(--panel);
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px;
  z-index: 20;
  flex-shrink: 0;
}
.m-header-left, .m-header-right {
  display: flex; align-items: center; gap: 10px;
}
.m-brand-mark {
  display: flex; align-items: center; gap: 8px;
  font-weight: 700; font-size: 13.5px; letter-spacing: -.01em;
  color: var(--ink); flex-shrink: 0;
}
.m-header-sep {
  color: var(--ink-faint); font-size: 13px; font-weight: 400;
  margin: 0 1px; user-select: none; flex-shrink: 0;
}
.m-icon-btn {
  background: transparent; border: 1px solid var(--line);
  color: var(--ink-dim); height: 32px; padding: 0 8px;
  border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12px; cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.m-icon-btn:hover {
  background: var(--bg-raise); color: var(--ink); border-color: var(--line-strong);
}
.m-sidebar-btn, .m-theme-btn {
  width: 32px; height: 32px; padding: 0;
}
.m-mob-only { display: none !important; }

/* ── theme toggle pill: Fumadocs / Shadcn dual Sun & Moon capsule ── */
.m-theme-pill, .m-theme-btn.m-desk-only {
  width: auto !important;
  height: 28px !important;
  padding: 2px !important;
  border-radius: 9999px !important;
  background: var(--bg-raise);
  border: 1px solid var(--line);
  display: inline-flex !important;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.m-theme-pill:hover, .m-theme-btn.m-desk-only:hover {
  background: var(--bg-raise);
  border-color: var(--line-strong);
}
.m-theme-opt {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--ink-dim);
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
  flex-shrink: 0;
}
.m-theme-opt svg {
  display: block;
}

/* Light Mode active */
html:not([data-theme="dark"]) .m-theme-sun {
  background: var(--panel);
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}
html:not([data-theme="dark"]) .m-theme-moon {
  background: transparent;
  color: var(--ink-dim);
}
html:not([data-theme="dark"]) .m-theme-pill:hover .m-theme-moon,
html:not([data-theme="dark"]) .m-theme-btn.m-desk-only:hover .m-theme-moon {
  color: var(--ink);
}

/* Dark Mode active */
html[data-theme="dark"] .m-theme-moon {
  background: var(--line-strong);
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
html[data-theme="dark"] .m-theme-sun {
  background: transparent;
  color: var(--ink-dim);
}
html[data-theme="dark"] .m-theme-pill:hover .m-theme-sun,
html[data-theme="dark"] .m-theme-btn.m-desk-only:hover .m-theme-sun {
  color: var(--ink);
}

/* ── breadcrumbs: integrated into the command bar ── */
.m-breadcrumbs {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 400; white-space: nowrap;
  min-width: 0; overflow: hidden;
}
.m-breadcrumbs a { color: var(--ink-dim); text-decoration: none; transition: color .15s; font-weight: 500; }
.m-breadcrumbs a:hover { color: var(--ink); }
.m-breadcrumbs .m-crumb-here {
  color: var(--ink-dim); font-weight: 400;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.m-breadcrumbs .m-crumb-sep { display: grid; place-items: center; color: var(--ink-faint); }
.m-crumb-sep svg { width: 14px; height: 14px; }

/* ── watermark: sits inside the viewport, clipped at its edges ── */
.m-watermark {
  position: absolute; left: 16px; bottom: 16px; z-index: 4;
  pointer-events: none; user-select: none; line-height: .88;
  max-width: calc(100vw - 32px); overflow: hidden;
}
.m-watermark span {
  display: block; white-space: nowrap;
  font-size: clamp(40px, 7.5vw, 108px); font-weight: 800; letter-spacing: -.01em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 4%, transparent);
}
.m-watermark small {
  display: block; margin: 8px 0 6px 4px;
  font-size: 11px; font-weight: 600; letter-spacing: .25em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 11%, transparent);
}
.m-watermark[data-mode="off"] { display: none; }
.m-watermark[data-mode="subtle"] span {
  color: color-mix(in srgb, var(--ink) 2%, transparent);
}
.m-watermark[data-mode="minimal"],
.m-watermark[data-mode="blueprint"] {
  bottom: 12px; line-height: 1.4;
}
.m-watermark[data-mode="minimal"] span,
.m-watermark[data-mode="blueprint"] span {
  display: inline-block; font-size: 11.5px; font-weight: 600; letter-spacing: .08em;
  font-family: var(--font-mono, monospace);
  color: color-mix(in srgb, var(--ink) 26%, transparent);
}
.m-watermark[data-mode="minimal"] small,
.m-watermark[data-mode="blueprint"] small {
  display: inline-block; margin: 0 0 0 8px; font-size: 10.5px; font-weight: 400; letter-spacing: .05em;
  font-family: var(--font-mono, monospace);
  color: color-mix(in srgb, var(--ink) 18%, transparent);
}
.m-watermark[data-font="mono"] span,
.m-watermark[data-font="mono"] small {
  font-family: var(--font-mono, monospace);
}
.m-watermark[data-casing="sentence"] span,
.m-watermark[data-casing="sentence"] small {
  text-transform: capitalize;
}
.m-watermark[data-casing="as-is"] span,
.m-watermark[data-casing="as-is"] small {
  text-transform: none;
}

/* ── backdrop: author-branded margin around the boxed viewport ── */
.m-backdrop { position: fixed; inset: 0; z-index: 0; pointer-events: none; user-select: none; }
.m-backdrop-text {
  position: absolute; top: 0; right: 24px; height: var(--topbar-height);
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 38%, transparent);
}
.m-backdrop-text svg { flex: none; }
.m-backdrop-note {
  position: absolute; bottom: 0; left: 0; right: 0; height: var(--statusbar-height);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 26%, transparent);
}

/* ── sidebar: left site navigation inside master island ── */
.m-sidebar {
  width: var(--sidebar-width); height: 100%;
  background: var(--panel); border-right: 1px solid var(--line);
  display: flex; flex-direction: column; z-index: 25; flex-shrink: 0;
  position: relative; overflow: hidden;
  transition: width .25s cubic-bezier(0.16, 1, 0.3, 1), opacity .2s ease;
}
.m-sidebar.is-collapsed {
  width: 0 !important;
  border-right: none !important;
  opacity: 0;
  pointer-events: none;
}
.m-sidebar.open {
  width: var(--sidebar-width) !important;
  opacity: 1;
  pointer-events: auto;
}
.m-sidebar-close { border: none; padding: 4px; }

/* icon-strip internals: logo only in the header, square icon rows with
   flyout labels, non-nav groups collapsed away */
.m-sidebar:not(.open) .m-sidebar-inner { overflow: visible; }
/* strip mode: the proprietary logo anchors the BOTTOM of the strip (shadcn
   footer position); nav icons start right under the trigger chip */
.m-sidebar.m-nav:not(.open) .m-side-header { padding: 8px; justify-content: center; order: 99; margin-top: auto; }
.m-sidebar:not(.open) .m-side-id { display: none; }
.m-sidebar:not(.open) h4 { display: none; }
.m-sidebar:not(.open) section:not(:has(a.m-side-row)) { display: none; }
.m-sidebar:not(.open) .m-side-static { display: none; }
.m-sidebar:not(.open) .m-side-row { width: 32px; height: 32px; padding: 8px; justify-content: center; position: relative; }
.m-sidebar:not(.open) .m-side-row em { display: none; }
.m-sidebar:not(.open) .m-side-row > span {
  position: absolute; left: 100%; top: 50%;
  transform: translateY(-50%) translateX(-6px);
  margin-left: 12px; padding: 5px 10px; overflow: visible;
  background: var(--ink); color: var(--bg);
  font-size: 11px; font-weight: 500; white-space: nowrap;
  border-radius: var(--radius-sm); box-shadow: var(--shadow-sm);
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity .15s, transform .15s, visibility .15s;
  z-index: 40;
}
.m-sidebar:not(.open) .m-side-row:hover > span { opacity: 1; visibility: visible; transform: translateY(-50%) translateX(0); }
.m-sidebar-inner {
  height: 100%; overflow-y: auto;
  background: var(--sidebar); color: var(--sidebar-fg);
  border-right: 1px solid var(--sidebar-border);
  display: flex; flex-direction: column;
}
/* SidebarHeader / SidebarGroup / SidebarFooter: each a p-2 block */
.m-sidebar-inner section { padding: 8px; }
/* SidebarFooter: last section pins to the bottom */
.m-sidebar-inner section:last-of-type { margin-top: auto; }
/* company brand footer (backdrop.text; Marrow by default) */
.m-side-foot {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px; flex: none;
  border-top: 1px solid var(--sidebar-border); margin-top: 2px;
  font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase;
  color: color-mix(in srgb, var(--sidebar-fg) 45%, transparent);
}
.m-side-foot svg { flex: none; width: 14px; height: 14px; }
.m-sidebar:not(.open) .m-side-foot { display: none; }
/* ── global company logo (brand/brand.html) ──────────────────────────────────
   Author-supplied markup of unknown size: clamp it everywhere it appears so a
   large SVG/bitmap can never blow out the chrome. */
/* the brand mark as a hyperlink (brand.link): inherits the footer's type, only
   the hover underline marks it as clickable */
.m-brand-link {
  display: inline-flex; align-items: center; gap: 8px; min-width: 0;
  color: inherit; text-decoration: none; font: inherit; letter-spacing: inherit;
}
.m-brand-link:hover { text-decoration: underline; text-underline-offset: 2px; }
/* the source/repo mark sits at the far end of the footer row */
.m-brand-gh {
  margin-left: auto; flex: none; display: inline-flex; color: inherit; opacity: .65;
  transition: opacity .15s;
}
.m-brand-gh:hover { opacity: 1; }
.m-brand-gh svg { width: 14px; height: 14px; }
.m-brand-logo { display: inline-flex; align-items: center; flex: none; }
.m-brand-logo svg, .m-brand-logo img { display: block; width: auto; object-fit: contain; }
.m-brand-mark .m-brand-logo svg, .m-brand-mark .m-brand-logo img {
  height: 18px; max-width: 120px;
}
.m-side-foot .m-brand-logo svg, .m-side-foot .m-brand-logo img,
.m-drawer-foot .m-brand-logo svg, .m-drawer-foot .m-brand-logo img {
  height: 14px; max-width: 80px;
}
.m-backdrop-text .m-brand-logo svg, .m-backdrop-text .m-brand-logo img { height: 16px; max-width: 140px; }
/* shadcn Menubar: compact trigger row styled matching inspector tabs (TabsList + TabsTrigger) */
.m-menubar {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 10px 14px 8px;
  padding: 3px;
  background: var(--bg-raise);
  border: 1px solid var(--line);
  border-radius: var(--radius-md, 8px);
  flex-shrink: 0;
}
.m-menubar button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--ink-dim);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: calc(var(--radius-md, 8px) - 2px);
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}
.m-menubar button:hover {
  color: var(--ink);
}
.m-menubar button:focus-visible {
  outline: 2px solid var(--ring, var(--ink));
  outline-offset: 1px;
}
.m-menubar button.active,
.m-menubar button.is-active,
.m-menubar button.open {
  background: var(--panel);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--line);
}
.m-sidebar:not(.open) .m-menubar { display: none; }

/* SidebarGroupLabel: h-8 px-2 text-xs font-medium fg/70 — no uppercase */
.m-sidebar h4 {
  display: flex; align-items: center; height: 32px; padding: 0 8px; margin: 0;
  font-size: 12px; font-weight: 500; letter-spacing: 0; text-transform: none;
  color: color-mix(in srgb, var(--sidebar-fg) 70%, transparent);
}
.m-field { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0 8px 8px; font-size: 13px; }
.m-field > span { color: var(--ink-dim); }
.m-seg {
  display: inline-flex; gap: 2px; padding: 2px;
  background: var(--bg-raise); border-radius: var(--radius);
}
.m-seg button {
  border: 0; background: none; color: var(--ink-dim); font: inherit; font-size: 12px; font-weight: 500;
  padding: 3px 9px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s;
}
.m-seg button.active { background: var(--panel); color: var(--ink); box-shadow: var(--shadow-sm); }
.m-legend { list-style: none; padding: 0 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px 8px; font-size: 12px; color: var(--ink-dim); }
.m-legend li { display: flex; align-items: center; gap: 7px; }
.m-legend li:nth-last-child(-n+2) { grid-column: span 2; }
.m-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
.m-line { width: 18px; border-top: 2px solid var(--edge); display: inline-block; flex: none; }
.m-line-dash { border-top-style: dashed; }
/* SidebarHeader card + SidebarMenuButton rows: [icon] label ······ badge */
.m-side-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 12px 14px; border-bottom: 1px solid var(--line);
  background: var(--panel); gap: 10px; flex-shrink: 0;
}
.m-side-id {
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;
}
.m-side-id strong, .m-side-title {
  display: block; font-size: 11px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--ink-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.m-side-id small, .m-side-stats {
  display: block; font-size: 12px; font-weight: 500;
  color: var(--ink); line-height: 1.4;
  white-space: normal; overflow: visible;
}
.m-sidebar-close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid transparent; color: var(--ink-dim);
  cursor: pointer; padding: 0; flex-shrink: 0; margin-left: auto;
  transition: all .15s;
}
.m-sidebar-close:hover {
  background: var(--bg-raise); color: var(--ink); border-color: var(--line);
}
.m-side-nav { display: flex; flex-direction: column; gap: 1px; }
/* SidebarMenuButton: h-8 gap-2 rounded-md p-2 text-sm; icons size-4 */
.m-side-row {
  display: flex; align-items: center; gap: 8px; height: 34px;
  color: var(--sidebar-fg); text-decoration: none; font-size: 14px; font-weight: 400;
  padding: 0 10px; border-radius: 12px; transition: background .15s, color .15s;
}
.m-side-row i { display: grid; place-items: center; color: color-mix(in srgb, var(--sidebar-fg) 65%, transparent); flex: none; }
.m-side-row span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* SidebarMenuBadge */
.m-side-row em { margin-left: auto; font-style: normal; font-size: 12px; font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--sidebar-fg) 55%, transparent); font-weight: 500; }
a.m-side-row:hover { background: var(--sidebar-accent); }
/* data-[active=true]: accent bg + font-medium */
a.m-side-row.active { background: var(--sidebar-accent); font-weight: 500; }
a.m-side-row.active i, a.m-side-row.active em { color: var(--sidebar-fg); }
/* collapsible nav groups: shadcn SidebarMenuSub — indent rail + chevron */
.m-side-group-head { width: 100%; background: none; border: 0; cursor: pointer; }
.m-side-group-head:hover { background: var(--sidebar-accent); }
.m-side-group-head .m-chev {
  flex: none; display: grid; place-items: center; margin-left: 2px;
  color: color-mix(in srgb, var(--sidebar-fg) 55%, transparent);
  rotate: 90deg; transition: rotate .2s;
}
.m-side-group.collapsed .m-side-group-head .m-chev { rotate: 0deg; }
.m-sidebar.open .m-side-sub {
  margin-left: 15px; border-left: 1px solid var(--sidebar-border); padding-left: 6px;
}
.m-sidebar.open .m-side-group.collapsed .m-side-sub { display: none; }
/* icon strip: a group is ONE icon (its head); members stay tucked away.
   Clicking the head expands the sidebar with that group open. */
.m-sidebar:not(.open) .m-side-sub { display: none; }
.m-sidebar:not(.open) .m-chev { display: none; }
.m-sidebar:not(.open) .m-side-group-head { width: 32px; height: 32px; padding: 8px; justify-content: center; position: relative; }
.m-side-static { cursor: default; }
.m-side-static span { color: color-mix(in srgb, var(--sidebar-fg) 65%, transparent); font-weight: 400; }
.m-side-static em { color: var(--sidebar-fg); font-weight: 500; }

/* view settings applied via root data attributes */
:root[data-labels="off"] .m-label { opacity: 0 !important; }
:root[data-labels="on"] .m-label { opacity: 1 !important; }

/* ── port label chips (LOD: hidden at far zoom, near zoom, or forced via setting) ── */
.m-portlabel { opacity: 0; transition: opacity .25s; pointer-events: none; cursor: pointer; }
:root[data-zoom="near"] .m-portlabel { opacity: 1; pointer-events: auto; }
:root[data-zoom="mid"][data-ports="on"] .m-portlabel { opacity: 0.9; pointer-events: auto; }
:root[data-zoom="far"] .m-portlabel:not(.is-hot) { opacity: 0 !important; pointer-events: none !important; }
:root[data-ports="off"] .m-portlabel:not(.is-hot) { opacity: 0 !important; pointer-events: none !important; }
/* hovering/focusing an edge or device reveals its chips regardless of the zoom/toggle */
.m-portlabel.is-hot { opacity: 1 !important; pointer-events: auto !important; }
.m-portlabel rect { fill: var(--bg); stroke: var(--line-strong); stroke-width: 1; rx: 9px; }
.m-portlabel text { fill: var(--ink); font: 500 9px ui-monospace, monospace; }
.m-portlabel.is-hot rect { stroke: var(--m-accent); }
/* "+N": stands for ports that had no room — full list lives in the inspector */
.m-portsum text { fill: var(--ink); font-weight: 700; }
.m-btn {
  background: none; border: 1px solid var(--line); color: var(--ink);
  border-radius: var(--radius); padding: 5px 11px; font: inherit; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: background .15s, border-color .15s;
}
.m-btn:hover { background: var(--bg-raise); border-color: var(--line-strong); }
.m-btn:active { background: color-mix(in srgb, var(--ink) 10%, transparent); }

/* ── minimap ── */
.m-minimap {
  position: fixed;
  right: calc(var(--frame-x, 0px) + 58px);
  bottom: calc(var(--frame-bottom, 0px) + 12px);
  z-index: 20;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg, 10px);
  padding: 5px;
  box-shadow: var(--shadow);
  transition: right .25s ease, border-color .15s;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.m-minimap:hover { border-color: var(--line-strong); }
.m-minimap > svg {
  display: block;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.m-mini-toggle {
  position: absolute; top: 4px; right: 4px; z-index: 1;
  width: 20px; height: 20px; display: grid; place-items: center;
  background: var(--panel);
  border: 1px solid var(--line); border-radius: var(--radius-sm); color: var(--ink-dim);
  cursor: pointer; padding: 0; opacity: 0;
  transition: opacity .15s, background .15s, color .15s;
}
.m-mini-toggle svg { width: 14px; height: 14px; display: block; }
.m-minimap:hover .m-mini-toggle { opacity: 1; }
.m-mini-toggle:hover { background: var(--bg-raise); color: var(--ink); }
/* collapsed: an icon card matching the zoom controls */
.m-minimap.collapsed { padding: 4px; border-radius: var(--radius); }
.m-minimap.collapsed > svg { display: none; }
.m-minimap.collapsed .m-mini-toggle {
  position: static; opacity: 1;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  background: none; border: 1px solid transparent; color: var(--ink-dim);
  display: grid; place-items: center;
}
.m-minimap.collapsed .m-mini-toggle svg { width: 16px; height: 16px; display: block; }
.m-minimap.collapsed .m-mini-toggle:hover { background: var(--bg-raise); border-color: var(--line); color: var(--ink); }
.m-mini-world { fill: color-mix(in srgb, var(--ink) 5%, transparent); stroke: color-mix(in srgb, var(--line) 70%, transparent); stroke-width: 1; }
.m-mini-zone {
  fill: color-mix(in srgb, var(--m-zone-accent, var(--zone)) 20%, transparent);
  stroke: color-mix(in srgb, var(--m-zone-accent, var(--zone)) 55%, transparent);
  stroke-width: 1;
}
.m-mini-dot { fill: var(--ink-dim); }
.m-mini-dot.m-status-up { fill: color-mix(in srgb, var(--up) 80%, var(--ink-dim)); }
.m-mini-dot.m-status-down { fill: var(--down); }
.m-mini-dot.m-status-degraded { fill: var(--degraded); }
.m-mini-dot.m-status-planned { fill: var(--planned); }
.m-mini-view {
  fill: color-mix(in srgb, var(--m-accent) 13%, transparent);
  stroke: var(--m-accent);
  stroke-width: 1.3;
  cursor: grab;
  touch-action: none;
  pointer-events: all;
}
/* the view shows the whole diagram: a quiet accent outline, and a click
   anywhere pans to that point rather than grabbing the outline */
.m-mini-view.m-mini-whole {
  fill: none;
  stroke-opacity: .5;
  cursor: crosshair;
}
.m-minimap.m-dragging,
.m-minimap.m-dragging > svg,
.m-minimap.m-dragging .m-mini-view {
  cursor: grabbing !important;
}

/* ── inspector: Fumadocs TOC Inspector docked inside Master Island ── */
.m-inspector {
  width: var(--inspector-w, 360px);
  max-width: 100%;
  height: 100%;
  background: var(--panel);
  border-left: 1px solid var(--line);
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
  box-shadow: none;
  z-index: 25;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
  transition: width .25s cubic-bezier(0.16, 1, 0.3, 1), opacity .2s ease;
}
.m-inspector[hidden] {
  display: none !important;
}
@keyframes mSlideIn { from { transform: translateX(100%); } }
.m-sheet-drag-handle { display: none; }
.m-inspector-head {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  flex: none;
}
.m-inspector-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.m-inspector-title { font-size: 14px; font-weight: 600; font-family: ui-monospace, monospace; letter-spacing: -.01em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-inspector-desc { font-size: 12px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-inspector-desc:empty { display: none; }
.m-inspector-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm, 8px); background: transparent; border: 0;
  color: var(--ink-dim); cursor: pointer; display: grid; place-items: center;
  transition: background .15s, color .15s; flex-shrink: 0;
}
.m-inspector-close:hover { background: var(--bg-raise); color: var(--ink); }

/* ── inspector schema tabs: shadcn TabsList + TabsTrigger ── */
.m-inspector-tabs {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 12px 16px 8px;
  padding: 3px;
  background: var(--bg-raise);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow-x: auto;
  flex-shrink: 0;
  scrollbar-width: none;
}
.m-inspector-tabs::-webkit-scrollbar {
  display: none;
}
.m-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--ink-dim);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 11px;
  border-radius: 7px;
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}
.m-tab-btn:hover {
  color: var(--ink);
}
.m-tab-btn:focus-visible {
  outline: 2px solid var(--ring, var(--ink));
  outline-offset: 1px;
}
.m-tab-btn.active,
.m-tab-btn.is-active {
  background: var(--panel);
  color: var(--ink);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--line);
}
.m-inspector-pane { display: flex; flex-direction: column; gap: 14px; }
.m-inspector-pane[hidden] { display: none !important; }

/* ── zoom controls: joined vertical dock in stage wrap ── */
.m-controls {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg, 10px);
  box-shadow: var(--shadow);
  transition: right .25s ease, bottom .25s ease;
}
.m-controls .m-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 6px);
  display: grid;
  place-items: center;
  background: none;
  box-shadow: none;
  color: var(--ink-dim);
  cursor: pointer;
  transition: background .15s, border-color .15s, color .15s;
}
.m-controls .m-btn:hover {
  background: var(--bg-raise);
  border-color: var(--line);
  color: var(--ink);
}
.m-controls .m-btn:active {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.m-ctl-sep {
  height: 1px;
  background: var(--line);
  margin: 2px 4px;
}



/* ── Tablet overrides (768px - 1024px) ── */
@media (max-width: 1024px) and (min-width: 768px) {
  :root {
    --shell-padding: 8px;
    --card-radius: 12px;
  }
  .m-sidebar {
    position: fixed;
    top: 0; bottom: 0; left: 0;
    width: 280px; max-width: 85vw;
    background: var(--panel);
    border-right: 1px solid var(--line);
    box-shadow: var(--shadow);
    z-index: 60;
    transform: translateX(-100%);
    margin-left: 0 !important;
    transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .m-sidebar.open {
    transform: translateX(0);
    width: 280px !important;
  }
  .m-sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    z-index: 55;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  body:has(.m-sidebar.open) .m-sidebar-backdrop,
  .m-sidebar.open + .m-sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
  }
  .m-inspector {
    position: relative;
    width: var(--inspector-w, 360px) !important;
    max-width: 45vw;
    flex: 0 0 var(--inspector-w, 360px);
    height: 100%;
    border-left: 1px solid var(--line);
    border-top: none;
    box-shadow: none;
    z-index: 25;
  }
}

/* ── Mobile / Phone Layout: Pure Flux (< 768px) ── */
@media (max-width: 767px) {
  :root {
    --shell-padding: 0px !important;
    --card-radius: 0px !important;
    --topbar-height: 0px !important;
    --mobile-nav-height: 52px !important;
  }

  body {
    padding: 0 !important;
    margin: 0 !important;
  }

  #marrow-chrome {
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  /* Single Control Hub on Mobile: Top header is 100% hidden */
  .m-command-bar {
    display: none !important;
  }

  .m-desk-only { display: none !important; }
  .m-mob-only { display: inline-flex !important; }
  .m-minimap { display: none !important; }

  /* Flexible Stage Layout on Mobile: Flex column where inspector shrinks canvas */
  .m-stage-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .m-stage-wrap {
    flex: 1;
    min-height: 0;
    width: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Mobile Tap Target Optimization: Minimum 44x44px per touch target criteria */
  .m-controls {
    right: 12px;
    bottom: 16px;
  }
  .m-controls .m-btn {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
  }
  .m-controls .m-btn svg {
    width: 20px;
    height: 20px;
  }
  .m-inspector-close {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
    display: grid !important;
    place-items: center !important;
  }
  .m-inspector-close svg {
    width: 20px;
    height: 20px;
  }
  .m-sidebar-close {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
    display: grid !important;
    place-items: center !important;
  }
  .m-sidebar-close svg {
    width: 20px;
    height: 20px;
  }
  .m-inspector-tabs .m-tab-btn {
    min-height: 38px;
    padding: 8px 14px;
    font-size: 13px;
  }
  .m-menubar {
    margin: 8px 12px 10px;
    padding: 3px;
  }
  .m-menubar button {
    padding: 8px 12px;
    min-height: 36px;
    font-size: 13px;
  }
  .m-ctxmenu {
    z-index: 75 !important;
    max-width: calc(100vw - 24px);
    box-shadow: 0 10px 38px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--line);
  }
  .m-ctx-item {
    min-height: 38px;
    font-size: 13px;
    padding: 0 12px 0 8px;
  }

  /* Drawer for Mobile Navigation */
  .m-sidebar {
    position: fixed;
    top: 0; bottom: 0; left: 0;
    width: 280px; max-width: 85vw;
    background: var(--panel);
    border-right: 1px solid var(--line);
    box-shadow: var(--shadow);
    z-index: 60;
    transform: translateX(-100%);
    margin-left: 0 !important;
    transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .m-sidebar.open {
    transform: translateX(0);
    width: 280px !important;
  }
  .m-sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    z-index: 55;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  body:has(.m-sidebar.open) .m-sidebar-backdrop,
  .m-sidebar.open + .m-sidebar-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  /* Flexible Dedicated Space Bottom Sheet for Inspector: physically shrinks stage-wrap */
  .m-inspector {
    position: relative;
    flex: 0 0 auto;
    width: 100% !important;
    border-left: none;
    border-top: 1px solid var(--line);
    border-radius: 16px 16px 0 0;
    background: var(--panel);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.25);
    z-index: 25;
    margin-right: 0 !important;
    transform: none !important;
    transition: height .3s cubic-bezier(0.16, 1, 0.3, 1), opacity .2s ease;
  }
  .m-sheet-drag-handle {
    display: block; width: 36px; height: 4px;
    background: var(--line-strong); border-radius: 999px;
    margin: 8px auto 4px; cursor: pointer; flex-shrink: 0;
  }
  .m-inspector[hidden],
  .m-inspector[data-sheet="closed"],
  .m-inspector[data-sheet-snap="closed"] {
    display: none !important;
    height: 0 !important;
  }
  .m-inspector[data-sheet-snap="peek"], .m-inspector[data-sheet="peek"] { height: 84px !important; overflow: hidden; }
  .m-inspector[data-sheet-snap="half"], .m-inspector[data-sheet="half"] { height: 42vh !important; max-height: 48vh; }
  .m-inspector[data-sheet-snap="full"], .m-inspector[data-sheet="full"] { height: 72vh !important; max-height: 80vh; }

  /* Single Mobile Bottom Nav Bar (Flux) */
  .m-mobile-bar {
    display: flex !important;
    height: 52px;
    background: var(--panel);
    border-top: 1px solid var(--line);
    padding: 0 12px;
    align-items: center;
    justify-content: space-between;
    z-index: 50;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .m-mob-left {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    min-width: 0;
  }
  .m-mob-brand {
    white-space: nowrap;
  }
  .m-mob-selector-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: var(--radius-sm, 6px);
    background: var(--bg-raise);
    border: 1px solid var(--line);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink);
    cursor: pointer;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .m-mob-caret {
    font-size: 8px;
    color: var(--ink-dim);
    flex-shrink: 0;
  }
  .m-mob-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .m-mob-right .m-icon-btn {
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
    display: grid !important;
    place-items: center !important;
  }
  .m-mob-right .m-icon-btn svg {
    width: 20px;
    height: 20px;
  }
}

.m-mobile-bar {
  display: none;
}
.m-inspector-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm); background: none; border: 0;
  color: var(--ink-dim); cursor: pointer; display: grid; place-items: center;
  transition: background .15s, color .15s;
}
.m-inspector-close:hover { background: var(--bg-raise); color: var(--ink); }
.m-inspector-body { overflow-y: auto; padding: 14px 16px 24px; flex: 1; display: flex; flex-direction: column; gap: 14px; }
/* company brand footer on the drawer (backdrop.text; Marrow by default) */
.m-drawer-foot {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; flex: none;
  border-top: 1px solid var(--line);
  font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 45%, transparent);
}
.m-drawer-foot svg { flex: none; width: 14px; height: 14px; }
.m-inspector-body h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600; color: var(--ink-dim); margin: 16px 0 8px; }
.m-inspector-section {
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-raise) 25%, transparent);
  overflow: hidden;
}
.m-inspector-section summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  background: transparent;
  transition: background .15s ease;
}
.m-inspector-section summary:hover {
  background: var(--bg-raise);
}
.m-inspector-section summary::-webkit-details-marker {
  display: none;
}
.m-inspector-section summary h3 {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .06em;
  font-weight: 600;
  color: var(--ink-dim);
}
.m-section-chevron {
  color: var(--ink-dim);
  transition: transform .2s cubic-bezier(0.16, 1, 0.3, 1);
}
.m-inspector-section[open] .m-section-chevron {
  transform: rotate(180deg);
}
.m-section-body {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--line);
  background: var(--panel);
}
.m-table-wrap {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--panel);
}
.m-inspector-body .m-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.m-inspector-body .m-table th {
  background: var(--bg-raise);
  color: var(--ink-dim);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
}
.m-inspector-body .m-table td {
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent);
  color: var(--ink);
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.m-inspector-body .m-table tr:hover td {
  background: color-mix(in srgb, var(--bg-raise) 45%, transparent);
}
.m-inspector-body .m-table tr:last-child td {
  border-bottom: none;
}
.m-icon-badge { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
/* direct child only — the "Open page" link's arrow must not inherit this */
.m-icon-badge > svg { width: 42px; height: 42px; background: var(--bg-raise); border: 1px solid var(--line); border-radius: 10px; padding: 6px; flex-shrink: 0; }
.m-status-pill {
  font-size: 11px; font-weight: 500; text-transform: capitalize; padding: 2px 9px; border-radius: 999px;
  background: var(--bg-raise); color: var(--ink-dim);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.m-status-pill.m-status-up { background: color-mix(in srgb, var(--up) 14%, transparent); color: var(--up); }
.m-status-pill.m-status-down { background: color-mix(in srgb, var(--down) 15%, transparent); color: var(--down); }
.m-status-pill.m-status-degraded { background: color-mix(in srgb, var(--degraded) 15%, transparent); color: var(--degraded); }
.m-facts {
  display: grid; grid-template-columns: 88px 1fr; gap: 8px 12px; font-size: 12px; margin: 4px 0 8px;
  border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--bg-raise) 30%, transparent); padding: 10px 14px;
}
.m-facts dt { color: var(--ink-dim); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; align-self: center; }
.m-facts dd { overflow-wrap: anywhere; align-self: center; color: var(--ink); font-family: ui-monospace, monospace; }

/* ── Visual badges & detail panel presentation ── */
.m-quick-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 10px 0 14px;
}
.m-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border-radius: 999px;
  font: 600 11px/1 ui-monospace, monospace;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
}
.m-status-badge .m-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.m-status-badge.m-status-up {
  background: color-mix(in srgb, var(--up) 14%, transparent);
  color: var(--up);
  border-color: color-mix(in srgb, var(--up) 35%, transparent);
}
.m-status-badge.m-status-up .m-status-dot {
  background: var(--up);
  box-shadow: 0 0 6px var(--up);
}
.m-status-badge.m-status-down {
  background: color-mix(in srgb, var(--down) 14%, transparent);
  color: var(--down);
  border-color: color-mix(in srgb, var(--down) 35%, transparent);
}
.m-status-badge.m-status-down .m-status-dot {
  background: var(--down);
  box-shadow: 0 0 6px var(--down);
}
.m-status-badge.m-status-degraded {
  background: color-mix(in srgb, var(--degraded) 14%, transparent);
  color: var(--degraded);
  border-color: color-mix(in srgb, var(--degraded) 35%, transparent);
}
.m-status-badge.m-status-degraded .m-status-dot {
  background: var(--degraded);
}
.m-status-badge.m-status-planned {
  background: color-mix(in srgb, var(--planned) 14%, transparent);
  color: var(--planned);
  border-color: color-mix(in srgb, var(--planned) 35%, transparent);
}
.m-status-badge.m-status-planned .m-status-dot {
  background: var(--planned);
}
.m-role-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-raise);
  border: 1px solid var(--line-strong);
  font: 600 11px/1.2 -apple-system, system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink);
}
.m-tier-badge, .m-zone-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 7px;
  border-radius: var(--radius-sm, 6px);
  background: color-mix(in srgb, var(--panel) 90%, var(--ink-dim));
  border: 1px solid var(--line);
  font: 500 11px/1.2 -apple-system, system-ui, sans-serif;
  color: var(--ink-dim);
}
.m-ip-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font: 500 12px/1 ui-monospace, monospace;
  padding: 3px 7px;
  border-radius: var(--radius-sm, 6px);
  background: var(--bg-raise);
  border: 1px solid var(--line);
  color: var(--ink);
  user-select: all;
}
.m-ha-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: 500 12px/1 ui-monospace, monospace;
  padding: 3px 7px;
  border-radius: var(--radius-sm, 6px);
  background: color-mix(in srgb, var(--m-accent) 10%, var(--bg-raise));
  border: 1px solid color-mix(in srgb, var(--m-accent) 30%, var(--line));
  color: var(--ink);
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
.m-ha-chip:hover {
  background: color-mix(in srgb, var(--m-accent) 18%, var(--bg-raise));
  border-color: var(--m-accent);
}

/* Search Canvas Real-time Interaction */
.is-search-active .m-node { transition: opacity .2s ease; }
.is-search-active .m-node.is-search-dim { opacity: 0.15 !important; }
.is-search-active .m-node.is-search-match {
  opacity: 1 !important;
  filter: drop-shadow(0 0 10px var(--m-accent));
}
.is-search-active .m-edge { opacity: 0.08 !important; transition: opacity .2s ease; }
.is-search-active .m-zone { opacity: 0.25 !important; transition: opacity .2s ease; }
.m-links { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.m-links button {
  width: 100%; text-align: left; background: color-mix(in srgb, var(--bg-raise) 45%, transparent); border: 1px solid var(--line);
  border-radius: 10px; padding: 10px 12px; color: var(--ink); font: inherit; font-size: 13px;
  cursor: pointer; display: grid; gap: 4px; transition: all .15s ease;
}
.m-links button:hover {
  background: var(--bg-raise);
  border-color: var(--line-strong);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.m-link-other { font-weight: 600; font-family: ui-monospace, monospace; font-size: 13px; color: var(--ink); }
.m-link-ports { color: var(--ink-dim); font-size: 11px; font-family: ui-monospace, monospace; }
.m-link-meta { color: var(--ink-dim); font-size: 11px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
/* a miniature of the link drawn with the SAME edge classes as the canvas, so
   speed (width), status (colour/dash) and flow (animation) all carry over */
.m-swatch { width: 56px; height: 10px; flex: none; overflow: visible; }
/* edge dashes are plain px, so the 56px swatch inherits every width, dash and
   the flow animation from the real edge rules — nothing restated here */
.m-swatch .m-edge { cursor: default; opacity: .95; }
/* the swatch is a legend, not part of the graph — path focus must not dim it */
.focus-mode .m-swatch .m-edge:not(.is-path) { opacity: .95; }
.m-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.m-table th { text-align: left; color: var(--ink-dim); font-weight: 500; padding: 3px 6px; border-bottom: 1px solid var(--line); }
.m-table td { padding: 4px 6px; border-bottom: 1px solid color-mix(in srgb, var(--line) 45%, transparent); }
.m-table tbody tr { transition: background .15s; }
.m-table tbody tr:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.m-note { white-space: pre-wrap; font-size: 13px; color: var(--ink); }
.m-config {
  background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
  padding: 12px 14px; font: 12px/1.6 ui-monospace, monospace; overflow-x: auto; white-space: pre;
  color: var(--ink);
}

/* ── spotlight: shadcn Command dialog (cmdk) — icon'd input row, a muted
      group heading, kbd-hint footer, backdrop blur dimming ── */
.m-spotlight {
  position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 14vh;
}
.m-spotlight-box {
  width: min(560px, 92vw); background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius-lg); box-shadow: var(--shadow); overflow: hidden;
  display: flex; flex-direction: column;
  animation: mPop .15s cubic-bezier(.22,.7,.28,1);
}
@keyframes mPop { from { scale: .98; opacity: 0; } }
.m-spotlight-head {
  display: flex; align-items: center; gap: 10px; padding: 0 16px;
  border-bottom: 1px solid var(--line); color: var(--ink-faint); flex: none;
}
.m-spotlight input {
  flex: 1; background: none; border: 0; outline: none; color: var(--ink);
  font: inherit; font-size: 15px; line-height: 1.4; padding: 13px 0;
}
.m-spotlight input:focus-visible { box-shadow: none; }
.m-spotlight input::placeholder { color: var(--ink-faint); }
.m-spotlight ul { list-style: none; padding: 6px; margin: 0; max-height: 46vh; overflow-y: auto; }
/* CommandItem: [icon] label ···· shortcut/sub */
.m-spotlight li[data-idx] { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; }
.m-spotlight li.active, .m-spotlight li[data-idx]:hover { background: var(--bg-raise); }
/* CommandGroup heading */
.m-spotlight .m-cmd-h { padding: 6px 10px 5px; font-size: 11px; font-weight: 500; color: var(--ink-faint); }
/* CommandSeparator: -mx to bleed to the box edges */
.m-spotlight .m-cmd-s { height: 1px; background: var(--line); margin: 5px -6px; }
.m-spotlight li.m-empty { cursor: default; color: var(--ink-dim); display: flex; justify-content: center; padding: 18px 12px; font-size: 13px; }
.m-cmd-ic { width: 16px; height: 16px; flex: none; display: grid; place-items: center; color: var(--ink-dim); }
.m-cmd-ic svg { width: 16px; height: 16px; }
/* CommandShortcut slot: an ml-auto Kbd chip */
.m-cmd-kbd { margin-left: auto; flex: none; }
.m-hit-name { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-hit-sub { color: var(--ink-dim); font-size: 12px; flex: none; }
.m-spotlight-foot {
  display: flex; gap: 16px; padding: 8px 14px;
  border-top: 1px solid var(--line); flex: none;
  font-size: 11px; color: var(--ink-faint);
}
.m-spotlight-foot span { display: inline-flex; align-items: center; gap: 5px; }
.m-spotlight-foot kbd { height: 18px; font-size: 11px; }

/* ── context menu: shadcn ContextMenuContent — popover panel, h-8 items with
      a check column, right-aligned shortcuts, bleed separators ── */
.m-ctxmenu {
  position: fixed; z-index: 75; min-width: 208px;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 4px;
  animation: mPop .12s cubic-bezier(.22,.7,.28,1);
}
.m-ctx-title { padding: 6px 10px 7px; font-size: 13px; font-weight: 600; }
.m-ctx-title small { display: block; font-weight: 400; font-size: 11.5px; color: var(--ink-dim); margin-top: 1px; }
.m-ctx-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  height: 32px; padding: 0 10px 0 6px; border: 0; border-radius: var(--radius-sm);
  background: none; color: var(--ink); font: inherit; font-size: 13px; text-align: left;
  cursor: pointer; transition: background .1s;
}
.m-ctx-item:hover { background: var(--bg-raise); }
.m-ctx-item:focus-visible { background: var(--bg-raise); box-shadow: none; }
.m-ctx-item.disabled { opacity: .5; cursor: default; }
.m-ctx-check { width: 16px; flex: none; display: grid; place-items: center; color: var(--ink); }
.m-ctx-label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-ctx-kbd { margin-left: auto; flex: none; }
.m-ctx-sep { height: 1px; background: var(--line); margin: 4px -4px; }

/* ── about diagram dialog (shadcn Dialog / CAD blueprint document) ── */
.m-about-dialog {
  position: fixed; inset: 0; z-index: 47; background: rgb(0 0 0 / .6);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 8vh;
}
.m-about-box {
  position: relative; width: min(640px, 94vw); max-height: 84vh; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-lg);
  box-shadow: var(--shadow); overflow: hidden;
  animation: mPop .15s cubic-bezier(.22,.7,.28,1);
}
.m-about-watermark {
  position: absolute; right: 8px; bottom: 44px; z-index: 0; pointer-events: none; user-select: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  opacity: 0.04; color: var(--ink);
}
.m-about-wm-svg {
  width: 220px; height: 220px;
}
.m-about-watermark span {
  font-size: 26px; font-weight: 900; letter-spacing: .25em; margin-top: -12px;
}
.m-about-head {
  position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 20px 24px 16px; border-bottom: 1px solid var(--line); flex: none;
  background: var(--panel);
}
.m-about-title-wrap { flex: 1; min-width: 0; }
.m-about-title { font-size: 18px; font-weight: 700; letter-spacing: -.02em; margin: 0 0 4px; color: var(--ink); }
.m-about-desc { font-size: 13px; color: var(--ink-dim); margin: 0; line-height: 1.45; }
.m-about-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm); background: none; border: 0;
  color: var(--ink-dim); cursor: pointer; display: grid; place-items: center; flex: none;
  transition: background .15s, color .15s;
}
.m-about-close:hover { background: var(--bg-raise); color: var(--ink); }
.m-about-body {
  position: relative; z-index: 1; overflow-y: auto; padding: 18px 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.m-about-meta {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.m-about-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px;
  background: var(--panel); border: 1px solid var(--line); border-radius: 9999px;
  font-size: 12px; color: var(--ink-dim);
}
.m-about-pill strong { color: var(--ink); font-weight: 600; }
.m-about-content {
  font-size: 13.5px; line-height: 1.6; color: var(--ink);
}
.m-about-content h1, .m-about-content h2, .m-about-content h3 {
  margin: 16px 0 8px; font-size: 14px; font-weight: 600; color: var(--ink);
}
.m-about-content p { margin: 0 0 10px; }
.m-about-sections {
  display: flex; flex-direction: column; gap: 12px;
}
.m-about-hint {
  display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
  background: color-mix(in srgb, var(--m-accent) 8%, var(--panel));
  border: 1px dashed color-mix(in srgb, var(--m-accent) 30%, var(--line));
  border-radius: var(--radius); font-size: 12.5px; color: var(--ink-dim); line-height: 1.45;
}
.m-about-hint svg { flex: none; margin-top: 2px; color: var(--m-accent); }
.m-about-hint strong { color: var(--ink); }
.m-about-hint code {
  font-family: var(--font-mono, monospace); font-size: 11.5px; padding: 1px 4px;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-sm);
  color: var(--m-accent);
}
.m-about-foot {
  position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-top: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 92%, var(--line)); flex: none;
}
.m-about-credit {
  display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 12px;
  color: var(--ink-dim);
}
.m-about-credit-link {
  display: inline-flex; align-items: center; gap: 8px; color: var(--ink-dim); text-decoration: none; transition: color .15s;
}
.m-about-credit-link:hover { color: var(--m-accent); }
.m-about-credit-mark { display: inline-flex; align-items: center; color: var(--m-accent); }
.m-about-credit strong { color: var(--ink); font-weight: 600; }
.m-about-credit-gh {
  display: inline-flex; align-items: center; color: var(--ink-dim); opacity: 0.65; transition: opacity .15s, color .15s;
}
.m-about-credit-gh:hover { opacity: 1; color: var(--m-accent); }

/* ── keyboard-shortcuts guide (shadcn Dialog) ── */
.m-shortcuts {
  position: fixed; inset: 0; z-index: 46; background: rgb(0 0 0 / .6);
  display: flex; align-items: flex-start; justify-content: center; padding-top: 11vh;
}
.m-shortcuts-box {
  width: min(460px, 92vw); max-height: 76vh; display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-lg);
  box-shadow: var(--shadow); overflow: hidden;
  animation: mPop .15s cubic-bezier(.22,.7,.28,1);
}
.m-shortcuts-head {
  display: flex; align-items: flex-start; gap: 10px; padding: 16px 16px 12px;
  border-bottom: 1px solid var(--line); flex: none;
}
.m-shortcuts-head > div { flex: 1; }
.m-shortcuts-head strong { font-size: 15px; letter-spacing: -.01em; }
.m-shortcuts-head small { display: block; font-size: 12.5px; color: var(--ink-dim); margin-top: 2px; }
.m-shortcuts-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm); background: none; border: 0;
  color: var(--ink-dim); cursor: pointer; display: grid; place-items: center; flex: none;
  transition: background .15s, color .15s;
}
.m-shortcuts-close:hover { background: var(--bg-raise); color: var(--ink); }
.m-shortcuts-body { overflow-y: auto; padding: 6px 16px 18px; }
.m-shortcuts-body h5 {
  font-size: 11px; font-weight: 500; color: var(--ink-faint); margin: 14px 0 4px;
}
.m-sc-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 5px 0; font-size: 13px;
}
.m-sc-row > span:first-child { color: var(--ink); }
.m-sc-keys { display: inline-flex; gap: 4px; flex: none; }

/* ── tooltip ── */
.m-tooltip {
  position: absolute; z-index: 30; pointer-events: none;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 7px 10px; font-size: 12px; display: grid; gap: 2px;
  box-shadow: var(--shadow); max-width: 320px;
}
.m-tooltip span { color: var(--ink-dim); }

/* ── document pages (inventory) ── */
.m-doc {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 24px 24px 48px;
  box-sizing: border-box;
}
.m-doc-body::before {
  display: none;
}
.m-doc-inner { max-width: 980px; margin: 0 auto; }
/* the inventory's panel group gets a wide (but not edge-to-edge) canvas */
.m-doc-inner:has(.m-inv-cols) { max-width: 1320px; }
.m-doc h1 { font-size: 20px; font-weight: 600; letter-spacing: -.01em; margin-bottom: 4px; }
.m-dim { color: var(--ink-dim); }
.m-inv-filter {
  margin: 16px 0 12px; width: min(360px, 100%); background: var(--panel);
  border: 1px solid var(--line); border-radius: var(--radius); color: var(--ink);
  font: inherit; font-size: 13px; padding: 8px 12px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.m-inv-filter::placeholder { color: var(--ink-faint); }
.m-inv-filter:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 20%, transparent);
}
.m-inventory { font-size: 13px; }
.m-inventory th { cursor: pointer; user-select: none; height: 36px; }
.m-inventory th:hover { color: var(--ink); }
.m-inventory td { padding: 7px 8px; }
.m-inventory td a { color: var(--ink); text-decoration: none; font-weight: 500; }
.m-inventory td a:hover { color: var(--m-accent); }

/* status cell: the diagram's LED language — a dot + muted text, no pill wash */
.m-inv-status { display: inline-flex; align-items: center; gap: 7px; color: var(--ink-dim); text-transform: capitalize; }
.m-inv-status i { width: 8px; height: 8px; border-radius: 50%; background: var(--unknown); flex: none; }
.m-inv-status.m-status-up i { background: var(--up); }
.m-inv-status.m-status-down i { background: var(--down); }
.m-inv-status.m-status-degraded i { background: var(--degraded); }
.m-inv-status.m-status-planned i { background: var(--planned); }

/* device icon chip in the name cell — 24px chip, 18px vendor icon */
.m-inv-name { display: inline-flex; align-items: center; gap: 9px; }
.m-inv-ic {
  width: 24px; height: 24px; flex: none; display: grid; place-items: center;
  background: var(--bg-raise); border: 1px solid var(--line); border-radius: 6px;
  padding: 3px; overflow: hidden;
}
.m-inv-ic svg { width: 100%; height: 100%; display: block; }

/* filter + tabs bar */
.m-inv-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 16px 0 14px; }
.m-inv-bar .m-inv-filter { margin: 0; }
/* shadcn Tabs */
.m-tabs { display: inline-flex; gap: 2px; padding: 3px; background: var(--bg-raise); border-radius: var(--radius); }
.m-tab {
  border: 0; background: none; color: var(--ink-dim); font: inherit; font-size: 13px; font-weight: 500;
  padding: 5px 14px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s;
}
.m-tab.active { background: var(--panel); color: var(--ink); box-shadow: var(--shadow-sm); }

/* zone cards (shadcn Card + Table) */
.m-inv-group {
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-lg);
  padding: 4px 16px 12px; margin-bottom: 14px;
}
.m-inv-group > header { display: flex; align-items: baseline; gap: 10px; padding: 13px 0 6px; }
.m-inv-group > header a, .m-inv-group > header { font-size: 14px; font-weight: 600; color: var(--ink); }
.m-inv-group > header a { text-decoration: none; }
.m-inv-group > header a:hover { color: var(--m-accent); }
.m-inv-group > header em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--ink-faint); }
/* nested-zone sub-header row */
.m-inv-sub td { padding: 12px 8px 4px; font-size: 11px; font-weight: 500; color: var(--ink-faint); border-bottom: none; }

/* resizable card viewport: capped scroll region with a sticky header row */
.m-inv-scroll { max-height: 320px; overflow-y: auto; }
.m-inv-scroll thead th { position: sticky; top: 0; background: var(--panel); z-index: 2; }
/* shadcn Resizable: a panel group. Columns sit side by side split by
   vertical handles (drag = trade width); sections inside a column are split
   by horizontal handles (drag = trade height). All with the withHandle pill. */
.m-inv-cols { display: flex; align-items: flex-start; }
.m-inv-col { flex: 1 1 0; min-width: 0; }
.m-inv-view[data-view="zones"] .m-inv-group { margin-bottom: 0; container-type: inline-size; }
.m-rsz-v {
  flex: 0 0 17px; align-self: stretch; position: relative;
  display: grid; place-items: center;
  cursor: col-resize; touch-action: none; user-select: none;
}
.m-rsz-v::before { content: ""; position: absolute; top: 12px; bottom: 12px; left: 50%; width: 1px; background: var(--line); }
.m-rsz-v .m-rsz-grip { width: 14px; height: 26px; position: relative; z-index: 1; }
.m-rsz-v:hover .m-rsz-grip { color: var(--ink); border-color: var(--ring); }
/* narrow panels shed detail columns instead of breaking: id → role → mgmt ip */
@container (max-width: 700px) { .m-inventory th:nth-child(2), .m-inventory td:nth-child(2) { display: none; } }
@container (max-width: 560px) { .m-inventory th:nth-child(4), .m-inventory td:nth-child(4) { display: none; } }
@container (max-width: 440px) { .m-inventory th:nth-child(6), .m-inventory td:nth-child(6) { display: none; } }
/* narrow viewports: fall back to one column */
@media (max-width: 1080px) { .m-inv-cols { display: block; } .m-rsz-v { display: none; } }
.m-rsz-handle {
  position: relative; display: grid; place-items: center; height: 17px;
  cursor: row-resize; touch-action: none; user-select: none;
}
.m-rsz-handle::before { content: ""; position: absolute; left: 12px; right: 12px; top: 50%; height: 1px; background: var(--line); }
.m-rsz-grip {
  position: relative; z-index: 1; display: grid; place-items: center;
  width: 26px; height: 14px; border-radius: 4px;
  background: var(--bg-raise); border: 1px solid var(--line-strong); color: var(--ink-dim);
}
.m-rsz-handle:hover .m-rsz-grip { color: var(--ink); border-color: var(--ring); }
.m-inv-group .m-pagination { padding: 10px 0 0; }

/* shadcn Pagination */
.m-pagination { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 18px 0 6px; }
.m-page {
  min-width: 32px; height: 32px; padding: 0 10px; border: 0; border-radius: var(--radius-sm);
  background: none; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer;
  transition: background .15s;
}
.m-page:hover { background: var(--bg-raise); }
.m-page.active { border: 1px solid var(--line-strong); }
.m-page:disabled { opacity: .5; cursor: default; background: none; }
.m-page-nav { font-weight: 500; }
.m-page-ell { color: var(--ink-faint); padding: 0 2px; }
.m-full-link { margin-left: auto; display: inline-flex; align-items: center; gap: 3px; color: var(--m-accent); font-size: 13px; text-decoration: none; }
.m-full-link:hover { text-decoration: underline; }
.m-members { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; font-size: 12px; color: var(--ink-dim); }

/* ── embed & modular UI chrome (minimal/kiosk) ── */
html[data-chrome="minimal"] {
  --topbar-height: 0px !important;
  --shell-padding: 0px !important;
  --card-radius: 0px !important;
  --frame-top: 0px !important;
  --frame-bottom: 0px !important;
  --frame-left: 0px !important;
  --frame-right: 0px !important;
  --frame-x: 0px !important;
}
html[data-chrome="minimal"] body {
  padding: 0 !important;
  margin: 0 !important;
  background: var(--bg) !important;
}
html[data-chrome="minimal"] #marrow-chrome {
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  background: var(--bg) !important;
}
html[data-chrome="minimal"] .m-stage {
  inset: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
html[data-chrome="minimal"] .m-command-bar,
html[data-chrome="minimal"] .m-breadcrumbs,
html[data-chrome="minimal"] .m-backdrop,
html[data-chrome="minimal"] .m-watermark,
html[data-chrome="minimal"] .m-minimap,
html[data-chrome="minimal"] .m-sidebar {
  display: none !important;
}

html[data-chrome="minimal"] .m-inspector:not([hidden]) {
  display: flex !important;
  border-left: 1px solid var(--line) !important;
  background: var(--panel) !important;
  z-index: 25;
}

@media (max-width: 767px) {
  html[data-chrome="minimal"] .m-inspector:not([hidden]) {
    position: absolute !important;
    inset: auto 0 0 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: 55% !important;
    border-left: none !important;
    border-top: 1px solid var(--line) !important;
    border-radius: 14px 14px 0 0 !important;
    box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.3) !important;
  }
}

html[data-inspector="off"] .m-inspector {
  display: none !important;
}

html[data-minimap="off"] .m-minimap {
  display: none !important;
}

html[data-controls="off"] .m-controls {
  display: none !important;
}

html[data-watermark="off"] .m-watermark {
  display: none !important;
}

/* ── reduced motion: kill choreography and chrome slides ── */
@media (prefers-reduced-motion: reduce) {
  .m-enter-zone, .m-enter-node { animation: none !important; }
  .m-sidebar, .m-breadcrumbs, .m-inspector, .m-spotlight-box,
  .m-controls, .m-minimap { transition: none !important; animation: none !important; }
}

/* ── blueprint static export chrome ── */
.m-blueprint-titleblock text, .m-blueprint-legend text {
  user-select: none;
}

/* ── print ── */
@media print {
  .m-sidebar, .m-breadcrumbs, .m-controls, .m-minimap, .m-inspector, .m-spotlight, .m-tooltip, .m-backdrop { display: none !important; }
  .m-stage { position: static; inset: auto; border: none; box-shadow: none; }
  body { overflow: visible; background: #fff; }
  .m-portlabel { opacity: 1 !important; }
  .m-edge, .m-edge.m-flow { animation: none !important; }
}
`;

export const SITE_CSS = buildStylesheet();
