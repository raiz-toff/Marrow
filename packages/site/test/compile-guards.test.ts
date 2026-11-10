import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { resolveLayoutMetrics } from '@marrow/layout';
import type { Device, Link, Topology } from '@marrow/model';
import {
  createSiteBuilder,
  GeometryDefectError,
  MAX_DEVICES,
  MAX_LINKS,
  TopologyTooLargeError,
  topologySizeError,
} from '@marrow/site';

/**
 * The compile entry's two refusals: an L1 geometry defect (a compiler bug,
 * reported with the layout in effect and a remedy) and a topology over the
 * size cap (refused up front instead of exhausting the V8 heap).
 */
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const icons = loadCatalog(join(repoRoot, 'icon-packs'));

const dev = (id: string): Device => ({ id, name: id, icon: 'cisco/routers/router', status: 'up', hero: false, interfaces: [] });
const link = (a: string, b: string): Link => ({ id: `${a}--${b}#1`, from: { device: a }, to: { device: b }, status: 'up', animated: false });
const ring = (n: number, extra: Partial<Topology> = {}): Topology => {
  const ids = Array.from({ length: n }, (_, i) => `r${String(i).padStart(2, '0')}`);
  return { version: 2, name: 'R', theme: 'dark', zones: [], devices: ids.map(dev), links: ids.map((id, i) => link(id, ids[(i + 1) % n]!)), ...extra };
};

// A deliberately broken metric set (negative ring gap, no minimum radius)
// stands in for a layout bug: ring nodes pile onto each other.
const broken = (density: 'compact' | 'standard') => ({
  layout: { metrics: { ...resolveLayoutMetrics(density, 1), ringGap: -400, minRadius: 0 } },
});

describe('geometry defects', () => {
  test('a build refuses an L1 scene with a three-line, actionable message', async () => {
    const t = ring(6, { density: 'compact' });
    const err = await createSiteBuilder(t, { icons, ...broken('compact') })
      .buildPage('index.html')
      .then(() => undefined, (e: unknown) => e);
    expect(err).toBeInstanceOf(GeometryDefectError);
    const g = err as GeometryDefectError;
    expect(g.page).toBe('index.html');
    expect(g.archetype).toBe('ring');
    expect(g.density).toBe('compact');
    expect(g.scale).toBe(1);
    expect(g.ids.length).toBeGreaterThan(1);
    const lines = g.message.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^geometry lint failed on index\.html: \d+ L1 defects? \(.*node-overlap.*\) — a compiler-side layout defect/);
    expect(lines[1]).toContain('layout: ring, density compact, scale 1; offending ids: r0');
    expect(lines[2]).toContain('`density: standard` and `scale: 1`');
    expect(lines[2]).toContain('report it with this YAML file');
  });

  test('at standard/1 the remedy suggests another density instead', async () => {
    const [g] = await createSiteBuilder(ring(6), { icons, ...broken('standard') }).geometryDefects();
    expect(g!.message.split('\n')[2]).toContain('`density: spacious`');
  });

  test('geometryDefects() lays out every page without rendering; empty when clean', async () => {
    expect(await createSiteBuilder(ring(6), { icons }).geometryDefects()).toEqual([]);
    const failures = await createSiteBuilder(ring(6), { icons, ...broken('standard') }).geometryDefects();
    expect(failures.map((f) => f.page)).toEqual(['index.html']);
  });
});

describe('size cap', () => {
  const big = (devices: number, links: number): Topology => ({
    version: 2,
    name: 'Big',
    theme: 'dark',
    zones: [],
    devices: Array.from({ length: devices }, (_, i) => dev(`d${i}`)),
    links: Array.from({ length: links }, (_, i) => link(`d${i % devices}`, `d${(i + 1) % devices}`)),
  });

  test('caps are named constants: 5,000 devices, 10,000 links', () => {
    expect(MAX_DEVICES).toBe(5000);
    expect(MAX_LINKS).toBe(10_000);
  });

  test('one device over the cap is refused up front with the counts and the caps', () => {
    const t = big(MAX_DEVICES + 1, MAX_DEVICES);
    expect(() => createSiteBuilder(t, { icons })).toThrow(TopologyTooLargeError);
    const err = topologySizeError(t)!;
    expect(err.devices).toBe(MAX_DEVICES + 1);
    expect(err.message).toContain(`${MAX_DEVICES + 1} devices (cap ${MAX_DEVICES})`);
    expect(err.message).toContain(`${MAX_DEVICES} links (cap ${MAX_LINKS})`);
    expect(err.message).toContain('split it into several topology files');
  });

  test('the link cap applies on its own; at the caps nothing is refused', () => {
    expect(topologySizeError(big(100, MAX_LINKS + 1))).toBeInstanceOf(TopologyTooLargeError);
    expect(topologySizeError(big(MAX_DEVICES, MAX_LINKS))).toBeUndefined();
  });
});
