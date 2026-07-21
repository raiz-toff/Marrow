import type { Rect, SceneEdge, SceneNode, Vec } from '@marrow/scene';

/**
 * The tidy pass — cable-tray discipline for routed edges.
 *
 * Rule: no line owns a free path; shared runs ride shared channels.
 *
 *  1. Parallel links between the SAME device pair collapse onto one path,
 *     labelled ×N. The siblings keep their identity (hover, status, data) —
 *     they are simply routed coincident, so they render as a single stroke.
 *  2. Fan-outs — a parent feeding ≥3 children in a row below — reroute onto
 *     a bus: one spine drops from the parent, a horizontal channel runs in
 *     the tier gutter, short taps rise to each child. Dual-homed children
 *     produce coincident taps, so A/B uplinks read as one drop per device.
 *
 * Buses claim distinct lanes inside the gutter; any channel or corridor that
 * would clip a node keeps its original libavoid route. The geometry linter
 * still validates the result afterwards.
 */

const MIN_FAN = 2;
const LANE_STEP = 9;
const ROW_BAND = 56;
const MIN_GUTTER = 26;
const SAME_ROW_DY = 44;

export function tidyEdges(nodes: readonly SceneNode[], edges: SceneEdge[]): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chipCx = (n: SceneNode): number => n.chip.x + n.chip.w / 2;

  // ── 1 · same-pair bundling ────────────────────────────────────────────────
  const pairs = new Map<string, SceneEdge[]>();
  for (const e of edges) {
    if (e.from.node === e.to.node) continue;
    const key = e.from.node < e.to.node ? `${e.from.node}\0${e.to.node}` : `${e.to.node}\0${e.from.node}`;
    (pairs.get(key) ?? pairs.set(key, []).get(key)!).push(e);
  }
  for (const group of pairs.values()) {
    if (group.length < 2) continue;
    const rep = group[0]!;
    for (let i = 1; i < group.length; i++) {
      const e = group[i]!;
      const pts = rep.points.map((p) => ({ x: p.x, y: p.y }));
      e.points = e.from.node === rep.from.node ? pts : pts.reverse();
    }
    if (group.every((e) => e.label === undefined)) rep.label = `×${group.length}`;
  }

  // ── 2 · fan-out buses ─────────────────────────────────────────────────────
  interface FanItem {
    edge: SceneEdge;
    child: SceneNode;
    childIsFrom: boolean;
  }
  interface Fan {
    parent: SceneNode;
    items: FanItem[];
  }
  const fans = new Map<string, Fan>();
  for (const e of edges) {
    const a = byId.get(e.from.node);
    const b = byId.get(e.to.node);
    if (!a || !b || a.id === b.id) continue;
    let parent: SceneNode;
    let child: SceneNode;
    let childIsFrom: boolean;
    if (b.box.y >= a.box.y + a.box.h + MIN_GUTTER) {
      parent = a;
      child = b;
      childIsFrom = false;
    } else if (a.box.y >= b.box.y + b.box.h + MIN_GUTTER) {
      parent = b;
      child = a;
      childIsFrom = true;
    } else {
      continue;
    }
    const key = `${parent.id}\0${Math.round(child.box.y / ROW_BAND)}`;
    const fan = fans.get(key) ?? fans.set(key, { parent, items: [] }).get(key)!;
    fan.items.push({ edge: e, child, childIsFrom });
  }

  /** Node boxes intersecting a thin rect (the channel corridors). */
  const blocked = (r: Rect): boolean =>
    nodes.some(
      (n) =>
        n.box.x < r.x + r.w &&
        n.box.x + n.box.w > r.x &&
        n.box.y < r.y + r.h &&
        n.box.y + n.box.h > r.y,
    );

  const lanes: Array<{ y: number; minX: number; maxX: number }> = [];
  const rerouted = new Set<string>();
  for (const fan of [...fans.values()].sort((a, b) => a.parent.id.localeCompare(b.parent.id))) {
    const distinctChildren = new Set(fan.items.map((i) => i.child.id));
    if (distinctChildren.size < MIN_FAN) continue;
    const parent = fan.parent;
    const parentBottom = parent.box.y + parent.box.h;
    const childTop = Math.min(...fan.items.map((i) => i.child.box.y));
    if (childTop - parentBottom < MIN_GUTTER) continue;
    const px = chipCx(parent);
    const xsAll = [px, ...fan.items.map((i) => chipCx(i.child))];
    const minX = Math.min(...xsAll);
    const maxX = Math.max(...xsAll);

    // claim a lane: nearest to the children first, stepping up through the
    // gutter; a lane must be clear of nodes AND of other claimed buses
    let busY: number | undefined;
    for (let y = childTop - 16; y > parentBottom + 8; y -= LANE_STEP) {
      if (blocked({ x: minX - 4, y: y - 3, w: maxX - minX + 8, h: 6 })) continue;
      if (lanes.some((l) => Math.abs(l.y - y) < 7 && l.minX < maxX + 6 && l.maxX > minX - 6)) continue;
      busY = y;
      break;
    }
    if (busY === undefined) continue;

    // corridors: the parent spine and every tap must be node-free
    const spine: Rect = { x: px - 2, y: parentBottom + 1, w: 4, h: busY - parentBottom - 1 };
    if (blocked(spine)) continue;
    let tapsClear = true;
    for (const it of fan.items) {
      const cx = chipCx(it.child);
      const tap: Rect = { x: cx - 2, y: busY + 1, w: 4, h: it.child.box.y - busY - 2 };
      if (tap.h > 0 && blocked(tap)) {
        tapsClear = false;
        break;
      }
    }
    if (!tapsClear) continue;

    lanes.push({ y: busY, minX, maxX });
    for (const it of fan.items) {
      const cx = chipCx(it.child);
      const pts: Vec[] = [
        { x: px, y: parentBottom },
        { x: px, y: busY },
        { x: cx, y: busY },
        { x: cx, y: it.child.box.y },
      ];
      it.edge.points = it.childIsFrom ? pts.reverse() : pts;
      rerouted.add(it.edge.id);
    }
  }

  // ── 2b · upward fan-outs (mirror): parent feeding children ABOVE it ──────
  const upFans = new Map<string, Fan>();
  for (const e of edges) {
    if (rerouted.has(e.id)) continue;
    const a = byId.get(e.from.node);
    const b = byId.get(e.to.node);
    if (!a || !b || a.id === b.id) continue;
    let parent: SceneNode;
    let child: SceneNode;
    let childIsFrom: boolean;
    if (a.box.y >= b.box.y + b.box.h + MIN_GUTTER) {
      // a sits BELOW b → a is the parent, the child b is the edge's `to`
      parent = a;
      child = b;
      childIsFrom = false;
    } else if (b.box.y >= a.box.y + a.box.h + MIN_GUTTER) {
      parent = b;
      child = a;
      childIsFrom = true;
    } else {
      continue;
    }
    const key = `${parent.id}\0${Math.round(child.box.y / ROW_BAND)}`;
    const fan = upFans.get(key) ?? upFans.set(key, { parent, items: [] }).get(key)!;
    fan.items.push({ edge: e, child, childIsFrom });
  }
  for (const fan of [...upFans.values()].sort((a, b) => a.parent.id.localeCompare(b.parent.id))) {
    const distinctChildren = new Set(fan.items.map((i) => i.child.id));
    if (distinctChildren.size < MIN_FAN) continue;
    const parent = fan.parent;
    const parentTop = parent.box.y;
    const childBottom = Math.max(...fan.items.map((i) => i.child.box.y + i.child.box.h));
    if (parentTop - childBottom < MIN_GUTTER) continue;
    const px = chipCx(parent);
    const xsAll = [px, ...fan.items.map((i) => chipCx(i.child))];
    const minX = Math.min(...xsAll);
    const maxX = Math.max(...xsAll);

    let busY: number | undefined;
    for (let y = childBottom + 16; y < parentTop - 8; y += LANE_STEP) {
      if (blocked({ x: minX - 4, y: y - 3, w: maxX - minX + 8, h: 6 })) continue;
      if (lanes.some((l) => Math.abs(l.y - y) < 7 && l.minX < maxX + 6 && l.maxX > minX - 6)) continue;
      busY = y;
      break;
    }
    if (busY === undefined) continue;

    const spine: Rect = { x: px - 2, y: busY + 1, w: 4, h: parentTop - busY - 2 };
    if (blocked(spine)) continue;
    let tapsClear = true;
    for (const it of fan.items) {
      const cx = chipCx(it.child);
      const bottom = it.child.box.y + it.child.box.h;
      const tap: Rect = { x: cx - 2, y: bottom + 1, w: 4, h: busY - bottom - 2 };
      if (tap.h > 0 && blocked(tap)) {
        tapsClear = false;
        break;
      }
    }
    if (!tapsClear) continue;

    lanes.push({ y: busY, minX, maxX });
    for (const it of fan.items) {
      const cx = chipCx(it.child);
      const pts: Vec[] = [
        { x: px, y: parentTop },
        { x: px, y: busY },
        { x: cx, y: busY },
        { x: cx, y: it.child.box.y + it.child.box.h },
      ];
      it.edge.points = it.childIsFrom ? pts.reverse() : pts;
      rerouted.add(it.edge.id);
    }
  }

  // ── 3 · same-row interconnect channels (the core-mesh calmer) ────────────
  // Pairs sitting in one row whose direct corridor is blocked get channel
  // routing: riser to a gutter lane above the row, across, riser back down.
  // Lanes are assigned left-edge style — non-overlapping spans share a lane,
  // overlapping spans stack — and shared with the fan-out bus registry so
  // channels never collide with buses.
  interface RowCandidate {
    group: SceneEdge[];
    left: SceneNode;
    right: SceneNode;
    span: [number, number];
    rowTop: number;
  }
  const candidates: RowCandidate[] = [];
  for (const group of pairs.values()) {
    const rep = group[0]!;
    const a = byId.get(rep.from.node);
    const b = byId.get(rep.to.node);
    if (!a || !b) continue;
    if (Math.abs(a.box.y - b.box.y) > SAME_ROW_DY) continue;
    const [left, right] = a.box.x <= b.box.x ? [a, b] : [b, a];
    const gapLeft = left.box.x + left.box.w;
    const gapRight = right.box.x;
    if (gapRight - gapLeft < 8) continue; // adjacent neighbours — direct line is fine
    // direct corridor between the chips: only channel when something blocks it
    const yLo = Math.max(left.chip.y, right.chip.y);
    const yHi = Math.min(left.chip.y + left.chip.h, right.chip.y + right.chip.h);
    const corridorClear =
      yHi - yLo > 8 &&
      !blocked({ x: gapLeft + 1, y: yLo + 2, w: gapRight - gapLeft - 2, h: yHi - yLo - 4 });
    if (corridorClear) continue;
    candidates.push({
      group,
      left,
      right,
      span: [chipCx(left), chipCx(right)],
      rowTop: Math.min(left.box.y, right.box.y),
    });
  }
  candidates.sort((x, y) => x.span[0] - y.span[0] || x.span[1] - y.span[1] || x.group[0]!.id.localeCompare(y.group[0]!.id));
  for (const c of candidates) {
    const [x0, x1] = c.span;
    let laneY: number | undefined;
    for (let y = c.rowTop - 14; y > c.rowTop - 14 - 8 * LANE_STEP; y -= LANE_STEP) {
      if (blocked({ x: x0 - 4, y: y - 3, w: x1 - x0 + 8, h: 6 })) continue;
      if (lanes.some((l) => Math.abs(l.y - y) < 7 && l.minX < x1 + 6 && l.maxX > x0 - 6)) continue;
      // risers must be node-free too
      if (blocked({ x: x0 - 2, y: y + 1, w: 4, h: c.left.box.y - y - 2 })) continue;
      if (blocked({ x: x1 - 2, y: y + 1, w: 4, h: c.right.box.y - y - 2 })) continue;
      laneY = y;
      break;
    }
    if (laneY === undefined) continue;
    lanes.push({ y: laneY, minX: x0, maxX: x1 });
    const pts: Vec[] = [
      { x: x0, y: c.left.box.y },
      { x: x0, y: laneY },
      { x: x1, y: laneY },
      { x: x1, y: c.right.box.y },
    ];
    for (const e of c.group) {
      const startsLeft = e.from.node === c.left.id;
      const copy = pts.map((p) => ({ x: p.x, y: p.y }));
      e.points = startsLeft ? copy : copy.reverse();
    }
  }
}
