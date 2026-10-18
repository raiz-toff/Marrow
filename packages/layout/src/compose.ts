import type { Device, Topology } from '@marrow/model';
import type { Rect, SceneZone, Vec } from '@marrow/scene';
import { TIER_RANK } from './classify.js';
import { elkLayout } from './elk.js';
import type { LayoutMetrics } from './metrics.js';
import type { NodeSizing } from './size.js';

/**
 * Zone-aware placement — the P4 compose pipeline. Every zone that directly
 * contains devices gets its own ELK layout; zone boxes (including nested
 * zones) pack into a shelf mosaic ordered by the tiers they contain, so an
 * edge/WAN zone lands above access-heavy zones and — critically — no zone box
 * ever overlaps a foreign device. Non-overlap is guaranteed by construction,
 * not by post-hoc fixing (the central v1 lesson).
 */

const PAD_X = 28;
const PAD_TOP = 46; // room for the zone label
const PAD_BOTTOM = 28;
const GAP = 56;

export interface ComposeResult {
  nodeBoxes: Map<string, Rect>;
  zones: SceneZone[];
}

interface ZoneLayout {
  /** zone id, or undefined for the pseudo-unit of zoneless devices. */
  id: string | undefined;
  w: number;
  h: number;
  /** local (origin-0) boxes of the zone's OWN devices */
  ownBoxes: Map<string, Rect>;
  /** packed position of 'self' (own-device block) and each child zone */
  itemPos: Map<string, Vec>;
  children: ZoneLayout[];
  /** smallest tier rank present anywhere inside (for storytelling order) */
  minRank: number;
}

export async function composeZones(
  t: Topology,
  sizing: ReadonlyMap<string, NodeSizing>,
  metrics?: LayoutMetrics,
): Promise<ComposeResult> {
  const devicesByZone = new Map<string, Device[]>();
  for (const d of t.devices) {
    const key = d.zone ?? '';
    const arr = devicesByZone.get(key);
    if (arr) arr.push(d);
    else devicesByZone.set(key, [d]);
  }
  const childZones = new Map<string, string[]>();
  for (const z of t.zones) {
    if (z.parent === undefined) continue;
    const arr = childZones.get(z.parent);
    if (arr) arr.push(z.id);
    else childZones.set(z.parent, [z.id]);
  }
  const hasContent = (zoneId: string, seen = new Set<string>()): boolean => {
    if (seen.has(zoneId)) return false;
    seen.add(zoneId);
    if ((devicesByZone.get(zoneId) ?? []).length > 0) return true;
    return (childZones.get(zoneId) ?? []).some((c) => hasContent(c, seen));
  };

  const measure = async (zoneId: string): Promise<ZoneLayout> => {
    const own = devicesByZone.get(zoneId) ?? [];
    const ownBoxes = own.length > 0 ? await layoutOwn(t, own, sizing, metrics) : new Map<string, Rect>();
    const children: ZoneLayout[] = [];
    for (const childId of (childZones.get(zoneId) ?? []).filter((c) => hasContent(c)).sort()) {
      children.push(await measure(childId));
    }
    return finishZone(zoneId, own, ownBoxes, children, metrics);
  };

  // Root items: top-level zones with content + a pseudo-unit for zoneless devices.
  const rootItems: ZoneLayout[] = [];
  for (const z of [...t.zones].sort((a, b) => a.id.localeCompare(b.id))) {
    if (z.parent !== undefined) continue;
    if (!hasContent(z.id)) continue;
    rootItems.push(await measure(z.id));
  }
  const zoneless = devicesByZone.get('') ?? [];
  if (zoneless.length > 0) {
    const ownBoxes = await layoutOwn(t, zoneless, sizing, metrics);
    const bounds = boundsOf(ownBoxes);
    rootItems.push({
      id: undefined,
      w: bounds.w,
      h: bounds.h,
      ownBoxes,
      itemPos: new Map([['self', { x: 0, y: 0 }]]),
      children: [],
      minRank: minRankOf(zoneless, []),
    });
  }

  // Pack the root mosaic in story order (edge/core zones first).
  const rootGap = metrics?.composeGap ?? GAP;
  rootItems.sort((a, b) => a.minRank - b.minRank || (a.id ?? '~').localeCompare(b.id ?? '~'));
  const rootPack = shelfPack(
    rootItems.map((z) => ({ id: z.id ?? '~unzoned', w: z.w, h: z.h })),
    rootGap,
  );

  const result: ComposeResult = { nodeBoxes: new Map(), zones: [] };
  const zoneMeta = new Map(t.zones.map((z) => [z.id, z]));
  const padX = metrics?.zonePad ?? PAD_X;
  const padTop = Math.round(padX * 1.64);
  const place = (zl: ZoneLayout, ox: number, oy: number, depth: number): void => {
    if (zl.id !== undefined) {
      const meta = zoneMeta.get(zl.id);
      const zone: SceneZone = {
        id: zl.id,
        name: meta?.name ?? zl.id,
        box: { x: ox, y: oy, w: zl.w, h: zl.h },
        depth,
      };
      if (meta?.accent !== undefined) zone.accent = meta.accent;
      result.zones.push(zone);
    }
    const innerX = ox + (zl.id !== undefined ? padX : 0);
    const innerY = oy + (zl.id !== undefined ? padTop : 0);
    const selfPos = zl.itemPos.get('self');
    if (selfPos) {
      for (const [deviceId, box] of zl.ownBoxes) {
        result.nodeBoxes.set(deviceId, {
          x: innerX + selfPos.x + box.x,
          y: innerY + selfPos.y + box.y,
          w: box.w,
          h: box.h,
        });
      }
    }
    for (const child of zl.children) {
      const pos = zl.itemPos.get(child.id ?? '~unzoned');
      if (pos) place(child, innerX + pos.x, innerY + pos.y, depth + 1);
    }
  };
  for (const zl of rootItems) {
    const pos = rootPack.positions.get(zl.id ?? '~unzoned');
    if (pos) place(zl, pos.x, pos.y, 0);
  }
  result.zones.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));
  return result;
}

