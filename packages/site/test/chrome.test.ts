import { describe, expect, test } from 'vitest';
import { BUILTIN_TABS, decodePageData, HOOKS, hookAttr, type EmbeddedData, type HookId } from '@marrow/runtime';
import { renderChrome, type ChromeOptions } from '../src/chrome.js';

// Class names are styling, not contract: these tests check structure and
// presentation. Which elements the runtime binds to is the page contract's
// job (hooks), proven end to end by packages/runtime/test/boot.test.ts.

const data: EmbeddedData = {
  name: 'Test Topology',
  theme: 'dark',
  kind: 'stage',
  page: 'index.html',
  zonesCount: 0,
  devices: [],
  links: [],
  zones: [],
};

const stageOptions: ChromeOptions = {
  title: 'Test Topology',
  stats: '12 devices · 16 links',
  crumbs: [{ label: 'Network', href: 'index.html' }, { label: 'Core DC' }],
  rootPrefix: '',
  page: 'index.html',
  theme: 'dark',
  stage: '<svg class="m-svg" data-w="1200" data-h="800"></svg>',
  data,
  assets: { mode: 'external' },
  navLinks: [{ label: 'Core DC', href: 'index.html', count: 12 }],
};

const docOptions: ChromeOptions = {
  ...stageOptions,
  stage: undefined,
  body: '<p>inventory</p>',
  data: { ...data, kind: 'inventory', page: 'inventory.html' },
};

const count = (html: string, id: HookId): number => html.split(hookAttr(id)).length - 1;

