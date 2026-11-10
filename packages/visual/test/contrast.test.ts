/**
 * WCAG 2.x contrast of the chrome text tokens against the surfaces they sit
 * on. Body text (`ink`, `inkDim`) and secondary text (`inkFaint`: breadcrumb
 * separators, counts, secondary table cells) must reach 4.5:1 in the light
 * theme; the dark theme's faint text, used only for de-emphasised labels,
 * keeps at least 3:1.
 */
import { describe, expect, test } from 'vitest';
import { DEFAULT_THEMES, type PaletteTokens } from '@marrow/visual';

function rgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`test: not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['ink', 'inkDim', 'inkFaint'] as const satisfies readonly (keyof PaletteTokens)[];
const SURFACES = ['bg', 'bgRaise', 'panel'] as const satisfies readonly (keyof PaletteTokens)[];

describe('chrome text contrast', () => {
  test('the ratio is computed as WCAG defines it', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  test.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))('light %s on %s ≥ 4.5:1', (text, surface) => {
    const p = DEFAULT_THEMES.light.palette;
    expect(contrast(p[text], p[surface])).toBeGreaterThanOrEqual(4.5);
  });

  test.each(TEXT.flatMap((t) => SURFACES.map((s) => [t, s] as const)))('dark %s on %s ≥ 4.5:1 (faint ≥ 3:1)', (text, surface) => {
    const p = DEFAULT_THEMES.dark.palette;
    expect(contrast(p[text], p[surface])).toBeGreaterThanOrEqual(text === 'inkFaint' ? 3 : 4.5);
  });

  test('the light theme keeps a visible step between dim and faint text', () => {
    const p = DEFAULT_THEMES.light.palette;
    expect(contrast(p.inkDim, p.panel)).toBeGreaterThan(contrast(p.inkFaint, p.panel) + 1);
  });
});
