// @vitest-environment happy-dom
/** A diagram page on a phone (360 px): the bottom tab bar (Pages, Search,
 *  Fit, Menu), the top strip (title, theme), no floating zoom stack, and the
 *  camera fitting between strip and bar. */
import { describe, expect, test, vi } from 'vitest';
import { buildStylesheet } from '@marrow/site';
import { hookSelector, STAGE_HOOKS, storageKey } from '../src/shared/page-contract.js';
import { boot, buildPagesOnce, click, frame, hook, installHarness, q, viewport } from './support/boot-harness.js';

const W = 360;
const H = 740;
const STRIP = 36;
const BAR = 56;

buildPagesOnce();
installHarness();

/** Phone layout as Chromium lays it out: the stage fills the screen, the strip and bar float over it. */
function phone(): void {
  hook('stage.root').getBoundingClientRect = () => new DOMRect(0, 0, W, H);
  hook('mobile.strip').getBoundingClientRect = () => new DOMRect(0, 0, W, STRIP);
  hook('mobile.bar').getBoundingClientRect = () => new DOMRect(0, H - BAR, W, BAR);
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
    query.includes('reduced-motion')
      ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : real(query),
  );
  localStorage.setItem(storageKey('sidebar'), 'open'); // a desktop preference, ignored on a phone
}

function camera(): { x: number; y: number; k: number } {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)\s*scale\(([-\d.e]+)/.exec(q(STAGE_HOOKS.camera).getAttribute('transform') ?? '');
  if (!m) throw new Error('test: no camera transform');
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

const touch = (el: Element, type: string, x: number, y: number): void =>
  void el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch' }));

describe('phone chrome (< 768 px)', () => {
  test('the stylesheet hides the floating zoom stack on phones only', () => {
    const phoneBlocks = buildStylesheet().split('@media (max-width: 767px) {').slice(1);
    expect(phoneBlocks.some((b) => b.includes('.m-controls { display: none !important; }'))).toBe(true);
  });

  test('tab bar, top strip, their panels, Fit, and the camera between strip and bar', async () => {
    viewport(W, H);
    await boot('stage', phone);
    await frame();

    // four tabs, nothing else: the old bar's brand, pill, search, sidebar and theme buttons are gone
    const bar = hook('mobile.bar');
    expect([...bar.children].map((b) => [b.localName, b.getAttribute('data-m')])).toEqual([
      ['button', 'mobile.pages'],
      ['button', 'mobile.search'],
      ['button', 'mobile.fit'],
      ['button', 'mobile.menu'],
    ]);
    for (const id of ['search.open', 'sidebar.toggle', 'theme.toggle'] as const) expect(bar.querySelector(hookSelector(id))).toBeNull();

    // the strip carries the title, and is the only place it shows on a phone
    expect(`${hook('mobile.title').textContent} — Marrow`).toBe(document.title);

    // fit centres the diagram in the space between the strip and the bar
    const svg = q(`${hookSelector('stage.root')} svg`);
    const sceneW = Number(svg.getAttribute('data-w'));
    const sceneH = Number(svg.getAttribute('data-h'));
    const c = camera();
    expect(c.y + (sceneH * c.k) / 2).toBeCloseTo(STRIP + (H - STRIP - BAR) / 2, 3);
    expect(c.x + (sceneW * c.k) / 2).toBeCloseTo(W / 2, 3);

    // Pages: the drawer, closed at boot whatever a desktop session remembered
    const sidebar = hook('sidebar.panel');
    const pages = hook('mobile.pages');
    expect(sidebar.classList.contains('open')).toBe(false);
    click(pages);
    expect(sidebar.classList.contains('open')).toBe(true);
    expect(pages.getAttribute('aria-expanded')).toBe('true');
    // the Site's page picker sits in the drawer header, current page selected
    const picker = hook<HTMLSelectElement>('mobile.selector', sidebar);
    expect(picker.options.length).toBeGreaterThan(1);
    expect(picker.value).toBe(picker.selectedOptions[0]!.value);
    expect(picker.selectedOptions[0]!.value.endsWith(document.documentElement.dataset['page']!)).toBe(true);
    click(pages);
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(pages.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem(storageKey('sidebar'))).toBe('open');

    // Search: the spotlight; the bar's panels are exclusive
    const search = hook('mobile.search');
    const spotlight = hook('spotlight.root');
    click(search);
    expect(spotlight.hidden).toBe(false);
    expect(search.getAttribute('aria-expanded')).toBe('true');
    click(pages);
    expect(spotlight.hidden).toBe(true);
    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(sidebar.classList.contains('open')).toBe(true);

    // Menu: view settings, export and help in one popover
    const menu = hook('mobile.menu');
    click(menu);
    expect(sidebar.classList.contains('open')).toBe(false);
    const pop = q('.m-menupop');
    expect(pop.hidden).toBe(false);
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    for (const label of ['Theme', 'Device labels', 'Port labels', 'Link motion', 'Export PNG', 'About this diagram']) {
      expect(pop.textContent).toContain(label);
    }
    click(menu);
    expect(pop.hidden).toBe(true);
    expect(menu.getAttribute('aria-expanded')).toBe('false');

    // Fit
    const { Camera } = await import('../src/client/camera.js');
    const fit = vi.spyOn(Camera.prototype, 'fit');
    click(hook('mobile.fit'));
    expect(fit).toHaveBeenCalledWith(true);

    // the strip's theme toggle
    const root = document.documentElement;
    const before = root.dataset['theme'];
    click(hook('mobile.theme'));
    expect(root.dataset['theme']).toBe(before === 'light' ? 'dark' : 'light');

    // the title opens About
    click(hook('mobile.title'));
    expect(hook('about.dialog').hidden).toBe(false);

    // double-tap on empty stage zooms ×1.6 (a mouse double click does not)
    const stage = hook('stage.root');
    const k0 = camera().k;
    for (let i = 0; i < 2; i++) {
      touch(stage, 'pointerdown', 180, 400);
      touch(stage, 'pointerup', 180, 400);
    }
    await frame();
    expect(camera().k).toBeCloseTo(Math.min(k0 * 1.6, 4), 5);
  });
});
