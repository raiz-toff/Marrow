import { truncateToWidth } from '@marrow/metrics';
import type { Scene, SceneEdge, SceneNode, ScenePortChip, SceneZone } from '@marrow/scene';
import { linkPresentation, resolveScene, type EdgePaint, type NodePaint } from '@marrow/visual';

/**
 * @marrow/render-svg — the "lush tier" renderer: Scene → classed, data-attributed
 * SVG markup. Pure string generation: WHAT to paint (paths, proportions, draw
 * order, classes) comes resolved from @marrow/visual; HOW classes look is its
 * generated stylesheet; behavior lives in the runtime. The renderer's contract:
 *  - every node/edge/zone carries data-* ids the runtime binds to;
 *  - entrance choreography is expressed as per-element `--d` delay vars;
 *  - icons are referenced via <use> against a subset sprite built from ONLY
 *    the icons this scene uses.
 */

export interface IconSource {
  /** Raw SVG file content for an icon id, or undefined when unknown. */
  svg(id: string): string | undefined;
}

export interface RenderOptions {
  icons: IconSource;
}

export interface RenderedSvg {
  svg: string;
  /** icon ids actually embedded in the sprite */
  usedIcons: string[];
}

/**
 * The scale-tier host: a hidden icon sprite (shared with the inspector's
 * <use> refs and rasterized by the canvas engine) plus the canvas element.
 * All geometry ships as embedded scene JSON; the runtime draws it.
 */
export function renderCanvasHost(scene: Scene, options: RenderOptions): RenderedSvg {
  const sprite = buildSprite(scene, options.icons);
  const svg =
    `<svg class="m-sprite" width="0" height="0" aria-hidden="true"><defs>${sprite.defs}</defs></svg>\n` +
    `<canvas class="m-canvas" role="img" aria-label="Network topology diagram"></canvas>`;
  return { svg, usedIcons: sprite.used };
}

export function renderScene(scene: Scene, options: RenderOptions): RenderedSvg {
  const sprite = buildSprite(scene, options.icons);
  const visual = resolveScene(scene);
  const parts: string[] = [];
  // Deliberately NO viewBox: the runtime camera owns the entire world→screen
  // mapping. A viewBox would add a second, competing transform.
  parts.push(
    `<svg class="m-svg" data-w="${scene.size.w}" data-h="${scene.size.h}" ` +
      `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Network topology diagram">`,
  );
  parts.push('<defs>');
  parts.push(
    '<pattern id="m-grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">' +
      '<circle cx="1.2" cy="1.2" r="1.2" class="m-grid-dot"/></pattern>',
  );
  parts.push(sprite.defs);
  parts.push('</defs>');
  parts.push('<g class="m-camera">');
  parts.push(`<rect class="m-grid" width="${scene.size.w}" height="${scene.size.h}" fill="url(#m-grid-dots)"/>`);

  parts.push('<g class="m-zones">');
  for (const z of scene.zones) parts.push(renderZone(z));
  parts.push('</g>');

  parts.push('<g class="m-edges">');
  // paints arrive in draw order (healthy first, alarms on top); map each back
  // to its scene edge for the data-* attributes the runtime binds to
  const byId = new Map<string, SceneEdge[]>();
  for (const e of scene.edges) (byId.get(e.id) ?? byId.set(e.id, []).get(e.id)!).push(e);
  for (const p of visual.edges) {
    const e = byId.get(p.id)?.shift();
    if (e !== undefined) parts.push(renderEdge(e, p));
  }
  parts.push('</g>');

  // titles live above the edge layer so routed links can never slice
  // through them; their bg-stroke halo knocks a clean gap into any edge
  parts.push('<g class="m-zone-titles">');
  for (const z of scene.zones) parts.push(renderZoneTitle(z));
  parts.push('</g>');

  parts.push('<g class="m-portlabels">');
  for (const c of scene.portChips ?? []) parts.push(portChip(c));
  parts.push('</g>');

  parts.push('<g class="m-nodes">');
  scene.nodes.forEach((n, i) => parts.push(renderNode(n, visual.nodes[i]!, sprite.symbolOf)));
  parts.push('</g>');

  parts.push('</g>'); // m-camera
  parts.push('</svg>');
  return { svg: parts.join('\n'), usedIcons: sprite.used };
}

/** Zone title metrics: 12px, .1em tracking (must match .m-zone-label CSS). */
const ZONE_TITLE_SIZE = 12;
const ZONE_TITLE_TRACKING = ZONE_TITLE_SIZE * 0.1;
const ZONE_TITLE_INSET = 14;

