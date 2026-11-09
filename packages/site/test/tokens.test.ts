import { describe, expect, test } from 'vitest';
import {
  generateThemeCss,
  buildStylesheet,
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  type ThemeConfig,
} from '../src/index.js';

describe('Design Token Contract & CSS Generation', () => {
  test('generates default theme CSS custom properties', () => {
    const css = generateThemeCss();
    expect(css).toContain(`--bg: ${DEFAULT_DARK_PALETTE.bg}`);
    expect(css).toContain(`--ink: ${DEFAULT_DARK_PALETTE.ink}`);
    expect(css).toContain(`--m-accent: ${DEFAULT_DARK_PALETTE.accent}`);
    expect(css).toContain(`--edge: ${DEFAULT_DARK_PALETTE.edge}`);
    expect(css).toContain('--edge-width-default: 1.5px');
    expect(css).toContain('--edge-width-10g: 3px');
    expect(css).toContain('--edge-width-trunk: 4.5px');

    // Light theme
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(`--bg: ${DEFAULT_LIGHT_PALETTE.bg}`);
    expect(css).toContain(`--ink: ${DEFAULT_LIGHT_PALETTE.ink}`);
  });

  test('merges user theme overrides without losing default tokens', () => {
    const config: ThemeConfig = {
      dark: {
        bg: '#000000',
        accent: '#ff00ff',
        status: {
          up: '#00ff00',
        },
      },
      links: {
        widthDefault: 2.5,
        widthTrunk: 6,
      },
    };

    const css = generateThemeCss(config);
    expect(css).toContain('--bg: #000000');
    expect(css).toContain('--m-accent: #ff00ff');
    expect(css).toContain('--up: #00ff00');
    // Default tokens should remain for non-overridden properties
    expect(css).toContain(`--panel: ${DEFAULT_DARK_PALETTE.panel}`);
    expect(css).toContain('--edge-width-default: 2.5px');
    expect(css).toContain('--edge-width-trunk: 6px');
    expect(css).toContain('--edge-width-10g: 3px');
  });

  test('buildStylesheet combines theme variables with base styles', () => {
    const customCss = buildStylesheet({ dark: { bg: '#112233' } });
    expect(customCss).toContain('--bg: #112233');
    expect(customCss).toContain('.m-stage');
    expect(customCss).toContain('.m-edge');
    expect(customCss).toContain('.m-chip-btn');
  });
});

describe('stylesheet ⇄ visual language', () => {
  test('buildStylesheet splices visualCss() exactly once, with px dashes only', async () => {
    const { visualCss } = await import('@marrow/visual');
    const css = buildStylesheet();
    const vc = visualCss();
    expect(css.split(vc).length - 1).toBe(1);
    expect(css).not.toContain('pathLength');
  });

  test('link overrides accept px dash strings or lists', () => {
    const css = generateThemeCss({ links: { dashTunnel: '10 5', dashPeering: [2, 4], width10g: 4 } });
    expect(css).toContain('--dash-tunnel: 10 5;');
    expect(css).toContain('--dash-peering: 2 4;');
    expect(css).toContain('--edge-width-10g: 4px;');
  });

  test('status colours are honoured flat or nested', () => {
    expect(generateThemeCss({ dark: { up: '#00ff01' } })).toContain('--up: #00ff01;');
    expect(generateThemeCss({ dark: { status: { down: '#ff0001' } } })).toContain('--down: #ff0001;');
  });
});
