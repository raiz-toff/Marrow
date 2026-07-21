import { AvoidLib } from 'libavoid-js';
import type { Rect, Vec } from '@marrow/scene';
import { CHIP } from './size.js';

/**
 * The dedicated edge-routing pass: libavoid (Adaptagrams) running in WASM at
 * build time. Placement stays fixed; every edge is re-routed orthogonally
 * around all node boxes with per-side connection pins spread proportionally,
 * so parallel links get their own lanes.
 *
 * Obstacle vs. attachment: the obstacle is the full node box (chip ∪ label) so
 * routes avoid label text, but pins sit on the icon chip (centered at the top
 * of the box) so lines visually touch the icon instead of stopping at the
 * invisible label-width boundary. South pins stay on the box bottom — the
 * label sits between the chip and that side.
 *
 * Spike-verified rules baked in (see docs/plans + the P1 spike):
 *  - version pinned to 0.5.0-beta.5 (`latest` is a beta dist-tag);
 *  - `performUnifyingNudgingPreprocessingStep=false` (50× speedup at scale);
 *  - nonzero shapeBufferDistance (the 0 default is pathological);
 *  - Router ctor + setRoutingType take NUMBERS (`.value`), while
 *    setRoutingParameter/Option take the enum OBJECT — mixing them up is a
 *    silent no-op;
 *  - one Router per build, processTransaction once, then delete().
 */

export interface RoutableEdge {
  id: string;
  from: string;
  to: string;
}

/** Outward direction flags (ConnDirFlag is not exposed by the binding). */
const DIR = { N: 1, S: 2, W: 4, E: 8 } as const;
type Side = keyof typeof DIR;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Anything = any;

let avoidInstance: Promise<Anything> | undefined;
function getAvoid(): Promise<Anything> {
  if (!avoidInstance) {
    avoidInstance = AvoidLib.load().then(() => AvoidLib.getInstance() as Anything);
  }
  return avoidInstance;
}

export type RouteStyle = 'orthogonal' | 'polyline';

export async function routeEdges(
  nodeBoxes: ReadonlyMap<string, Rect>,
  edges: readonly RoutableEdge[],
  style: RouteStyle = 'orthogonal',
): Promise<Map<string, Vec[]>> {
  const out = await routePass(nodeBoxes, edges, style === 'polyline', style);
  if (style === 'polyline') return out; // straight segments are legitimate here
  // L2 auto-repair: when directional pins make a connector infeasible (tight
  // corridors), libavoid silently falls back to a straight centre line —
  // detect the diagonal and re-route those edges with open pin visibility.
  const failed = edges.filter((e) => {
    const points = out.get(e.id);
    return points !== undefined && isDiagonalFallback(points);
  });
  if (failed.length > 0) {
    const repaired = await routePass(nodeBoxes, failed, true, style);
    for (const [id, points] of repaired) {
      if (!isDiagonalFallback(points)) out.set(id, points);
    }
  }
  return out;
}

function isDiagonalFallback(points: readonly Vec[]): boolean {
  if (points.length !== 2) return false;
  const [a, b] = [points[0]!, points[1]!];
  return Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01;
}