function renderZone(z: SceneZone): string {
  const accent = z.accent ? ` style="--m-zone-accent:${esc(z.accent)}"` : '';
  return (
    `<g class="m-zone m-enter-zone" data-zone="${esc(z.id)}" data-depth="${z.depth}"${accent}>` +
    `<rect x="${z.box.x}" y="${z.box.y}" width="${z.box.w}" height="${z.box.h}" rx="16" class="m-zone-panel"/>` +
    `</g>`
  );
}

function renderZoneTitle(z: SceneZone): string {
  const accent = z.accent ? ` style="--m-zone-accent:${esc(z.accent)}"` : '';
  const full = z.name.toUpperCase();
  const fit = truncateToWidth(full, ZONE_TITLE_SIZE, z.box.w - 2 * ZONE_TITLE_INSET, ZONE_TITLE_TRACKING);
  return (
    `<g class="m-zone m-enter-zone" data-zone="${esc(z.id)}" data-depth="${z.depth}"${accent}>` +
    `${fit !== full ? `<title>${esc(z.name)}</title>` : ''}` +
    `<text x="${z.box.x + ZONE_TITLE_INSET}" y="${z.box.y + 22}" class="m-zone-label">${esc(fit)}</text>` +
    `</g>`
  );
}

function renderEdge(e: SceneEdge, p: EdgePaint): string {
  const pres = linkPresentation(e);
  const meta = [e.from.port, e.to.port, e.speed, e.kind, pres.mode, pres.chip].filter(Boolean).join(' · ');
  const data =
    `data-edge="${esc(e.id)}" data-from="${esc(e.from.node)}" data-to="${esc(e.to.node)}"` +
    `${e.from.port !== undefined ? ` data-from-port="${esc(e.from.port)}"` : ''}` +
    `${e.to.port !== undefined ? ` data-to-port="${esc(e.to.port)}"` : ''}` +
    `${e.kind !== undefined ? ` data-kind="${esc(e.kind)}"` : ''}` +
    `${e.speed !== undefined ? ` data-speed="${esc(e.speed)}"` : ''}` +
    `${pres.mode !== undefined ? ` data-mode="${esc(pres.mode)}"` : ''}` +
    `${e.encap !== undefined ? ` data-encap="${esc(e.encap)}"` : ''}` +
    `${e.protocol !== undefined ? ` data-protocol="${esc(e.protocol)}"` : ''}` +
    `${e.vlans !== undefined ? ` data-vlans="${esc(e.vlans)}"` : ''}` +
    `${e.lacp !== undefined ? ` data-lacp="${esc(e.lacp)}"` : ''}` +
    `${e.lag !== undefined ? ` data-lag="${esc(e.lag)}"` : ''}`;
  // --len sizes the px draw-in dashes (geometry, like --d on nodes)
  const geom = `style="--len:${p.len}" d="${p.d}"`;
  const path = `<path class="${esc(p.classes)}" ${geom} ${data} data-meta="${esc(meta)}"/>`;
  // trunk = double rail: a thin bg-coloured slot carved down the casing
  const leaf = p.classes.split(' ').includes('m-leaf') ? ' m-leaf' : '';
  const rail = p.rail ? `<path class="m-edge-rail${leaf}" ${geom} data-edge="${esc(e.id)}"/>` : '';
  const hit = `<path class="m-edge-hit" d="${p.d}" data-edge="${esc(e.id)}"/>`;
  let extras = '';
  // aggregate labels ("×24") ride the midpoint of the polyline
  if (p.label) {
    const l = p.label;
    extras +=
      `<g class="m-edge-label" data-edge="${esc(e.id)}"><rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="${l.r}"/>` +
      `<text x="${l.textX}" y="${l.textY}" text-anchor="middle">${esc(l.text)}</text></g>`;
  }
  // semantic chip (VLANs / encap / protocol / lag), with an optional glyph
  if (p.chip) {
    const c = p.chip;
    const drawGlyph = c.glyph === 'lock' || c.glyph === 'bundle';
    extras +=
      `<g class="m-edge-chip"${c.glyph ? ` data-glyph="${esc(c.glyph)}"` : ''} data-edge="${esc(e.id)}">` +
      `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="${c.r}"/>` +
      (drawGlyph ? chipGlyph(c.glyph!, c.glyphX, c.y + c.h / 2) : '') +
      `<text x="${c.textX}" y="${c.textY}" text-anchor="middle">${esc(c.text)}</text>` +
      `</g>`;
  }
  return path + rail + hit + extras;
}

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/** Tiny inline glyphs drawn at (x, cy) spanning ~9px wide, vertically centred. */
function chipGlyph(kind: string, x: number, cy: number): string {
  if (kind === 'lock') {
    // padlock: rounded body + shackle arc
    const bx = x;
    const by = cy - 1.5;
    return (
      `<g class="m-chip-glyph">` +
      `<rect x="${n2(bx)}" y="${n2(by)}" width="9" height="6.5" rx="1.5"/>` +
      `<path d="M${n2(bx + 1.7)} ${n2(by)} v-1.8 a2.8 2.8 0 0 1 5.6 0 v1.8" fill="none"/>` +
      `</g>`
    );
  }
  // bundle: three short parallel strands (aggregation)
  const top = cy - 4;
  const bot = cy + 4;
  return (
    `<g class="m-chip-glyph m-chip-glyph-stroke">` +
    `<path d="M${n2(x)} ${n2(top)} V${n2(bot)} M${n2(x + 4)} ${n2(top)} V${n2(bot)} M${n2(x + 8)} ${n2(top)} V${n2(bot)}" fill="none"/>` +
    `</g>`
  );
}

