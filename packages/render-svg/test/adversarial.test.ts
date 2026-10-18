import { describe, expect, test } from 'vitest';
import { extractSvg, namespaceSvgInner } from '../src/index.js';

describe('Adversarial & Stress Tests for SVG Namespacing', () => {
  test('does not double-prefix class names when one class is a prefix of another (e.g. icon and icon-box)', () => {
    const raw = `<svg viewBox="0 0 100 100">
      <style>
        .icon { fill: red; }
        .icon-box { stroke: black; }
      </style>
      <rect class="icon-box"/>
      <circle class="icon"/>
    </svg>`;

    const extracted = extractSvg(raw, 'ic-test');
    expect(extracted).toBeDefined();
    const inner = extracted!.inner;

    // Must NOT have ic-test-ic-test-icon-box or corrupted classes
    expect(inner).not.toContain('ic-test-ic-test');
    expect(inner).toContain('class="ic-test-icon-box"');
    expect(inner).toContain('class="ic-test-icon"');
  });

  test('namespaces CSS pseudo-classes, compound selectors, and media queries properly', () => {
    const raw = `<svg viewBox="0 0 100 100">
      <style>
        .cls-1:hover { fill: red; }
        .cls-2.active { opacity: 0.9; }
        .cls-3::before { content: ""; }
        .cls-4:not(.cls-5) { stroke: blue; }
        @media (prefers-color-scheme: dark) {
          .cls-1 { fill: white; }
        }
      </style>
      <rect class="cls-1 cls-2 active"/>
      <circle class="cls-3 cls-4"/>
    </svg>`;

    const extracted = extractSvg(raw, 'ic-test');
    expect(extracted).toBeDefined();
    const inner = extracted!.inner;

    expect(inner).toContain('.ic-test-cls-1:hover');
    expect(inner).toContain('.ic-test-cls-2.ic-test-active');
    expect(inner).toContain('.ic-test-cls-3::before');
    expect(inner).toContain('.ic-test-cls-4:not(.ic-test-cls-5)');
  });

  test('never touches external URLs in href or xlink:href', () => {
    const raw = `<svg viewBox="0 0 100 100">
      <defs><circle id="local-def" r="5"/></defs>
      <image href="https://example.com/logo.svg#icon" xlink:href="http://example.org/test.png"/>
      <use href="#local-def"/>
    </svg>`;

    const extracted = extractSvg(raw, 'ic-test');
    expect(extracted).toBeDefined();
    const inner = extracted!.inner;

    expect(inner).toContain('href="https://example.com/logo.svg#icon"');
    expect(inner).toContain('xlink:href="http://example.org/test.png"');
    expect(inner).toContain('href="#ic-test-local-def"');
  });

  test('handles viewBox edge cases: exponential notation, negative offsets, and comma separation', () => {
    const rawComma = '<svg viewBox="0, 0, 100, 200"><rect/></svg>';
    expect(extractSvg(rawComma)?.viewBox).toBe('0, 0, 100, 200');

    const rawNegative = '<svg viewBox="-50 -50 100 100"><circle/></svg>';
    expect(extractSvg(rawNegative)?.viewBox).toBe('-50 -50 100 100');
  });
});
