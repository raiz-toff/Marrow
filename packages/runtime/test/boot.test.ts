// @vitest-environment happy-dom
/**
 * The runtime booted against a hero-tier page the compiler really produced:
 * proof that both sides of the page contract agree (see support/boot-harness).
 *
 * Scale-tier (canvas) pages are NOT booted here: happy-dom has no 2D canvas
 * context. They stay covered by the Playwright path (`marrow snapshot`,
 * which waits on the ready flag).
 */
import { describe, expect, test, vi } from 'vitest';
import { hookSelector, STAGE_HOOKS } from '../src/shared/page-contract.js';
import {
  boot,
  buildPagesOnce,
  click,
  expectContractHolds,
  frame,
  hook,
  installHarness,
  key,
  pointer,
  q,
} from './support/boot-harness.js';

const STAGE_W = 1400;
const STAGE_H = 900;

/** happy-dom has no layout: give the stage a desktop size and the minimap its natural size, and skip the entrance animation */
function desktop(): void {
  hook('stage.root').getBoundingClientRect = () => new DOMRect(0, 0, STAGE_W, STAGE_H);
  const real = window.matchMedia.bind(window);
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) =>
    query.includes('reduced-motion')
      ? ({ matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList)
      : real(query),
  );
}

function camera(): { x: number; y: number; k: number } {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)\s*scale\(([-\d.e]+)/.exec(q(STAGE_HOOKS.camera).getAttribute('transform') ?? '');
  if (!m) throw new Error('test: no camera transform');
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

/** the minimap as drawn, plus its world frame */
function minimap() {
  const svg = q<SVGSVGElement>(`${hookSelector('minimap.root')} > svg`);
  const [, , vbW, vbH] = svg.getAttribute('viewBox')!.split(' ').map(Number) as [number, number, number, number];
  svg.getBoundingClientRect = () => new DOMRect(0, 0, vbW, vbH); // client px = map units
  const num = (el: Element, a: string): number => Number(el.getAttribute(a));
  const v = q('.m-mini-view', svg);
  const w = q('.m-mini-world', svg);
  const sceneW = Number(q(`${hookSelector('stage.root')} svg`).getAttribute('data-w'));
  return {
    svg,
    vbW,
    vbH,
    view: { x: num(v, 'x'), y: num(v, 'y'), w: num(v, 'width'), h: num(v, 'height') },
    whole: v.classList.contains('m-mini-whole'),
    pad: num(w, 'x'),
    scale: num(w, 'width') / sceneW,
  };
}

function expectViewInside(m: ReturnType<typeof minimap>): void {
  expect(m.view.w).toBeGreaterThan(0);
  expect(m.view.h).toBeGreaterThan(0);
  expect(m.view.x).toBeGreaterThanOrEqual(0);
  expect(m.view.y).toBeGreaterThanOrEqual(0);
  expect(m.view.x + m.view.w).toBeLessThanOrEqual(m.vbW);
  expect(m.view.y + m.view.h).toBeLessThanOrEqual(m.vbH);
}

/** the world point at the centre of the stage */
function viewCentre(): { x: number; y: number } {
  const c = camera();
  return { x: (STAGE_W / 2 - c.x) / c.k, y: (STAGE_H / 2 - c.y) / c.k };
}

buildPagesOnce();
installHarness();

describe('runtime boots against a compiled diagram page', () => {
  test('hero-tier diagram page', async () => {
    await boot('stage', desktop);
    const panel = hook('inspector.panel');

    // minimap: at fit zoom the view shows the whole world, drawn inside the map
    await frame();
    let mini = minimap();
    expect(mini.whole).toBe(true);
    expectViewInside(mini);
    // zoomed in (keyboard), the view is a smaller rectangle, still inside
    for (let i = 0; i < 4; i++) key('+');
    await frame();
    mini = minimap();
    expect(mini.whole).toBe(false);
    expectViewInside(mini);
    // a press outside the view centres the camera on that world point
    pointer(mini.svg, 'pointerdown', mini.pad + 2, mini.pad + 3);
    pointer(mini.svg, 'pointerup', mini.pad + 2, mini.pad + 3);
    await frame();
    expect(viewCentre().x).toBeCloseTo(2 / mini.scale, 1); // scale read back from a 0.1-rounded attribute
    expect(viewCentre().y).toBeCloseTo(3 / mini.scale, 1); // scale read back from a 0.1-rounded attribute
    mini = minimap();
    expectViewInside(mini); // centred on the corner: clipped to the world, not drawn off the map
    // dragging the view moves the camera 1:1 in map units
    const grab = { x: mini.view.x + mini.view.w / 2, y: mini.view.y + mini.view.h / 2 };
    const before = viewCentre();
    pointer(mini.svg, 'pointerdown', grab.x, grab.y);
    pointer(mini.svg, 'pointermove', grab.x + 20, grab.y + 10);
    pointer(mini.svg, 'pointerup', grab.x + 20, grab.y + 10);
    await frame();
    expect(viewCentre().x - before.x).toBeCloseTo(20 / mini.scale, 1); // scale read back from a 0.1-rounded attribute
    expect(viewCentre().y - before.y).toBeCloseTo(10 / mini.scale, 1); // scale read back from a 0.1-rounded attribute
    expectViewInside(minimap());

    // click a node (one that is not a link to another page) → device inspector
    const node = q(`${STAGE_HOOKS.node}:not([data-href])`);
    click(q('rect', node));
    expect(panel.hidden).toBe(false);
    expect(hook('inspector.title').textContent).not.toBe('');
    expect(document.documentElement.classList.contains('has-selection')).toBe(true);

    // switch inspector tab
    const tabs = [...document.querySelectorAll<HTMLElement>(hookSelector('inspector.tab'))];
    const second = tabs[1]!;
    click(second);
    expect(second.classList.contains('active')).toBe(true);
    expect(tabs[0]!.classList.contains('active')).toBe(false);

    // click a link → link inspector
    click(q(STAGE_HOOKS.edge));
    expect(hook('inspector.title').textContent).toContain('⟷');

    // Ctrl+K → command center, search, Escape closes
    key('k', { ctrlKey: true });
    const spot = hook('spotlight.root');
    expect(spot.hidden).toBe(false);
    const input = hook<HTMLInputElement>('spotlight.input');
    input.value = 'core';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(hook('spotlight.list').querySelectorAll('li[data-idx]').length).toBeGreaterThan(0);
    key('Escape');
    expect(spot.hidden).toBe(true);

    // open the View menu and run an item
    click(q(`${hookSelector('menubar.trigger')}[data-menu="view"]`));
    const pop = q('.m-menupop');
    expect(pop.hidden).toBe(false);
    click(q('.m-ctx-item[data-act="t-labels"]', pop));
    expect(document.documentElement.dataset['labels']).toBe('on');

    // camera controls, theme toggle, Escape deselects
    click(hook('camera.zoomIn'));
    expect(document.documentElement.dataset['zoom']).toBeDefined();
    await frame();
    expectViewInside(minimap()); // with the inspector open (insets) and zoomed again
    click(q(`${hookSelector('theme.option')}[data-theme-val="light"]`));
    expect(document.documentElement.dataset['theme']).toBe('light');
    // a browser drops focus from the now-hidden search input; happy-dom doesn't
    (document.activeElement as HTMLElement | null)?.blur();
    key('Escape');
    expect(panel.hidden).toBe(true);

    expectContractHolds('stage');
  });
});
