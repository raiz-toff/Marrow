/**
 * Minimap geometry, kept pure so it can be tested without a DOM.
 *
 * Three coordinate spaces meet here:
 * - world: scene units, as the compiled diagram lays it out (0..sceneW, 0..sceneH)
 * - screen: stage pixels; the camera maps world → screen as s = w·k + t
 * - map: the minimap's own viewBox units; world → map is m = pad + w·scale
 */
import type { CameraState } from './camera.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How the world sits inside the minimap's viewBox. */
export interface MiniFrame {
  pad: number;
  scale: number;
  sceneW: number;
  sceneH: number;
}

/** The world's box in map units. */
export function worldInMap(f: MiniFrame): Rect {
  return { x: f.pad, y: f.pad, w: f.sceneW * f.scale, h: f.sceneH * f.scale };
}

/** The true (unclamped) visible area in map units: may be larger than, or lie off, the world. */
export function viewInMap(cam: CameraState, visible: Rect, f: MiniFrame): Rect {
  return {
    x: f.pad + ((visible.x - cam.x) / cam.k) * f.scale,
    y: f.pad + ((visible.y - cam.y) / cam.k) * f.scale,
    w: (visible.w / cam.k) * f.scale,
    h: (visible.h / cam.k) * f.scale,
  };
}

export interface DrawnView {
  /** what to draw: always inside the world box inset by `inset`, never smaller than `min` (unless the world is) */
  rect: Rect;
  /** the visible area contains the whole world */
  covers: boolean;
}

/**
 * The viewport rectangle as the minimap draws it: the visible area
 * intersected with the world box (inset so a stroke centred on the edge
 * stays inside), grown to at least `min`×`min` and kept inside. A view
 * entirely off the world collapses onto the nearest world edge, so the
 * rectangle never disappears.
 */
export function drawnView(view: Rect, world: Rect, inset = 1, min = 6): DrawnView {
  const covers =
    view.x <= world.x && view.y <= world.y && view.x + view.w >= world.x + world.w && view.y + view.h >= world.y + world.h;
  const ix = Math.min(inset, world.w / 2);
  const iy = Math.min(inset, world.h / 2);
  const [x, w] = span(view.x, view.w, world.x + ix, world.w - ix * 2, min);
  const [y, h] = span(view.y, view.h, world.y + iy, world.h - iy * 2, min);
  return { rect: { x, y, w, h }, covers };
}

/** One axis of `drawnView`: intersect [a, a+len) with [lo, lo+room), grow to `min`, keep inside. */
function span(a: number, len: number, lo: number, room: number, min: number): [number, number] {
  const hi = lo + room;
  let s = Math.max(a, lo);
  let e = Math.min(a + len, hi);
  if (e < s) s = e = a + len < lo ? lo : hi; // no overlap: sit on the nearest edge
  const size = Math.min(room, Math.max(min, e - s));
  const mid = (s + e) / 2;
  const start = Math.max(lo, Math.min(hi - size, mid - size / 2));
  return [start, size];
}

/** A map point as the world point it shows, clamped to the world: the minimap never aims off the diagram. */
export function mapToWorld(mx: number, my: number, f: MiniFrame): { x: number; y: number } {
  return {
    x: clampTo((mx - f.pad) / f.scale, 0, f.sceneW),
    y: clampTo((my - f.pad) / f.scale, 0, f.sceneH),
  };
}

export function containsPoint(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function clampTo(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
