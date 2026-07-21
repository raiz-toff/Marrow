import { describe, expect, test } from 'vitest';
import type { Device, Link, Topology } from '@marrow/model';
import { classify, findHubs, layoutTopology } from '@marrow/layout';
import { lintScene } from '@marrow/lint';

function dev(id: string): Device {
  return { id, name: id, icon: 'cisco/routers/router', status: 'up', hero: false, interfaces: [] };
}

function link(from: string, to: string, n = 1): Link {
  return { id: `${from}--${to}#${n}`, from: { device: from }, to: { device: to }, status: 'up', animated: false };
}

function topo(devices: Device[], links: Link[]): Topology {
  return { version: 2, name: 'T', theme: 'dark', zones: [], devices, links };
}

describe('shape classification', () => {
  test('pure star → hub-spoke, with the hub found', () => {
    const t = topo(
      [dev('hub'), ...Array.from({ length: 8 }, (_, i) => dev(`spoke-${i}`))],
      Array.from({ length: 8 }, (_, i) => link('hub', `spoke-${i}`)),
    );
    expect(classify(t)).toBe('hub-spoke');
    expect(findHubs(t)).toEqual(['hub']);
  });

  test('dual-hub star → hub-spoke with both hubs', () => {
    const spokes = Array.from({ length: 6 }, (_, i) => `s${i}`);
    const t = topo(
      [dev('hub-a'), dev('hub-b'), ...spokes.map(dev)],
      [link('hub-a', 'hub-b'), ...spokes.flatMap((s) => [link('hub-a', s), link('hub-b', s, 2)])],
    );
    expect(classify(t)).toBe('hub-spoke');
    expect(findHubs(t).sort()).toEqual(['hub-a', 'hub-b']);
  });

  test('a chained spoke disqualifies hub-spoke (impure star → flat)', () => {
    const t = topo(
      [dev('hub'), dev('a'), dev('b'), dev('c'), dev('d'), dev('tail')],
      [link('hub', 'a'), link('hub', 'b'), link('hub', 'c'), link('hub', 'd'), link('d', 'tail')],
    );
    expect(classify(t)).toBe('flat');
  });

  test('cycle → ring', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `r${i}`);
    const t = topo(
      ids.map(dev),
      ids.map((id, i) => link(id, ids[(i + 1) % ids.length]!)),
    );
    expect(classify(t)).toBe('ring');
  });

  test('dense small graph → mesh', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const links: Link[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) links.push(link(ids[i]!, ids[j]!));
    }
    expect(classify(topo(ids.map(dev), links))).toBe('mesh');
  });

  test('declared structure outranks shape: tiers beat a star', () => {
    const t = topo(
      [
        { ...dev('hub'), tier: 'core' },
        ...Array.from({ length: 6 }, (_, i) => ({ ...dev(`s${i}`), tier: 'access' as const })),
      ],
      Array.from({ length: 6 }, (_, i) => link('hub', `s${i}`)),
    );
    expect(classify(t)).toBe('tiered');
  });
});

describe('preset layouts stay linter-clean and deterministic', () => {
  test('hub-spoke: hub centred, spokes ringed, no overlaps', async () => {
    const t = topo(
      [dev('hub'), ...Array.from({ length: 14 }, (_, i) => dev(`branch-${String(i).padStart(2, '0')}`))],
      Array.from({ length: 14 }, (_, i) => link('hub', `branch-${String(i).padStart(2, '0')}`)),
    );
    const scene = await layoutTopology(t);
    expect(lintScene(scene).l1).toEqual([]);
    // hub sits at the centroid of the spokes
    const hub = scene.nodes.find((n) => n.id === 'hub')!;
    const cx = scene.nodes.reduce((s, n) => s + n.box.x + n.box.w / 2, 0) / scene.nodes.length;
    expect(Math.abs(hub.box.x + hub.box.w / 2 - cx)).toBeLessThan(60);
    expect(JSON.stringify(await layoutTopology(t))).toBe(JSON.stringify(scene));
  });

  test('ring: neighbors adjacent on the circle', async () => {
    const ids = Array.from({ length: 8 }, (_, i) => `r${i}`);
    const t = topo(
      ids.map(dev),
      ids.map((id, i) => link(id, ids[(i + 1) % ids.length]!)),
    );
    const scene = await layoutTopology(t);
    expect(lintScene(scene).l1).toEqual([]);
    // each edge should connect two nodes that are close on the ring —
    // no chord should be much longer than the average edge
    const lengths = scene.edges.map((e) => {
      const a = e.points[0]!;
      const b = e.points.at(-1)!;
      return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const avg = lengths.reduce((s, l) => s + l, 0) / lengths.length;
    for (const l of lengths) expect(l).toBeLessThan(avg * 1.8);
  });
});