/** ELK-layout a zone's own devices as an isolated subgraph, normalized to origin 0. */
async function layoutOwn(
  t: Topology,
  own: Device[],
  sizing: ReadonlyMap<string, NodeSizing>,
  metrics?: LayoutMetrics,
): Promise<Map<string, Rect>> {
  const ids = new Set(own.map((d) => d.id));
  const sub: Topology = {
    version: 2,
    name: '',
    theme: t.theme,
    zones: [],
    devices: own,
    links: t.links.filter(
      (l) => l.from.device !== l.to.device && ids.has(l.from.device) && ids.has(l.to.device),
    ),
  };
  const archetype = own.every((d) => d.tier !== undefined) ? 'tiered' : 'flat';
  const { nodeBoxes } = await elkLayout(sub, sizing, archetype, metrics);
  // strip ELK's own padding so zone chrome is applied exactly once
  let minX = Infinity;
  let minY = Infinity;
  for (const box of nodeBoxes.values()) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
  }
  const normalized = new Map<string, Rect>();
  for (const [id, box] of nodeBoxes) {
    normalized.set(id, { x: box.x - minX, y: box.y - minY, w: box.w, h: box.h });
  }
  return normalized;
}

function finishZone(
  zoneId: string,
  own: Device[],
  ownBoxes: Map<string, Rect>,
  children: ZoneLayout[],
  metrics?: LayoutMetrics,
): ZoneLayout {
  interface Item {
    id: string;
    w: number;
    h: number;
    rank: number;
  }
  const items: Item[] = [];
  if (own.length > 0) {
    const bounds = boundsOf(ownBoxes);
    items.push({ id: 'self', w: bounds.w, h: bounds.h, rank: minRankOf(own, []) });
  }
  for (const child of children) {
    items.push({ id: child.id ?? '~unzoned', w: child.w, h: child.h, rank: child.minRank });
  }
  items.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const gap = metrics?.composeGap ?? GAP;
  const packed = shelfPack(items, gap);
  const padX = metrics?.zonePad ?? PAD_X;
  const padTop = Math.round(padX * 1.64);
  const padBottom = padX;
  return {
    id: zoneId,
    w: packed.w + 2 * padX,
    h: packed.h + padTop + padBottom,
    ownBoxes,
    itemPos: packed.positions,
    children,
    minRank: Math.min(...items.map((i) => i.rank)),
  };
}

function minRankOf(devices: readonly Device[], children: readonly ZoneLayout[]): number {
  let min = 5;
  for (const d of devices) {
    if (d.tier !== undefined) min = Math.min(min, TIER_RANK[d.tier] ?? 5);
  }
  for (const c of children) min = Math.min(min, c.minRank);
  return min;
}

function boundsOf(boxes: ReadonlyMap<string, Rect>): { w: number; h: number } {
  let maxX = 0;
  let maxY = 0;
  for (const b of boxes.values()) {
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { w: maxX, h: maxY };
}

/**
 * Deterministic shelf packing that PRESERVES input order — callers pre-sort
 * by story rank, so rows read top-to-bottom in network order.
 */
export function shelfPack(
  items: ReadonlyArray<{ id: string; w: number; h: number }>,
  gap: number,
): { positions: Map<string, Vec>; w: number; h: number } {
  const positions = new Map<string, Vec>();
  if (items.length === 0) return { positions, w: 0, h: 0 };
  const totalArea = items.reduce((s, i) => s + (i.w + gap) * (i.h + gap), 0);
  const maxItemW = Math.max(...items.map((i) => i.w));
  const targetW = Math.max(maxItemW, Math.ceil(Math.sqrt(totalArea * 1.35)));
  let x = 0;
  let y = 0;
  let rowH = 0;
  let usedW = 0;
  for (const item of items) {
    if (x > 0 && x + item.w > targetW) {
      y += rowH + gap;
      x = 0;
      rowH = 0;
    }
    positions.set(item.id, { x, y });
    x += item.w + gap;
    rowH = Math.max(rowH, item.h);
    usedW = Math.max(usedW, x - gap);
  }
  return { positions, w: usedW, h: y + rowH };
}
