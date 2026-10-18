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
  /** Scaled label font size in px. */
  labelSize?: number;
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
  /** Logical function — access | trunk | routed | tunnel | peering | stack. */
  mode?: string;
  /** VLAN set/range carried (trunk) or the access VLAN. */
  vlans?: string;
  /** Native (untagged) VLAN on a trunk. */
  nativeVlan?: number;
  /** Overlay/VPN encapsulation — ipsec | gre | vxlan | … */
  encap?: string;
  /** Routing / control-plane protocol — ospf | ebgp | … */
  protocol?: string;
  /** Aggregation control mode — active | passive | on | static | pagp. */
  lacp?: string;
  label?: string;
}

// ─── link visual language ────────────────────────────────────────────────────
// The single source of truth for how a link's logical semantics become a
// symbol. render-svg calls this directly; the (deliberately decoupled) runtime
// client mirrors it — keep the two in sync.

/** At-a-glance stroke pattern, set by the link's mode. Status dash still wins. */
export type LinkPattern = 'solid' | 'double' | 'dashed' | 'dotted' | 'thick';
/** A small glyph drawn with the midpoint chip. */
export type LinkGlyph = 'lock' | 'bundle' | 'vlan' | 'proto' | 'hop' | 'stack';

export interface LinkPresentation {
  /** Effective mode after deriving from attributes (encap ⇒ tunnel). */
  mode?: string;
  pattern: LinkPattern;
  /** Midpoint chip text, or undefined. */
  chip?: string;
  glyph?: LinkGlyph;
}

const ENCAP_LABEL: Record<string, string> = {
  ipsec: 'IPsec',
  gre: 'GRE',
  vxlan: 'VXLAN',
  wireguard: 'WG',
  dmvpn: 'DMVPN',
  mpls: 'MPLS',
  l2tp: 'L2TP',
  geneve: 'Geneve',
  ssl: 'SSL',
};

const PROTO_LABEL: Record<string, string> = {
  ospf: 'OSPF',
  ebgp: 'eBGP',
  ibgp: 'iBGP',
  bgp: 'BGP',
  eigrp: 'EIGRP',
  isis: 'IS-IS',
  rip: 'RIP',
  static: 'static',
};

/** Human label for an encap id (falls back to upper-case). */
export function encapLabel(encap: string): string {
  return ENCAP_LABEL[encap] ?? encap.toUpperCase();
}

/** Human label for a routing-protocol id (falls back to upper-case). */
export function protocolLabel(protocol: string): string {
  return PROTO_LABEL[protocol] ?? protocol.toUpperCase();
}

function clampChip(s: string, max = 10): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

/**
 * Resolve a link's logical semantics into a symbol. Pattern comes from the
 * mode; the chip carries the exact detail (VLANs / encap / protocol / lag).
 * A `lag` id always takes the chip — it's the aggregation identity — while the
 * mode still drives the pattern (so a LAG'd trunk reads as a double rail).
 */
export function linkPresentation(e: {
  mode?: string;
  vlans?: string;
  encap?: string;
  protocol?: string;
  lag?: string;
  lacp?: string;
}): LinkPresentation {
  const mode = e.mode ?? (e.encap !== undefined ? 'tunnel' : undefined);
  const pattern: LinkPattern =
    mode === 'trunk'
      ? 'double'
      : mode === 'tunnel'
        ? 'dashed'
        : mode === 'peering'
          ? 'dotted'
          : mode === 'stack'
            ? 'thick'
            : 'solid';

  let chip: string | undefined;
  let glyph: LinkGlyph | undefined;
  if (e.lag !== undefined) {
    chip = e.lag.toUpperCase();
    glyph = 'bundle';
  } else if (mode === 'tunnel') {
    chip = e.encap !== undefined ? encapLabel(e.encap) : 'VPN';
    glyph = 'lock';
  } else if (mode === 'trunk') {
    chip = e.vlans !== undefined ? clampChip(e.vlans) : 'trunk';
    glyph = 'vlan';
  } else if (mode === 'peering') {
    chip = e.protocol !== undefined ? protocolLabel(e.protocol) : 'peer';
    glyph = 'proto';
  } else if (mode === 'routed') {
    if (e.protocol !== undefined) {
      chip = protocolLabel(e.protocol);
      glyph = 'hop';
    }
  } else if (mode === 'stack') {
    chip = 'stack';
    glyph = 'stack';
  } else if (mode === 'access' && e.vlans !== undefined) {
    chip = 'v' + clampChip(e.vlans, 8);
    glyph = 'vlan';
  }

  const out: LinkPresentation = { pattern };
  if (mode !== undefined) out.mode = mode;
  if (chip !== undefined) out.chip = chip;
  if (glyph !== undefined) out.glyph = glyph;
  return out;
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
  /** Active layout density preset (compact | standard | spacious). */
  density?: string;
  /** Active layout scale multiplier. */
  scale?: number;
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