describe('renderChrome', () => {
  test('every single-instance hook a page kind requires is emitted exactly once', () => {
    for (const [kind, html] of [
      ['stage', renderChrome(stageOptions)],
      ['inventory', renderChrome(docOptions)],
    ] as const) {
      for (const [id, spec] of Object.entries(HOOKS) as [HookId, (typeof HOOKS)[HookId]][]) {
        // inventory.* hooks live in the inventory body (pages.ts), not the chrome
        if (!(spec.on as readonly string[]).includes(kind) || id.startsWith('inventory.')) continue;
        if (spec.count === 'one') expect(count(html, id), `${kind}: ${id}`).toBe(1);
        else expect(count(html, id), `${kind}: ${id}`).toBeGreaterThan(0);
      }
    }
  });

  test('stage-only chrome stays off document pages', () => {
    const doc = renderChrome(docOptions);
    for (const id of ['stage.root', 'camera.controls', 'minimap.root'] as const) expect(count(doc, id)).toBe(0);
    expect(count(doc, 'settings.seg')).toBe(1); // doc pages get the theme control in the sidebar
  });

  test('phone chrome: a four-tab bar and a title strip on diagram pages, three tabs and no strip on documents', () => {
    const tabsOf = (html: string): string[] =>
      [.../<nav class="m-mobile-bar"[^>]*>([\s\S]*?)<\/nav>/.exec(html)![1]!.matchAll(/data-m="([^"]+)"/g)].map((m) => m[1]!);
    const stage = renderChrome(stageOptions);
    expect(tabsOf(stage)).toEqual(['mobile.pages', 'mobile.search', 'mobile.fit', 'mobile.menu']);
    expect(stage).toMatch(/data-m="mobile.title"[^>]*>Test Topology<\/button>/);
    expect(tabsOf(renderChrome(docOptions))).toEqual(['mobile.pages', 'mobile.search', 'mobile.menu']);
    expect(count(renderChrome(docOptions), 'mobile.strip')).toBe(0);
    // the brand and the page pill left the bar; the command bar has no phone-only buttons
    expect(stage).not.toContain('m-mob-brand');
    expect(stage).not.toContain('m-mob-selector-btn');
    expect(count(stage, 'theme.toggle')).toBe(1);
  });

  test('the page picker lists a Site\'s pages in the drawer header; single files have none', () => {
    const html = renderChrome({ ...stageOptions, navLinks: [...stageOptions.navLinks!, { label: 'Edge', href: 'zones/edge.html' }] });
    const picker = /<select data-m="mobile.selector">([\s\S]*?)<\/select>/.exec(html)![1]!;
    expect(picker).toBe('<option value="index.html" selected>Core DC</option><option value="zones/edge.html">Edge</option>');
    expect(count(renderChrome({ ...stageOptions, navLinks: [] }), 'mobile.selector')).toBe(0);
  });

  test('the payload round-trips through the page', () => {
    const html = renderChrome(stageOptions);
    const text = /<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(decodePageData(text)).toEqual(data);
  });

  test('inspector tabs follow BUILTIN_TABS order, first active', () => {
    const html = renderChrome(stageOptions);
    const tabs = [...html.matchAll(/data-tab="([a-z]+)"[^>]*aria-selected="(true|false)">([^<]+)</g)].map((m) => [
      m[1],
      m[2],
      m[3],
    ]);
    expect(tabs).toEqual([
      ['overview', 'true', 'Overview'],
      ['interfaces', 'false', 'Interfaces'],
      ['neighbors', 'false', 'Neighbors'],
      ['metadata', 'false', 'Custom Fields'],
      ['config', 'false', 'Config'],
    ]);
    expect(count(html, 'inspector.pane')).toBe(BUILTIN_TABS.length);
  });

  test('the sidebar toggle is an icon button without text clutter', () => {
    const html = renderChrome(stageOptions);
    const btn = new RegExp(`<button[^>]*${hookAttr('sidebar.toggle')}[^>]*>([\\s\\S]*?)</button>`).exec(html);
    expect(btn).toBeTruthy();
    expect(btn![1]).not.toContain('Navigation');
    expect(btn![1]).not.toContain('Ctrl B');
  });

  test('about dialog carries the Marrow watermark and attribution credit', () => {
    const html = renderChrome(stageOptions);
    expect(html).toMatch(/<div class="m-about-watermark"[^>]*>\s*<svg class="m-fibre"[^>]*aria-label="Marrow"/);
    expect(html).toContain('href="https://marrowdiagram.vercel.app"');
    expect(html).toContain('href="https://github.com/raiz-toff/Marrow"');
    expect(html).toContain('Engineered with <strong>Marrow</strong>');
    // the watermark carries the attribution line phones show in place of the title
    expect(html).toMatch(/<div class="m-watermark"[^>]*>[\s\S]*?<em class="m-wm-attr"><svg class="m-fibre"[^>]*aria-label="Marrow"[\s\S]*?<\/svg><\/em><\/div>/);
  });

  test('the fibre lockup is the default brand; a configured name keeps the mark and shows the name', () => {
    const header = (html: string) => html.match(/<div class="m-brand-mark">([\s\S]*?)<\/div>/)![1]!;
    const plain = header(renderChrome(stageOptions));
    expect(plain).toMatch(/^<svg class="m-fibre" width="114" height="18"[^>]*aria-label="Marrow"/);
    const named = header(renderChrome({ ...stageOptions, brand: { name: 'Acme' } }));
    expect(named).toMatch(/^<svg class="m-fibre"[^>]*aria-hidden="true"/);
    expect(named).toContain('<span>Acme</span>');
    const logo = header(renderChrome({ ...stageOptions, brand: { logo: '<svg id="ACME"></svg>' } }));
    expect(logo).not.toContain('m-fibre');
  });

  test('watermark respects modular modes (minimal, blueprint, off)', () => {
    const minHtml = renderChrome({ ...stageOptions, watermark: { mode: 'minimal', font: 'mono' } });
    expect(minHtml).toContain('data-mode="minimal"');
    expect(minHtml).toContain('fig. 01 — Test Topology');

    const offHtml = renderChrome({ ...stageOptions, watermark: { mode: 'off' } });
    expect(offHtml).toContain('data-watermark="off"');
    expect(offHtml).not.toContain('fig. 01');
    expect(offHtml).not.toContain('<span>Test Topology</span><small>');
  });

  test('theme: auto ships a dark default plus the auto mode marker', () => {
    const html = renderChrome({ ...stageOptions, theme: 'auto' });
    expect(html).toContain('<html lang="en" data-theme="dark" data-theme-mode="auto"');
  });

  test('breadcrumbs and the sidebar header show the page hierarchy', () => {
    const html = renderChrome(stageOptions);
    expect(html).toContain('<a href="index.html">Network</a>');
    expect(html).toContain('Core DC</span>');
    expect(html).toContain('Lab Overview');
    expect(html).toContain('12 devices · 16 links');
  });
});
