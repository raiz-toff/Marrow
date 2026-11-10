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
    expect(html).toContain('MARROW');
    expect(html).toContain('href="https://marrowdiagram.vercel.app"');
    expect(html).toContain('href="https://github.com/raiz-toff/Marrow"');
    expect(html).toContain('Engineered with <strong>Marrow</strong>');
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
