import { describe, expect, test } from 'vitest';
import { parseEndpoint, validateSource } from '@marrow/schema';
import { ciscoCatalog, fixtureSource } from './helpers.js';

describe('parseEndpoint', () => {
  test('string forms', () => {
    expect(parseEndpoint('sw-01:Gi1/0/1')).toEqual({ ok: true, endpoint: { device: 'sw-01', port: 'Gi1/0/1' } });
    expect(parseEndpoint('sw-01')).toEqual({ ok: true, endpoint: { device: 'sw-01' } });
    // only the first colon splits — ports may contain colons
    expect(parseEndpoint('sw-01:veth:0')).toEqual({ ok: true, endpoint: { device: 'sw-01', port: 'veth:0' } });
  });

  test('object form', () => {
    expect(parseEndpoint({ device: 'sw-01', port: 'Gi1' })).toEqual({
      ok: true,
      endpoint: { device: 'sw-01', port: 'Gi1' },
    });
    expect(parseEndpoint({ device: 'sw-01' })).toEqual({ ok: true, endpoint: { device: 'sw-01' } });
  });

  test('rejects malformed endpoints with reasons', () => {
    expect(parseEndpoint(':Gi1').ok).toBe(false);
    expect(parseEndpoint('sw-01:').ok).toBe(false);
    expect(parseEndpoint('   ').ok).toBe(false);
    expect(parseEndpoint({ device: ' ' }).ok).toBe(false);
  });
});

describe('normalization', () => {
  const source = `
marrow: 2
name: Norm Test
devices:
  - id: a-sw
    icon: cisco/switches/layer-3-switch
    mgmt_ip: 10.0.0.1
  - id: b-sw
    icon: cisco/switches/workgroup-switch
links:
  - from: a-sw:p1
    to: b-sw:p1
  - from: a-sw:p2
    to: b-sw:p2
`;

  test('defaults, snake→camel, name fallback, stable link ids', () => {
    const { valid, topology } = validateSource(source, { icons: ciscoCatalog() });
    expect(valid).toBe(true);
    const t = topology!;
    expect(t.theme).toBe('dark');
    expect(t.devices[0]!.name).toBe('a-sw');
    expect(t.devices[0]!.mgmtIp).toBe('10.0.0.1');
    expect(t.devices[0]!.status).toBe('up');
    expect(t.devices[0]!.hero).toBe(false);
    expect(t.links.map((l) => l.id)).toEqual(['a-sw--b-sw#1', 'a-sw--b-sw#2']);
  });

  test('validation output is deterministic', () => {
    const a = validateSource(fixtureSource('valid/campus-three-tier.yaml'), { icons: ciscoCatalog() });
    const b = validateSource(fixtureSource('valid/campus-three-tier.yaml'), { icons: ciscoCatalog() });
    expect(JSON.stringify(a.topology)).toBe(JSON.stringify(b.topology));
  });
});
