import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { buildSite, collapseEndpoints, planSite } from '@marrow/site';
import type { Topology } from '@marrow/model';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const catalog = loadCatalog(join(repoRoot, 'icon-packs'));

function topo(rel: string): Topology {
  const t = validateSource(readFileSync(join(repoRoot, 'fixtures', rel), 'utf8')).topology;
  if (!t) throw new Error(`fixture invalid: ${rel}`);
  return t;
}

describe('planSite', () => {
  test('small topologies stay single; big or zone-heavy ones become sites', () => {
    expect(planSite(topo('valid/small-office.yaml')).mode).toBe('single');
    const xl = planSite(topo('corpus/xl-campus-01.yaml'));
    expect(xl.mode).toBe('site');
    expect(xl.zonePages.length).toBeGreaterThanOrEqual(5);
    expect(xl.devicePages.length).toBeGreaterThan(0);
  });
});

describe('collapseEndpoints', () => {
  test('folds single-parent endpoints into stacks with worst status and ×N edges', () => {
    const t = topo('corpus/xl-campus-01.yaml');
    const collapsed = collapseEndpoints(t, { activateAbove: 100 });
    expect(collapsed.devices.length).toBeLessThan(t.devices.length);
    const stacks = collapsed.devices.filter((d) => d.stack !== undefined);
    expect(stacks.length).toBeGreaterThan(0);
    for (const s of stacks) {
      expect(s.stack!.members.length).toBeGreaterThanOrEqual(5);
      expect(s.name).toMatch(/endpoints$/);
    }
    const agg = collapsed.links.filter((l) => l.label?.startsWith('×'));
    expect(agg.length).toBeGreaterThan(0);
    // no dangling references
    const ids = new Set(collapsed.devices.map((d) => d.id));
    for (const l of collapsed.links) {
      expect(ids.has(l.from.device), l.from.device).toBe(true);
      expect(ids.has(l.to.device), l.to.device).toBe(true);
    }
  });

  test('below the activation threshold nothing changes', () => {
    const t = topo('valid/small-office.yaml');
    expect(collapseEndpoints(t)).toBe(t);
  });
});

describe('buildSite (xl-campus, 358 devices)', () => {
  const t = topo('corpus/xl-campus-01.yaml');

  test('full site: budgets hold, every internal link resolves, search covers everything', async () => {
    const site = await buildSite(t, { icons: catalog });
    expect(site.files.has('index.html')).toBe(true);
    expect(site.files.has('inventory.html')).toBe(true);
    expect(site.files.has('assets/runtime.js')).toBe(true);
    expect(site.files.has('assets/styles.css')).toBe(true);

    // hard page budget
    for (const stat of site.pageStats) {
      expect(stat.nodes, `${stat.page} node budget`).toBeLessThanOrEqual(250);
    }

    // every link must resolve to an emitted file:
    //  - plain href/src are relative to the page's directory
    //  - data-href (door nodes) are SITE-ROOT-relative (runtime adds the prefix)
    const paths = new Set(site.files.keys());
    for (const [page, html] of site.files) {
      if (!page.endsWith('.html')) continue;
      const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
      for (const m of html.matchAll(/(?<![-\w])(?:href|src)="([^"#]+)(#[^"]*)?"/g)) {
        const target = m[1]!;
        if (target.startsWith('http') || target.startsWith('data:') || target.startsWith('#')) continue;
        const normalized = normalize(dir + target);
        expect(paths.has(normalized), `${page} → ${target}`).toBe(true);
      }
      for (const m of html.matchAll(/data-href="([^"#]+)(#[^"]*)?"/g)) {
        expect(paths.has(m[1]!), `${page} → data-href ${m[1]!}`).toBe(true);
      }
    }

    // offline: no external URLs anywhere
    for (const [page, content] of site.files) {
      expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(content), `${page} external ref`).toBe(false);
    }

    // the search index covers every authored device
    const search = site.files.get('assets/search-data.js')!;
    const docs = JSON.parse(search.slice(search.indexOf('=') + 1, search.lastIndexOf(';'))) as {
      docs: Array<{ id: string; page: string }>;
    };
    expect(docs.docs.length).toBe(t.devices.length);
    for (const doc of docs.docs) {
      expect(paths.has(doc.page), `search doc page ${doc.page}`).toBe(true);
    }
  }, 60000);

  test('deterministic site output', async () => {
    const a = await buildSite(t, { icons: catalog });
    const b = await buildSite(t, { icons: catalog });
    expect([...a.files.keys()]).toEqual([...b.files.keys()]);
    expect(a.files.get('index.html')).toBe(b.files.get('index.html'));
    expect(a.files.get('assets/search-data.js')).toBe(b.files.get('assets/search-data.js'));
  }, 60000);
});

function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}
