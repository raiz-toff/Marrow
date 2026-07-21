import { describe, expect, test } from 'vitest';
import { measureLines, measureText, truncateToWidth } from '@marrow/metrics';

describe('measureText', () => {
  test('deterministic and monotonic', () => {
    expect(measureText('Core Switch 01', 13)).toEqual(measureText('Core Switch 01', 13));
    expect(measureText('ab', 13).w).toBeGreaterThan(measureText('a', 13).w);
    expect(measureText('MMM', 13).w).toBeGreaterThan(measureText('iii', 13).w);
  });

  test('scales with size', () => {
    const at13 = measureText('router', 13).w;
    const at26 = measureText('router', 26).w;
    expect(at26).toBeCloseTo(at13 * 2, 1);
  });

  test('wide codepoints count as 1em', () => {
    expect(measureText('数据中心', 13).w).toBeCloseTo(52, 1);
  });
});

describe('truncateToWidth', () => {
  test('short text untouched, long text ellipsized within budget', () => {
    expect(truncateToWidth('core', 13, 160)).toBe('core');
    const long = 'a-very-long-device-name-that-never-ends-at-all';
    const cut = truncateToWidth(long, 13, 160);
    expect(cut.endsWith('…')).toBe(true);
    expect(measureText(cut, 13).w).toBeLessThanOrEqual(160);
  });
});

describe('measureLines', () => {
  test('widest line wins, height stacks', () => {
    const m = measureLines(['short', 'a much longer line here'], 13);
    expect(m.w).toBe(measureText('a much longer line here', 13).w);
    expect(m.h).toBeCloseTo(2 * 13 * 1.3, 1);
  });
});
