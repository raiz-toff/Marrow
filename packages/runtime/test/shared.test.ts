import { describe, expect, test } from 'vitest';
import { parseHash, parseModularParams, serializeHash } from '../src/shared/hash.js';
import { searchDocs, type SearchDoc } from '../src/shared/search.js';

describe('hash deep links', () => {
  test('round-trips device + camera', () => {
    const state = { device: 'core-sw-01', camera: { x: 12.345, y: -40, k: 1.25 } };
    const parsed = parseHash(serializeHash(state));
    expect(parsed.device).toBe('core-sw-01');
    expect(parsed.camera).toEqual({ x: 12.35, y: -40, k: 1.25 });
  });

  test('tolerates junk', () => {
    expect(parseHash('#garbage')).toEqual({});
    expect(parseHash('#c=a,b,c')).toEqual({});
    expect(parseHash('#c=1,2,0')).toEqual({}); // zero zoom rejected
    expect(parseHash('')).toEqual({});
    expect(serializeHash({})).toBe('');
  });

  test('encodes device ids safely', () => {
    const parsed = parseHash(serializeHash({ device: 'a;b=c' }));
    expect(parsed.device).toBe('a;b=c');
  });
});

describe('modular UI options (Defect 3)', () => {
  test('parses query and hash parameters for embed & modular chrome', () => {
    expect(parseModularParams('?chrome=minimal&inspector=off', '')).toEqual({
      chrome: 'minimal',
      inspector: 'off',
    });

    expect(parseModularParams('', '#embed=true;minimap=off;theme=light')).toEqual({
      chrome: 'minimal',
      minimap: 'off',
      theme: 'light',
    });

    expect(parseModularParams('?theme=dark', '#d=core-01;embed=1;inspector=off')).toEqual({
      chrome: 'minimal',
      inspector: 'off',
      theme: 'dark',
    });

    expect(parseModularParams('?chrome=full&minimap=on', '')).toEqual({
      chrome: 'full',
      minimap: 'on',
    });

    expect(parseModularParams('?export_title=on&export_legend=off&export_ports=off', '')).toEqual({
      exportTitle: 'on',
      exportLegend: 'off',
      exportPorts: 'off',
    });
  });
});

describe('spotlight search', () => {
  const docs: SearchDoc[] = [
    { id: 'core-sw-01', name: 'Core Switch 1', tier: 'core', ip: '10.255.0.1', extra: ['Te1/0/1'] },
    { id: 'dist-a-01', name: 'Distribution A1', tier: 'distribution', zone: 'building-a' },
    { id: 'srv-db-01', name: 'DB Server', role: 'database', ip: '10.20.0.5' },
  ];

  test('id and name prefixes rank highest', () => {
    expect(searchDocs('core', docs)[0]!.id).toBe('core-sw-01');
    expect(searchDocs('db', docs)[0]!.id).toBe('srv-db-01');
  });

  test('finds by ip fragment and interface name', () => {
    expect(searchDocs('10.255', docs)[0]!.id).toBe('core-sw-01');
    expect(searchDocs('te1/0/1', docs)[0]!.id).toBe('core-sw-01');
  });

  test('every token must match — unmatched terms kill the hit', () => {
    expect(searchDocs('core zzz', docs)).toEqual([]);
    expect(searchDocs('', docs)).toEqual([]);
  });
});