/** Chips arrive pre-placed (collision-free) from layout; just draw the rects. */
function portChip(c: ScenePortChip): string {
  const cx = c.box.x + c.box.w / 2;
  return (
    `<g class="m-portlabel${c.summary ? ' m-portsum' : ''}"${c.edge !== undefined ? ` data-edge="${esc(c.edge)}"` : ''} data-node="${esc(c.node)}">` +
    `<rect x="${c.box.x.toFixed(1)}" y="${c.box.y.toFixed(1)}" width="${c.box.w.toFixed(1)}" height="${c.box.h}" rx="4"/>` +
    `<text x="${cx.toFixed(1)}" y="${(c.box.y + c.box.h / 2 + 3).toFixed(1)}" text-anchor="middle">${esc(c.label)}</text></g>`
  );
}

function renderNode(n: SceneNode, p: NodePaint, symbolOf: (iconId: string) => string | undefined): string {
  const accent = n.accent ? ` style="--d:${p.delay}s;--m-accent:${esc(n.accent)}"` : ` style="--d:${p.delay}s"`;
  const symbol = symbolOf(n.icon);
  const iconMarkup = symbol
    ? `<use href="#${symbol}" x="${p.icon.x}" y="${p.icon.y}" width="${p.icon.w}" height="${p.icon.h}"/>`
    : `<text x="${n.chip.x + n.chip.w / 2}" y="${n.chip.y + n.chip.h / 2 + 5}" text-anchor="middle" class="m-icon-fallback">${esc(
        n.label.slice(0, 2).toUpperCase(),
      )}</text>`;
  const b = p.badge;
  const badge = b
    ? `<g class="m-badge"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}"/><text x="${b.textX}" y="${b.textY}" text-anchor="middle">${esc(b.text)}</text></g>`
    : '';
  const l = p.label;
  const labelStyle = l.size !== 12 ? ` style="font-size:${l.size}px"` : '';
  return (
    `<g class="${esc(p.classes)}" data-node="${esc(n.id)}"` +
    `${n.tier !== undefined ? ` data-tier="${esc(n.tier)}"` : ''}` +
    `${n.zone !== undefined ? ` data-zone="${esc(n.zone)}"` : ''}` +
    `${n.href !== undefined ? ` data-href="${esc(n.href)}"` : ''}${accent} tabindex="0" role="button" aria-label="${esc(n.title ?? n.label)}">` +
    `${n.title !== undefined ? `<title>${esc(n.title)}</title>` : ''}` +
    `<g class="m-node-inner m-enter-node">` +
    `<rect class="m-chip" x="${p.chip.x}" y="${p.chip.y}" width="${p.chip.w}" height="${p.chip.h}" rx="${p.chip.r}"/>` +
    iconMarkup +
    `<circle class="m-led" cx="${p.led.cx}" cy="${p.led.cy}" r="${p.led.r}"/>` +
    badge +
    // textLength pins the client's font to the width layout reserved — the
    // label cannot overflow its box no matter which system font renders it.
    // Not for emoji labels (`pin` false): the metrics table counts each
    // codepoint of a ZWJ sequence, so pinning would stretch the single glyph.
    `<text class="m-label"${labelStyle} x="${l.x}" y="${l.y}" text-anchor="middle"${
      l.pin ? ` textLength="${l.w}" lengthAdjust="spacingAndGlyphs"` : ''
    }>${esc(n.label)}</text>` +
    `</g></g>`
  );
}

