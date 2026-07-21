import ELKRaw from 'elkjs/lib/elk.bundled.js';
import type { Topology } from '@marrow/model';
import type { Rect, Vec } from '@marrow/scene';
import { TIER_RANK, type Archetype } from './classify.js';
import type { NodeSizing } from './size.js';

/** Minimal structural typing of the elkjs surface we use. */
interface ElkPoint {
  x: number;
  y: number;
}
interface ElkSection {
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
}
interface ElkChildIn {
  id: string;
  width: number;
  height: number;
  layoutOptions?: Record<string, string>;
}
interface ElkEdgeIn {
  id: string;
  sources: string[];
  targets: string[];
}
interface ElkGraphIn {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkChildIn[];
  edges: ElkEdgeIn[];
}
interface ElkGraphOut {
  children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>;
  edges?: Array<{ id: string; sections?: ElkSection[] }>;
}
type ElkInstance = { layout(graph: ElkGraphIn): Promise<ElkGraphOut> };

const ElkCtor = ELKRaw as new () => ElkInstance;

export interface ElkResult {
  nodeBoxes: Map<string, Rect>;
  edgePoints: Map<string, Vec[]>;
}

/**
 * Run ELK layered headlessly. Inputs are canonically sorted so the same
 * topology yields the same graph regardless of construction order; ELK
 * layered is deterministic for a fixed input.
 */
export async function elkLayout(
  t: Topology,
  sizing: ReadonlyMap<string, NodeSizing>,
  archetype: Archetype,
): Promise<ElkResult> {
  const tiered = archetype === 'tiered';
  const children: ElkChildIn[] = [...t.devices]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => {
      const s = sizing.get(d.id);
      if (!s) throw new Error(`no sizing for device ${d.id}`);
      const child: ElkChildIn = { id: d.id, width: s.w, height: s.h };
      if (tiered && d.tier) {
        child.layoutOptions = { 'elk.partitioning.partition': String(TIER_RANK[d.tier] ?? 4) };
      }
      return child;
    });

  const edges: ElkEdgeIn[] = [...t.links]
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((l) => l.from.device !== l.to.device)
    .map((l) => ({ id: l.id, sources: [l.from.device], targets: [l.to.device] }));

  const graph: ElkGraphIn = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '88',
      'elk.spacing.nodeNode': '48',
      // Disconnected components (e.g. devices whose only links leave their
      // zone) default to 20px apart — too tight for the router's buffer.
      'elk.spacing.componentComponent': '56',
      'elk.spacing.edgeNode': '24',
      'elk.spacing.edgeEdge': '14',
      'elk.layered.spacing.edgeNodeBetweenLayers': '28',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '14',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.padding': '[top=48,left=48,bottom=48,right=48]',
      ...(tiered ? { 'elk.partitioning.activate': 'true' } : {}),
    },
    children,
    edges,
  };

  const elk = new ElkCtor();
  const out = await elk.layout(graph);

  const nodeBoxes = new Map<string, Rect>();
  for (const c of out.children ?? []) {
    nodeBoxes.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, w: c.width ?? 0, h: c.height ?? 0 });
  }

  const edgePoints = new Map<string, Vec[]>();
  for (const e of out.edges ?? []) {
    const points: Vec[] = [];
    for (const s of e.sections ?? []) {
      const seg: Vec[] = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
      for (const p of seg) {
        const last = points.at(-1);
        if (!last || last.x !== p.x || last.y !== p.y) points.push({ x: p.x, y: p.y });
      }
    }
    edgePoints.set(e.id, points);
  }

  return { nodeBoxes, edgePoints };
}
