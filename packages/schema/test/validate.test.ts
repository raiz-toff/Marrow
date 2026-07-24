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

describe('logical link semantics', () => {
  const base = [
    'marrow: 2',
    'name: Semantics',
    'devices:',
    '  - { id: a, icon: cisco/switches/layer-3-switch }',
    '  - { id: b, icon: cisco/switches/workgroup-switch }',
  ].join('\n');
  const withLink = (link: string) =>
    validateSource(`${base}\nlinks:\n  - ${link}`, { icons: ciscoCatalog() });

  test('a fully-specified trunk LAG validates and normalizes every field', () => {
    const r = withLink('{ from: a:Te1/0/1, to: b:Te1/0/1, mode: trunk, vlans: "10,20,30", native_vlan: 1, lag: po1, lacp: active, encap: gre }');
    // encap on a trunk is contradictory → one advisory, but still valid
    expect(r.valid).toBe(true);
    const l = r.topology!.links[0]!;
    expect(l.mode).toBe('trunk');
    expect(l.vlans).toBe('10,20,30');
    expect(l.nativeVlan).toBe(1);
    expect(l.lag).toBe('po1');
    expect(l.lacp).toBe('active');
  });

  test('numeric vlans is coerced to a string', () => {
    const l = withLink('{ from: a, to: b, mode: access, vlans: 10 }').topology!.links[0]!;
    expect(l.vlans).toBe('10');
  });

  test('an unknown mode/encap/protocol enum value → MRW-E011', () => {
    expect(codes(withLink('{ from: a, to: b, mode: bogus }').diagnostics)).toContain('MRW-E011');
    expect(codes(withLink('{ from: a, to: b, encap: rot13 }').diagnostics)).toContain('MRW-E011');
    expect(codes(withLink('{ from: a, to: b, protocol: bgp4 }').diagnostics)).toContain('MRW-E011');
    expect(codes(withLink('{ from: a, to: b, lacp: sometimes }').diagnostics)).toContain('MRW-E011');
  });

  test('native_vlan out of range is rejected', () => {
    const r = withLink('{ from: a, to: b, mode: trunk, native_vlan: 9999 }');
    expect(r.valid).toBe(false);
    // zod range violations surface as MRW-E006 (same mapping as interface vlan)
    expect(codes(r.diagnostics)).toContain('MRW-E006');
  });

  test('encap on a non-tunnel mode → W105 (advisory, still valid)', () => {
    const r = withLink('{ from: a, to: b, mode: routed, encap: ipsec }');
    expect(r.valid).toBe(true);
    expect(codes(r.diagnostics)).toContain('MRW-W105');
  });

  test('protocol on a trunk → W105', () => {
    expect(codes(withLink('{ from: a, to: b, mode: trunk, protocol: ospf }').diagnostics)).toContain('MRW-W105');
  });

  test('lacp without a lag id → W105', () => {
    expect(codes(withLink('{ from: a, to: b, lacp: active }').diagnostics)).toContain('MRW-W105');
  });

  test('native_vlan on an access port → W105', () => {
    expect(codes(withLink('{ from: a, to: b, mode: access, native_vlan: 5 }').diagnostics)).toContain('MRW-W105');
  });

  test('encap alone (no mode) is accepted — the renderer derives tunnel', () => {
    const r = withLink('{ from: a, to: b, encap: vxlan }');
    expect(r.valid).toBe(true);
    expect(codes(r.diagnostics)).not.toContain('MRW-W105');
    expect(r.topology!.links[0]!.encap).toBe('vxlan');
  });

  test('a misspelled link key is still MRW-E005 with suggestions', () => {
    const cs = codes(withLink('{ from: a, to: b, mdoe: trunk }').diagnostics);
    expect(cs).toContain('MRW-E005');
  });
});
