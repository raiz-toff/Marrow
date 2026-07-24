import { describe, expect, test } from 'vitest';
import { encapLabel, linkPresentation, protocolLabel } from '@marrow/scene';

describe('linkPresentation — mode → stroke pattern', () => {
  test('each mode maps to its pattern', () => {
    expect(linkPresentation({ mode: 'trunk' }).pattern).toBe('double');
    expect(linkPresentation({ mode: 'tunnel' }).pattern).toBe('dashed');
    expect(linkPresentation({ mode: 'peering' }).pattern).toBe('dotted');
    expect(linkPresentation({ mode: 'stack' }).pattern).toBe('thick');
    expect(linkPresentation({ mode: 'routed' }).pattern).toBe('solid');
    expect(linkPresentation({ mode: 'access' }).pattern).toBe('solid');
    expect(linkPresentation({}).pattern).toBe('solid');
  });

  test('encap alone derives a tunnel (renderer-side, no declared mode)', () => {
    const p = linkPresentation({ encap: 'ipsec' });
    expect(p.mode).toBe('tunnel');
    expect(p.pattern).toBe('dashed');
    expect(p.chip).toBe('IPsec');
    expect(p.glyph).toBe('lock');
  });
});

describe('linkPresentation — chip + glyph', () => {
  test('a lag id always wins the chip (aggregation identity), with the bundle glyph', () => {
    const p = linkPresentation({ mode: 'trunk', vlans: '10,20', lag: 'po3' });
    expect(p.chip).toBe('PO3');
    expect(p.glyph).toBe('bundle');
    // the mode still drives the pattern → a LAG'd trunk is a double rail
    expect(p.pattern).toBe('double');
  });

  test('tunnel chip is the encap label with a lock', () => {
    expect(linkPresentation({ mode: 'tunnel', encap: 'vxlan' })).toMatchObject({ chip: 'VXLAN', glyph: 'lock' });
    expect(linkPresentation({ mode: 'tunnel' }).chip).toBe('VPN');
  });

  test('trunk chip is the VLAN set (clamped) or "trunk"', () => {
    expect(linkPresentation({ mode: 'trunk', vlans: '10,20,30' }).chip).toBe('10,20,30');
    expect(linkPresentation({ mode: 'trunk' }).chip).toBe('trunk');
    expect(linkPresentation({ mode: 'trunk', vlans: '100,200,300,400,500' }).chip).toMatch(/…$/);
  });

  test('routed shows a protocol chip only when a protocol is set; peering always labels', () => {
    expect(linkPresentation({ mode: 'routed' }).chip).toBeUndefined();
    expect(linkPresentation({ mode: 'routed', protocol: 'ospf' }).chip).toBe('OSPF');
    expect(linkPresentation({ mode: 'peering' }).chip).toBe('peer');
    expect(linkPresentation({ mode: 'peering', protocol: 'ebgp' }).chip).toBe('eBGP');
  });

  test('access shows a v-prefixed chip only when a VLAN is set', () => {
    expect(linkPresentation({ mode: 'access' }).chip).toBeUndefined();
    expect(linkPresentation({ mode: 'access', vlans: '10' }).chip).toBe('v10');
  });

  test('stack labels "stack"', () => {
    expect(linkPresentation({ mode: 'stack' })).toMatchObject({ chip: 'stack', glyph: 'stack', pattern: 'thick' });
  });
});

describe('label maps', () => {
  test('encap labels', () => {
    expect(encapLabel('ipsec')).toBe('IPsec');
    expect(encapLabel('wireguard')).toBe('WG');
    expect(encapLabel('mystery')).toBe('MYSTERY');
  });
  test('protocol labels', () => {
    expect(protocolLabel('ebgp')).toBe('eBGP');
    expect(protocolLabel('isis')).toBe('IS-IS');
    expect(protocolLabel('mystery')).toBe('MYSTERY');
  });
});
