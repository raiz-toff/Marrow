import { describe, expect, test } from 'vitest';
import { buildSnippet, countBySeverity, diag, formatPretty, toJsonReport } from '@marrow/diagnostics';

describe('buildSnippet', () => {
  test('renders gutter and caret at the column', () => {
    const snippet = buildSnippet('a: 1\nbb: two\nc: 3', { line: 2, col: 5 });
    expect(snippet).toBe('2 | bb: two\n  |     ^');
  });

  test('out-of-range line yields empty string', () => {
    expect(buildSnippet('a: 1', { line: 9, col: 1 })).toBe('');
  });
});

describe('reporting', () => {
  const diags = [
    diag('MRW-E010', { message: 'Unknown icon "x"', path: 'devices[0].icon', hint: 'search the catalog' }),
    diag('MRW-W103', { message: 'Device "a" has no links', path: 'devices[1]' }),
  ];

  test('severity is derived from the code', () => {
    expect(diags[0]!.severity).toBe('error');
    expect(diags[1]!.severity).toBe('warning');
    expect(countBySeverity(diags)).toEqual({ errors: 1, warnings: 1, infos: 0 });
  });

  test('json report shape', () => {
    const report = toJsonReport(diags);
    expect(report.valid).toBe(false);
    expect(report.summary.errors).toBe(1);
    expect(report.diagnostics).toHaveLength(2);
  });

  test('pretty output mentions code, path, and hint', () => {
    const text = formatPretty(diags, { color: false, filename: 'x.yaml' });
    expect(text).toContain('MRW-E010');
    expect(text).toContain('devices[0].icon');
    expect(text).toContain('hint: search the catalog');
    expect(text).toContain('1 error, 1 warning — x.yaml');
  });
});
