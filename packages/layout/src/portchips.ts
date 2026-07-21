import { rectsOverlap, type Rect, type SceneEdge, type SceneNode, type ScenePortChip, type Vec } from '@marrow/scene';

/**
 * Collision-free port-chip placement. Every edge endpoint with a port wants a
 * chip riding its own polyline near the attachment; parallel fan-ins used to
 * pile every chip on the same spot 26px out. Here each chip walks outward
 * along its edge until it clears everything already placed (nodes included) —
 * parallel runs cascade into a readable staircase. A chip that finds no room
 * inside its half of the edge is dropped and rolled into a per-node-side
 * "+N" summary chip; the full port list stays available in the inspector.
 *
 * Deterministic: scene edge order is canonical, no randomness, no fonts —
 * chip width comes from the same per-char estimate the renderers use.
 */

/** Chip geometry — must match .m-portlabel CSS and the canvas port pass. */
export const PORT_CHIP_H = 16;
export const PORT_CHIP_CHAR = 5.6; // 9px ui-monospace advance estimate
export const PORT_CHIP_PAD = 10;
const BASE_D = 26; // preferred distance from the attachment point
const STEP = 10; // walk increment while colliding
const MIN_D = 12; // closer than this reads as part of the node

export function chipWidth(label: string): number {
  return [...label].length * PORT_CHIP_CHAR + PORT_CHIP_PAD;
}

interface Want {
  edge: string;
  node: string;
  label: string;
  /** Polyline from the attachment point outward. */
  pts: Vec[];
  /** Cascade/summary grouping: node + departure side. */
  group: string;
}

export function placePortChips(nodes: readonly SceneNode[], edges: readonly SceneEdge[]): ScenePortChip[] {
  const wants: Want[] = [];
  for (const e of edges) {
    if (e.points.length < 2) continue;
    if (e.from.port !== undefined) {
      wants.push({ edge: e.id, node: e.from.node, label: e.from.port, pts: e.points, group: groupOf(e.from.node, e.points) });
    }
    if (e.to.port !== undefined) {
      const rev = [...e.points].reverse();
      wants.push({ edge: e.id, node: e.to.node, label: e.to.port, pts: rev, group: groupOf(e.to.node, rev) });
    }
  }

  const placed: ScenePortChip[] = [];
  const obstacles: Rect[] = nodes.map((n) => n.box);
  const dropped = new Map<string, { node: string; pts: Vec[]; count: number }>();

  for (const want of wants) {
    const w = chipWidth(want.label);
    const box = findSpot(want.pts, w, obstacles);
    if (box === undefined) {
      const d = dropped.get(want.group) ?? { node: want.node, pts: want.pts, count: 0 };
      d.count++;
      d.pts = want.pts; // remember one polyline of the group for the summary
      dropped.set(want.group, d);
      continue;
    }
    obstacles.push(box);
    placed.push({ box, label: want.label, node: want.node, edge: want.edge });
  }

  // one "+N" per crowded node side, competing for space like any other chip
  for (const [, d] of [...dropped.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const label = `+${d.count}`;
    const box = findSpot(d.pts, chipWidth(label), obstacles);
    if (box === undefined) continue; // genuinely no room — inspector still has it
    obstacles.push(box);
    placed.push({ box, label, node: d.node, summary: true });
  }
  return placed;
}

/** Walk outward along the polyline until the chip clears every obstacle.
 *  Never passes the midpoint — beyond it the chip would annotate the far end. */
function findSpot(pts: Vec[], w: number, obstacles: readonly Rect[]): Rect | undefined {
  const maxD = polyLength(pts) / 2;
  if (maxD < MIN_D) return undefined;
  for (let d = Math.min(BASE_D, maxD); d <= maxD; d += STEP) {
    const p = pointAlong(pts, d);
    const box: Rect = { x: p.x - w / 2, y: p.y - PORT_CHIP_H / 2, w, h: PORT_CHIP_H };
    if (!obstacles.some((o) => rectsOverlap(box, o))) return box;
  }
  return undefined;
}

function groupOf(node: string, pts: Vec[]): string {
  const dx = pts[1]!.x - pts[0]!.x;
  const dy = pts[1]!.y - pts[0]!.y;
  const side = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : dy >= 0 ? 's' : 'n';
  return `${node}|${side}`;
}

function polyLength(pts: Vec[]): number {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
  return len;
}

function pointAlong(pts: Vec[], d: number): Vec {
  let remaining = d;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= seg;
  }
  return pts.at(-1)!;
}
