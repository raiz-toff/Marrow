import { describe, expect, test } from 'vitest';
import { parsePx, parseDash } from '../src/client/canvas-engine.js';

describe('canvas-engine CSS token parsers', () => {
  test('parsePx extracts valid pixel and raw float values', () => {
    expect(parsePx('2.5px', 1.5)).toBe(2.5);
    expect(parsePx('4px', 1.5)).toBe(4);
    expect(parsePx('  3.2px  ', 1.5)).toBe(3.2);
    expect(parsePx('5', 1.5)).toBe(5);
  });

  test('parsePx falls back on invalid or negative numbers', () => {
    expect(parsePx(undefined, 1.5)).toBe(1.5);
    expect(parsePx('', 1.5)).toBe(1.5);
    expect(parsePx('abc', 1.5)).toBe(1.5);
    expect(parsePx('-2px', 1.5)).toBe(1.5);
    expect(parsePx('0px', 1.5)).toBe(1.5);
  });

  test('parseDash parses space- and comma-delimited dash arrays', () => {
    expect(parseDash('14 7', [14, 7])).toEqual([14, 7]);
    expect(parseDash('2, 7', [2, 7])).toEqual([2, 7]);
    expect(parseDash('8 6 4 2', [8, 6])).toEqual([8, 6, 4, 2]);
  });

  test('parseDash falls back on malformed dash values', () => {
    expect(parseDash(undefined, [14, 7])).toEqual([14, 7]);
    expect(parseDash('none', [14, 7])).toEqual([14, 7]);
    expect(parseDash('single', [14, 7])).toEqual([14, 7]);
    expect(parseDash('5', [14, 7])).toEqual([14, 7]); // single number is not a valid dash pattern
  });
});
