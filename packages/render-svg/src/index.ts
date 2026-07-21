import { truncateToWidth } from '@marrow/metrics';
import type { Scene, SceneEdge, SceneNode, ScenePortChip, SceneZone } from '@marrow/scene';

/**
 * @marrow/render-svg — the "lush tier" renderer: Scene → classed, data-attributed
 * SVG markup. Pure string generation; all styling/motion lives in the site
 * stylesheet, all behavior in the runtime. The renderer's contract:
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

const TIER_ORDER: Record<string, number> = {
  edge: 0,
  core: 1,
  distribution: 2,
  access: 3,
  endpoint: 4,
  management: 4,
};

export function renderScene(scene: Scene, options: RenderOptions): RenderedSvg {
  const sprite = buildSprite(scene, options.icons);
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
  const tierOf = new Map(scene.nodes.map((n) => [n.id, n.tier]));
  const statusRank: Record<string, number> = { up: 0, unknown: 1, planned: 2, degraded: 3, down: 4 };
  const drawOrder = [...scene.edges].sort(
    (a, b) => (statusRank[a.status] ?? 0) - (statusRank[b.status] ?? 0) || a.id.localeCompare(b.id),
  );
  for (const e of drawOrder) {
    const leaf = tierOf.get(e.from.node) === 'endpoint' || tierOf.get(e.to.node) === 'endpoint';
    parts.push(renderEdge(e, leaf));
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
  const rankIndex = new Map<number, number>();
  for (const n of scene.nodes) {
    const rank = TIER_ORDER[n.tier ?? ''] ?? 2;
    const idx = rankIndex.get(rank) ?? 0;
    rankIndex.set(rank, idx + 1);
    parts.push(renderNode(n, rank, idx, sprite.symbolOf));
  }
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

function renderEdge(e: SceneEdge, leaf = false): string {
  const d = roundedPath(e.points);
  const speedClass = e.speed ? ` m-speed-${cssSafe(e.speed)}` : '';
  const animated = e.animated ? ' m-flow' : '';
  const leafClass = leaf ? ' m-leaf' : '';
  const lag = e.lag !== undefined ? ` data-lag="${esc(e.lag)}"` : '';
  const meta = [e.from.port, e.to.port, e.speed, e.kind].filter(Boolean).join(' · ');
  const path =
    `<path class="m-edge m-status-${cssSafe(e.status)}${speedClass}${animated}${leafClass}" pathLength="1" d="${d}" ` +
    `data-edge="${esc(e.id)}" data-from="${esc(e.from.node)}" data-to="${esc(e.to.node)}"` +
    `${e.from.port !== undefined ? ` data-from-port="${esc(e.from.port)}"` : ''}` +
    `${e.to.port !== undefined ? ` data-to-port="${esc(e.to.port)}"` : ''}` +
    `${e.kind !== undefined ? ` data-kind="${esc(e.kind)}"` : ''}` +
    `${e.speed !== undefined ? ` data-speed="${esc(e.speed)}"` : ''}` +
    `${lag} data-meta="${esc(meta)}"/>`;
  let extras = '';
  // aggregate labels ("×24") ride the midpoint of the polyline
  if (e.label !== undefined && e.label.length <= 6) {
    const mid = polylineMidpoint(e.points);
    extras +=
      `<g class="m-edge-label"><rect x="${mid.x - e.label.length * 4 - 6}" y="${mid.y - 9}" width="${e.label.length * 8 + 12}" height="18" rx="9"/>` +
      `<text x="${mid.x}" y="${mid.y + 4}" text-anchor="middle">${esc(e.label)}</text></g>`;
  }
  return path + extras;
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

function polylineMidpoint(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1]!.x - points[i]!.x) + Math.abs(points[i + 1]!.y - points[i]!.y);
  }
  let remaining = total / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const seg = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return points[0] ?? { x: 0, y: 0 };
}

function renderNode(
  n: SceneNode,
  rank: number,
  indexInRank: number,
  symbolOf: (iconId: string) => string | undefined,
): string {
  const delay = Math.min(0.15 + rank * 0.13 + indexInRank * 0.03, 1.4);
  const hero = n.hero ? ' m-hero' : '';
  const ghost = n.ghost ? ' m-ghost' : '';
  const accent = n.accent ? ` style="--d:${delay}s;--m-accent:${esc(n.accent)}"` : ` style="--d:${delay}s"`;
  const symbol = symbolOf(n.icon);
  const iconMarkup = symbol
    ? `<use href="#${symbol}" x="${n.chip.x + 8}" y="${n.chip.y + 8}" width="${n.chip.w - 16}" height="${n.chip.h - 16}"/>`
    : `<text x="${n.chip.x + n.chip.w / 2}" y="${n.chip.y + n.chip.h / 2 + 5}" text-anchor="middle" class="m-icon-fallback">${esc(
        n.label.slice(0, 2).toUpperCase(),
      )}</text>`;
  const badgeW = n.badge ? Math.max(17, n.badge.length * 7 + 12) : 0;
  const badge = n.badge
    ? `<g class="m-badge"><rect x="${n.chip.x + n.chip.w - 3.8 + 8.5 - badgeW}" y="${n.chip.y + n.chip.h - 12.3}" width="${badgeW}" height="17" rx="8.5"/><text x="${n.chip.x + n.chip.w - 3.8 + 8.5 - badgeW / 2}" y="${n.chip.y + n.chip.h + 0.2}" text-anchor="middle">${esc(n.badge)}</text></g>`
    : '';
  return (
    `<g class="m-node m-status-${cssSafe(n.status)}${hero}${ghost}" data-node="${esc(n.id)}"` +
    `${n.tier !== undefined ? ` data-tier="${esc(n.tier)}"` : ''}` +
    `${n.zone !== undefined ? ` data-zone="${esc(n.zone)}"` : ''}` +
    `${n.href !== undefined ? ` data-href="${esc(n.href)}"` : ''}${accent} tabindex="0" role="button" aria-label="${esc(n.title ?? n.label)}">` +
    `${n.title !== undefined ? `<title>${esc(n.title)}</title>` : ''}` +
    `<g class="m-node-inner m-enter-node">` +
    `<rect class="m-chip" x="${n.chip.x}" y="${n.chip.y}" width="${n.chip.w}" height="${n.chip.h}" rx="13"/>` +
    iconMarkup +
    `<circle class="m-led" cx="${n.chip.x + n.chip.w - 3.8}" cy="${n.chip.y + 3.8}" r="4.2"/>` +
    badge +
    // textLength pins the client's font to the width layout reserved — the
    // label cannot overflow its box no matter which system font renders it.
    // Not for emoji labels: the metrics table counts each codepoint of a
    // ZWJ sequence, so pinning would visibly stretch the single drawn glyph.
    `<text class="m-label" x="${n.labelBox.x + n.labelBox.w / 2}" y="${n.labelBox.y + n.labelBox.h - 4}" text-anchor="middle"${
      /[\u200d\ufe0f]|\p{Extended_Pictographic}/u.test(n.label)
        ? ''
        : ` textLength="${n.labelBox.w}" lengthAdjust="spacingAndGlyphs"`
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
    const extracted = extractSvg(raw);
    if (!extracted) continue;
    const symbolId = 'ic-' + cssSafe(id);
    symbols.push(`<symbol id="${symbolId}" viewBox="${esc(extracted.viewBox)}">${extracted.inner}</symbol>`);
    map.set(id, symbolId);
  }
  return {
    defs: symbols.join('\n'),
    used: [...map.keys()],
    symbolOf: (iconId) => map.get(iconId),
  };
}

/** Corner radius for edge bends — the chrome's --radius, so wires follow the
 *  same rounding language as every panel and chip. */
