import { byId, compareIds, type Topology } from '@marrow/model';
import type { Rect } from '@marrow/scene';
import type { NodeSizing } from './size.js';
import type { LayoutMetrics } from './metrics.js';

/**
 * Non-layered placement presets: polar for hub-and-spoke, circular for rings
 * and meshes. Perfectly symmetric, deterministic, overlap-free by
 * construction — arc space is allocated from actual node footprints, never
 * from a fixed count, and the radius is then grown until every pair of boxes
 * clears by the density's ring gap along the straight line between them.
 * Paired with POLYLINE routing (orthogonal channels look wrong on radial
 * shapes).
 */

const RING_GAP = 48;
const MIN_RADIUS = 200;
const HUB_GAP = 72;

interface Slot {
  id: string;
  w: number;
  h: number;
}

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
  const spokes = t.devices.filter((d) => !hubSet.has(d.id)).sort(byId);

  // hubs at the centre, side by side
  const hubSizes = hubs.map((id) => sizing.get(id)!);
  const hubsW = hubSizes.reduce((s, z) => s + z.w, 0) + (hubs.length - 1) * hubGap;
  const maxHubH = Math.max(...hubSizes.map((z) => z.h), 0);

  let x = -hubsW / 2;
  for (const id of hubs) {
    const s = sizing.get(id)!;
    boxes.set(id, { x, y: -s.h / 2, w: s.w, h: s.h });
    x += s.w + hubGap;
  }

  const slots = spokes.map((d) => slotOf(d.id, sizing.get(d.id)!));
  const ring = ringLayout(slots, ringGap, minRadius);
  // aesthetic floor (edges long enough to read) + exact clearance of the hub block
  let radius = Math.max(ring.radius, hubsW * 0.9, maxHubH * 1.6);
  if (hubs.length > 0) {
    slots.forEach((s, i) => {
      // the hub block is centred on the origin, so the spoke sits `radius` away along its own angle
      radius = Math.max(radius, clearDistance(ring.angles[i]!, hubsW / 2 + s.w / 2 + ringGap, maxHubH / 2 + s.h / 2 + ringGap));
    });
  }
  placeSlots(boxes, slots, ring.angles, radius);
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
  const order = followCycle ? cycleOrder(t) : [...t.devices.map((d) => d.id)].sort(compareIds);
  const slots: Slot[] = [];
  for (const id of order) {
    const s = sizing.get(id);
    if (s) slots.push(slotOf(id, s));
  }
  const ring = ringLayout(slots, ringGap, minRadius);
  const boxes = new Map<string, Rect>();
  placeSlots(boxes, slots, ring.angles, ring.radius);
  return normalize(boxes);
}

function slotOf(id: string, s: NodeSizing): Slot {
  return { id, w: s.w, h: s.h };
}

/**
 * Angles (clockwise from 12 o'clock) and radius for boxes on one circle.
 *
 * Each box gets arc proportional to `max(w, h) + gap`: a tangent can be
 * horizontal (top/bottom, width matters) or vertical (the sides, height
 * matters), so the larger side is what the box can need. Arc length is not
 * clearance, though — the chord is shorter than the arc and a diagonal chord
 * needs more than either side — so the radius is then raised until every
 * PAIR clears exactly: two axis-aligned boxes whose centres are D apart in
 * direction φ are disjoint iff D·|cos φ| ≥ w̄ or D·|sin φ| ≥ h̄ (w̄, h̄ = the
 * mean sides plus the gap). Angles are fixed fractions of the turn, so each
 * pair's chord grows linearly with the radius and the bound is closed-form.
 */
function ringLayout(slots: readonly Slot[], gap: number, minRadius: number): { angles: number[]; radius: number } {
  const spans = slots.map((s) => Math.max(s.w, s.h) + gap);
  const total = spans.reduce((a, b) => a + b, 0);
  const angles: number[] = [];
  let angle = -Math.PI / 2;
  for (const span of spans) {
    const arc = total > 0 ? (span / total) * 2 * Math.PI : 0;
    angles.push(angle + arc / 2);
    angle += arc;
  }
  let radius = Math.max(minRadius, total / (2 * Math.PI));
  for (let i = 0; i < slots.length; i++) {
    for (let k = i + 1; k < slots.length; k++) {
      const a = slots[i]!;
      const b = slots[k]!;
      let theta = Math.abs(angles[k]! - angles[i]!);
      if (theta > Math.PI) theta = 2 * Math.PI - theta;
      const halfSin = Math.sin(theta / 2);
      if (halfSin <= 0) continue;
      // chord direction is perpendicular to the bisector of the two angles
      const phi = (angles[i]! + angles[k]!) / 2 + Math.PI / 2;
      const need = clearDistance(phi, (a.w + b.w) / 2 + gap, (a.h + b.h) / 2 + gap);
      radius = Math.max(radius, need / (2 * halfSin));
    }
  }
  return { angles, radius };
}

/** Smallest centre distance along direction `phi` that separates two boxes
 *  with summed half-extents `hw` × `hh`. */
function clearDistance(phi: number, hw: number, hh: number): number {
  const c = Math.abs(Math.cos(phi));
  const s = Math.abs(Math.sin(phi));
  return Math.min(c > 1e-9 ? hw / c : Infinity, s > 1e-9 ? hh / s : Infinity);
}

function placeSlots(boxes: Map<string, Rect>, slots: readonly Slot[], angles: readonly number[], radius: number): void {
  slots.forEach((s, i) => {
    const mid = angles[i]!;
    boxes.set(s.id, {
      x: Math.cos(mid) * radius - s.w / 2,
      y: Math.sin(mid) * radius - s.h / 2,
      w: s.w,
      h: s.h,
    });
  });
}

/** Walk the cycle so ring neighbors are placed adjacently. */
function cycleOrder(t: Topology): string[] {
  const neighbors = new Map<string, string[]>();
  for (const l of t.links) {
    if (l.from.device === l.to.device) continue;
    (neighbors.get(l.from.device) ?? neighbors.set(l.from.device, []).get(l.from.device)!).push(l.to.device);
    (neighbors.get(l.to.device) ?? neighbors.set(l.to.device, []).get(l.to.device)!).push(l.from.device);
  }
  const start = [...neighbors.keys()].sort(compareIds)[0];
  if (start === undefined) return [...t.devices.map((d) => d.id)].sort(compareIds);
  const order: string[] = [start];
  const seen = new Set<string>([start]);
  let current = start;
  for (;;) {
    const next = (neighbors.get(current) ?? []).filter((n) => !seen.has(n)).sort(compareIds)[0];
    if (next === undefined) break;
    order.push(next);
    seen.add(next);
    current = next;
  }
  for (const d of [...t.devices.map((x) => x.id)].sort(compareIds)) {
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
