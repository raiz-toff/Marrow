import { describe, expect, test } from 'vitest';
import { drawnView, mapToWorld, viewInMap, worldInMap, type MiniFrame, type Rect } from '../src/client/minimap-geometry.js';

// a 1000×500 scene drawn at 0.1 with 7 units of padding: the world is (7,7) 100×50 in map units
const frame: MiniFrame = { pad: 7, scale: 0.1, sceneW: 1000, sceneH: 500 };
const world = worldInMap(frame);
const inner: Rect = { x: 8, y: 8, w: 98, h: 48 }; // world inset by 1

function expectWithin(r: Rect, box: Rect): void {
  expect(r.x).toBeGreaterThanOrEqual(box.x - 1e-9);
  expect(r.y).toBeGreaterThanOrEqual(box.y - 1e-9);
  expect(r.x + r.w).toBeLessThanOrEqual(box.x + box.w + 1e-9);
  expect(r.y + r.h).toBeLessThanOrEqual(box.y + box.h + 1e-9);
}

describe('minimap view rectangle', () => {
  test('maps the camera view into map units', () => {
    // stage 800×400 at k=2 panned to (−200,−100): shows world (100,50)–(500,250)
    const v = viewInMap({ x: -200, y: -100, k: 2 }, { x: 0, y: 0, w: 800, h: 400 }, frame);
    expect(v).toEqual({ x: 17, y: 12, w: 40, h: 20 });
  });

  test('view inside the world is drawn as is', () => {
    const v = { x: 17, y: 12, w: 40, h: 20 };
    expect(drawnView(v, world)).toEqual({ rect: v, covers: false });
  });

  test('view larger than the world draws the whole world, inset, and says so', () => {
    const d = drawnView({ x: -53.6, y: 2.7, w: 209, h: 124.6 }, world);
    expect(d.covers).toBe(true);
    expect(d.rect).toEqual(inner);
  });

  test.each([
    ['left', { x: -20, y: 20, w: 40, h: 20 }, { x: 8, y: 20, w: 12, h: 20 }],
    ['right', { x: 90, y: 20, w: 40, h: 20 }, { x: 90, y: 20, w: 16, h: 20 }],
    ['top', { x: 30, y: -5, w: 40, h: 20 }, { x: 30, y: 8, w: 40, h: 7 }],
    ['bottom', { x: 30, y: 50, w: 40, h: 20 }, { x: 30, y: 50, w: 40, h: 6 }],
  ])('view partly off the %s edge is clipped to the world', (_edge, view, rect) => {
    const d = drawnView(view, world);
    expect(d.covers).toBe(false);
    expect(d.rect.x).toBeCloseTo(rect.x);
    expect(d.rect.y).toBeCloseTo(rect.y);
    expect(d.rect.w).toBeCloseTo(rect.w);
    expect(d.rect.h).toBeCloseTo(rect.h);
    expectWithin(d.rect, inner);
  });

  test('a sliver at an edge still draws at the minimum size, inside', () => {
    const d = drawnView({ x: 104, y: 20, w: 40, h: 20 }, world); // 2 units of overlap on the right
    expect(d.rect.w).toBe(6);
    expect(d.rect.x).toBe(100);
    expectWithin(d.rect, inner);
  });

  test('a view entirely off the world sits on the nearest edge', () => {
    const d = drawnView({ x: 300, y: -400, w: 40, h: 20 }, world);
    expect(d.rect).toEqual({ x: 100, y: 8, w: 6, h: 6 });
  });

  test('a degenerate tiny view grows to the minimum around its centre', () => {
    const d = drawnView({ x: 50, y: 30, w: 0.5, h: 0.2 }, world);
    expect(d.rect.w).toBe(6);
    expect(d.rect.h).toBe(6);
    expect(d.rect.x + d.rect.w / 2).toBeCloseTo(50.25);
    expect(d.rect.y + d.rect.h / 2).toBeCloseTo(30.1);
  });

  test('a world smaller than the minimum is drawn whole', () => {
    const tiny = { x: 7, y: 7, w: 4, h: 3 };
    const d = drawnView({ x: 8, y: 8, w: 0.1, h: 0.1 }, tiny);
    expectWithin(d.rect, tiny);
    expect(d.rect.w).toBeCloseTo(2);
    expect(d.rect.h).toBeCloseTo(1);
  });
});

describe('minimap aiming', () => {
  test('a map point is the world point under it', () => {
    expect(mapToWorld(57, 32, frame)).toEqual({ x: 500, y: 250 });
  });

  test('points in the padding clamp to the world edge', () => {
    expect(mapToWorld(0, 200, frame)).toEqual({ x: 0, y: 500 });
  });
});
