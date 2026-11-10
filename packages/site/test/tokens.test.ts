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
    expect(customCss).toContain('.m-icon-btn');
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

/** The bodies of every `@media <query> { … }` block (balanced braces), joined. */
function media(css: string, query: string): string {
  const bodies: string[] = [];
  for (let start = css.indexOf(`@media ${query} {`); start >= 0; start = css.indexOf(`@media ${query} {`, start + 1)) {
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) {
        bodies.push(css.slice(open + 1, i));
        break;
      }
    }
  }
  expect(bodies.length, `@media ${query}`).toBeGreaterThan(0);
  return bodies.join('\n');
}

/** Declarations of every top-level rule in `css` whose selector list names `selector`. */
function declsFor(css: string, selector: string): string {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel!.split(',').some((s) => s.trim() === selector))
    .map(([, , body]) => body)
    .join(';');
}

describe('chrome modes in the stylesheet', () => {
  const css = buildStylesheet();

  test('minimal chrome has no sidebar backdrop and no mobile bar', () => {
    for (const sel of ['.m-sidebar', '.m-sidebar-backdrop', '.m-mobile-bar']) {
      expect(declsFor(css, `html[data-chrome="minimal"] ${sel}`), sel).toContain('display: none !important');
    }
  });

  test('44 px touch targets follow a coarse pointer, not only phone widths', () => {
    const touch = media(css, '(max-width: 767px), (pointer: coarse)');
    for (const sel of ['.m-controls .m-btn', '.m-inspector-close', '.m-sidebar-close']) {
      expect(declsFor(touch, sel), sel).toContain('min-height: 44px');
    }
    expect(declsFor(media(css, '(max-width: 767px)'), '.m-mob-selector-btn')).toContain('min-height: 44px');
  });

  test('the minimap sits in the stage frame, clear of the controls', () => {
    const decls = declsFor(css, '.m-minimap');
    expect(decls).toContain('position: absolute');
    expect(decls).toContain('var(--ctl-w)');
  });

  test('print: light palette, no chrome, one flowing document', () => {
    const custom = buildStylesheet({ light: { bg: '#eeeeee' } });
    const tokens = declsFor(media(custom, 'print'), ':root[data-theme]');
    expect(tokens).toContain('--bg: #eeeeee'); // the light palette, with overrides
    expect(tokens).toContain(`--ink: ${DEFAULT_LIGHT_PALETTE.ink}`);
    const print = media(css, 'print');
    for (const sel of ['.m-command-bar', '.m-mobile-bar', '.m-watermark', '.m-sidebar-backdrop', '.m-backdrop', '.m-controls']) {
      expect(declsFor(print, sel), sel).toContain('display: none !important');
    }
    expect(declsFor(print, 'html')).toMatch(/height: auto !important; overflow: visible !important/);
    expect(declsFor(print, '.m-camera')).toContain('transform: none !important');
  });
});
