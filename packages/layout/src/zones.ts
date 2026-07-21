import type { Topology } from '@marrow/model';
import { union, type Rect } from '@marrow/scene';
import type { SceneZone } from '@marrow/scene';

const ZONE_PAD = 28;

/**
 * P1 zone treatment: advisory hulls — the bounding box of member devices
 * (children zones included), padded, nesting-aware. Zone-aware PLACEMENT
 * (packing each zone's subgraph separately) is the P4 compose step; hulls
 * keep zones visible until then.
 */
export function zoneHulls(t: Topology, nodeBoxes: ReadonlyMap<string, Rect>): SceneZone[] {
  const childrenOf = new Map<string, string[]>();
  for (const z of t.zones) {
    if (z.parent === undefined) continue;
    const arr = childrenOf.get(z.parent);
    if (arr) arr.push(z.id);
    else childrenOf.set(z.parent, [z.id]);
  }

  const depthOf = (zoneId: string): number => {
    let depth = 0;
    let current = t.zones.find((z) => z.id === zoneId);
    const seen = new Set<string>();
    while (current?.parent !== undefined && !seen.has(current.id)) {
      seen.add(current.id);
      depth++;
      current = t.zones.find((z) => z.id === current!.parent);
    }
    return depth;
  };

  const hullOf = new Map<string, Rect | undefined>();
  const computeHull = (zoneId: string, stack: Set<string>): Rect | undefined => {
    if (hullOf.has(zoneId)) return hullOf.get(zoneId);
    if (stack.has(zoneId)) return undefined;
    stack.add(zoneId);
    let hull: Rect | undefined;
    for (const d of t.devices) {
      if (d.zone !== zoneId) continue;
      const box = nodeBoxes.get(d.id);
      if (!box) continue;
      hull = hull ? union(hull, box) : box;
    }
    for (const child of childrenOf.get(zoneId) ?? []) {
      const childHull = computeHull(child, stack);
      if (childHull) hull = hull ? union(hull, childHull) : childHull;
    }
    stack.delete(zoneId);
    const padded = hull
      ? { x: hull.x - ZONE_PAD, y: hull.y - ZONE_PAD, w: hull.w + 2 * ZONE_PAD, h: hull.h + 2 * ZONE_PAD }
      : undefined;
    hullOf.set(zoneId, padded);
    return padded;
  };

  const zones: SceneZone[] = [];
  for (const z of [...t.zones].sort((a, b) => a.id.localeCompare(b.id))) {
    const box = computeHull(z.id, new Set());
    if (!box) continue; // empty zone: nothing to draw
    const zone: SceneZone = { id: z.id, name: z.name, box, depth: depthOf(z.id) };
    if (z.accent !== undefined) zone.accent = z.accent;
    zones.push(zone);
  }
  // deeper zones draw later (on top)
  zones.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  return zones;
}
