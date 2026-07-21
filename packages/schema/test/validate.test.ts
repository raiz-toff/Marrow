import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import type { Diagnostic } from '@marrow/diagnostics';
import { ciscoCatalog, fixtureSource } from './helpers.js';

function run(rel: string) {
  return validateSource(fixtureSource(rel), { icons: ciscoCatalog() });
}

function codes(diags: Diagnostic[]): string[] {
  return diags.map((d) => d.code);
}

describe('valid fixtures', () => {
  test('small-office is clean', () => {
    const result = run('valid/small-office.yaml');
    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.topology?.devices).toHaveLength(10);
    expect(result.topology?.hero).toBe('edge-rt-01');
  });

  test('campus-three-tier is clean and x- annotations are ignored', () => {
    const result = run('valid/campus-three-tier.yaml');
    expect(result.diagnostics).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.topology?.devices).toHaveLength(14);
    expect(result.topology?.links.filter((l) => l.lag === 'po1')).toHaveLength(2);
  });
});

describe('invalid fixtures produce the intended diagnostics', () => {
  test('syntax-error → E001 with location', () => {
    const { valid, diagnostics } = run('invalid/syntax-error.yaml');
    expect(valid).toBe(false);
    expect(codes(diagnostics)).toContain('MRW-E001');
    expect(diagnostics[0]!.loc?.line).toBeGreaterThan(0);
  });

  test('missing-version → exactly E003', () => {
    const { diagnostics } = run('invalid/missing-version.yaml');
    expect(codes(diagnostics)).toEqual(['MRW-E003']);
    expect(diagnostics[0]!.hint).toContain('marrow: 2');
  });

  test('unknown-keys → E005 with did-you-mean', () => {
    const { diagnostics } = run('invalid/unknown-keys.yaml');
    const unknown = diagnostics.filter((d) => d.code === 'MRW-E005');
    expect(unknown).toHaveLength(2);
    const roots = unknown.find((d) => d.path === 'devcies');
    const nested = unknown.find((d) => d.path === 'devices[0].teir');
    expect(roots?.didYouMean).toContain('devices');
    expect(nested?.didYouMean).toContain('tier');
    expect(nested?.message).toContain('device "core-sw-01"');
  });

  test('bad-references → E013 / E009 / E015 with suggestions', () => {
    const { diagnostics } = run('invalid/bad-references.yaml');
    const cs = codes(diagnostics);
    expect(cs).toContain('MRW-E013');
    expect(cs).toContain('MRW-E009');
    expect(cs).toContain('MRW-E015');
    const zone = diagnostics.find((d) => d.code === 'MRW-E013');
    expect(zone?.didYouMean).toContain('office');
    const device = diagnostics.find((d) => d.code === 'MRW-E009');
    expect(device?.didYouMean).toContain('dist-sw-01');
  });

  test('bad-icon → E010 with catalog suggestions', () => {
    const { diagnostics } = run('invalid/bad-icon.yaml');
    const icons = diagnostics.filter((d) => d.code === 'MRW-E010');
    expect(icons).toHaveLength(2);
    expect(icons[0]!.didYouMean).toContain('cisco/switches/layer-3-switch');
    expect(icons[1]!.didYouMean).toContain('cisco/switches/workgroup-switch');
  });

  test('bad-values → E011 enums with suggestions, E006 type', () => {
    const { diagnostics } = run('invalid/bad-values.yaml');
    const enums = diagnostics.filter((d) => d.code === 'MRW-E011');
    expect(enums).toHaveLength(3);
    const tier = enums.find((d) => d.path === 'devices[0].tier');
    expect(tier?.didYouMean).toContain('core');
    const speed = enums.find((d) => d.path === 'links[0].speed');
    expect(speed?.didYouMean).toContain('10G');
    expect(codes(diagnostics)).toContain('MRW-E006');
  });

  test('duplicate-ids → E008 for zone and device', () => {
    const { diagnostics } = run('invalid/duplicate-ids.yaml');
    const dups = diagnostics.filter((d) => d.code === 'MRW-E008');
    expect(dups).toHaveLength(2);
    expect(dups.some((d) => d.message.includes('zone id "office"'))).toBe(true);
    expect(dups.some((d) => d.message.includes('device id "core-sw-01"'))).toBe(true);
  });

  test('bad-endpoints → E014', () => {
    const { diagnostics } = run('invalid/bad-endpoints.yaml');
    expect(codes(diagnostics)).toContain('MRW-E014');
  });

  test('missing-required → E007 with authoring hints', () => {
    const { diagnostics } = run('invalid/missing-required.yaml');
    const missing = diagnostics.filter((d) => d.code === 'MRW-E007');
    expect(missing).toHaveLength(3);
    const icon = missing.find((d) => d.path === 'devices[0].icon');
    expect(icon?.hint).toContain('icons search');
    expect(missing.some((d) => d.path === 'name')).toBe(true);
    expect(missing.some((d) => d.path === 'links[0].to')).toBe(true);
  });

  test('warnings-only → valid with W101/W102/W103', () => {
    const result = run('invalid/warnings-only.yaml');
    expect(result.valid).toBe(true);
    expect(result.topology).toBeDefined();
    const cs = codes(result.diagnostics);
    expect(cs).toContain('MRW-W101');
    expect(cs).toContain('MRW-W102');
    expect(cs).toContain('MRW-W103');
  });
});
