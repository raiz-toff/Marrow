import { describe, expect, test } from 'vitest';
import type { Scene, SceneEdge, SceneNode } from '@marrow/scene';
import { segmentIntersectsRect, segmentsCross } from '@marrow/scene';
import { lintScene } from '@marrow/lint';

function node(id: string, x: number, y: number, w = 60, h = 80): SceneNode {
  return {
    id,
    chip: { x, y, w, h: 60 },
    labelBox: { x, y: y + 66, w, h: 14 },
    box: { x, y, w, h },
    label: id,
    icon: 'x/y/z',
    status: 'up',
    hero: false,
  };
}

function edge(id: string, from: string, to: string, points: Array<[number, number]>): SceneEdge {
  return {
    id,
    from: { node: from },
    to: { node: to },
    points: points.map(([x, y]) => ({ x, y })),
    status: 'up',
    animated: false,
  };
}

function scene(nodes: SceneNode[], edges: SceneEdge[]): Scene {
  return { size: { w: 800, h: 600 }, nodes, edges, zones: [] };
}

describe('geometry primitives', () => {
  test('segmentIntersectsRect: through, touching, missing', () => {
    const r = { x: 100, y: 100, w: 50, h: 50 };
    expect(segmentIntersectsRect({ x: 0, y: 125 }, { x: 300, y: 125 }, r)).toBe(true);
    expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 300, y: 100 }, r)).toBe(false); // border graze
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 300, y: 0 }, r)).toBe(false);
  });

  test('segmentsCross: crossing vs parallel vs shared endpoint', () => {
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false);
    expect(segmentsCross({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 })).toBe(false);
  });
});

describe('lintScene L1', () => {
  test('clean scene is clean', () => {
    const s = scene(
      [node('a', 0, 0), node('b', 200, 0)],
      [edge('a--b#1', 'a', 'b', [[60, 40], [200, 40]])],
    );
    const report = lintScene(s);
    expect(report.clean).toBe(true);
    expect(report.l1).toEqual([]);
  });

  test('overlapping nodes are a build-failing defect', () => {
    const s = scene([node('a', 0, 0), node('b', 30, 10)], []);
    const report = lintScene(s);
    expect(report.clean).toBe(false);
    expect(report.l1[0]!.kind).toBe('node-overlap');
    expect(report.l1[0]!.ids).toEqual(['a', 'b']);
  });

  test('edge through a foreign node is a defect; terminal touch is not', () => {
    // c sits between a and b; the edge ploughs straight through it
    const s = scene(
      [node('a', 0, 0), node('c', 150, 0), node('b', 400, 0)],
      [edge('a--b#1', 'a', 'b', [[60, 40], [400, 40]])],
    );
    const report = lintScene(s);
    expect(report.l1.some((i) => i.kind === 'edge-through-node' && i.ids.includes('c'))).toBe(true);
    // same edge with a detour around c is clean
    const detour = scene(
      [node('a', 0, 0), node('c', 150, 0), node('b', 400, 0)],
      [edge('a--b#1', 'a', 'b', [[60, 40], [100, 40], [100, 120], [360, 120], [360, 40], [400, 40]])],
    );
    expect(lintScene(detour).clean).toBe(true);
  });

  test('an edge that never reaches its node is detached', () => {
    const s = scene(
      [node('a', 0, 0), node('b', 400, 0)],
      [edge('a--b#1', 'a', 'b', [[60, 40], [300, 40]])],
    );
    const report = lintScene(s);
    expect(report.l1.some((i) => i.kind === 'detached-endpoint' && i.ids.includes('b'))).toBe(true);
  });
});

describe('lintScene L3', () => {
  test('extreme aspect ratio warns without failing', () => {
    const s: Scene = { size: { w: 5000, h: 100 }, nodes: [], edges: [], zones: [] };
    const report = lintScene(s);
    expect(report.clean).toBe(true);
    expect(report.l3.some((i) => i.kind === 'aspect-ratio')).toBe(true);
  });
});