// ─── icon sprite subsetting ─────────────────────────────────────────────────

interface Sprite {
  defs: string;
  used: string[];
  symbolOf: (iconId: string) => string | undefined;
}

function buildSprite(scene: Scene, icons: IconSource): Sprite {
  const ids = [...new Set(scene.nodes.map((n) => n.icon))].sort();
  const symbols: string[] = [];
  const map = new Map<string, string>();
  for (const id of ids) {
    const raw = icons.svg(id);
    if (raw === undefined) continue;
    const symbolId = 'ic-' + cssSafe(id);
    const extracted = extractSvg(raw, symbolId);
    if (!extracted) continue;
    symbols.push(`<symbol id="${symbolId}" viewBox="${esc(extracted.viewBox)}">${extracted.inner}</symbol>`);
    map.set(id, symbolId);
  }
  return {
    defs: symbols.join('\n'),
    used: [...map.keys()],
    symbolOf: (iconId) => map.get(iconId),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Prefix internal IDs, url references, and CSS classes to avoid collisions in a shared sprite. */
export function namespaceSvgInner(inner: string, prefix: string): string {
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(inner)) !== null) {
    if (match[1]) ids.add(match[1]);
  }

  let result = inner;
  for (const oldId of ids) {
    const newId = `${prefix}-${oldId}`;
    result = result.replace(new RegExp(`\\bid=(["'])${escapeRegex(oldId)}\\1`, 'g'), `id=$1${newId}$1`);
    result = result.replace(new RegExp(`url\\((["']?)#${escapeRegex(oldId)}\\1\\)`, 'g'), `url($1#${newId}$1)`);
    result = result.replace(new RegExp(`\\b((?:xlink:)?href)=(["'])#${escapeRegex(oldId)}\\2`, 'g'), `$1=$2#${newId}$2`);
    result = result.replace(new RegExp(`(#)${escapeRegex(oldId)}(?![a-zA-Z0-9_-])`, 'g'), `$1${newId}`);
  }

  // Find all class names declared in <style> blocks
  const classNames = new Set<string>();
  const styleMatches = inner.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi);
  for (const sm of styleMatches) {
    const styleContent = sm[1];
    if (!styleContent) continue;
    const classRegex = /\.([a-zA-Z0-9_-]+)(?=[^}]*\{)/g;
    let cm: RegExpExecArray | null;
    while ((cm = classRegex.exec(styleContent)) !== null) {
      if (cm[1]) classNames.add(cm[1]);
    }
  }

  if (classNames.size > 0) {
    result = result.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, styleContent: string) => {
      let scopedStyle = styleContent;
      for (const cls of classNames) {
        scopedStyle = scopedStyle.replace(new RegExp(`\\.${escapeRegex(cls)}(?![a-zA-Z0-9_-])`, 'g'), `.${prefix}-${cls}`);
      }
      return `<style>${scopedStyle}</style>`;
    });

    result = result.replace(/\bclass=(["'])([^"']*)\1/g, (_, q, classList: string) => {
      const rewritten = classList
        .split(/(\s+)/)
        .map((token) => (classNames.has(token) ? `${prefix}-${token}` : token))
        .join('');
      return `class=${q}${rewritten}${q}`;
    });
  }

  return result;
}

/** Pull viewBox + inner markup out of a standalone SVG file, optionally namespacing internal IDs. */
export function extractSvg(raw: string, symbolPrefix?: string): { viewBox: string; inner: string } | undefined {
  const cleaned = raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const open = cleaned.match(/<svg\b[^>]*>/i);
  if (!open) return undefined;
  const closeIdx = cleaned.lastIndexOf('</svg>');
  if (closeIdx === -1) return undefined;
  let inner = cleaned.slice((open.index ?? 0) + open[0].length, closeIdx).trim();

  let viewBox = /viewBox="([^"]+)"/i.exec(open[0])?.[1];
  if (!viewBox) {
    const w = /width="([^"]+)"/i.exec(open[0])?.[1]?.replace(/px$/i, '');
    const h = /height="([^"]+)"/i.exec(open[0])?.[1]?.replace(/px$/i, '');
    if (w && h && !Number.isNaN(Number(w)) && !Number.isNaN(Number(h))) {
      viewBox = `0 0 ${w} ${h}`;
    } else {
      viewBox = '0 0 100 100';
    }
  }

  if (symbolPrefix) {
    inner = namespaceSvgInner(inner, symbolPrefix);
  }

  return { viewBox, inner };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

