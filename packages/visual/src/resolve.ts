/**
 * Scene → VisualScene: everything a renderer needs to paint, resolved once.
 * Coordinates are rounded to 2 dp, lengths to 1 dp; sorts compare code units;
 * nothing throws. Both tiers translate this verbatim (SVG to markup, canvas to
 * draw calls), so geometry, proportions and precedence are shared.
 */
import type { Scene, SceneEdge, SceneNode } from '@marrow/scene';
import { linkPresentation, edgeClasses } from './link.js';
import { foldEdge, flowOf, strokeOf, type Ctx, type Stroke } from './rules.js';
import {
  BEND_RADIUS,
  CHIP,
  FILLET_CHORDS,
  FLOW_SECONDS,
  modeSpec,
  normalizeStatus,
  PILL,
  statusRank,
  TIER_ORDER,
  type LinkGlyph,
} from './spec.js';
import { DEFAULT_THEMES, tokenValue, type Theme } from './tokens.js';

export interface Pill {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  textX: number;
  textY: number;
  fontPx: number;
  text: string;
}

export interface EdgePaint {
  id: string;
  classes: string;
  d: string;
  len: number;
  stroke: Stroke;
  rail?: Stroke;
  flow?: { dash: readonly number[]; period: number; seconds: number };
  label?: Pill;
  chip?: Pill & { glyph?: LinkGlyph; glyphX: number };
}

export interface NodePaint {
  id: string;
  classes: string;
  delay: number;
  chip: { x: number; y: number; w: number; h: number; r: number };
  ring: Stroke;
  icon: { x: number; y: number; w: number; h: number };
  led: { cx: number; cy: number; r: number; fill: string };
  badge?: Pill;
  label: { x: number; y: number; w: number; size: number; pin: boolean };
}

export interface VisualScene {
  edges: readonly EdgePaint[];
  nodes: readonly NodePaint[];
}

export interface Interaction {
  path?: boolean;
  selected?: boolean;
  focused?: boolean;
  dimmed?: boolean;
  far?: boolean;
}

// ─── numbers ─────────────────────────────────────────────────────────────────

const fin = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** Round to 2 dp; never yields -0. */
const r2 = (v: number): number => Math.round(fin(v) * 100) / 100 + 0;
const r1 = (v: number): number => Math.round(fin(v) * 10) / 10 + 0;
const dist = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
};

interface P {
  x: number;
  y: number;
}

function cleanPoints(points: unknown): P[] {
  if (!Array.isArray(points)) return [];
  const out: P[] = [];
  for (const p of points) {
    if (p && typeof p === 'object' && Number.isFinite((p as P).x) && Number.isFinite((p as P).y)) {
      out.push({ x: (p as P).x, y: (p as P).y });
    }
  }
  return out;
}

// ─── path geometry ───────────────────────────────────────────────────────────

/** Polyline → path with BEND_RADIUS quadratic fillets, plus its length. */
function edgePath(points: readonly P[]): { d: string; len: number } {
  if (points.length === 0) return { d: '', len: 0 };
  let cx = r2(points[0]!.x);
  let cy = r2(points[0]!.y);
  let d = `M${cx} ${cy}`;
  let len = 0;
  const lineTo = (x: number, y: number): void => {
    const nx = r2(x);
    const ny = r2(y);
    d += ` L${nx} ${ny}`;
    len += dist(cx, cy, nx, ny);
    cx = nx;
    cy = ny;
  };
  const quadTo = (qx: number, qy: number, x: number, y: number): void => {
    const kx = r2(qx);
    const ky = r2(qy);
    const nx = r2(x);
    const ny = r2(y);
    d += ` Q${kx} ${ky} ${nx} ${ny}`;
    let px = cx;
    let py = cy;
    for (let i = 1; i <= FILLET_CHORDS; i++) {
      const t = i / FILLET_CHORDS;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      const bx = a * cx + b * kx + c * nx;
      const by = a * cy + b * ky + c * ny;
      len += dist(px, py, bx, by);
      px = bx;
      py = by;
    }
    cx = nx;
    cy = ny;
  };
  if (points.length < 3) {
    for (let i = 1; i < points.length; i++) lineTo(points[i]!.x, points[i]!.y);
    return { d, len: r1(len) };
  }
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const p = points[i]!;
    const next = points[i + 1]!;
    const inLen = dist(prev.x, prev.y, p.x, p.y);
    const outLen = dist(p.x, p.y, next.x, next.y);
    // collinear or degenerate corners stay straight
    const cross = (p.x - prev.x) * (next.y - p.y) - (p.y - prev.y) * (next.x - p.x);
    const r = Math.min(BEND_RADIUS, inLen / 2, outLen / 2);
    if (inLen === 0 || outLen === 0 || Math.abs(cross) < 0.01 || r < 0.5) {
      lineTo(p.x, p.y);
      continue;
    }
    lineTo(p.x - ((p.x - prev.x) / inLen) * r, p.y - ((p.y - prev.y) / inLen) * r);
    quadTo(p.x, p.y, p.x + ((next.x - p.x) / outLen) * r, p.y + ((next.y - p.y) / outLen) * r);
  }
  const last = points[points.length - 1]!;
  lineTo(last.x, last.y);
  return { d, len: r1(len) };
}

