import type { Topology } from '@marrow/model';

/**
 * Layout archetypes, in precedence order:
 *  'zoned'     — ≥2 zones with devices → per-zone compose mosaic
 *  'tiered'    — every device declares a tier → ELK layered with partitions
 *  'ring'      — a single cycle → circular placement
 *  'hub-spoke' — one or two hubs own most links → polar placement
 *  'mesh'      — dense small graph → circular placement, polyline routing
 *  'flat'      — everything else → plain ELK layered
 * Declared structure (zones, tiers) always outranks inferred shape.
 */
export type Archetype = 'zoned' | 'tiered' | 'ring' | 'hub-spoke' | 'mesh' | 'flat';

/** Visual rank per tier: smaller = higher on the page. */
export const TIER_RANK: Record<string, number> = {
  edge: 0,
  core: 1,
  distribution: 2,
  access: 3,
  endpoint: 4,
  management: 4,
};

export function classify(t: Topology): Archetype {
  const n = t.devices.length;
  if (n === 0) return 'flat';
  const zonesWithDevices = new Set(t.devices.map((d) => d.zone).filter((z) => z !== undefined));
  if (zonesWithDevices.size >= 2) return 'zoned';
  if (t.devices.every((d) => d.tier !== undefined)) return 'tiered';
  if (n >= 4) {
    const neighbors = neighborMap(t);
    const degrees = [...neighbors.entries()].sort(
      (a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]),
    );
    // ring: connected, every device has exactly two neighbors
    if (degrees.every(([, nb]) => nb.size === 2) && isConnected(neighbors)) return 'ring';
    if (detectHubs(t) !== undefined) return 'hub-spoke';
    // mesh: small and dense
    const density = t.links.length / ((n * (n - 1)) / 2);
    const avgDegree = degrees.reduce((s, [, nb]) => s + nb.size, 0) / n;
    if (n <= 16 && density >= 0.4 && avgDegree >= 3) return 'mesh';
  }
  return 'flat';
}

/**
 * A topology is hub-spoke ONLY when it is pure: after picking the one or two
 * highest-degree devices as hubs, every other device must connect exclusively
 * to hubs. A single chained neighbor disqualifies (that shape belongs to the
 * layered engine).
 */
function detectHubs(t: Topology): string[] | undefined {
  const neighbors = neighborMap(t);
  const degrees = [...neighbors.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
  const candidates: string[][] = [];
  if (degrees[0] && degrees[0][1].size >= 3) candidates.push([degrees[0][0]]);
  if (degrees[0] && degrees[1] && degrees[0][1].size >= 3 && degrees[1][1].size >= 3) {
    candidates.push([degrees[0][0], degrees[1][0]]);
  }
  for (const hubs of candidates) {
    const hubSet = new Set(hubs);
    const pure = t.devices.every((d) => {
      if (hubSet.has(d.id)) return true;
      const nb = neighbors.get(d.id) ?? new Set();
      return nb.size >= 1 && [...nb].every((x) => hubSet.has(x));
    });
    if (pure) return hubs;
  }
  return undefined;
}

/** The hub devices of a hub-spoke topology (empty when the shape isn't pure). */
export function findHubs(t: Topology): string[] {
  return detectHubs(t) ?? [];
}

function neighborMap(t: Topology): Map<string, Set<string>> {
  const neighbors = new Map<string, Set<string>>();
  for (const d of t.devices) neighbors.set(d.id, new Set());
  for (const l of t.links) {
    if (l.from.device === l.to.device) continue;
    neighbors.get(l.from.device)?.add(l.to.device);
    neighbors.get(l.to.device)?.add(l.from.device);
  }
  return neighbors;
}

function isConnected(neighbors: ReadonlyMap<string, ReadonlySet<string>>): boolean {
  const ids = [...neighbors.keys()];
  if (ids.length === 0) return true;
  const seen = new Set<string>([ids[0]!]);
  const queue = [ids[0]!];
  while (queue.length > 0) {
    for (const nb of neighbors.get(queue.pop()!) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen.size === ids.length;
}
