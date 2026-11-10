import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, test } from 'vitest';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { createSiteBuilder } from '@marrow/site';
import { getPrebootSource } from '../src/index.js';
import { parseModularParams } from '../src/shared/hash.js';
import { applyModularParams } from '../src/shared/page-contract.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const PREBOOT_BUDGET = 1536; // 1.5 KB — it is inlined in every page's <head>

/** Run applyModularParams over a URL against a plain `<html>`-like object. */
function apply(search: string, hash: string, initial: Record<string, string> = {}): Record<string, string | undefined> {
  const root = { dataset: { ...initial } as DOMStringMap };
  applyModularParams(root, parseModularParams(search, hash));
  return { ...root.dataset };
}

describe('URL → <html> attributes', () => {
  test.each([
    ['', '', {}, {}],
    ['?chrome=minimal', '', {}, { chrome: 'minimal' }],
    ['', '#embed=true', {}, { chrome: 'minimal' }],
    ['', '#embed=1;inspector=off', {}, { chrome: 'minimal', inspector: 'off' }],
    ['?inspector=false&minimap=off', '', {}, { inspector: 'off', minimap: 'off' }],
    ['?theme=light', '', { theme: 'dark' }, { theme: 'light' }],
    ['?theme=sepia', '', { theme: 'dark' }, { theme: 'dark' }],
    ['?controls=off', '#minimap=false', {}, { controls: 'off', minimap: 'off' }],
    ['?layout=spacious', '', {}, {}], // retired: nothing read it
    ['?theme=dark', '#theme=light', {}, { theme: 'dark' }], // query beats hash
    // full / false / on undo what the page shipped — before first paint now
    ['?chrome=full', '', { chrome: 'minimal' }, {}],
    ['', '#embed=false', { chrome: 'minimal' }, {}],
    ['?inspector=on&minimap=true&controls=on', '', { inspector: 'off', minimap: 'off', controls: 'off' }, {}],
    // unrelated params leave shipped attributes alone
    ['?export_title=off', '', { chrome: 'minimal', theme: 'light' }, { chrome: 'minimal', theme: 'light' }],
  ] as const)('%s %s on %j → %j', (search, hash, initial, expected) => {
    expect(apply(search, hash, initial)).toEqual(expected);
  });
});

async function bundle(): Promise<string> {
  const out = await build({
    entryPoints: [join(repoRoot, 'packages/runtime/src/shared/preboot.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2019',
    write: false,
    logLevel: 'silent',
  });
  return out.outputFiles[0]!.text;
}

describe('the pre-boot bundle', () => {
  test(`stays within ${PREBOOT_BUDGET} bytes`, async () => {
    const code = await bundle();
    expect(Buffer.byteLength(code)).toBeLessThanOrEqual(PREBOOT_BUDGET);
    expect(code).not.toContain('</script');
  });

  /** Execute the real bundle against stand-ins for the browser globals it reads. */
  async function run(opts: {
    search?: string;
    hash?: string;
    html: Record<string, string>;
    stored?: string | null | 'throw';
    osDark?: boolean;
  }): Promise<Record<string, string | undefined>> {
    const html = { dataset: { ...opts.html } as DOMStringMap };
    const location = { search: opts.search ?? '', hash: opts.hash ?? '' };
    const localStorage = {
      getItem: () => {
        if (opts.stored === 'throw') throw new Error('blocked');
        return opts.stored ?? null;
      },
    };
    const matchMedia = () => ({ matches: opts.osDark ?? true });
    new Function('document', 'location', 'localStorage', 'matchMedia', await bundle())(
      { documentElement: html },
      location,
      localStorage,
      matchMedia,
    );
    return { ...html.dataset };
  }

  test('theme: auto follows the OS scheme before first paint', async () => {
    expect(await run({ html: { theme: 'dark', themeMode: 'auto' }, osDark: false })).toMatchObject({ theme: 'light' });
    expect(await run({ html: { theme: 'dark', themeMode: 'auto' }, osDark: true })).toMatchObject({ theme: 'dark' });
  });

  test('a remembered choice or a URL theme wins over the OS scheme', async () => {
    expect(await run({ html: { theme: 'dark', themeMode: 'auto' }, stored: 'dark', osDark: false })).toMatchObject({
      theme: 'dark',
    });
    expect(
      await run({ html: { theme: 'dark', themeMode: 'auto' }, search: '?theme=dark', osDark: false }),
    ).toMatchObject({ theme: 'dark' });
  });

  test('fixed themes are left alone; blocked storage never throws', async () => {
    expect(await run({ html: { theme: 'light' }, osDark: true })).toEqual({ theme: 'light' });
    expect(await run({ html: { theme: 'dark', themeMode: 'auto' }, stored: 'throw', osDark: false })).toMatchObject({
      theme: 'light',
    });
  });

  test('embed hash applies through the same code as the runtime', async () => {
    expect(await run({ html: { theme: 'dark' }, hash: '#embed=true;minimap=off' })).toEqual({
      theme: 'dark',
      chrome: 'minimal',
      minimap: 'off',
    });
  });
});

describe('compiled pages', () => {
  const icons = loadCatalog(join(repoRoot, 'icon-packs'));
  const t = validateSource(readFileSync(join(repoRoot, 'fixtures/valid/small-office.yaml'), 'utf8'), {
    icons,
  }).topology!;

  test.each(['single', 'site'] as const)(
    '%s pages inline the pre-boot script in <head>, before the stylesheet',
    async (shape) => {
      const page = (await createSiteBuilder(t, { icons, shape }).buildPage('index.html'))!.content;
      const script = page.indexOf(`<script>${getPrebootSource()}</script>`);
      const style = Math.min(
        ...['<style>', '<link rel="stylesheet"'].map((s) => page.indexOf(s)).filter((i) => i >= 0),
      );
      expect(script).toBeGreaterThan(0);
      expect(script).toBeLessThan(style);
      expect(script).toBeLessThan(page.indexOf('</head>'));
    },
  );
});
