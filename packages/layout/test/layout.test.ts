import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import { classify, layoutTopology, sizeNode } from '@marrow/layout';
import { lintScene } from '@marrow/lint';
import type { Topology } from '@marrow/model';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

function topo(rel: string): Topology {
  const source = readFileSync(join(repoRoot, 'fixtures', rel), 'utf8');
  const result = validateSource(source);
  if (!result.topology) {
    throw new Error(`fixture ${rel} did not validate: ${JSON.stringify(result.diagnostics, null, 2)}`);
  }
  return result.topology;
}

describe('classify', () => {
  test('2+ populated zones → zoned; else tiered/flat by declarations', () => {
    expect(classify(topo('valid/small-office.yaml'))).toBe('zoned');
    expect(classify(topo('valid/campus-three-tier.yaml'))).toBe('zoned');
    const t = topo('valid/small-office.yaml');
    for (const d of t.devices) delete (d as { zone?: string }).zone;
    expect(classify(t)).toBe('tiered');
    delete (t.devices[0] as { tier?: string }).tier;
    expect(classify(t)).toBe('flat');
  });
});

describe('sizeNode', () => {
  test('long names widen the node instead of overflowing it', () => {
    const base = { id: 'a', icon: 'x/y/z', status: 'up' as const, hero: false, interfaces: [] };
    const short = sizeNode({ ...base, name: 'sw' });
    const long = sizeNode({ ...base, name: 'building-a-floor-3-closet-b-access' });
    expect(long.w).toBeGreaterThan(short.w);
    expect(long.labelText.length).toBeGreaterThan(4);
  });
});

describe('layoutTopology', () => {
  test('small-office: linter-clean, tiers stack within their zone', async () => {
    const t = topo('valid/small-office.yaml');
    const scene = await layoutTopology(t);
    expect(scene.nodes).toHaveLength(10);
    expect(scene.edges).toHaveLength(9);

    const report = lintScene(scene);
    expect(report.l1).toEqual([]);

    const yOf = (id: string): number => scene.nodes.find((n) => n.id === id)!.box.y;
    // within the office zone, layered order holds: core above access above endpoints
    expect(yOf('core-sw-01')).toBeLessThan(yOf('acc-sw-01'));
    expect(yOf('acc-sw-01')).toBeLessThan(yOf('pc-01'));
  });

  test('ZONE CONTAINMENT: no foreign device ever sits inside a zone box', async () => {
    for (const rel of ['valid/small-office.yaml', 'valid/campus-three-tier.yaml']) {
      const t = topo(rel);
      const scene = await layoutTopology(t);
      // devices belonging to a zone or any of its descendants
      const childrenOf = new Map<string, string[]>();
      for (const z of t.zones) {
        if (z.parent) (childrenOf.get(z.parent) ?? childrenOf.set(z.parent, []).get(z.parent)!).push(z.id);
      }
      const subtree = (zoneId: string): Set<string> => {
        const out = new Set<string>([zoneId]);
        for (const c of childrenOf.get(zoneId) ?? []) for (const s of subtree(c)) out.add(s);
        return out;
      };
      for (const zone of scene.zones) {
        const allowed = subtree(zone.id);
        for (const node of scene.nodes) {
          if (node.zone !== undefined && allowed.has(node.zone)) continue;
          const overlaps =
            node.box.x < zone.box.x + zone.box.w &&
            zone.box.x < node.box.x + node.box.w &&
            node.box.y < zone.box.y + zone.box.h &&
            zone.box.y < node.box.y + node.box.h;
          expect(overlaps, `${rel}: device "${node.id}" intrudes into zone "${zone.id}"`).toBe(false);
        }
      }
    }
  });

  test('campus: linter-clean with zones present', async () => {
    const t = topo('valid/campus-three-tier.yaml');
    const scene = await layoutTopology(t);
    expect(scene.nodes).toHaveLength(14);
    expect(scene.zones.length).toBeGreaterThan(0);
    const report = lintScene(scene);
    expect(report.l1).toEqual([]);
    // every edge is orthogonal (ELK ORTHOGONAL routing): all segments axis-aligned
    for (const e of scene.edges) {
      for (let i = 0; i < e.points.length - 1; i++) {
        const a = e.points[i]!;
        const b = e.points[i + 1]!;
        const axisAligned = Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.y - b.y) < 1e-6;
        expect(axisAligned, `edge ${e.id} segment ${i} is diagonal`).toBe(true);
      }
    }
  });

  test('byte-identical determinism across runs', async () => {
    const t1 = topo('valid/campus-three-tier.yaml');
    const t2 = topo('valid/campus-three-tier.yaml');
    const a = JSON.stringify(await layoutTopology(t1));
    const b = JSON.stringify(await layoutTopology(t2));
    expect(a).toBe(b);
  });

  test('elk-native routing fallback mode is also linter-clean', async () => {
    const scene = await layoutTopology(topo('valid/small-office.yaml'), { routing: 'elk' });
    expect(lintScene(scene).l1).toEqual([]);
  });

  test('parallel links bundle onto one coincident path with a ×N label', async () => {
    // cable-tray discipline (tidy pass): same-pair parallels ride ONE stroke;
    // each keeps its identity for hover/status, the representative carries ×N
    const t = topo('valid/campus-three-tier.yaml');
    const scene = await layoutTopology(t);
    const lagEdges = scene.edges.filter((e) => e.lag === 'po1');
    expect(lagEdges).toHaveLength(2);
    expect(JSON.stringify(lagEdges[0]!.points)).toBe(JSON.stringify(lagEdges[1]!.points));
    expect(lagEdges.some((e) => e.label === '×2')).toBe(true);
  });

  test('empty topology yields an empty, clean scene', async () => {
    const result = validateSource('marrow: 2\nname: Empty\ndevices: []');
    const scene = await layoutTopology(result.topology!);
    expect(scene.nodes).toEqual([]);
    expect(lintScene(scene).clean).toBe(true);
  });
});
