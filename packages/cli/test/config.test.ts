import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