/** Midpoint by orthogonal (Manhattan) arc length — what labels ride. */
function midpoint(points: readonly P[]): P {
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

// ─── edges ───────────────────────────────────────────────────────────────────

const NO_CTX: ReadonlySet<Ctx> = new Set();

function classSet(classes: string): Set<string> {
  return new Set(classes.split(' '));
}

function resolveEdge(e: SceneEdge, leaf: boolean, t: Theme): EdgePaint {
  const pts = cleanPoints(e.points);
  const { d, len } = edgePath(pts);
  const classes = edgeClasses(e) + (leaf ? ' m-leaf' : '');
  const folded = foldEdge(classSet(classes), NO_CTX);
  const pres = linkPresentation(e);
  const out: EdgePaint = { id: String(e.id), classes, d, len, stroke: strokeOf(folded, t) };
  if (modeSpec(pres.mode)?.rail === true) {
    out.rail = { color: t.palette.bg, width: t.links.widthSlot, dash: [], cap: 'butt', opacity: out.stroke.opacity };
  }
  if (folded.flow) out.flow = { ...flowOf(t), seconds: FLOW_SECONDS };

  const mid = pts.length > 0 ? midpoint(pts) : undefined;
  const label = typeof e.label === 'string' ? e.label : undefined;
  const hasLabel = mid !== undefined && label !== undefined && label.length <= PILL.label.maxChars;
  if (hasLabel) {
    const L = PILL.label;
    const w = label.length * L.charW + 2 * L.pad;
    out.label = {
      x: r2(mid.x - w / 2),
      y: r2(mid.y - L.h / 2),
      w: r2(w),
      h: L.h,
      r: L.h / 2,
      textX: r2(mid.x),
      textY: r2(mid.y + L.textDy),
      fontPx: L.fontPx,
      text: label,
    };
  }
  if (mid !== undefined && pres.chip !== undefined) {
    const C = PILL.chip;
    const cx = mid.x;
    const cy = mid.y + (hasLabel ? C.belowLabel : 0);
    const drawGlyph = pres.glyph === 'lock' || pres.glyph === 'bundle';
    const glyphW = drawGlyph ? C.glyphW : 0;
    const textW = Math.max(pres.chip.length * C.charW, C.minTextW);
    const w = C.padX * 2 + glyphW + textW;
    const x = cx - w / 2;
    const chip: NonNullable<EdgePaint['chip']> = {
      x: r2(x),
      y: r2(cy - C.h / 2),
      w: r2(w),
      h: C.h,
      r: C.h / 2,
      textX: r2(x + C.padX + glyphW + textW / 2),
      textY: r2(cy + C.textDy),
      fontPx: C.fontPx,
      text: pres.chip,
      glyphX: r2(x + C.padX),
    };
    if (pres.glyph !== undefined) chip.glyph = pres.glyph;
    out.chip = chip;
  }
  return out;
}

const codeUnitCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// ─── nodes ───────────────────────────────────────────────────────────────────

const EMOJI = /[‍️]|\p{Extended_Pictographic}/u;

/** Chip proportions at a given chip width. */
function chipMetrics(w: number): { r: number; inset: number; cornerArc: number; ledR: number } {
  const r = Math.round(w * CHIP.radius);
  return {
    r,
    inset: Math.round(w * CHIP.iconInset),
    // the chip's corner arc at 45°: LED and badge centre here
    cornerArc: Math.round(r * (1 - 1 / Math.SQRT2) * 10) / 10,
    ledR: Math.max(CHIP.ledMin, Math.round(w * CHIP.ledRadius * 10) / 10),
  };
}

function resolveNode(n: SceneNode, delay: number, t: Theme): NodePaint {
  const box = n.chip ?? { x: 0, y: 0, w: 0, h: 0 };
  const cx = fin(box.x);
  const cy = fin(box.y);
  const cw = fin(box.w);
  const ch = fin(box.h);
  const m = chipMetrics(cw);
  const status = normalizeStatus(n.status);
  const classes = `m-node m-status-${status}${n.hero ? ' m-hero' : ''}${n.ghost ? ' m-ghost' : ''}`;
  const statusColor = tokenValue(t, `--${status}`);
  const lb = n.labelBox ?? { x: 0, y: 0, w: 0, h: 0 };
  const label = typeof n.label === 'string' ? n.label : '';
  const out: NodePaint = {
    id: String(n.id),
    classes,
    delay: r2(delay),
    chip: { x: r2(cx), y: r2(cy), w: r2(cw), h: r2(ch), r: m.r },
    ring: nodeRing(classes, {}, t),
    icon: { x: r2(cx + m.inset), y: r2(cy + m.inset), w: r2(cw - 2 * m.inset), h: r2(ch - 2 * m.inset) },
    led: {
      cx: r2(cx + cw - m.cornerArc),
      cy: r2(cy + m.cornerArc),
      r: m.ledR,
      fill: typeof statusColor === 'string' ? statusColor : t.status.unknown,
    },
    label: {
      x: r2(fin(lb.x) + fin(lb.w) / 2),
      y: r2(fin(lb.y) + fin(lb.h) - 4),
      w: r2(fin(lb.w)),
      size: typeof n.labelSize === 'number' && Number.isFinite(n.labelSize) ? n.labelSize : 12,
      pin: !EMOJI.test(label),
    },
  };
  if (typeof n.badge === 'string' && n.badge !== '') {
    // mirrors the LED: right cap centred on the bottom-right corner arc
    const B = PILL.badge;
    const w = Math.max(B.minW, n.badge.length * B.charW + B.pad);
    const bcx = cx + cw - m.cornerArc;
    const bcy = cy + ch - m.cornerArc;
    out.badge = {
      x: r2(bcx + B.h / 2 - w),
      y: r2(bcy - B.h / 2),
      w: r2(w),
      h: B.h,
      r: B.h / 2,
      textX: r2(bcx + B.h / 2 - w / 2),
      textY: r2(bcy + B.textDy),
      fontPx: B.fontPx,
      text: n.badge,
    };
  }
  return out;
}

function nodeRing(classes: string, s: Interaction, t: Theme): Stroke {
  const hero = classes.includes(' m-hero');
  const ghost = classes.includes(' m-ghost');
  let color = t.palette.chipLine;
  let width: number = CHIP.ringWidth;
  if (s.focused) color = t.palette.inkDim;
  if (hero) {
    color = t.palette.ring;
    width = CHIP.heroWidth;
  }
  if (s.path) color = t.palette.ring;
  if (s.selected) {
    color = t.palette.ring;
    width = CHIP.selectedWidth;
  }
  return {
    color,
    width,
    dash: ghost ? CHIP.ghostDash : [],
    cap: 'butt',
    opacity: s.dimmed ? CHIP.dimOpacity : ghost ? CHIP.ghostOpacity : 1,
  };
}

// ─── public resolution ───────────────────────────────────────────────────────

export function resolveScene(scene: Scene, theme: Theme = DEFAULT_THEMES.dark): VisualScene {
  const nodes = Array.isArray(scene?.nodes) ? scene.nodes : [];
  const edges = Array.isArray(scene?.edges) ? scene.edges : [];
  const tierOf = new Map<string, string | undefined>();
  for (const n of nodes) tierOf.set(n.id, n.tier);

  const edgePaints = edges
    .map((e) => {
      const leaf = tierOf.get(e.from?.node) === 'endpoint' || tierOf.get(e.to?.node) === 'endpoint';
      return { rank: statusRank(e.status), paint: resolveEdge(e, leaf, theme) };
    })
    .sort((a, b) => a.rank - b.rank || codeUnitCompare(a.paint.id, b.paint.id))
    .map((x) => x.paint);

  const rankIndex = new Map<number, number>();
  const nodePaints = nodes.map((n) => {
    const rank = TIER_ORDER[n.tier ?? ''] ?? 2;
    const idx = rankIndex.get(rank) ?? 0;
    rankIndex.set(rank, idx + 1);
    return resolveNode(n, Math.min(0.15 + rank * 0.13 + idx * 0.03, 1.4), theme);
  });

  return { edges: edgePaints, nodes: nodePaints };
}

const classCache = new WeakMap<EdgePaint, Set<string>>();

/** An edge's stroke under interaction state (path/selection, focus dim, far LOD). */
export function interactEdge(p: EdgePaint, s: Interaction, t: Theme): Stroke {
  let base = classCache.get(p);
  if (base === undefined) {
    base = classSet(p.classes);
    classCache.set(p, base);
  }
  let classes: ReadonlySet<string> = base;
  if (s.path || s.selected) {
    const c = new Set(base);
    if (s.path) c.add('is-path');
    if (s.selected) c.add('is-selected');
    classes = c;
  }
  const ctx = new Set<Ctx>();
  if (s.far) ctx.add('far');
  if (s.dimmed) ctx.add('dimmed');
  return strokeOf(foldEdge(classes, ctx), t);
}

/** A node chip's ring stroke under interaction state. */
export function interactNode(p: NodePaint, s: Interaction, t: Theme): Stroke {
  return nodeRing(p.classes, s, t);
}

