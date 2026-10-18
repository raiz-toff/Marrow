import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { buildSite } from '@marrow/site';
import { LIVE_CLIENT, serve, type RunningServer } from '@marrow/server';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const catalog = loadCatalog(join(repoRoot, 'icon-packs'));

let dir: string;
let server: RunningServer;

async function until<T>(fn: () => Promise<T>, pred: (v: T) => boolean, ms = 4000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = await fn();
    if (pred(value)) return value;
    if (performance.now() - start > ms) throw new Error(`condition not met within ${ms}ms: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

const api = async (path: string): Promise<any> => (await fetch(`${server.url.slice(0, -1)}${path}`)).json();

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'marrow-serve-'));
  cpSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), join(dir, 'a-office.yaml'));
  cpSync(join(repoRoot, 'fixtures', 'valid', 'campus-three-tier.yaml'), join(dir, 'b-campus.yaml'));
  server = await serve({ input: dir, icons: catalog, port: 0 });
});

afterAll(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('marrow serve', () => {
  test('serves the first topology with the live-reload client injected', async () => {
    const res = await fetch(server.url);
    const html = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Small Office');
    expect(html).toContain('/api/events'); // live client present in served page
  });

  test('status + validate + scene + files APIs', async () => {
    const status = await api('/api/status');
    expect(status).toMatchObject({ file: 'a-office.yaml', valid: true, errors: 0 });
    expect(status.stamp).toBeGreaterThanOrEqual(1);

    const validate = await api('/api/validate');
    expect(validate.valid).toBe(true);
    expect(validate.file).toBe('a-office.yaml');

    const scene = await api('/api/scene');
    expect(scene.nodes).toHaveLength(10);
    expect(scene.size.w).toBeGreaterThan(100);

    const files = await api('/api/files');
    expect(files.files).toEqual(['a-office.yaml', 'b-campus.yaml']);
  });

  test('switching topologies via POST /api/current', async () => {
    const res = await fetch(`${server.url}api/current`, {
      method: 'POST',
      body: JSON.stringify({ file: 'b-campus.yaml' }),
    });
    expect((await res.json()).current).toBe('b-campus.yaml');
    const html = await (await fetch(server.url)).text();
    expect(html).toContain('Campus Three-Tier');

    const bad = await fetch(`${server.url}api/current`, {
      method: 'POST',
      body: JSON.stringify({ file: '../escape.yaml' }),
    });
    expect(bad.status).toBe(404);
  });

  test('editing the current file triggers a rebuild (agent loop)', async () => {
    await fetch(`${server.url}api/current`, { method: 'POST', body: JSON.stringify({ file: 'a-office.yaml' }) });
    const before = await api('/api/status');

    const file = join(dir, 'a-office.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('name: Small Office', 'name: Small Office v2'));

    const after = await until(
      () => api('/api/status'),
      (s) => s.stamp > before.stamp,
    );
    expect(after.valid).toBe(true);
    const html = await (await fetch(server.url)).text();
    expect(html).toContain('Small Office v2');
  });

  test('an invalid edit keeps the last good diagram and reports diagnostics', async () => {
    const file = join(dir, 'a-office.yaml');
    const good = readFileSync(file, 'utf8');
    writeFileSync(file, good.replace('icon: affinity/tile/router', 'icon: affinity/tile/rooter'));

    const status = await until(
      () => api('/api/status'),
      (s) => s.valid === false,
    );
    expect(status.errors).toBeGreaterThan(0);
    const validate = await api('/api/validate');
    expect(validate.diagnostics.some((d: { code: string }) => d.code === 'MRW-E010')).toBe(true);
    // last good page still served
    const html = await (await fetch(server.url)).text();
    expect(html).toContain('Small Office v2');

    // repair → valid again
    writeFileSync(file, good);
    await until(
      () => api('/api/status'),
      (s) => s.valid === true,
    );
  });

  test('editing the watched config file triggers a live reload with updated brand and theme', async () => {
    const cfgPath = join(dir, 'test-config.yaml');
    let brandName = 'Initial Brand';
    let accentColor = '#3b82f6';
    writeFileSync(cfgPath, `brand:\n  name: ${brandName}`);

    const cfgServer = await serve({
      input: dir,
      icons: catalog,
      port: 0,
      configFile: cfgPath,
      configLoader: () => ({
        brand: { name: brandName },
        themeConfig: { dark: { accent: accentColor } },
      }),
    });
    try {
      const beforeHtml = await (await fetch(cfgServer.url)).text();
      expect(beforeHtml).toContain('Initial Brand');

      brandName = 'Live Updated Brand';
      accentColor = '#8b5cf6';
      writeFileSync(cfgPath, `brand:\n  name: ${brandName}`);

      const afterHtml = await until(
        async () => (await fetch(cfgServer.url)).text(),
        (html) => html.includes('Live Updated Brand') && html.includes('#8b5cf6'),
      );
      expect(afterHtml).toContain('Live Updated Brand');
      expect(afterHtml).toContain('#8b5cf6');
    } finally {
      await cfgServer.close();
    }
  });
});

describe('marrow serve — site mode (large topology)', () => {
  let siteDir: string;
  let siteServer: RunningServer;
  const sapi = async (path: string): Promise<any> => (await fetch(`${siteServer.url.slice(0, -1)}${path}`)).json();
  const page = async (path: string): Promise<Response> => fetch(`${siteServer.url.slice(0, -1)}${path}`, { redirect: 'manual' });

  beforeAll(async () => {
    siteDir = mkdtempSync(join(tmpdir(), 'marrow-serve-site-'));
    cpSync(join(repoRoot, 'fixtures', 'corpus', 'xl-campus-01.yaml'), join(siteDir, 'campus.yaml'));
    siteServer = await serve({ input: siteDir, icons: catalog, port: 0 });
  }, 30_000);

  afterAll(async () => {
    await siteServer.close();
    rmSync(siteDir, { recursive: true, force: true });
  });

  test('serves the multi-page site, not a single-file fallback', async () => {
    expect(siteServer.mode()).toBe('site');
    const status = await sapi('/api/status');
    expect(status.mode).toBe('site');
    expect(status.pages).toBeGreaterThan(5);

    const index = await (await page('/')).text();
    expect(index).toContain('zones/building-a.html'); // real site nav
    expect(index).toContain('assets/runtime.js'); // external assets, like a build
    expect(index).toContain('/api/events'); // live client injected

    const zone = await page('/zones/building-a.html');
    expect(zone.status).toBe(200);
    const zoneHtml = await zone.text();
    expect(zoneHtml).toContain('Building A');
    expect(zoneHtml).toContain('/api/events');

    expect((await page('/inventory.html')).status).toBe(200);
    expect((await page('/assets/styles.css')).headers.get('content-type')).toContain('text/css');
    expect((await page('/assets/runtime.js')).headers.get('content-type')).toContain('javascript');
    const search = await (await page('/assets/search-data.js')).text();
    expect(search).toContain('__MARROW_SEARCH');
  }, 30_000);

  test('served pages are byte-identical to buildSite output (+ live client)', async () => {
    const source = readFileSync(join(siteDir, 'campus.yaml'), 'utf8');
    const topology = validateSource(source, { icons: catalog }).topology!;
    const built = await buildSite(topology, { icons: catalog });
    for (const path of ['index.html', 'zones/datacenter.html', 'inventory.html']) {
      const served = await (await page(`/${path}`)).text();
      expect(served).toBe(built.files.get(path)!.replace('</body>', `${LIVE_CLIENT}\n</body>`));
    }
  }, 30_000);

  test('an edit rebuilds only the pages it feeds (memoized site)', async () => {
    const before = await sapi('/api/status');
    const file = join(siteDir, 'campus.yaml');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('Building A - HQ Tower Floor 1 Wireless AP', 'Building A - AP One (renamed)'),
    );
    const after = await until(
      () => sapi('/api/status'),
      (s) => s.stamp > before.stamp,
      15_000,
    );
    expect(after.valid).toBe(true);
    expect(after.mode).toBe('site');
    // a rename inside one building must NOT invalidate the whole site —
    // only the served pages that actually contain it (its zone + inventory)
    expect(after.changed).toBeGreaterThan(0);
    expect(after.changed).toBeLessThan(6);

    const zoneHtml = await (await page('/zones/building-a.html')).text();
    expect(zoneHtml).toContain('AP One (renamed)');
  }, 30_000);

  test('a vanished page redirects to the overview instead of 404ing', async () => {
    const res = await page('/zones/no-such-zone.html');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  test('/api/scene returns the overview scene in site mode', async () => {
    const scene = await sapi('/api/scene');
    expect(scene.nodes.length).toBeGreaterThan(3); // one aggregate node per top zone
    expect(scene.size.w).toBeGreaterThan(100);
  });
});
