import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadCatalog } from '@marrow/icons';
import { validateSource } from '@marrow/schema';
import { buildSingleFile } from '../src/index.js';
import { hasBrand, isSafeLink, sanitizeLogo, type Brand } from '../src/brand.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const icons = loadCatalog(join(repoRoot, 'icon-packs'));

function topology(): ReturnType<typeof validateSource>['topology'] {
  const src = readFileSync(join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), 'utf8');
  const result = validateSource(src, { icons });
  if (!result.topology) throw new Error('fixture failed to validate');
  return result.topology;
}

const ACME: Brand = {
  logo: '<svg id="ACMEMARK" viewBox="0 0 24 24"></svg>',
  name: 'Acme Networks',
  note: 'Proprietary & Confidential',
};

describe('sanitizeLogo', () => {
  test('strips scripts, handlers and external URLs, keeps the artwork', () => {
    const { logo, problems } = sanitizeLogo(
      `<svg><script>alert('xss')</script>` +
        `<img src="https://evil.example.com/x.png" onerror="fetch('https://evil.example.com')">` +
        `<img src="./local.png"><rect id="SAFE"/></svg>`,
    );
    expect(logo).toContain('SAFE');
    expect(logo).not.toContain('script');
    expect(logo).not.toContain('evil.example.com');
    expect(logo).not.toContain('onerror');
    expect(logo).not.toContain('<img'); // src stripped ⇒ dropped, not left broken
    expect(problems.length).toBeGreaterThan(0);
  });

  test('keeps data: URIs — the one way to embed a bitmap offline', () => {
    const { logo } = sanitizeLogo('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(logo).toContain('data:image/png;base64');
  });

  test('drops the XML prolog and doctype', () => {
    const { logo } = sanitizeLogo('<?xml version="1.0"?><!DOCTYPE svg><svg id="OK"></svg>');
    expect(logo).toBe('<svg id="OK"></svg>');
  });
});

describe('isSafeLink / hasBrand', () => {
  test('only http(s) is a safe link', () => {
    expect(isSafeLink('https://acme.example.com')).toBe(true);
    expect(isSafeLink('http://acme.example.com')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', './rel', 'file:///etc/passwd']) {
      expect(isSafeLink(bad), bad).toBe(false);
    }
  });

  test('hasBrand is false only when nothing is set', () => {
    expect(hasBrand(undefined)).toBe(false);
    expect(hasBrand({})).toBe(false);
    expect(hasBrand({ name: 'Acme' })).toBe(true);
    expect(hasBrand({ github: 'https://github.com/a/b' })).toBe(true);
  });
});

describe('brand in the built page', () => {
  test('the logo reaches every chrome surface', async () => {
    const built = await buildSingleFile(topology(), { icons, brand: ACME });
    for (const surface of ['m-backdrop-text', 'm-side-foot', 'm-drawer-foot']) {
      const region = new RegExp(`class="${surface}"[\\s\\S]{0,400}`).exec(built.html);
      expect(region, `${surface} missing`).not.toBeNull();
      expect(region![0], `${surface} has no brand logo`).toContain('ACMEMARK');
    }
    expect(built.html).toContain('Acme Networks');
  });

  test('the config is authoritative — topology YAML cannot override it', async () => {
    // `backdrop` is no longer part of the schema; even smuggled in, it is ignored
    const t = { ...topology()!, backdrop: { text: 'Per-Diagram Co', note: 'Internal' } } as never;
    const built = await buildSingleFile(t, { icons, brand: ACME });

    expect(built.html).toContain('Acme Networks');
    expect(built.html).toContain('ACMEMARK');
    expect(built.html).not.toContain('Per-Diagram Co');
  });

  test('no brand configured still renders the default mark', async () => {
    const built = await buildSingleFile(topology(), { icons });
    expect(built.html).toContain('Marrow');
    expect(built.html).not.toContain('ACMEMARK');
  });

  test('OFFLINE GATE holds with branding applied', async () => {
    const built = await buildSingleFile(topology(), { icons, brand: ACME });
    const external = built.html.match(/https?:\/\/(?!www\.w3\.org)[^"' )]+/g) ?? [];
    expect(external).toEqual([]);
  });
});

describe('brand links', () => {
  const LINKED: Brand = { ...ACME, link: 'https://acme.example.com', github: 'https://github.com/acme/net' };

  test('the brand mark links out, with a separate source mark', async () => {
    const built = await buildSingleFile(topology(), { icons, brand: LINKED });
    expect(built.html).toContain('href="https://acme.example.com"');
    expect(built.html).toContain('href="https://github.com/acme/net"');
    for (const a of built.html.match(/<a class="m-brand-(?:link|gh)"[^>]*>/g) ?? []) {
      expect(a).toContain('rel="noopener noreferrer"');
      expect(a).toContain('target="_blank"');
    }
  });

  test('links are navigation only — never an external resource load', async () => {
    const built = await buildSingleFile(topology(), { icons, brand: LINKED });
    expect(built.html.match(/\bsrc\s*=\s*"https?:\/\/[^"]*"/gi) ?? []).toEqual([]);
    for (const tag of built.html.match(/<[a-z-]+\b[^>]*href\s*=\s*"https?:\/\/[^"]*"[^>]*>/gi) ?? []) {
      expect(tag.toLowerCase().startsWith('<a ')).toBe(true);
    }
  });

  test('no links configured leaves the mark unlinked', async () => {
    const built = await buildSingleFile(topology(), { icons, brand: { name: 'Acme' } });
    expect(built.html).not.toContain('<a class="m-brand-link"');
    expect(built.html).not.toContain('<a class="m-brand-gh"');
  });
});
