import { describe, expect, test } from 'vitest';
import { DEFAULT_THEMES, readTheme } from '@marrow/visual';

/** What the canvas engine hands readTheme: getComputedStyle().getPropertyValue — '' when unset. */
const computed = (vars: Record<string, string>) => (name: string) => vars[name] ?? '';

describe('canvas theme from computed CSS variables (readTheme)', () => {
  test('nothing set → the scheme defaults', () => {
    expect(readTheme(computed({}), 'dark')).toEqual(DEFAULT_THEMES.dark);
    expect(readTheme(computed({}), 'light')).toEqual(DEFAULT_THEMES.light);
  });

  test('px widths: "2.5px", "  3.2px  " and bare "5" parse; invalid or non-positive fall back', () => {
    const t = readTheme(
      computed({
        '--edge-width-default': '2.5px',
        '--edge-width-10g': '  3.2px  ',
        '--edge-width-40g': '5',
        '--edge-width-trunk': 'abc',
        '--edge-width-slot': '-2px',
        '--edge-width-stack': '0px',
      }),
      'dark',
    );
    const d = DEFAULT_THEMES.dark.links;
    expect(t.links.widthDefault).toBe(2.5);
    expect(t.links.width10g).toBe(3.2);
    expect(t.links.width40g).toBe(5);
    expect(t.links.widthTrunk).toBe(d.widthTrunk);
    expect(t.links.widthSlot).toBe(d.widthSlot);
    expect(t.links.widthStack).toBe(d.widthStack);
  });

  test('px dashes: space-, comma- and px-delimited lists parse; malformed fall back', () => {
    const t = readTheme(
      computed({
        '--dash-degraded': '14 7',
        '--dash-planned': '2, 7',
        '--dash-tunnel': '8px 6px 4px 2px',
        '--dash-peering': 'none',
        '--dash-flow': '0 0',
      }),
      'light',
    );
    const d = DEFAULT_THEMES.light.links;
    expect(t.links.dashDegraded).toEqual([14, 7]);
    expect(t.links.dashPlanned).toEqual([2, 7]);
    expect(t.links.dashTunnel).toEqual([8, 6, 4, 2]);
    expect(t.links.dashPeering).toEqual(d.dashPeering);
    expect(t.links.dashFlow).toEqual(d.dashFlow);
  });

  test('colours pass through trimmed; blanks fall back', () => {
    const t = readTheme(computed({ '--up': ' #00ff00 ', '--bg': '   ', '--m-accent': 'oklch(0.6 0.2 250)' }), 'dark');
    expect(t.status.up).toBe('#00ff00');
    expect(t.palette.bg).toBe(DEFAULT_THEMES.dark.palette.bg);
    expect(t.palette.accent).toBe('oklch(0.6 0.2 250)');
  });
});
