import type { Topology } from '@marrow/model';
import type { Rect, Scene, SceneEdge, SceneNode, SceneZone, Vec } from '@marrow/scene';
import { classify, findHubs, TIER_RANK, type Archetype } from './classify.js';
import { composeZones } from './compose.js';
import { elkLayout } from './elk.js';
import { placeCircle, placePolar } from './presets.js';
import { routeEdges, type RouteStyle } from './router.js';
import { placePortChips } from './portchips.js';
import { tidyEdges } from './tidy.js';
import { CHIP, LABEL_GAP, sizeNode, type NodeSizing } from './size.js';
import { zoneHulls } from './zones.js';
import { resolveLayoutMetrics, type LayoutMetrics } from './metrics.js';

export { classify, findHubs, TIER_RANK, type Archetype } from './classify.js';
export { CHIP, LABEL_GAP, LABEL_SIZE, MAX_LABEL_W, sizeNode, type NodeSizing } from './size.js';
export { resolveLayoutMetrics, type LayoutMetrics } from './metrics.js';
export { routeEdges, type RoutableEdge, type RouteStyle } from './router.js';
export { placeCircle, placePolar } from './presets.js';

const SCENE_MARGIN = 24;

export interface NodeMeta {
  ghost?: boolean;
  href?: string;
  badge?: string;
}

export interface LayoutOptions {
  /**
   * 'libavoid' (default): ELK places, the dedicated libavoid router routes —
   * per-side spread pins, obstacle-avoiding lanes.
   * 'elk': ELK's native orthogonal sections (fallback / comparison mode).
   */
  routing?: 'libavoid' | 'elk';
  /** Presentation annotations per device id (ghost stubs, page links, badges). */
  nodeMeta?: ReadonlyMap<string, NodeMeta>;
  /** Optional layout metrics override. */
  metrics?: LayoutMetrics;
}

/**
 * The P1 layout pipeline: classify → size (content-aware) → ELK layered
 * placement (tier partitions when declared) → libavoid orthogonal routing →
 * scene assembly with advisory zone hulls. Deterministic: canonically
 * sorted inputs, no randomness, no environment-dependent branches.
 */
