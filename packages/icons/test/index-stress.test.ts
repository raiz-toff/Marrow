import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { indexIconPacks } from '../src/generate.js';
import { loadCatalog } from '../src/catalog.js';

describe('indexIconPacks Stress & Edge Cases', () => {
  let tempPacksDir: string;

  beforeEach(() => {
    tempPacksDir = join(tmpdir(), `marrow-test-packs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempPacksDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempPacksDir, { recursive: true, force: true });
  });

  test('handles corrupted SVGs, empty files, and missing directories without throwing', () => {
    const packA = join(tempPacksDir, 'pack-a');
    const svgDir = join(packA, 'svg', 'Network');
    mkdirSync(svgDir, { recursive: true });

    // 1 valid SVG
    writeFileSync(join(svgDir, 'good-switch.svg'), '<svg viewBox="0 0 50 50"><rect/></svg>');
    // 1 empty file
    writeFileSync(join(svgDir, 'empty.svg'), '');
    // 1 invalid non-SVG file disguised as SVG
    writeFileSync(join(svgDir, 'corrupt.svg'), '<html><body>Not an svg</body></html>');

    // Folder without svg/
    mkdirSync(join(tempPacksDir, 'pack-without-svg'), { recursive: true });

    const results = indexIconPacks(tempPacksDir);
    expect(results).toHaveLength(1);
    expect(results[0]?.pack).toBe('pack-a');
    // Only the good SVG should be indexed
    expect(results[0]?.count).toBe(1);

    const manifest = JSON.parse(readFileSync(join(packA, 'manifest.json'), 'utf8'));
    expect(manifest.icons).toHaveLength(1);
    expect(manifest.icons[0].id).toBe('pack-a/network/good-switch');
  });

  test('resolves filename collisions and creates deterministic suffixes', () => {
    const packB = join(tempPacksDir, 'pack-b');
    const svgDir = join(packB, 'svg', 'Switches');
    mkdirSync(svgDir, { recursive: true });

    // Two files that resolve to the same kebab name
    writeFileSync(join(svgDir, 'Core_Switch.svg'), '<svg viewBox="0 0 100 100"><rect/></svg>');
    writeFileSync(join(svgDir, 'core-switch.svg'), '<svg viewBox="0 0 100 100"><circle/></svg>');

    const results = indexIconPacks(tempPacksDir);
    expect(results).toHaveLength(1);
    expect(results[0]?.count).toBe(2);

    const manifest = JSON.parse(readFileSync(join(packB, 'manifest.json'), 'utf8'));
    const ids = manifest.icons.map((i: { id: string }) => i.id);
    expect(ids).toContain('pack-b/switches/core-switch');
    expect(ids).toContain('pack-b/switches/core-switch-2');
  });

  test('idempotence: re-indexing produces identical manifest without duplicating entries', () => {
    const packC = join(tempPacksDir, 'pack-c');
    const svgDir = join(packC, 'svg', 'Routers');
    mkdirSync(svgDir, { recursive: true });

    writeFileSync(join(svgDir, 'edge.svg'), '<svg viewBox="0 0 50 50"><rect/></svg>');

    // First indexing pass
    indexIconPacks(tempPacksDir);
    const manifestPass1 = readFileSync(join(packC, 'manifest.json'), 'utf8');

    // Second indexing pass
    indexIconPacks(tempPacksDir);
    const manifestPass2 = readFileSync(join(packC, 'manifest.json'), 'utf8');

    expect(manifestPass1).toBe(manifestPass2);

    // Verify catalog can load the newly indexed pack seamlessly
    const catalog = loadCatalog(tempPacksDir);
    expect(catalog.has('pack-c/routers/edge')).toBe(true);
    expect(catalog.hasSvg('pack-c/routers/edge')).toBe(true);
  });
});
