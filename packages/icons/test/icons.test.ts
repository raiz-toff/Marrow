import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import {
  IconCatalog,
  assertManifest,
  generateManifestFromSvgDir,
  kebab,
  loadCatalog,
  type IconPackManifest,
} from '@marrow/icons';

describe('kebab', () => {
  test('camel, snake, acronym, mixed', () => {
    expect(kebab('LanSwitching')).toBe('lan-switching');
    expect(kebab('IOT')).toBe('iot');
    expect(kebab('layer_3_switch')).toBe('layer-3-switch');
    expect(kebab('ComputerAndPeripherals')).toBe('computer-and-peripherals');
    expect(kebab('multi-fabric_server_switch')).toBe('multi-fabric-server-switch');
    expect(kebab('CiscoSafeSecurityIcons')).toBe('cisco-safe-security-icons');
  });
});

describe('generateManifestFromSvgDir', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marrow-icons-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test('deterministic ids, categories, collision suffixes', () => {
    const svg = join(tmp, 'svg');
    mkdirSync(join(svg, 'CatA'), { recursive: true });
    mkdirSync(join(svg, 'CatB'), { recursive: true });
    writeFileSync(join(svg, 'CatA', 'foo_bar.svg'), '<svg/>');
    writeFileSync(join(svg, 'CatA', 'foo-bar.svg'), '<svg/>');
    writeFileSync(join(svg, 'CatB', 'thing.svg'), '<svg/>');

    const manifest = generateManifestFromSvgDir(svg, { pack: 'test', title: 'Test' });
    const ids = manifest.icons.map((i) => i.id);
    expect(ids).toEqual(['test/cat-a/foo-bar', 'test/cat-a/foo-bar-2', 'test/cat-b/thing']);
    expect(manifest.icons[0]!.file).toBe('svg/CatA/foo-bar.svg');
    expect(manifest.icons[2]!.category).toBe('cat-b');

    const again = generateManifestFromSvgDir(svg, { pack: 'test', title: 'Test' });
    expect(again).toEqual(manifest);
  });

  test('collision suffixes are themselves collision-checked', () => {
    const svg = join(tmp, 'svg2');
    mkdirSync(svg, { recursive: true });
    // a.svg, a-2.svg and A.svg all fight over "a"/"a-2" — ids must stay unique
    writeFileSync(join(svg, 'A.svg'), '<svg/>');
    writeFileSync(join(svg, 'a-2.svg'), '<svg/>');
    writeFileSync(join(svg, 'a.svg'), '<svg/>');
    const manifest = generateManifestFromSvgDir(svg, { pack: 'p', title: 'P' });
    const ids = manifest.icons.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(() => assertManifest(manifest as unknown, 'generated')).not.toThrow();
  });
});

describe('pack loading robustness', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'marrow-packs-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  test('corrupt manifest is skipped with a problem naming the file; good packs still load', () => {
    mkdirSync(join(tmp, 'broken'), { recursive: true });
    writeFileSync(join(tmp, 'broken', 'manifest.json'), '{ not json');
    mkdirSync(join(tmp, 'good'), { recursive: true });
    writeFileSync(
      join(tmp, 'good', 'manifest.json'),
      JSON.stringify({
        pack: 'good',
        title: 'Good',
        version: '1.0.0',
        icons: [{ id: 'good/misc/thing', title: 'Thing', category: 'misc', keywords: ['thing'], file: 'svg/thing.svg' }],
      }),
    );
    const catalog = loadCatalog(tmp);
    expect(catalog.size).toBe(1);
    expect(catalog.problems.some((p) => p.includes('broken') && p.includes('manifest.json'))).toBe(true);
  });

  test('dangling symlink in the packs root is skipped, not fatal', () => {
    symlinkSync('/nonexistent-target-xyz', join(tmp, 'dangling'));
    expect(() => loadCatalog(tmp)).not.toThrow();
    expect(loadCatalog(tmp).size).toBe(1);
  });

  test('duplicate manifest ids fail assertManifest; cross-pack dupes keep first and record a problem', () => {
    const dupManifest = {
      pack: 'd',
      title: 'D',
      version: '1.0.0',
      icons: [
        { id: 'd/misc/x', title: 'X', category: 'misc', keywords: ['x'], file: 'svg/x.svg' },
        { id: 'd/misc/x', title: 'X2', category: 'misc', keywords: ['x'], file: 'svg/x2.svg' },
      ],
    };
    expect(() => assertManifest(dupManifest, 'dup')).toThrow(/duplicate icon id/);

    const catalog = new IconCatalog();
    const entry = (file: string): IconPackManifest => ({
      pack: 'p',
      title: 'P',
      version: '1',
      icons: [{ id: 'p/misc/x', title: 'X', category: 'misc', keywords: ['x'], file }],
    });
    catalog.addPack(entry('svg/first.svg'), '/a');
    catalog.addPack(entry('svg/second.svg'), '/b');
    expect(catalog.get('p/misc/x')?.file).toBe('svg/first.svg');
    expect(catalog.problems).toHaveLength(1);
  });
});

describe('IconCatalog', () => {
  const manifest: IconPackManifest = {
    pack: 'cisco',
    title: 'Cisco',
    version: '1.0.0',
    icons: [
      {
        id: 'cisco/switches/layer-3-switch',
        title: 'Layer 3 Switch',
        category: 'switches',
        keywords: ['layer', 'switch', 'switches'],
        file: 'svg/Switches/layer_3_switch.svg',
      },
      {
        id: 'cisco/switches/workgroup-switch',
        title: 'Workgroup Switch',
        category: 'switches',
        keywords: ['workgroup', 'switch', 'switches'],
        file: 'svg/Switches/workgroup_switch.svg',
      },
      {
        id: 'cisco/security/firewall',
        title: 'Firewall',
        category: 'security',
        keywords: ['firewall', 'security'],
        file: 'svg/Security/firewall.svg',
      },
    ],
  };
  const catalog = new IconCatalog();
  catalog.addPack(manifest, '/packs/cisco');

  test('has / get', () => {
    expect(catalog.has('cisco/security/firewall')).toBe(true);
    expect(catalog.has('cisco/security/nope')).toBe(false);
    expect(catalog.get('cisco/security/firewall')?.packDir).toBe('/packs/cisco');
  });

  test('suggest catches a typo in a segment', () => {
    expect(catalog.suggest('cisco/switchs/layer-3-switch')).toContain('cisco/switches/layer-3-switch');
  });

  test('suggest falls back to the icon name', () => {
    expect(catalog.suggest('layer3switch')).toContain('cisco/switches/layer-3-switch');
  });

  test('search ranks whole-word hits first and requires all tokens', () => {
    const hits = catalog.search('switch');
    expect(hits.length).toBe(2);
    expect(catalog.search('firewall')[0]!.id).toBe('cisco/security/firewall');
    expect(catalog.search('quantum entanglement')).toEqual([]);
  });

  test('one strong token must not carry a query with an unmatched term', () => {
    // "switch" matches plenty, "zzzquantum" matches nothing → no results
    expect(catalog.search('zzzquantum switch')).toEqual([]);
    expect(catalog.search('juniper firewall')).toEqual([]);
  });
});