export async function layoutTopology(t: Topology, options: LayoutOptions = {}): Promise<Scene> {
  const archetype: Archetype = classify(t);
  const routing = options.routing ?? 'libavoid';
  const metrics = options.metrics ?? resolveLayoutMetrics(t.density, t.scale);

  const sizing = new Map<string, NodeSizing>();
  for (const d of t.devices) sizing.set(d.id, sizeNode(d, metrics));

  let nodeBoxes: Map<string, Rect>;
  let edgePoints: Map<string, Vec[]>;
  let composedZones: SceneZone[] | undefined;

  const routable = t.links
    .filter((l) => l.from.device !== l.to.device)
    .map((l) => ({ id: l.id, from: l.from.device, to: l.to.device }));

  if (archetype === 'zoned') {
    // Per-zone ELK layouts packed into a mosaic; libavoid routes everything
    // against the final fixed geometry (zone boxes cannot overlap foreign
    // devices by construction).
    const composed = await composeZones(t, sizing, metrics);
    nodeBoxes = composed.nodeBoxes;
    composedZones = composed.zones;
    edgePoints = await routeEdges(nodeBoxes, routable);
  } else if (archetype === 'hub-spoke' || archetype === 'ring' || archetype === 'mesh') {
    // radial presets: symmetric placement + polyline routing (orthogonal
    // channels look wrong on circles)
    nodeBoxes =
      archetype === 'hub-spoke'
        ? placePolar(t, sizing, findHubs(t), metrics)
        : placeCircle(t, sizing, archetype === 'ring', metrics);
    const style: RouteStyle = 'polyline';
    edgePoints = await routeEdges(nodeBoxes, routable, style);
  } else {
    ({ nodeBoxes, edgePoints } = await elkLayout(t, sizing, archetype, metrics));
    if (routing === 'libavoid') {
      const routed = await routeEdges(nodeBoxes, routable);
      for (const [id, points] of routed) edgePoints.set(id, points);
    }
  }

  const nodes: SceneNode[] = [];
  for (const d of [...t.devices].sort((a, b) => a.id.localeCompare(b.id))) {
    const box = nodeBoxes.get(d.id);
    const s = sizing.get(d.id);
    if (!box || !s) continue;
    const chipW = s.chipSize;
    const chip: Rect = { x: box.x + (box.w - chipW) / 2, y: box.y, w: chipW, h: chipW };
    const labelBox: Rect = {
      x: box.x + (box.w - s.labelW) / 2,
      y: box.y + chipW + s.labelGap,
      w: s.labelW,
      h: s.labelH,
    };
    const node: SceneNode = {
      id: d.id,
      chip,
      labelBox,
      box,
      label: s.labelText,
      icon: d.icon,
      status: d.status,
      hero: d.hero,
      labelSize: s.labelSize,
    };
    if (s.labelFull !== undefined) node.title = s.labelFull;
    if (d.tier !== undefined) node.tier = d.tier;
    if (d.zone !== undefined) node.zone = d.zone;
    if (d.accent !== undefined) node.accent = d.accent;
    const meta = options.nodeMeta?.get(d.id);
    if (meta?.ghost) node.ghost = true;
    if (meta?.href !== undefined) node.href = meta.href;
    if (meta?.badge !== undefined) node.badge = meta.badge;
    nodes.push(node);
  }

  const edges: SceneEdge[] = [];
  for (const l of [...t.links].sort((a, b) => a.id.localeCompare(b.id))) {
    let points = edgePoints.get(l.id);
    if (l.from.device === l.to.device) {
      points = selfLoop(nodeBoxes.get(l.from.device));
    }
    if (!points || points.length < 2) continue;
    const edge: SceneEdge = {
      id: l.id,
      from: l.from.port !== undefined ? { node: l.from.device, port: l.from.port } : { node: l.from.device },
      to: l.to.port !== undefined ? { node: l.to.device, port: l.to.port } : { node: l.to.device },
      points,
      status: l.status,
      animated: l.animated,
    };
    if (l.kind !== undefined) edge.kind = l.kind;
    if (l.speed !== undefined) edge.speed = l.speed;
    if (l.lag !== undefined) edge.lag = l.lag;
    if (l.mode !== undefined) edge.mode = l.mode;
    if (l.vlans !== undefined) edge.vlans = l.vlans;
    if (l.nativeVlan !== undefined) edge.nativeVlan = l.nativeVlan;
    if (l.encap !== undefined) edge.encap = l.encap;
    if (l.protocol !== undefined) edge.protocol = l.protocol;
    if (l.lacp !== undefined) edge.lacp = l.lacp;
    if (l.label !== undefined) edge.label = l.label;
    edges.push(edge);
  }

  // cable-tray discipline: bundle parallels, reroute fan-outs onto gutter
  // buses (channelled presets only — radial shapes keep their spokes)
  if (archetype === 'zoned' || archetype === 'tiered' || archetype === 'flat') {
    tidyEdges(nodes, edges);
  }

  const zones = composedZones ?? zoneHulls(t, nodeBoxes, metrics);

  // Nested zone padding can push hulls to negative coordinates — translate
  // the whole scene so everything sits inside the canvas with a margin.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const seeRect = (r: Rect): void => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  };
  for (const n of nodes) seeRect(n.box);
  for (const z of zones) seeRect(z.box);
  for (const e of edges) {
    for (const p of e.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) {
    return {
      size: { w: 2 * SCENE_MARGIN, h: 2 * SCENE_MARGIN },
      nodes,
      edges,
      zones,
      portChips: [],
      archetype,
      density: metrics.density,
      scale: metrics.scale,
    };
  }
  const dx = SCENE_MARGIN - minX;
  const dy = SCENE_MARGIN - minY;
  const shiftRect = (r: Rect): void => {
    r.x = round2(r.x + dx);
    r.y = round2(r.y + dy);
  };
  for (const n of nodes) {
    shiftRect(n.box);
    shiftRect(n.chip);
    shiftRect(n.labelBox);
  }
  for (const z of zones) shiftRect(z.box);
  for (const e of edges) {
    for (const p of e.points) {
      p.x = round2(p.x + dx);
      p.y = round2(p.y + dy);
    }
  }

  return {
    size: { w: Math.ceil(maxX + dx + SCENE_MARGIN), h: Math.ceil(maxY + dy + SCENE_MARGIN) },
    nodes,
    edges,
    zones,
    portChips: placePortChips(nodes, edges, metrics),
    archetype,
    density: metrics.density,
    scale: metrics.scale,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A small loop off the node's east side for (discouraged) self-links. */
function selfLoop(box: Rect | undefined): Vec[] | undefined {
  if (!box) return undefined;
  const right = box.x + box.w;
  const yTop = box.y + box.h * 0.25;
  const yBottom = box.y + box.h * 0.55;
  return [
    { x: right, y: yTop },
    { x: right + 28, y: yTop },
    { x: right + 28, y: yBottom },
    { x: right, y: yBottom },
  ];
}