const EDGE_BEND_RADIUS = 8;

/** Polyline → path with filleted corners (quadratic curves at each bend). */
export function roundedPath(points: ReadonlyArray<{ x: number; y: number }>, radius = EDGE_BEND_RADIUS): string {
  if (points.length < 3) return 'M' + points.map((p) => `${p.x} ${p.y}`).join(' L');
  const fmt = (v: number): string => String(Math.round(v * 100) / 100);
  let d = `M${fmt(points[0]!.x)} ${fmt(points[0]!.y)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const p = points[i]!;
    const next = points[i + 1]!;
    const inLen = Math.hypot(p.x - prev.x, p.y - prev.y);
    const outLen = Math.hypot(next.x - p.x, next.y - p.y);
    // collinear or degenerate corners stay straight
    const cross = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (inLen === 0 || outLen === 0 || Math.abs(cross) < 0.01 || r < 0.5) {
      d += ` L${fmt(p.x)} ${fmt(p.y)}`;
      continue;
    }
    const inX = p.x - ((p.x - prev.x) / inLen) * r;
    const inY = p.y - ((p.y - prev.y) / inLen) * r;
    const outX = p.x + ((next.x - p.x) / outLen) * r;
    const outY = p.y + ((next.y - p.y) / outLen) * r;
    d += ` L${fmt(inX)} ${fmt(inY)} Q${fmt(p.x)} ${fmt(p.y)} ${fmt(outX)} ${fmt(outY)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

/** Pull viewBox + inner markup out of a standalone SVG file. */
export function extractSvg(raw: string): { viewBox: string; inner: string } | undefined {
  const cleaned = raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const open = cleaned.match(/<svg\b[^>]*>/i);
  if (!open) return undefined;
  const closeIdx = cleaned.lastIndexOf('</svg>');
  if (closeIdx === -1) return undefined;
  const inner = cleaned.slice((open.index ?? 0) + open[0].length, closeIdx).trim();
  const viewBox = /viewBox="([^"]+)"/i.exec(open[0])?.[1] ?? '0 0 100 100';
  return { viewBox, inner };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
