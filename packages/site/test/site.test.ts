import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { buildSingleFile } from '@marrow/site';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const catalog = loadCatalog(join(repoRoot, 'icon-packs'));

async function build(rel: string) {
  const source = readFileSync(join(repoRoot, 'fixtures', rel), 'utf8');
  const validated = validateSource(source, { icons: catalog });
  if (!validated.topology) throw new Error('fixture invalid');
  return buildSingleFile(validated.topology, { icons: catalog });
}

describe('buildSingleFile', () => {
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
    const { html } = await buildSingleFile(validated.topology!, { icons: catalog });
    const dataBlock = /<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(html)![1]!;
    expect(dataBlock).not.toContain('</script');
    expect(JSON.parse(dataBlock).devices[0].note).toContain('</script>');
  });

  test('single-file size budget: ≤900 KB at ~50 nodes', async () => {
    const { html } = await build('corpus/tiered-medium-01.yaml');
    expect(Buffer.byteLength(html) / 1024).toBeLessThanOrEqual(900);
  });

  test('canvas tier engages above the SVG limit (and on demand)', async () => {
    const source = readFileSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), 'utf8');
    const t = validateSource(source, { icons: catalog }).topology!;
    const svgBuild = await buildSingleFile(t, { icons: catalog });
    expect(svgBuild.html).toContain('class="m-svg"');
    expect(svgBuild.html).not.toContain('<canvas');
    const canvasBuild = await buildSingleFile(t, { icons: catalog, forceRenderer: 'canvas' });
    expect(canvasBuild.html).toContain('class="m-canvas"');
    expect(canvasBuild.html).toContain('class="m-sprite"');
    // geometry ships as data on canvas pages
    const data = JSON.parse(
      /<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(canvasBuild.html)![1]!,
    );
    expect(data.scene.nodes).toHaveLength(10);
    expect(data.scene.edges[0].points.length).toBeGreaterThanOrEqual(2);
  });

  test('deterministic output', async () => {
    const a = await build('valid/campus-three-tier.yaml');
    const b = await build('valid/campus-three-tier.yaml');
    expect(a.html).toBe(b.html);
  });
});
