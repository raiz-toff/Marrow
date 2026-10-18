import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import { layoutTopology, resolveLayoutMetrics, sizeNode } from '../src/index.js';
import { lintScene } from '@marrow/lint';
import type { Topology } from '../../model/src/index.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

function topo(rel: string): Topology {
  const source = readFileSync(join(repoRoot, 'fixtures', rel), 'utf8');
  const result = validateSource(source);
  if (!result.topology) {
    throw new Error(`fixture ${rel} did not validate: ${JSON.stringify(result.diagnostics, null, 2)}`);
  }
  return result.topology;
}

describe('resolveLayoutMetrics', () => {
  test('standard matches baseline constants exactly', () => {
    const m = resolveLayoutMetrics('standard');
    expect(m.chip).toBe(64);
    expect(m.labelSize).toBe(12);
    expect(m.labelGap).toBe(6);
    expect(m.maxLabelW).toBe(168);
    expect(m.layerSpacing).toBe(88);
    expect(m.nodeSpacing).toBe(48);
    expect(m.padding).toBe(48);
    expect(m.zonePad).toBe(28);
    expect(m.composeGap).toBe(56);
    expect(m.portChipH).toBe(16);
  });

  test('compact and spacious adjust dimensions', () => {
    const compact = resolveLayoutMetrics('compact');
    const spacious = resolveLayoutMetrics('spacious');

    expect(compact.chip).toBe(48);
    expect(compact.labelSize).toBe(10);
    expect(compact.nodeSpacing).toBeLessThan(64);

    expect(spacious.chip).toBe(80);
    expect(spacious.labelSize).toBe(14);
    expect(spacious.nodeSpacing).toBeGreaterThan(48);
  });

  test('scale multiplier scales all metrics cleanly', () => {
    const scaled = resolveLayoutMetrics('standard', 1.5);
    expect(scaled.chip).toBe(96);
    expect(scaled.labelSize).toBe(18);
    expect(scaled.nodeSpacing).toBe(72);
  });
});

describe('sizeNode with metrics', () => {
  test('compact metrics generate smaller node footprints', () => {
    const device = { id: 'r1', name: 'core-router-01', icon: 'router', status: 'up' as const, hero: false, interfaces: [] };
    const standardSizing = sizeNode(device, resolveLayoutMetrics('standard'));
    const compactSizing = sizeNode(device, resolveLayoutMetrics('compact'));
    const spaciousSizing = sizeNode(device, resolveLayoutMetrics('spacious'));

    expect(compactSizing.chipSize).toBe(48);
    expect(compactSizing.labelSize).toBe(10);
    expect(compactSizing.h).toBeLessThan(standardSizing.h);

    expect(spaciousSizing.chipSize).toBe(80);
    expect(spaciousSizing.labelSize).toBe(14);
    expect(spaciousSizing.h).toBeGreaterThan(standardSizing.h);
  });
});

describe('layoutTopology with density', () => {
  test('compact layout has smaller bounds than spacious layout and passes linting', async () => {
    const tCompact: Topology = { ...topo('valid/small-office.yaml'), density: 'compact' };
    const tSpacious: Topology = { ...topo('valid/small-office.yaml'), density: 'spacious' };

    const sceneCompact = await layoutTopology(tCompact);
    const sceneSpacious = await layoutTopology(tSpacious);

    expect(sceneCompact.density).toBe('compact');
    expect(sceneSpacious.density).toBe('spacious');

    expect(lintScene(sceneCompact).clean).toBe(true);
    expect(lintScene(sceneSpacious).clean).toBe(true);

    expect(sceneCompact.size.w).toBeLessThan(sceneSpacious.size.w);
    expect(sceneCompact.size.h).toBeLessThan(sceneSpacious.size.h);

    const compactChip = sceneCompact.nodes[0]!.chip;
    const spaciousChip = sceneSpacious.nodes[0]!.chip;
    expect(compactChip.w).toBe(48);
    expect(spaciousChip.w).toBe(80);
  });

  test('scale multiplier dynamically adjusts scene footprint and remains lint-clean', async () => {
    const tScaled: Topology = { ...topo('valid/small-office.yaml'), scale: 1.25 };
    const sceneScaled = await layoutTopology(tScaled);

    expect(sceneScaled.scale).toBe(1.25);
    expect(lintScene(sceneScaled).clean).toBe(true);

    const firstNode = sceneScaled.nodes[0]!;
    expect(firstNode.chip.w).toBe(80); // 64 * 1.25 = 80
  });
});
