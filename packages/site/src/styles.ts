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
export const SITE_CSS = `
:root {
  --bg: #09090b; --bg-raise: #27272a; --panel: #18181b;
  --line: #27272a; --line-strong: #3f3f46;
  --ink: #fafafa; --ink-dim: #a1a1aa; --ink-faint: #71717a;
  --chip: #18181b; --chip-line: #3f3f46; --grid-dot: #1c1c1f;
  --m-accent: #3b82f6; --ring: #3b82f6; --zone: #71717a;
  --up: #22c55e; --down: #ef4444; --degraded: #f59e0b; --planned: #71717a; --unknown: #71717a;
  --edge: #d4d4d8;
  /* shadcn sidebar layer (ported literals from shadcn/ui new-york-v4) */
  --sidebar: oklch(0.205 0 0); --sidebar-fg: #fafafa;
  --sidebar-accent: oklch(0.269 0 0); --sidebar-border: rgb(255 255 255 / .1);
  --radius-sm: 6px; --radius: 8px; --radius-lg: 12px;
  --frame-top: 52px; --frame-x: 20px; --frame-bottom: 20px; --frame-left: 20px;
  --shadow: 0 10px 30px -12px rgb(0 0 0 / .55), 0 4px 10px -6px rgb(0 0 0 / .45);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / .4);
  --inspector-w: 356px;
}
:root[data-theme="light"] {
  --bg: #fafafa; --bg-raise: #f4f4f5; --panel: #ffffff;
  --line: #e4e4e7; --line-strong: #d4d4d8;
  --ink: #18181b; --ink-dim: #71717a; --ink-faint: #a1a1aa;
  --chip: #ffffff; --chip-line: #d4d4d8; --grid-dot: #e4e4e7;
  --m-accent: #2563eb; --ring: #2563eb; --zone: #71717a;
  --up: #16a34a; --down: #dc2626; --degraded: #d97706; --planned: #a1a1aa; --unknown: #a1a1aa;
  --edge: #71717a;
  --sidebar: oklch(0.985 0 0); --sidebar-fg: #18181b;
  --sidebar-accent: oklch(0.97 0 0); --sidebar-border: oklch(0.922 0 0);
  --shadow: 0 10px 24px -8px rgb(0 0 0 / .10), 0 4px 8px -4px rgb(0 0 0 / .06);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / .05);
}

* { box-sizing: border-box; margin: 0; }
[hidden] { display: none !important; }
html, body { height: 100%; }
body {
  background: var(--bg); color: var(--ink);
  font: 14px/1.45 -apple-system, system-ui, "Segoe UI", sans-serif;
  overflow: hidden;
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
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 999px; }
*::-webkit-scrollbar-track { background: transparent; }

/* ── stage & svg: the canvas lives inside a boxed viewport (v1-style shell) —
      an inset framed panel; chrome (rail, dock) floats outside it ── */
.m-stage {
  position: fixed;
  inset: var(--frame-top) var(--frame-x) var(--frame-bottom) var(--frame-left);
  cursor: grab;
  background: var(--bg);
  border: 1px solid var(--line); border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  overflow: hidden;
  transition: left .3s cubic-bezier(0.16, 1, 0.3, 1);
}
.m-stage.m-grabbing { cursor: grabbing; }
.m-svg { width: 100%; height: 100%; display: block; }
.m-canvas { width: 100%; height: 100%; display: block; }
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

/* ── edges ── */
.m-edge {
  fill: none; stroke: var(--edge); stroke-width: 1.5; stroke-linejoin: round;
  opacity: .92; transition: opacity .25s, stroke .25s; cursor: pointer;
}
.m-edge.m-speed-10g, .m-edge.m-speed-25g { stroke-width: 3; }
.m-edge.m-speed-40g, .m-edge.m-speed-100g, .m-edge.m-speed-400g { stroke-width: 4.5; }
/* traffic reads as accent; status colors below still win */
.m-edge.m-flow { stroke: var(--m-accent); }
/* dash vocabulary — one source of truth, reused by the inspector swatch */
:root { --dash-degraded: 14 7; --dash-planned: 2 7; }
.m-edge.m-status-down { stroke: var(--down); }
.m-edge.m-status-degraded { stroke: var(--degraded); stroke-dasharray: var(--dash-degraded); }
.m-edge.m-status-planned { stroke: var(--planned); stroke-dasharray: var(--dash-planned); stroke-linecap: round; }
.m-edge.is-path { stroke: var(--m-accent); opacity: 1; }

/* ── nodes ── */
.m-node { cursor: pointer; outline: none; }
.m-chip {
  fill: var(--chip); stroke: var(--chip-line); stroke-width: 1.25;
  transition: stroke .15s, stroke-width .15s;
}
.m-node:hover .m-chip, .m-node:focus-visible .m-chip { stroke: var(--ink-dim); }
/* selection & hero: a clean accent ring — no glow */
.m-node.m-hero .m-chip { stroke: var(--ring); stroke-width: 1.5; }
.m-node.is-selected .m-chip { stroke: var(--ring); stroke-width: 2; }
.m-led { stroke: var(--bg); stroke-width: 2; }
.m-status-up .m-led { fill: var(--up); }
.m-status-down .m-led { fill: var(--down); }
.m-status-degraded .m-led { fill: var(--degraded); }
.m-status-planned .m-led { fill: var(--planned); }
.m-status-unknown .m-led { fill: var(--unknown); }
.m-label { fill: var(--ink); font-size: 12px; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; transition: opacity .3s; }
.m-icon-fallback { fill: var(--ink-dim); font-size: 18px; font-weight: 600; }

/* ghost "door" nodes: dimmed stubs that navigate to their own page */
.m-node.m-ghost { opacity: .55; }
.m-node.m-ghost .m-chip { stroke-dasharray: 4 3; }
.m-node.m-ghost:hover { opacity: .9; }

/* aggregate badges (device counts, stacks) */
.m-badge rect { fill: var(--m-accent); stroke: var(--bg); stroke-width: 2; }
.m-badge text { fill: #fff; font-size: 11px; font-weight: 700; }

/* edge aggregate labels (×24) */
.m-edge-label rect { fill: var(--bg); stroke: var(--line-strong); stroke-width: 1; rx: 10px; }
.m-edge-label text { fill: var(--ink); font-size: 11px; font-weight: 700; }

/* focus mode: dim everything but the hovered/selected neighborhood */
.m-node, .m-edge, .m-zone, .m-zone-titles { transition: opacity .25s; }
.focus-mode .m-node:not(.is-focus):not(.is-adj):not(.is-selected) { opacity: .15; }
.focus-mode .m-edge:not(.is-path) { opacity: .08; }
.focus-mode .m-zone { opacity: .35; }

/* LOD: labels fade when zoomed far out; leaf links recede so the far view
   reads trunks and structure */
:root[data-zoom="far"] .m-label { opacity: 0; }
:root[data-zoom="far"] .m-edge.m-leaf { opacity: .18; }

/* ── entrance choreography ── */
.m-enter-zone { animation: mZoneIn .5s ease-out both; }
.m-enter-node {
  animation: mNodeIn .42s cubic-bezier(.22,.7,.28,1) both;
  animation-delay: var(--d, 0s);
  transform-box: fill-box; transform-origin: center;
}
.m-edge { stroke-dasharray: 1; stroke-dashoffset: 1; animation: mDraw .55s ease-out forwards; animation-delay: .7s; }
.m-edge.m-flow { animation: mDraw .55s ease-out forwards, mFlow 1.1s linear infinite; animation-delay: .7s, 1.4s; }
@keyframes mZoneIn { from { opacity: 0; } }
@keyframes mNodeIn { from { opacity: 0; transform: scale(.96) translateY(4px); } }
@keyframes mDraw { to { stroke-dashoffset: 0; } }
@keyframes mFlow { from { stroke-dasharray: .06 .045; stroke-dashoffset: .21; } to { stroke-dasharray: .06 .045; stroke-dashoffset: 0; } }
.settled .m-enter-zone, .settled .m-enter-node { animation: none; }
.settled .m-edge { animation: none; stroke-dasharray: none; stroke-dashoffset: 0; }
.settled .m-edge.m-flow { animation: mFlow 1.1s linear infinite; }

/* ── the menu chip (SidebarTrigger) floats top-left; view settings live in
      the ⌘K command center ── */
.m-rail-wrap {
  position: fixed; top: 12px; left: 12px; z-index: 31;
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  pointer-events: none;
  /* travels with the panel when it opens/closes — same curve as the sidebar */
  transition: left .3s cubic-bezier(0.16, 1, 0.3, 1);
}
.m-chip-btn {
  width: 32px; height: 32px; flex: none; border: 0; border-radius: var(--radius);
  background: var(--ink); color: var(--bg);
  display: grid; place-items: center; cursor: pointer; pointer-events: auto;
  box-shadow: var(--shadow-sm);
  transition: background .15s, color .15s, transform .15s;
}
.m-chip-btn:hover { background: color-mix(in srgb, var(--ink) 86%, var(--bg)); }
.m-chip-btn:active { transform: scale(.94); }
/* like shadcn's ghost SidebarTrigger, the chip stays neutral — the sidebar
   itself is the open/closed signal */
.m-chip-btn.on { background: var(--ink); color: var(--bg); }

/* ── top dock (hides above the edge, a Search tab peeks out;
      hover or keyboard focus slides it down) ── */
.m-dock {
  position: fixed; top: 0; left: 50%; z-index: 30;
  transform: translate(-50%, -100%);
  display: flex; align-items: center; gap: 12px;
  padding: 9px 16px 10px;
  background: var(--panel); border: 1px solid var(--line); border-top: none;
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  box-shadow: var(--shadow);
  transition: transform .45s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: min(860px, calc(100vw - 120px));
}
.m-dock:hover, .m-dock:focus-within { transform: translate(-50%, 0); }
.m-dock-div { width: 1px; height: 20px; background: var(--line); flex: none; }
.m-dock-hint {
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 7px;
  padding: 5px 12px 6px;
  background: var(--panel); border: 1px solid var(--line); border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
  color: var(--ink-dim); font: inherit; font-size: 12px; cursor: pointer;
  box-shadow: var(--shadow-sm);
  white-space: nowrap; pointer-events: auto;
  transition: opacity .3s cubic-bezier(0.16, 1, 0.3, 1), transform .3s cubic-bezier(0.16, 1, 0.3, 1);
}
.m-dock:hover .m-dock-hint, .m-dock:focus-within .m-dock-hint {
  opacity: 0; transform: translateX(-50%) translateY(-10px); pointer-events: none;
}

/* ── breadcrumbs: shadcn Breadcrumb, persistent in the top strip — muted
      links, chevron separators, current page in the foreground color.
      Anchored to the stage's left edge so it moves with the sidebar. ── */
.m-breadcrumbs {
  /* floor of 56px keeps it clear of the floating trigger chip on single-file pages */
  position: fixed; top: 0; left: max(calc(var(--frame-left) + 2px), 56px); height: var(--frame-top);
  z-index: 20; display: flex; align-items: center; gap: 6px;
  font-size: 14px; white-space: nowrap;
  /* never run under the centered search dock */
  max-width: calc(50vw - var(--frame-left) - 120px); overflow: hidden;
  transition: left .3s cubic-bezier(0.16, 1, 0.3, 1);
}
.m-breadcrumbs a { color: var(--ink-dim); text-decoration: none; transition: color .15s; }
.m-breadcrumbs a:hover { color: var(--ink); }
.m-breadcrumbs .m-crumb-here { color: var(--ink); overflow: hidden; text-overflow: ellipsis; }
.m-breadcrumbs .m-crumb-sep { display: grid; place-items: center; color: var(--ink-faint); }
/* breadcrumb separator: full icon size (the shell bakes 12px, scale it up) */
.m-crumb-sep svg { width: 16px; height: 16px; }

/* ── watermark: sits inside the boxed viewport, clipped at its edges ── */
.m-watermark {
  position: fixed; left: calc(var(--frame-left) + 16px); bottom: calc(var(--frame-bottom) + 4px); z-index: 4;
  pointer-events: none; user-select: none; line-height: .88;
  max-width: calc(100vw - var(--frame-left) - var(--frame-x) - 32px); overflow: hidden;
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

/* ── backdrop: author-branded margin around the boxed viewport (backdrop: in
      the YAML) — brand line in the top strip, note in the bottom strip ── */
.m-backdrop { position: fixed; inset: 0; z-index: 0; pointer-events: none; user-select: none; }
.m-backdrop-text {
  position: absolute; top: 0; right: 24px; height: var(--frame-top);
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 38%, transparent);
}
.m-backdrop-text svg { flex: none; }
.m-backdrop-note {
  position: absolute; bottom: 0; left: 0; right: 0; height: var(--frame-bottom);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 26%, transparent);
}

/* ── crumbs ── */
.m-crumbs { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; white-space: nowrap; }
.m-crumbs a { color: var(--ink-dim); text-decoration: none; transition: color .15s; }
.m-crumbs a:hover { color: var(--ink); }
.m-crumb-here { color: var(--ink); }
.m-crumb-sep { display: grid; place-items: center; color: var(--ink-faint); }
.m-searchpill {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--line); background: var(--bg-raise); color: var(--ink-dim);
  border-radius: var(--radius); padding: 6px 8px 6px 12px; font: inherit; font-size: 13px;
  cursor: pointer; transition: border-color .15s, background .15s;
}
.m-searchpill:hover { border-color: var(--line-strong); }
.m-searchpill span { color: var(--ink-dim); }

/* ── sidebar: shadcn Sidebar, "sidebar" variant — a full-height panel docked
      flush to the left edge (header / grouped content / footer), toggled by
      the menu chip (SidebarTrigger). Opening it pushes the stage right and
      tucks the icon rail away. ── */
.m-sidebar {
  position: fixed; top: 0; bottom: 0; left: 0; width: 256px; z-index: 26; /* SIDEBAR_WIDTH = 16rem */
  transform: translateX(-100%);
  transition: transform .3s cubic-bezier(0.16, 1, 0.3, 1), width .2s linear; /* shadcn: duration-200 ease-linear */
  pointer-events: none;
}
.m-sidebar.open { transform: translateX(0); pointer-events: auto; }
/* collapsible="icon": with nav rows present, collapsed = a 3rem icon strip
   (SIDEBAR_WIDTH_ICON), never fully hidden — matching the shadcn sidebar.
   Pages without nav (single-file diagrams) keep the offcanvas hide above. */
.m-sidebar.m-nav:not(.open) {
  width: 48px; transform: translateX(0); pointer-events: auto;
}
/* the open/strip sidebar claims the layout: stage shifts, the rail reacts */
body:has(.m-sidebar.open) { --frame-left: 272px; }
body:has(.m-sidebar.m-nav:not(.open)) { --frame-left: 64px; }
body:has(.m-sidebar.m-nav:not(.open)) .m-doc { padding-left: 72px; }

/* icon-strip internals: logo only in the header, square icon rows with
   flyout labels, non-nav groups collapsed away */
.m-sidebar:not(.open) .m-sidebar-inner { overflow: visible; }
/* strip under a floating chip: leave room for it (chip ends at y=42) */
body:has(.m-rail-wrap) .m-sidebar:not(.open) .m-sidebar-inner { padding-top: 52px; }
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
.m-side-foot .m-brand-logo svg, .m-side-foot .m-brand-logo img,
.m-drawer-foot .m-brand-logo svg, .m-drawer-foot .m-brand-logo img {
  height: 14px; max-width: 80px;
}
.m-backdrop-text .m-brand-logo svg, .m-backdrop-text .m-brand-logo img { height: 16px; max-width: 140px; }
/* shadcn Menubar: a compact trigger row under the sidebar header; its
   popovers reuse the DropdownMenu/ContextMenu content style */
.m-menubar { display: flex; gap: 2px; padding: 0 8px 6px; border-bottom: 1px solid var(--sidebar-border); margin-bottom: 4px; }
.m-menubar button {
  border: 0; background: none; color: var(--sidebar-fg); font: inherit; font-size: 13px; font-weight: 500;
  padding: 4px 10px; border-radius: var(--radius-sm); cursor: pointer; transition: background .1s;
}
.m-menubar button:hover, .m-menubar button.open { background: var(--sidebar-accent); }
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
.m-switch {
  width: 34px; height: 20px; flex: none; position: relative; cursor: pointer; padding: 0;
  border: 0; border-radius: 999px; background: var(--line-strong);
  transition: background .15s;
}
.m-switch .m-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #fff; box-shadow: var(--shadow-sm); transition: translate .15s;
}
.m-switch[aria-checked="true"] { background: var(--m-accent); }
.m-switch[aria-checked="true"] .m-knob { translate: 14px 0; }
.m-legend { list-style: none; padding: 0 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px 8px; font-size: 12px; color: var(--ink-dim); }
.m-legend li { display: flex; align-items: center; gap: 7px; }
.m-legend li:nth-last-child(-n+2) { grid-column: span 2; }
.m-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
.m-line { width: 18px; border-top: 2px solid var(--edge); display: inline-block; flex: none; }
.m-line-dash { border-top-style: dashed; }
/* SidebarHeader card + SidebarMenuButton rows: [icon] label ······ badge */
.m-side-header {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; border-radius: var(--radius-sm);
}
/* stage pages: reserve the 48px strip so the floating trigger chip at (8,10)
   never overlaps the sidebar title */
body:has(.m-rail-wrap) .m-side-header { padding: 10px 8px 8px 48px; }
/* with a nav sidebar, the trigger chip tucks inside the 48px strip column */
body:has(.m-sidebar.m-nav) .m-rail-wrap { left: 8px; top: 10px; }
/* open: the trigger rides along to the panel's top-right corner, clear of the
   title. 216px = SIDEBAR_WIDTH(256) - chip(32) - gutter(8). */
body:has(.m-sidebar.open) .m-rail-wrap { left: 216px; top: 10px; }
/* …so the title reclaims the left gutter and instead keeps clear on the right */
body:has(.m-sidebar.open) .m-side-header { padding: 10px 44px 8px 8px; }
.m-side-id { min-width: 0; }
.m-side-id strong { display: block; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-side-id small { display: block; font-size: 11px; color: color-mix(in srgb, var(--sidebar-fg) 60%, transparent); margin-top: 1px; }
.m-side-nav { display: flex; flex-direction: column; gap: 1px; }
/* SidebarMenuButton: h-8 gap-2 rounded-md p-2 text-sm; icons size-4 */
.m-side-row {
  display: flex; align-items: center; gap: 8px; height: 32px;
  color: var(--sidebar-fg); text-decoration: none; font-size: 14px; font-weight: 400;
  padding: 0 8px; border-radius: var(--radius-sm); transition: background .15s;
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
.m-side-actions { display: flex; flex-direction: column; gap: 6px; }
.m-side-actions .m-btn { width: 100%; }
.m-about { font-size: 12px; display: grid; gap: 2px; }
.m-about dt { color: var(--ink-faint); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; margin-top: 7px; }
.m-about dd { color: var(--ink); }

/* view settings applied via root data attributes */
:root[data-labels="off"] .m-label { opacity: 0 !important; }
:root[data-labels="on"] .m-label { opacity: 1 !important; }
:root[data-motion="off"] .m-edge.m-flow { animation: none !important; stroke-dasharray: none; }

/* ── port label chips (LOD: near zoom, or forced via setting) ── */
.m-portlabel { opacity: 0; transition: opacity .25s; pointer-events: none; }
:root[data-zoom="near"] .m-portlabel, :root[data-ports="on"] .m-portlabel { opacity: 1; }
:root[data-ports="off"] .m-portlabel { opacity: 0 !important; }
/* hovering/focusing an edge reveals its chips regardless of the toggle */
.m-portlabel.is-hot { opacity: 1 !important; }
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
.m-kbd { color: var(--ink-faint); font-size: 11px; border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; margin-left: 6px; }

/* ── zoom controls: one joined card, matching the rail's language ── */
.m-controls {
  position: fixed; right: calc(var(--frame-x) + 12px); bottom: calc(var(--frame-bottom) + 12px); z-index: 20;
  display: flex; flex-direction: column; gap: 2px; padding: 4px;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  transition: right .25s ease;
}
/* the open inspector must never bury the controls or the minimap */
:root.has-selection .m-controls { right: calc(var(--inspector-w) + 24px); }
:root.has-selection .m-minimap { right: calc(var(--inspector-w) + 70px); }
.m-controls .m-btn {
  width: 30px; height: 30px; padding: 0; border: 1px solid transparent; border-radius: var(--radius);
  display: grid; place-items: center;
  background: none; box-shadow: none; color: var(--ink-dim);
}
.m-controls .m-btn:hover { background: var(--bg-raise); border-color: var(--line); color: var(--ink); }
.m-ctl-sep { height: 1px; background: var(--line); margin: 2px 4px; }

/* ── minimap ── */
.m-minimap {
  position: fixed; right: calc(var(--frame-x) + 58px); bottom: calc(var(--frame-bottom) + 12px); z-index: 20; /* beside the zoom controls */
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius-lg);
  padding: 5px; box-shadow: var(--shadow);
  transition: right .25s ease, border-color .15s;
}
.m-minimap:hover { border-color: var(--line-strong); }
.m-minimap > svg { display: block; cursor: crosshair; }
.m-mini-toggle {
  position: absolute; top: 4px; right: 4px; z-index: 1;
  width: 20px; height: 20px; display: grid; place-items: center;
  background: var(--panel);
  border: 1px solid var(--line); border-radius: var(--radius-sm); color: var(--ink-dim);
  cursor: pointer; padding: 0; opacity: 0;
  transition: opacity .15s, background .15s, color .15s;
}
.m-minimap:hover .m-mini-toggle { opacity: 1; }
.m-mini-toggle:hover { background: var(--bg-raise); color: var(--ink); }
/* collapsed: an icon card matching the zoom controls */
.m-minimap.collapsed { padding: 4px; }
.m-minimap.collapsed > svg { display: none; }
.m-minimap.collapsed .m-mini-toggle {
  position: static; opacity: 1;
  width: 30px; height: 30px; border-radius: var(--radius);
  background: none; border: 1px solid transparent; color: var(--ink-dim);
}
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
.m-mini-view { fill: color-mix(in srgb, var(--m-accent) 13%, transparent); stroke: var(--m-accent); stroke-width: 1.3; }

/* ── inspector: shadcn Drawer (right edge) — full-height, flush, border-left;
      slides in from the edge like DrawerContent ── */
.m-inspector {
  position: fixed; top: 0; right: 0; bottom: 0; width: var(--inspector-w); z-index: 25;
  background: var(--panel); border-left: 1px solid var(--line);
  box-shadow: var(--shadow);
  display: flex; flex-direction: column;
  animation: mSlideIn .3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes mSlideIn { from { translate: 100% 0; } }
.m-inspector-head {
  display: flex; align-items: center; padding: 14px 16px; gap: 10px;
  border-bottom: 1px solid var(--line); flex: none;
}
.m-inspector-id { flex: 1; min-width: 0; display: grid; gap: 1px; }
.m-inspector-title { font-size: 15px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-inspector-desc { font-size: 12px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.m-inspector-desc:empty { display: none; }
.m-inspector-close {
  width: 28px; height: 28px; border-radius: var(--radius-sm); background: none; border: 0;
  color: var(--ink-dim); cursor: pointer; display: grid; place-items: center;
  transition: background .15s, color .15s;
}
.m-inspector-close:hover { background: var(--bg-raise); color: var(--ink); }
.m-inspector-body { overflow-y: auto; padding: 16px 16px 24px; flex: 1; }
/* company brand footer on the drawer (backdrop.text; Marrow by default) */
.m-drawer-foot {
  display: flex; align-items: center; gap: 8px; padding: 11px 16px; flex: none;
  border-top: 1px solid var(--line);
  font-size: 11px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase;
  color: color-mix(in srgb, var(--ink) 42%, transparent);
}
.m-drawer-foot svg { flex: none; width: 14px; height: 14px; }
.m-inspector-body h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; color: var(--ink-faint); margin: 20px 0 8px; }
.m-icon-badge { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
/* direct child only — the "Open page" link's arrow must not inherit this */
.m-icon-badge > svg { width: 44px; height: 44px; background: var(--bg-raise); border: 1px solid var(--line); border-radius: var(--radius); padding: 6px; }
.m-status-pill {
  font-size: 11px; font-weight: 500; text-transform: capitalize; padding: 2px 9px; border-radius: 999px;
  background: var(--bg-raise); color: var(--ink-dim);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.m-status-pill.m-status-up { background: color-mix(in srgb, var(--up) 14%, transparent); color: var(--up); }
.m-status-pill.m-status-down { background: color-mix(in srgb, var(--down) 15%, transparent); color: var(--down); }
.m-status-pill.m-status-degraded { background: color-mix(in srgb, var(--degraded) 15%, transparent); color: var(--degraded); }
.m-facts { display: grid; grid-template-columns: 84px 1fr; gap: 5px 10px; font-size: 13px; }
.m-facts dt { color: var(--ink-dim); }
.m-facts dd { overflow-wrap: anywhere; }
.m-links { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.m-links button {
  width: 100%; text-align: left; background: var(--bg-raise); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 8px 10px; color: var(--ink); font: inherit; font-size: 13px;
  cursor: pointer; display: grid; gap: 2px; transition: background .15s, border-color .15s;
}
.m-links button:hover { border-color: var(--line-strong); }
.m-link-other { font-weight: 600; }
.m-link-ports, .m-link-meta { color: var(--ink-dim); font-size: 12px; }
/* a miniature of the link drawn with the SAME edge classes as the canvas, so
   speed (width), status (colour/dash) and flow (animation) all carry over */
.m-link-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.m-swatch { width: 56px; height: 10px; flex: none; overflow: visible; }
/* the swatch is a fixed 56px line, NOT a pathLength-normalised graph edge, so
   it opts out of the intro draw-on and restates the dash patterns in px from
   the same variables the edges use */
.m-swatch .m-edge {
  cursor: default; opacity: .95;
  animation: none; stroke-dasharray: none; stroke-dashoffset: 0;
}
.m-swatch .m-edge.m-status-degraded { stroke-dasharray: var(--dash-degraded); }
.m-swatch .m-edge.m-status-planned { stroke-dasharray: var(--dash-planned); }
/* mFlow's dashes are fractions of pathLength=1; in px terms that is 6/4.5 */
@keyframes mSwatchFlow { to { stroke-dashoffset: -21px; } }
.m-swatch .m-edge.m-flow { stroke-dasharray: 6 4.5; animation: mSwatchFlow 1.1s linear infinite; }
/* the swatch is a legend, not part of the graph — path focus must not dim it */
.focus-mode .m-swatch .m-edge:not(.is-path) { opacity: .95; }
.m-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.m-table th { text-align: left; color: var(--ink-dim); font-weight: 500; padding: 3px 6px; border-bottom: 1px solid var(--line); }
.m-table td { padding: 4px 6px; border-bottom: 1px solid color-mix(in srgb, var(--line) 45%, transparent); }
.m-table tbody tr { transition: background .15s; }
.m-table tbody tr:hover { background: color-mix(in srgb, var(--ink) 3%, transparent); }
.m-note { white-space: pre-wrap; font-size: 13px; color: var(--ink); }
.m-config {
  background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 10px; font: 12px/1.5 ui-monospace, monospace; overflow-x: auto; white-space: pre;
}

/* ── spotlight: shadcn Command dialog (cmdk) — icon'd input row, a muted
      group heading, kbd-hint footer ── */
.m-spotlight {
  position: fixed; inset: 0; z-index: 40; background: rgb(0 0 0 / .6);
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
  position: fixed; z-index: 45; min-width: 208px;
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
.m-doc-body { overflow: auto; }
/* header band: a solid strip under the breadcrumb with a hairline rule, so
   scrolling content passes beneath it cleanly */
.m-doc-body::before {
  content: ""; position: fixed; top: 0; left: 0; right: 0; height: var(--frame-top);
  background: var(--bg); border-bottom: 1px solid var(--line); z-index: 19;
}
.m-doc { padding: 88px 24px 48px; }
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

/* ── reduced motion: kill choreography and chrome slides ── */
@media (prefers-reduced-motion: reduce) {
  .m-enter-zone, .m-enter-node { animation: none !important; }
  .m-edge, .m-edge.m-flow { animation: none !important; stroke-dasharray: none; stroke-dashoffset: 0; }
  .m-sidebar, .m-dock, .m-dock-hint, .m-breadcrumbs, .m-inspector, .m-spotlight-box,
  .m-controls, .m-minimap, .m-chip-btn { transition: none !important; animation: none !important; }
}

/* ── print ── */
@media print {
  .m-sidebar, .m-rail-wrap, .m-dock, .m-breadcrumbs, .m-controls, .m-minimap, .m-inspector, .m-spotlight, .m-tooltip, .m-backdrop { display: none !important; }
  .m-stage { position: static; inset: auto; border: none; box-shadow: none; }
  body { overflow: visible; background: #fff; }
}
`;
