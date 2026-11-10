import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStylesheet, DEFAULT_DARK_PALETTE, DEFAULT_DARK_STATUS } from '@marrow/site';
import { loadConfig, parseConfig } from '../src/config.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'marrow-config-'));
  mkdirSync(join(dir, 'brand'), { recursive: true });
  writeFileSync(
    join(dir, 'brand', 'logo.svg'),
    '<?xml version="1.0"?><svg viewBox="0 0 24 24"><rect id="ACMEMARK" width="24" height="24"/></svg>',
  );
  writeFileSync(join(dir, 'brand', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('parseConfig', () => {
  test('reads every brand field', () => {
    const { brand, problems } = parseConfig(
      `brand:
  name: Acme Networks
  note: Proprietary & Confidential
  logo: brand/logo.svg
  link: https://acme.example.com
  github: https://github.com/acme/net`,
      dir,
    );
    expect(problems).toEqual([]);
    expect(brand?.name).toBe('Acme Networks');
    expect(brand?.note).toBe('Proprietary & Confidential');
    expect(brand?.logo).toContain('ACMEMARK');
    expect(brand?.link).toBe('https://acme.example.com');
    expect(brand?.github).toBe('https://github.com/acme/net');
  });

  test('blank values and a missing brand block mean "unset"', () => {
    expect(parseConfig('brand:\n  name: ""\n  note: "   "', dir).brand).toBeUndefined();
    expect(parseConfig('', dir).brand).toBeUndefined();
    expect(parseConfig('brand:', dir).brand).toBeUndefined();
  });

  test('flags unknown keys but still uses the good ones', () => {
    const { brand, problems } = parseConfig('theme: dark\nbrand:\n  name: Acme\n  colour: blue', dir);
    expect(brand?.name).toBe('Acme');
    expect(problems.some((p) => p.includes('"theme"'))).toBe(true);
    expect(problems.some((p) => p.includes('brand.colour'))).toBe(true);
  });

  test('x- prefixed keys are private annotations, not errors', () => {
    const { problems } = parseConfig('x-owner: netops\nbrand:\n  x-team: core\n  name: Acme', dir);
    expect(problems).toEqual([]);
  });

  test('rejects non-http(s) links', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>', './relative']) {
      const { brand, problems } = parseConfig(`brand:\n  link: "${bad}"`, dir);
      expect(brand?.link, bad).toBeUndefined();
      expect(problems.length, bad).toBeGreaterThan(0);
    }
  });

  test('sanitizes the logo and strips the XML prolog', () => {
    writeFileSync(
      join(dir, 'brand', 'evil.svg'),
      `<svg viewBox="0 0 24 24"><script>alert('xss')</script>` +
        `<image href="https://evil.example.com/x.png"/><rect id="SAFE"/></svg>`,
    );
    const { brand, problems } = parseConfig('brand:\n  logo: brand/evil.svg', dir);
    expect(brand?.logo).toContain('SAFE');
    expect(brand?.logo).not.toContain('script');
    expect(brand?.logo).not.toContain('evil.example.com');
    expect(brand?.logo).not.toContain('<?xml');
    expect(problems.length).toBeGreaterThan(0);
  });

  test('raster logos become self-contained data: URIs', () => {
    const { brand } = parseConfig('brand:\n  logo: brand/logo.png', dir);
    expect(brand?.logo).toMatch(/^<img src="data:image\/png;base64,/);
  });

  test('a missing or unsupported logo warns instead of throwing', () => {
    expect(parseConfig('brand:\n  logo: brand/nope.svg', dir).problems.join()).toContain('no file at');
    writeFileSync(join(dir, 'brand', 'logo.txt'), 'nope');
    expect(parseConfig('brand:\n  logo: brand/logo.txt', dir).problems.join()).toContain('unsupported file type');
  });

  test('malformed YAML degrades to a warning, never a throw', () => {
    expect(parseConfig('brand:\n  name: [unclosed', dir).problems.length).toBeGreaterThan(0);
    expect(parseConfig('- just\n- a list', dir).problems.join()).toContain('mapping');
  });

  test('parses theme overrides for dark, light and links', () => {
    const yaml = `
theme:
  dark:
    bg: "#101216"
    panel: "#1b1e24"
    accent_ink: "#38bdf8"
    up: "#4ade80"
  light:
    bg: "#ffffff"
    accent: "#0284c7"
  links:
    width_default: 2
    width10g: 3.5
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([]);
    expect(theme?.dark?.bg).toBe('#101216');
    expect(theme?.dark?.panel).toBe('#1b1e24');
    expect(theme?.dark?.accentInk).toBe('#38bdf8');
    expect(theme?.dark?.up).toBe('#4ade80');
    expect(theme?.light?.bg).toBe('#ffffff');
    expect(theme?.light?.accent).toBe('#0284c7');
    expect(theme?.links?.widthDefault).toBe(2);
    expect(theme?.links?.width10g).toBe(3.5);
  });

  test('validates theme colors against CSS injection and stroke widths', () => {
    const yaml = `
theme:
  dark:
    bg: "red; } evil { display: none; }"
    panel: "#222"
  links:
    width_default: -4
    width_trunk: "not-a-number"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(theme?.dark?.panel).toBe('#222');
    expect(theme?.dark?.bg).toBeUndefined();
    expect(theme?.links?.widthDefault).toBeUndefined();
    expect(problems.some((p) => p.includes('theme.dark.bg: invalid color'))).toBe(true);
    expect(problems.some((p) => p.includes('theme.links.width_default: must be a positive number'))).toBe(true);
  });

  test('theme.links overrides reach the built stylesheet (px widths and dashes)', () => {
    const yaml = `
theme:
  dark:
    planned: "#123456"
  links:
    width_10g: 4
    dash_tunnel: "10 5"
    dash_peering: [2, 4]
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([]);
    const css = buildStylesheet(theme);
    expect(css).toContain('--edge-width-10g: 4px;');
    expect(css).toContain('--dash-tunnel: 10 5;');
    expect(css).toContain('--dash-peering: 2 4;');
    expect(css).toContain('--planned: #123456;');
  });

  test('palette keys reach :root and [data-theme="light"] in both spellings, deprecated aliases included', () => {
    const yaml = `
theme:
  dark:
    bg_raise: "#101010"
    inkDim: "#202020"
    panel: "#303030"
    ring: "#404040"
    sidebar_fg: "#505050"
    muted: "#606060"
  light:
    bg_raise: "#a0a0a0"
    inkDim: "#b0b0b0"
    sidebar_fg: "#c0c0c0"
    surface: "#d0d0d0"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([
      'theme.dark.muted is deprecated — use theme.dark.ink_dim',
      'theme.light.surface is deprecated — use theme.light.panel',
    ]);
    const css = buildStylesheet(theme);
    const dark = /^:root \{([^}]*)\}/.exec(css)?.[1] ?? '';
    const light = /:root\[data-theme="light"\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(dark).toContain('--bg-raise: #101010;');
    expect(dark).toContain('--panel: #303030;');
    expect(dark).toContain('--ring: #404040;');
    expect(dark).toContain('--sidebar-fg: #505050;');
    // `muted` is an alias of ink_dim; the later key in the block wins
    expect(dark).toContain('--ink-dim: #606060;');
    expect(light).toContain('--bg-raise: #a0a0a0;');
    expect(light).toContain('--ink-dim: #b0b0b0;');
    expect(light).toContain('--sidebar-fg: #c0c0c0;');
    expect(light).toContain('--panel: #d0d0d0;');
  });

  test('every palette and status token is accepted in snake_case and camelCase', () => {
    const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    const keys = [...Object.keys(DEFAULT_DARK_PALETTE), ...Object.keys(DEFAULT_DARK_STATUS)];
    const value = (k: string) => (k.startsWith('shadow') ? '0 1px 2px 0 rgb(1 2 3 / .5)' : '#abcdef');
    for (const spell of [snake, (k: string) => k]) {
      const lines = keys.map((k) => `    ${spell(k)}: "${value(k)}"`).join('\n');
      const { theme, problems } = parseConfig(`theme:\n  dark:\n${lines}\n`, dir);
      expect(problems).toEqual([]);
      for (const k of keys) expect((theme?.dark as Record<string, string>)[k], k).toBe(value(k));
    }
  });

  test('keys with no theme token warn, naming the supported keys — never a silent drop', () => {
    const yaml = `
theme:
  dark:
    accent_hover: "#111111"
    accent_subtle: "#222222"
    subtle: "#333333"
    constructor: "#444444"
    accent: "#555555"
  light:
    admin_down: "#666666"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    for (const key of ['theme.dark.accent_hover', 'theme.dark.accent_subtle', 'theme.dark.subtle', 'theme.dark.constructor', 'theme.light.admin_down']) {
      const p = problems.find((m) => m.includes(`"${key}"`));
      expect(p, key).toBeDefined();
      expect(p).toContain('supported: bg, bg_raise, panel');
      expect(p).toContain('deprecated aliases: surface → panel');
    }
    expect(theme?.dark).toEqual({ accent: '#555555' });
    expect(theme?.light).toBeUndefined();
    const links = parseConfig('theme:\n  links:\n    constructor: 2\n', dir);
    expect(links.problems).toEqual(['unknown key "theme.links.constructor"']);
  });

  test('documented *_stroke link keys still apply but warn; undocumented legacy spellings are unknown', () => {
    const yaml = `
theme:
  links:
    default_stroke: 2
    ten_g_stroke: 3
    forty_g_stroke: 4
    trunk_stroke: 5
    slot_stroke: 6
    stack_stroke: 7
    defaultStrokeWidth: 8
    teng_stroke: 9
    trunk_stroke_width: 10
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(theme?.links).toEqual({ widthDefault: 2, width10g: 3, width40g: 4, widthTrunk: 5, widthSlot: 6, widthStack: 7 });
    expect(problems).toEqual([
      'theme.links.default_stroke is deprecated — use theme.links.width_default',
      'theme.links.ten_g_stroke is deprecated — use theme.links.width_10g',
      'theme.links.forty_g_stroke is deprecated — use theme.links.width_40g',
      'theme.links.trunk_stroke is deprecated — use theme.links.width_trunk',
      'theme.links.slot_stroke is deprecated — use theme.links.width_slot',
      'theme.links.stack_stroke is deprecated — use theme.links.width_stack',
      'unknown key "theme.links.defaultStrokeWidth"',
      'unknown key "theme.links.teng_stroke"',
      'unknown key "theme.links.trunk_stroke_width"',
    ]);
  });

  test('status colours are accepted flat or nested under status:', () => {
    const yaml = `
theme:
  dark:
    up: "#00aa00"
    status:
      down: "#aa0000"
      bg: "#000000"
  light:
    status:
      degraded: "#aaaa00"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"theme.dark.status.bg"');
    expect(problems[0]).toContain('supported: up, down, degraded, planned, unknown');
    const css = buildStylesheet(theme);
    expect(css).toContain('--up: #00aa00;');
    expect(css).toContain('--down: #aa0000;');
    expect(/:root\[data-theme="light"\] \{([^}]*)\}/.exec(css)?.[1]).toContain('--degraded: #aaaa00;');
  });

  test('shadow tokens take a box-shadow list but never a resource load', () => {
    const yaml = `
theme:
  dark:
    shadow: "0 4px 8px rgb(0 0 0 / .5)"
    shadow_sm: "0 0 0 1px url(https://example.com/x)"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(theme?.dark?.shadow).toBe('0 4px 8px rgb(0 0 0 / .5)');
    expect(theme?.dark?.shadowSm).toBeUndefined();
    expect(problems.some((p) => p.includes('theme.dark.shadow_sm: invalid shadow'))).toBe(true);
  });

  test('legacy normalized dash values warn; malformed dashes are rejected', () => {
    const yaml = `
theme:
  links:
    dash_tunnel: "0.02 0.014"
    dash_degraded: "solid"
`;
    const { theme, problems } = parseConfig(yaml, dir);
    expect(problems.some((p) => p.includes('theme.links.dash_tunnel') && p.includes('dashes are px now'))).toBe(true);
    expect(problems.some((p) => p.includes('theme.links.dash_degraded: must be a px dash pattern'))).toBe(true);
    expect(theme?.links?.dashDegraded).toBeUndefined();
  });

  test('parses layout density and scale from config', () => {
    const yaml = `
layout:
  density: compact
  scale: 1.2
`;
    const { layout, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([]);
    expect(layout?.density).toBe('compact');
    expect(layout?.scale).toBe(1.2);
  });

  test('warns on invalid layout density or out-of-range scale', () => {
    const yaml = `
layout:
  density: ultra-wide
  scale: 50
`;
    const { layout, problems } = parseConfig(yaml, dir);
    expect(layout?.density).toBeUndefined();
    expect(layout?.scale).toBeUndefined();
    expect(problems.some((p) => p.includes('layout.density'))).toBe(true);
    expect(problems.some((p) => p.includes('layout.scale'))).toBe(true);
  });

  test('parses modular watermark configuration', () => {
    const yaml = `
watermark:
  enabled: true
  mode: minimal
  opacity: 0.05
  font: mono
  casing: sentence
`;
    const { watermark, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([]);
    expect(watermark?.enabled).toBe(true);
    expect(watermark?.mode).toBe('minimal');
    expect(watermark?.opacity).toBe(0.05);
    expect(watermark?.font).toBe('mono');
    expect(watermark?.casing).toBe('sentence');
  });

  test('parses brand logo dictionary with src path', () => {
    const yaml = `
brand:
  name: Acme Corp
  logo:
    src: brand/logo.svg
    height: 18
`;
    const { brand, problems } = parseConfig(yaml, dir);
    expect(problems).toEqual([]);
    expect(brand?.name).toBe('Acme Corp');
    expect(brand?.logo).toContain('ACMEMARK');
  });
});

describe('loadConfig', () => {
  test('a missing default config is silent; a named missing one warns', () => {
    expect(loadConfig(join(dir, 'nope.yaml')).problems.join()).toContain('not found');
    expect(loadConfig(join(dir, 'also-nope-default.yaml')).problems.length).toBe(1);
  });

  test('resolves logo paths relative to the config file, not the cwd', () => {
    writeFileSync(join(dir, 'marrow.config.yaml'), 'brand:\n  name: Rel\n  logo: brand/logo.svg');
    const { brand, problems } = loadConfig(join(dir, 'marrow.config.yaml'));
    expect(problems).toEqual([]);
    expect(brand?.logo).toContain('ACMEMARK');
  });
});
