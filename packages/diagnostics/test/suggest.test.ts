import { describe, expect, test } from 'vitest';
import { closestMatches, editDistance } from '@marrow/diagnostics';

describe('editDistance', () => {
  test('classic cases', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });

  test('cap short-circuits', () => {
    expect(editDistance('aaaaaaaa', 'bbbbbbbb', 2)).toBeGreaterThan(2);
  });
});

describe('closestMatches', () => {
  const rootKeys = ['marrow', 'name', 'description', 'theme', 'hero', 'zones', 'devices', 'links'];

  test('finds the intended key for a typo', () => {
    expect(closestMatches('devcies', rootKeys)).toContain('devices');
    expect(closestMatches('teir', ['id', 'name', 'icon', 'tier', 'zone'])).toContain('tier');
  });

  test('does not suggest wildly unrelated candidates', () => {
    expect(closestMatches('zzzzzzzz', rootKeys)).toEqual([]);
  });

  test('substring intent match', () => {
    expect(closestMatches('switch', ['cisco/switches/workgroup-switch'])).toEqual([
      'cisco/switches/workgroup-switch',
    ]);
  });
});
