import { describe, expect, test } from 'vitest';
import { validateSource } from '@marrow/schema';
import { ciscoCatalog } from './helpers.js';

/**
 * Regression suite for the adversarial-review findings: hostile input must
 * NEVER crash the validator — every case yields structured diagnostics.
 */
describe('hostile input never crashes', () => {
  test('self-referential alias (value contains itself) → E001, no throw', () => {
    const result = validateSource('marrow: 2\nname: T\ndevices: &d\n  a: *d\nlinks: []');
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('MRW-E001');
    expect(result.diagnostics[0]!.message).toContain('self-referential');
  });

  test('nested circular alias inside a device → E001, no throw', () => {
    const result = validateSource(
      'marrow: 2\nname: T\ndevices:\n  - id: a\n    icon: cisco/switches/x\n    extra: &e { self: *e }',
    );
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('MRW-E001');
  });

  test('alias bomb (billion laughs) → E001, no throw', () => {
    const bomb = [
      'marrow: 2',
      'name: T',
      'a0: &a0 [x]',
      'a1: &a1 [*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0]',
      'a2: &a2 [*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1]',
      'a3: &a3 [*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2]',
      'a4: &a4 [*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3]',
      'devices: []',
      'links: []',
    ].join('\n');
    const result = validateSource(bomb);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('MRW-E001');
  });

  test('shared (non-circular) anchors are fine', () => {
    const result = validateSource(
      'marrow: 2\nname: T\ndevices:\n  - id: a\n    icon: cisco/switches/layer-3-switch\n    x-common: &c { note: shared }\n  - id: b\n    icon: cisco/switches/layer-3-switch\n    x-also: *c\nlinks:\n  - from: a\n    to: b',
      { icons: ciscoCatalog() },
    );
    expect(result.valid).toBe(true);
  });

  test('__proto__ device key is rejected as unknown and cannot satisfy required fields', () => {
    const result = validateSource(
      'marrow: 2\nname: T\ndevices:\n  - id: a\n    "__proto__":\n      icon: cisco/switches/layer-3-switch\n      hero: true\nlinks: []',
      { icons: ciscoCatalog() },
    );
    expect(result.valid).toBe(false);
    const codes = result.diagnostics.map((d) => d.code);
    // the smuggled block is an unknown key AND the real icon is still missing
    expect(codes).toContain('MRW-E005');
    expect(codes).toContain('MRW-E007');
    const unknown = result.diagnostics.find((d) => d.code === 'MRW-E005');
    expect(unknown?.message).toContain('__proto__');
  });

  test('scalar and list documents → E002', () => {
    expect(validateSource('just a string').diagnostics[0]!.code).toBe('MRW-E002');
    expect(validateSource('- a\n- b').diagnostics[0]!.code).toBe('MRW-E002');
    expect(validateSource('').diagnostics[0]!.code).toBe('MRW-E002');
  });

  test('null device entry → E006 naming the entry, not the index', () => {
    const result = validateSource('marrow: 2\nname: T\ndevices:\n  - null\nlinks: []');
    const e006 = result.diagnostics.find((d) => d.code === 'MRW-E006');
    expect(e006).toBeDefined();
    expect(e006!.message).not.toContain('"0"');
    expect(e006!.message).toContain('devices[0]');
    expect(e006!.hint).toContain('devices');
  });

  test('bare-string link entry → E006 naming the link', () => {
    const result = validateSource('marrow: 2\nname: T\ndevices: []\nlinks:\n  - just-a-string');
    const e006 = result.diagnostics.find((d) => d.code === 'MRW-E006');
    expect(e006!.message).toContain('link #1');
  });
});

describe('version gate is exact', () => {
  test('fractional 2.x is rejected with the real value in the message', () => {
    const result = validateSource('marrow: 2.999\nname: T\ndevices: []');
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]!.code).toBe('MRW-E004');
    expect(result.diagnostics[0]!.message).toContain('2.999');
  });

  test('.inf / .nan report Infinity / NaN, never "null"', () => {
    const inf = validateSource('marrow: .inf\nname: T\ndevices: []');
    expect(inf.diagnostics[0]!.code).toBe('MRW-E004');
    expect(inf.diagnostics[0]!.message).toContain('Infinity');
    expect(inf.diagnostics[0]!.message).not.toContain('null');
    const nan = validateSource('marrow: .nan\nname: T\ndevices: []');
    expect(nan.diagnostics[0]!.message).toContain('NaN');
  });

  test('marrow: 2 exactly (and 2.0, which IS the number 2) pass', () => {
    expect(validateSource('marrow: 2\nname: T\ndevices: []').valid).toBe(true);
    expect(validateSource('marrow: 2.0\nname: T\ndevices: []').valid).toBe(true);
  });
});

describe('warning precision', () => {
  test('a self-link touching one port on both ends is W104, never W101', () => {
    const result = validateSource(
      'marrow: 2\nname: T\ndevices:\n  - id: a\n    icon: cisco/switches/layer-3-switch\nlinks:\n  - from: a:Gi1\n    to: a:Gi1',
      { icons: ciscoCatalog() },
    );
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('MRW-W104');
    expect(codes).not.toContain('MRW-W101');
  });

  test('W101 counts distinct links', () => {
    const result = validateSource(
      [
        'marrow: 2',
        'name: T',
        'devices:',
        '  - id: a',
        '    icon: cisco/switches/layer-3-switch',
        '  - id: b',
        '    icon: cisco/switches/layer-3-switch',
        'links:',
        '  - from: a:Gi1',
        '    to: b:Gi1',
        '  - from: a:Gi1',
        '    to: b:Gi2',
      ].join('\n'),
      { icons: ciscoCatalog() },
    );
    const w101 = result.diagnostics.filter((d) => d.code === 'MRW-W101');
    expect(w101).toHaveLength(1);
    expect(w101[0]!.message).toContain('2 links (links #1, #2)');
  });
});