async function routePass(
  nodeBoxes: ReadonlyMap<string, Rect>,
  edges: readonly RoutableEdge[],
  openVisibility: boolean,
  style: RouteStyle,
): Promise<Map<string, Vec[]>> {
  const out = new Map<string, Vec[]>();
  if (edges.length === 0 || nodeBoxes.size === 0) return out;

  const Avoid = await getAvoid();
  const routerFlag =
    style === 'polyline' ? Avoid.RouterFlag.PolyLineRouting.value : Avoid.RouterFlag.OrthogonalRouting.value;
  const router = new Avoid.Router(routerFlag);
  // buffer 8 is spike-proven; larger buffers can seal narrow corridors shut
  // and break pin reachability entirely.
  router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance, 8);
  router.setRoutingParameter(Avoid.RoutingParameter.idealNudgingDistance, 8);
  router.setRoutingOption(Avoid.RoutingOption.performUnifyingNudgingPreprocessingStep, false);

  try {
    const shapes = new Map<string, Anything>();
    for (const [id, box] of [...nodeBoxes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const rect = new Avoid.Rectangle(
        new Avoid.Point(box.x, box.y),
        new Avoid.Point(box.x + box.w, box.y + box.h),
      );
      shapes.set(id, new Avoid.ShapeRef(router, rect)); // router owns the shape
    }

    // Assign each edge endpoint a side (toward the other node) and spread the
    // pins on each side proportionally, in deterministic order.
    interface End {
      edgeId: string;
      other: string;
    }
    const endsByNode = new Map<string, End[]>();
    const addEnd = (node: string, end: End): void => {
      const arr = endsByNode.get(node);
      if (arr) arr.push(end);
      else endsByNode.set(node, [end]);
    };
    for (const e of edges) {
      addEnd(e.from, { edgeId: e.id, other: e.to });
      addEnd(e.to, { edgeId: e.id, other: e.from });
    }

    const centerOf = (id: string): Vec => {
      const b = nodeBoxes.get(id)!;
      return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    };

    const pinClass = new Map<string, number>(); // `${edgeId}@${nodeId}` → classId
    let nextClass = 1;
    for (const [nodeId, ends] of [...endsByNode.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const shape = shapes.get(nodeId);
      const box = nodeBoxes.get(nodeId);
      if (!shape || !box) continue;
      const c = centerOf(nodeId);
      const buckets: Record<Side, End[]> = { N: [], S: [], W: [], E: [] };
      for (const end of ends) {
        if (!nodeBoxes.has(end.other)) continue;
        const oc = centerOf(end.other);
        const dx = oc.x - c.x;
        const dy = oc.y - c.y;
        const side: Side = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'N' : 'S') : (dx < 0 ? 'W' : 'E');
        buckets[side].push(end);
      }
      for (const side of ['N', 'S', 'W', 'E'] as const) {
        const list = buckets[side].sort((a, b) => {
          const ca = centerOf(a.other);
          const cb = centerOf(b.other);
          const axis = side === 'N' || side === 'S' ? ca.x - cb.x : ca.y - cb.y;
          return axis !== 0 ? axis : a.edgeId.localeCompare(b.edgeId);
        });
        // Chip rect derived from the box (same convention as scene assembly):
        // CHIP px square, centered horizontally, flush with the box top.
        const chipW = Math.min(CHIP, box.w);
        const chipH = Math.min(CHIP, box.h);
        const chipX0 = (box.w - chipW) / 2;
        list.forEach((end, i) => {
          const t = (i + 1) / (list.length + 1);
          let px: number;
          let py: number;
          if (side === 'W' || side === 'E') {
            // On the chip's vertical edge, spread within the chip's height.
            px = (chipX0 + (side === 'W' ? 0 : chipW)) / box.w;
            py = (t * chipH) / box.h;
          } else {
            // Spread within the chip's width; N on the chip top (= box top),
            // S on the box bottom (below the label — never through it).
            px = (chipX0 + t * chipW) / box.w;
            py = side === 'N' ? 0 : 1;
          }
          const classId = nextClass++;
          new Avoid.ShapeConnectionPin(shape, classId, px, py, true, 0, openVisibility ? 15 : DIR[side]);
          pinClass.set(`${end.edgeId}@${nodeId}`, classId);
        });
      }
    }

    const conns = new Map<string, Anything>();
    for (const e of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
      const fromClass = pinClass.get(`${e.id}@${e.from}`);
      const toClass = pinClass.get(`${e.id}@${e.to}`);
      const fromShape = shapes.get(e.from);
      const toShape = shapes.get(e.to);
      if (fromClass === undefined || toClass === undefined || !fromShape || !toShape) continue;
      const conn = new Avoid.ConnRef(
        router,
        new Avoid.ConnEnd(fromShape, fromClass),
        new Avoid.ConnEnd(toShape, toClass),
      );
      conn.setRoutingType(
        style === 'polyline' ? Avoid.ConnType.ConnType_PolyLine.value : Avoid.ConnType.ConnType_Orthogonal.value,
      );
      conns.set(e.id, conn);
    }

    router.processTransaction();

    for (const [id, conn] of conns) {
      const route = conn.displayRoute();
      const points: Vec[] = [];
      for (let i = 0; i < route.size(); i++) {
        const p = route.at(i);
        const last = points.at(-1);
        if (!last || last.x !== p.x || last.y !== p.y) points.push({ x: p.x, y: p.y });
      }
      if (points.length >= 2) out.set(id, points);
    }
  } finally {
    router.delete(); // frees router + all owned shapes/pins/connectors
  }
  return out;
}
