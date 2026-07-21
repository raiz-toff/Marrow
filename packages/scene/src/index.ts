/**
 * @marrow/scene — the GEOMETRIC contract of Marrow v2. The layout pipeline
 * produces a Scene; the geometry linter checks it; renderers draw it. All
 * coordinates are absolute pixels, origin top-left, y growing downward.
 * Zero dependencies by design.
 */

export interface Vec {
  x: number;
  y: number;
}

/** Axis-aligned rectangle; x/y is the top-left corner. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneNode {
  id: string;
  /** The icon chip box. */
  chip: Rect;
  /** The name label box (below the chip). */
  labelBox: Rect;
  /** chip ∪ labelBox — the box other geometry must respect. */
  box: Rect;
  label: string;
  /** Untruncated device name; present only when `label` was ellipsized. */
  title?: string;
  icon: string;
  status: string;
  hero: boolean;
  tier?: string;
  zone?: string;
  accent?: string;
  /** Cross-page stub ("door"): rendered dimmed, navigates on click. */
  ghost?: boolean;
  /** Page to open on click (relative to site root) instead of the inspector. */
  href?: string;
  /** Small chip badge, e.g. a device count on an aggregate node. */
  badge?: string;
}

export interface SceneEdgeEnd {
  node: string;
  port?: string;
}

export interface SceneEdge {
  id: string;
  from: SceneEdgeEnd;
  to: SceneEdgeEnd;
  /** Polyline waypoints, endpoints included, in draw order. */
  points: Vec[];
  status: string;
  animated: boolean;
  kind?: string;
  speed?: string;
  lag?: string;
  label?: string;
}

/**
 * A port-number chip, placed collision-free by layout. Renderers draw these
 * verbatim — placement logic lives in ONE place, so canvas and SVG can't drift.
 */
export interface ScenePortChip {
  box: Rect;
  label: string;
  /** Node whose port this annotates. */
  node: string;
  /** Owning edge — absent on "+N" summary chips, which stand for the ports
   *  of several edges that could not be placed without overlap. */
  edge?: string;
  summary?: boolean;
}

export interface SceneZone {
  id: string;
  name: string;
  box: Rect;
  /** 0 = top-level zone; children are deeper. */
  depth: number;
  accent?: string;
}

export interface Scene {
  size: { w: number; h: number };
  nodes: SceneNode[];
  edges: SceneEdge[];
  zones: SceneZone[];
  /** Collision-free port chips (absent on scenes from older pipelines). */
  portChips?: ScenePortChip[];
  /** Which layout preset produced this scene (informational). */
  archetype?: string;
}

// ─── geometry helpers (shared by layout and lint) ───────────────────────────

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by };
}

export function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function center(r: Rect): Vec {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function containsPoint(r: Rect, p: Vec, eps = 0): boolean {
  return p.x >= r.x - eps && p.x <= r.x + r.w + eps && p.y >= r.y - eps && p.y <= r.y + r.h + eps;
}

/**
 * True when segment p1→p2 passes through the INTERIOR of rect (touching the
 * border alone does not count) — Liang-Barsky clipping.
 */
export function segmentIntersectsRect(p1: Vec, p2: Vec, r: Rect): boolean {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - r.x, r.x + r.w - p1.x, p1.y - r.y, r.y + r.h - p1.y];
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  // The clipped span must have positive length AND its midpoint must be
  // STRICTLY inside — a segment gliding along the border never counts.
  if (t1 - t0 <= 1e-9) return false;
  const tm = (t0 + t1) / 2;
  const mx = p1.x + tm * dx;
  const my = p1.y + tm * dy;
  return mx > r.x + 1e-9 && mx < r.x + r.w - 1e-9 && my > r.y + 1e-9 && my < r.y + r.h - 1e-9;
}

/** True when segments a1→a2 and b1→b2 properly cross (shared endpoints excluded). */
export function segmentsCross(a1: Vec, a2: Vec, b1: Vec, b2: Vec): boolean {
  const d = (p: Vec, q: Vec, r: Vec): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const samePoint = (p: Vec, q: Vec): boolean => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
  if (samePoint(a1, b1) || samePoint(a1, b2) || samePoint(a2, b1) || samePoint(a2, b2)) return false;
  const d1 = d(b1, b2, a1);
  const d2 = d(b1, b2, a2);
  const d3 = d(a1, a2, b1);
  const d4 = d(a1, a2, b2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
