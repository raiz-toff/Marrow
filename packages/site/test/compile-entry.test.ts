import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import type { Topology } from '@marrow/model';
import { decodePageData } from '@marrow/runtime';
import { validateSource } from '@marrow/schema';
import { createSiteBuilder, SITE_DEVICE_THRESHOLD, type BuildOptions } from '@marrow/site';

/**
 * The one compile entry: createSiteBuilder covers both output shapes.
 * These tests pin the interface callers rely on — defaults, shape choice,
 * and what a Single file looks like as a one-page build.
 */

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const icons = loadCatalog(join(repoRoot, 'icon-packs'));

function topo(rel: string): Topology {
  const t = validateSource(readFileSync(join(repoRoot, 'fixtures', rel), 'utf8'), { icons }).topology;
  if (!t) throw new Error(`fixture invalid: ${rel}`);
  return t;
}

const html = async (t: Topology, options: Omit<BuildOptions, 'icons'> = {}): Promise<string> =>
  (await createSiteBuilder(t, { icons, ...options }).buildAll()).files.get('index.html')!;

describe('defaults (marrow.config.yaml layout:)', () => {
  const yaml = (extra = ''): Topology => {
    const src = readFileSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), 'utf8');
    const t = validateSource(src.replace(/^name: .*$/m, (line) => `${line}${extra}`), { icons }).topology;
    if (!t) throw new Error('fixture invalid');
    return t;
  };
  const indexScene = async (t: Topology, options: Omit<BuildOptions, 'icons'> = {}) =>
    (await createSiteBuilder(t, { icons, ...options }).buildPage('index.html'))!.scene!;

  test('parsed YAML leaves density/scale undeclared; layout still resolves standard / 1', async () => {
    const t = yaml();
    expect(t.density).toBeUndefined();
    expect(t.scale).toBeUndefined();
    const scene = await indexScene(t);
    expect(scene.density).toBe('standard');
    expect(scene.scale).toBe(1);
  });

  test('apply to YAML that declares nothing — smaller chips under compact — without mutating it', async () => {
    const t = yaml();
    const before = JSON.stringify(t);
    const plain = await indexScene(t);
    const compact = await indexScene(t, { defaults: { density: 'compact', scale: 1.2 } });
    expect(JSON.stringify(t)).toBe(before); // caller's topology untouched
    expect(compact.density).toBe('compact');
    expect(compact.scale).toBe(1.2);
    const compactOnly = await indexScene(t, { defaults: { density: 'compact' } });
    expect(compactOnly.nodes[0]!.chip.w).toBeLessThan(plain.nodes[0]!.chip.w);
    expect(await html(t, { defaults: { density: 'compact', scale: 1.2 } })).toBe(
      await html({ ...t, density: 'compact', scale: 1.2 }),
    );
  });

  test('a density the YAML declares wins over the default', async () => {
    const t = yaml('\ndensity: spacious');
    expect(t.density).toBe('spacious');
    expect((await indexScene(t, { defaults: { density: 'compact' } })).density).toBe('spacious');
    expect(await html(t, { defaults: { density: 'compact' } })).toBe(await html(t));
  });
});

describe('output shape', () => {
  test('absent → the planner decides (ADR-0008)', () => {
    const small = createSiteBuilder(topo('valid/small-office.yaml'), { icons });
    expect(small.plan.mode).toBe('single');
    const xl = topo('corpus/xl-campus-01.yaml');
    expect(xl.devices.length).toBeGreaterThan(SITE_DEVICE_THRESHOLD);
    const site = createSiteBuilder(xl, { icons });
    expect(site.plan.mode).toBe('site');
    expect(site.pages()).toContain('inventory.html');
    expect(site.paths()).toContain('assets/runtime.js');
  });

  test("shape: 'single' forces one inline page even above the split threshold", async () => {
    const xl = topo('corpus/xl-campus-01.yaml');
    const builder = createSiteBuilder(xl, { icons, shape: 'single' });
    expect(builder.plan).toEqual({ mode: 'single', zonePages: [], devicePages: [] });
    expect(builder.pages()).toEqual(['index.html']);
    expect(builder.paths()).toEqual(['index.html']);
    expect(builder.has('assets/runtime.js')).toBe(false);

    const out = await builder.buildAll();
    expect([...out.files.keys()]).toEqual(['index.html']);
    expect(out.pageStats).toHaveLength(1);
    const page = out.files.get('index.html')!;
    expect(page).not.toContain('assets/runtime.js'); // runtime + styles inlined
    expect(page).not.toContain('assets/styles.css');
    const data = decodePageData(/<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(page)?.[1]);
    expect(data.devicePages).toEqual([]); // no search asset to derive the manifest from
  }, 30_000);

  test('forcing the shape the planner would pick changes nothing (byte-identical)', async () => {
    const t = topo('valid/campus-three-tier.yaml');
    expect(await html(t, { shape: 'single' })).toBe(await html(t));
  });

  test("buildPage('index.html') carries the page's scene and lint report", async () => {
    const entry = (await createSiteBuilder(topo('valid/small-office.yaml'), { icons }).buildPage('index.html'))!;
    expect(entry.scene!.nodes).toHaveLength(10);
    expect(entry.lint!.clean).toBe(true);
    expect(entry.stats).toMatchObject({ nodes: 10, tier: 'svg' });
  });

  test('switching shape changes the shape hash, so a live server reloads every tab', () => {
    const t = topo('valid/small-office.yaml');
    const cache = new Map();
    const single = createSiteBuilder(t, { icons }, cache);
    const site = createSiteBuilder(t, { icons, shape: 'site' }, cache);
    expect(single.shapeHash).not.toBe(site.shapeHash);
  });
});
