import type { Topology } from '@marrow/model';
import type { Rect } from '@marrow/scene';
import type { NodeSizing } from './size.js';

/**
 * Non-layered placement presets: polar for hub-and-spoke, circular for rings
 * and meshes. Perfectly symmetric, deterministic, overlap-free by
 * construction — arc space is allocated from actual node widths, never from a
 * fixed count. Paired with POLYLINE routing (orthogonal channels look wrong
 * on radial shapes).
 */

import type { LayoutMetrics } from './metrics.js';

const RING_GAP = 48;
const MIN_RADIUS = 200;
const HUB_GAP = 72;

/** Hub(s) in the middle, spokes on a ring sized to fit them all. */
export function placePolar(
  t: Topology,
  sizing: ReadonlyMap<string, NodeSizing>,
  hubs: readonly string[],
  metrics?: LayoutMetrics,
): Map<string, Rect> {
  const ringGap = metrics?.ringGap ?? RING_GAP;
  const minRadius = metrics?.minRadius ?? MIN_RADIUS;
  const hubGap = metrics?.hubGap ?? HUB_GAP;

  const boxes = new Map<string, Rect>();
  const hubSet = new Set(hubs);
  const spokes = t.devices.filter((d) => !hubSet.has(d.id)).sort((a, b) => a.id.localeCompare(b.id));

  // hubs at the centre, side by side
  const hubSizes = hubs.map((id) => sizing.get(id)!);
  const hubsW = hubSizes.reduce((s, z) => s + z.w, 0) + (hubs.length - 1) * hubGap;
  const maxHubH = Math.max(...hubSizes.map((z) => z.h), 0);

  // ring radius from the space the spokes actually need
  const needed = spokes.reduce((s, d) => s + sizing.get(d.id)!.w + ringGap, 0);
  const radius = Math.max(minRadius, needed / (2 * Math.PI), hubsW * 0.9, maxHubH * 1.6);

  let x = -hubsW / 2;
  for (const id of hubs) {
    const s = sizing.get(id)!;
    boxes.set(id, { x, y: -s.h / 2, w: s.w, h: s.h });
    x += s.w + hubGap;
  }

  // allocate arc per spoke proportional to its width (start at 12 o'clock)
  let angle = -Math.PI / 2;
  const total = needed;
  for (const d of spokes) {
    const s = sizing.get(d.id)!;
    const arc = ((s.w + ringGap) / total) * 2 * Math.PI;
    const mid = angle + arc / 2;
    boxes.set(d.id, {
      x: Math.cos(mid) * radius - s.w / 2,
      y: Math.sin(mid) * radius - s.h / 2,
      w: s.w,
      h: s.h,
    });
    angle += arc;
  }
  return normalize(boxes);
}

/** Everyone on one circle — rings and small meshes. Ring order follows the
 *  cycle when one exists so neighbors sit adjacent. */
export function placeCircle(
  t: Topology,
  sizing: ReadonlyMap<string, NodeSizing>,
  followCycle: boolean,
  metrics?: LayoutMetrics,
): Map<string, Rect> {
  const ringGap = metrics?.ringGap ?? RING_GAP;
  const minRadius = metrics?.minRadius ?? MIN_RADIUS;
  const order = followCycle ? cycleOrder(t) : [...t.devices.map((d) => d.id)].sort();
  const boxes = new Map<string, Rect>();
  const needed = order.reduce((s, id) => s + (sizing.get(id)?.w ?? 64) + ringGap, 0);
  const radius = Math.max(minRadius, needed / (2 * Math.PI));
  let angle = -Math.PI / 2;
  for (const id of order) {
    const s = sizing.get(id);
    if (!s) continue;
    const arc = ((s.w + RING_GAP) / needed) * 2 * Math.PI;
    const mid = angle + arc / 2;
    boxes.set(id, {
      x: Math.cos(mid) * radius - s.w / 2,
      y: Math.sin(mid) * radius - s.h / 2,
      w: s.w,
      h: s.h,
    });
    angle += arc;
  }
  return normalize(boxes);
}

/** Walk the cycle so ring neighbors are placed adjacently. */
function cycleOrder(t: Topology): string[] {
  const neighbors = new Map<string, string[]>();
  for (const l of t.links) {
    if (l.from.device === l.to.device) continue;
    (neighbors.get(l.from.device) ?? neighbors.set(l.from.device, []).get(l.from.device)!).push(l.to.device);
    (neighbors.get(l.to.device) ?? neighbors.set(l.to.device, []).get(l.to.device)!).push(l.from.device);
  }
  const start = [...neighbors.keys()].sort()[0];
  if (start === undefined) return [...t.devices.map((d) => d.id)].sort();
  const order: string[] = [start];
  const seen = new Set<string>([start]);
  let current = start;
  for (;;) {
    const next = (neighbors.get(current) ?? []).filter((n) => !seen.has(n)).sort()[0];
    if (next === undefined) break;
    order.push(next);
    seen.add(next);
    current = next;
  }
  for (const d of [...t.devices.map((x) => x.id)].sort()) {
    if (!seen.has(d)) order.push(d);
  }
  return order;
}

function normalize(boxes: Map<string, Rect>): Map<string, Rect> {
  let minX = Infinity;
  let minY = Infinity;
  for (const b of boxes.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
  }
  const out = new Map<string, Rect>();
  for (const [id, b] of boxes) {
    out.set(id, { x: round2(b.x - minX + 48), y: round2(b.y - minY + 48), w: b.w, h: b.h });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
