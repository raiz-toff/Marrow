import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { DATA_SCRIPT_ID, decodePageData, getPrebootSource } from '@marrow/runtime';
import { validateSource } from '@marrow/schema';
import { buildSingle } from './helpers.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const catalog = loadCatalog(join(repoRoot, 'icon-packs'));

/** The page's payload, read the way the runtime reads it. */
function pageData(html: string) {
  const re = new RegExp(`<script type="application/json" id="${DATA_SCRIPT_ID}">([\\s\\S]*?)</script>`);
  return decodePageData(re.exec(html)?.[1]);
}

async function build(rel: string) {
  const source = readFileSync(join(repoRoot, 'fixtures', rel), 'utf8');
  const validated = validateSource(source, { icons: catalog });
  if (!validated.topology) throw new Error('fixture invalid');
  return buildSingle(validated.topology, { icons: catalog });
}

describe('build-wide watermark', () => {
  test('the config watermark applies; a topology\'s own keys win', async () => {
    const t = validateSource(readFileSync(join(repoRoot, 'fixtures/valid/small-office.yaml'), 'utf8'), { icons: catalog }).topology!;
    const configOnly = await buildSingle(t, { icons: catalog, watermark: { mode: 'blueprint', font: 'mono' } });
    expect(configOnly.html).toMatch(/<div class="m-watermark" data-mode="blueprint" data-font="mono"/);
    const both = await buildSingle({ ...t, watermark: { mode: 'minimal' } }, { icons: catalog, watermark: { mode: 'blueprint', font: 'mono' } });
    expect(both.html).toMatch(/<div class="m-watermark" data-mode="minimal" data-font="mono"/);
  });
});

describe('Single file output', () => {
  test('produces a complete, self-contained page', async () => {
    const { html, scene } = await build('valid/small-office.yaml');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Small Office');
    expect(html).toContain('class="m-svg"');
    expect(html).toContain('id="marrow-data"');
    expect(html).toContain('m-spotlight');
    expect(html).toContain('m-inspector');
    expect(scene.nodes).toHaveLength(10);
    // runtime + styles are inlined
    expect(html).toContain('prefers-reduced-motion');
    expect(html).toMatch(/<script>[\s\S]*addEventListener/);
  });

  test('OFFLINE GATE: no external URLs anywhere in the output', async () => {
    const { html } = await build('valid/campus-three-tier.yaml');
    // No external RESOURCE loads: anything the page would fetch to render.
    // (svg xmlns namespaces are not fetches; an <a href> is navigation the user
    // opts into by clicking — neither stops the page rendering offline.)
    const external = html.match(/\bsrc\s*=\s*"https?:\/\/[^"]*"/gi) ?? [];
    expect(external).toEqual([]);
    const linkTags = html.match(/<link\b[^>]*href\s*=\s*"https?:\/\/[^"]*"/gi) ?? [];
    expect(linkTags).toEqual([]);
    // every remaining external href must belong to an anchor, nothing else
    for (const tag of html.match(/<[a-z-]+\b[^>]*href\s*=\s*"https?:\/\/[^"]*"[^>]*>/gi) ?? []) {
      expect(tag.toLowerCase().startsWith('<a ')).toBe(true);
    }
    expect(html).not.toContain('@import');
    expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
    expect(html).not.toContain('fonts.googleapis');
  });

  test('icon sprite is subset to used icons only', async () => {
    const { html } = await build('valid/small-office.yaml');
    const symbolCount = (html.match(/<symbol /g) ?? []).length;
    // small-office uses 9 distinct icons
    expect(symbolCount).toBe(9);
    // each used exactly via <use>
    expect((html.match(/<use href="#ic-/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });

  test('embedded data cannot break out of its script tag', async () => {
    const source = [
      'marrow: 2',
      'name: Escape Test',
      'devices:',
      '  - id: a',
      '    icon: cisco/switches/layer-3-switch',
      '    note: "</script><script>alert(1)</script>"',
      '  - id: b',
      '    icon: cisco/switches/workgroup-switch',
      'links:',
      '  - from: a:p1',
      '    to: b:p1',
    ].join('\n');
    const validated = validateSource(source, { icons: catalog });
    const { html } = await buildSingle(validated.topology!, { icons: catalog });
    const dataBlock = /<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(dataBlock).not.toContain('</script');
    expect(pageData(html).devices[0]!.note).toContain('</script>');
  });

  test('single-file size budget: ≤900 KB at ~50 nodes', async () => {
    const { html } = await build('corpus/tiered-medium-01.yaml');
    expect(Buffer.byteLength(html) / 1024).toBeLessThanOrEqual(900);
  });

  test('canvas tier engages above the SVG limit (and on demand)', async () => {
    const source = readFileSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), 'utf8');
    const t = validateSource(source, { icons: catalog }).topology!;
    const svgBuild = await buildSingle(t, { icons: catalog });
    expect(svgBuild.html).toContain('class="m-svg"');
    expect(svgBuild.html).not.toContain('<canvas');
    const canvasBuild = await buildSingle(t, { icons: catalog, forceRenderer: 'canvas' });
    expect(canvasBuild.html).toContain('class="m-canvas"');
    expect(canvasBuild.html).toContain('class="m-sprite"');
    // geometry ships as data on canvas pages
    const data = pageData(canvasBuild.html);
    expect(data.kind).toBe('stage');
    expect(data.scene!.nodes).toHaveLength(10);
    expect(data.scene!.edges[0]!.points.length).toBeGreaterThanOrEqual(2);
  });

  test('deterministic output', async () => {
    const a = await build('valid/campus-three-tier.yaml');
    const b = await build('valid/campus-three-tier.yaml');
    expect(a.html).toBe(b.html);
  });

  test('modular chrome embed support (Defect 3)', async () => {
    const source = readFileSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), 'utf8');
    const t = validateSource(source, { icons: catalog }).topology!;
    const buildFull = await buildSingle(t, { icons: catalog });
    // the pre-boot script (URL → <html> attributes before first paint) is
    // inlined in <head>; its behaviour is tested in packages/runtime
    const head = buildFull.html.slice(0, buildFull.html.indexOf('</head>'));
    expect(head).toContain(`<script>${getPrebootSource()}</script>`);

    // Build-time minimal chrome option
    const buildMinimal = await buildSingle(t, { icons: catalog, chrome: 'minimal' });
    expect(buildMinimal.html).toContain('data-chrome="minimal"');
  });

  test('serializes custom_fields and sections in embedded data (Defect 4)', async () => {
    const source = [
      'marrow: 2',
      'name: Custom Test',
      'devices:',
      '  - id: dev-1',
      '    icon: cisco/switches/layer-3-switch',
      '    custom_fields:',
      '      rack: "Rack 5"',
      '    sections:',
      '      bgp: "Peer 1.1.1.1"',
      'links:',
      '  - from: dev-1',
      '    to: dev-1:loop',
      '    custom_fields:',
      '      tested: true',
    ].join('\n');
    const validated = validateSource(source, { icons: catalog });
    const { html } = await buildSingle(validated.topology!, { icons: catalog });
    const parsed = pageData(html);
    expect(parsed.devices[0]!.customFields).toEqual({ rack: 'Rack 5' });
    expect(parsed.devices[0]!.sections).toEqual({ bgp: 'Peer 1.1.1.1' });
    expect(parsed.links[0]!.customFields).toEqual({ tested: true });
  });
});
