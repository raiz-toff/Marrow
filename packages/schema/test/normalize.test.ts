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

  test('normalizes custom_fields and sections on devices and links', () => {
    const customSource = `
marrow: 2
name: Custom Meta Test
devices:
  - id: core-01
    icon: cisco/switches/layer-3-switch
    custom_fields:
      serial_number: "FOC998877"
      rack: "Rack 12U"
      asn: 65001
    sections:
      bgp_peers:
        - peer: 10.0.0.2
          remote_as: 65002
          state: Established
      firewall_rules: |
        | Rule | Port | Action |
        | 10   | 443  | Allow  |
links:
  - from: core-01
    to: core-01:loopback
    custom_fields:
      speed_tested: true
    sections:
      optical_budget: "Loss: 0.2dB"
`;
    const { valid, topology } = validateSource(customSource, { icons: ciscoCatalog() });
    expect(valid).toBe(true);
    const d = topology!.devices[0]! as any;
    expect(d.customFields).toEqual({
      serial_number: 'FOC998877',
      rack: 'Rack 12U',
      asn: 65001,
    });
    expect(d.sections).toBeDefined();
    expect((d.sections as any)['bgp_peers']).toHaveLength(1);
    const l = topology!.links[0]! as any;
    expect(l.customFields).toEqual({ speed_tested: true });
    expect((l.sections as any)['optical_budget']).toBe('Loss: 0.2dB');
  });

  test('normalizes title_block, author, revision, date', () => {
    const tbSource = `
marrow: 2
name: Blueprint Topology
author: Network Architecture Team
revision: v3.2
date: "2026-10-18"
title_block:
  title: Datacenter Spine Fabric
  logo: brand/custom-logo.svg
devices:
  - id: spine-01
    icon: cisco/switches/layer-3-switch
`;
    const { valid, topology } = validateSource(tbSource, { icons: ciscoCatalog() });
    expect(valid).toBe(true);
    const t = topology as any;
    expect(t.author).toBe('Network Architecture Team');
    expect(t.revision).toBe('v3.2');
    expect(t.date).toBe('2026-10-18');
    expect(t.titleBlock).toEqual({
      title: 'Datacenter Spine Fabric',
      author: 'Network Architecture Team',
      revision: 'v3.2',
      date: '2026-10-18',
      logo: 'brand/custom-logo.svg',
    });
  });
});
