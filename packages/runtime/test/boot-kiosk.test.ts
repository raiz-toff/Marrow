// @vitest-environment happy-dom
/**
 * A diagram page opened with a kiosk URL (see support/boot-harness): the
 * flags reach <html> before boot, survive the runtime writing the view into
 * the hash, ride along on links to other pages, and `c=` places the camera.
 */
import { describe, expect, test, vi } from 'vitest';
import { hookSelector, STAGE_HOOKS, storageKey } from '../src/shared/page-contract.js';
import { boot, buildPagesOnce, click, frame, hook, installHarness, q, viewport } from './support/boot-harness.js';

const STAGE_W = 1200;
const STAGE_H = 800;
const KIOSK = 'chrome=minimal;minimap=off;controls=off';

function camera(): { x: number; y: number; k: number } {
  const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)\s*scale\(([-\d.e]+)/.exec(q(STAGE_HOOKS.camera).getAttribute('transform') ?? '');
  if (!m) throw new Error('test: no camera transform');
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

buildPagesOnce();
installHarness();

describe('kiosk / embed URL on a diagram page', () => {
  test('flags apply, survive syncHash, ride along on links; c= places the camera; no sidebar', async () => {
    viewport(1366);
    history.replaceState(null, '', `/zones/office.html#${KIOSK};c=120,80,1.5`);
    await boot('stage', () => {
      hook('stage.root').getBoundingClientRect = () => new DOMRect(0, 0, STAGE_W, STAGE_H);
      localStorage.setItem(storageKey('sidebar'), 'open'); // a desktop preference, irrelevant in minimal chrome
    });
    const root = document.documentElement;
    expect(root.dataset).toMatchObject({ chrome: 'minimal', minimap: 'off', controls: 'off' });

    // c= is the world point at the centre of the stage, and the zoom
    await frame();
    const c = camera();
    expect(c.k).toBe(1.5);
    expect((STAGE_W / 2 - c.x) / c.k).toBeCloseTo(120, 5);
    expect((STAGE_H / 2 - c.y) / c.k).toBeCloseTo(80, 5);

    // minimal chrome has no sidebar: not open at boot, not from the mobile bar
    const sidebar = hook('sidebar.panel');
    expect(sidebar.classList.contains('open')).toBe(false);
    click(hook('mobile.selector'));
    expect(sidebar.classList.contains('open')).toBe(false);

    // selecting a device writes d= (and the camera) but keeps every kiosk pair
    click(q('rect', q(`${STAGE_HOOKS.node}:not([data-href])`)));
    expect(location.hash.startsWith(`#${KIOSK};d=`)).toBe(true);
    await vi.waitFor(() => expect(location.hash).toMatch(/;c=[-\d.]+,[-\d.]+,[\d.]+$/), { timeout: 2000 });
    expect(location.hash.startsWith(`#${KIOSK};`)).toBe(true);

    // links to other pages of the site carry the same flags; the pre-boot
    // script on the next page reads them back
    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href$=".html"], a[href*=".html#"]')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.getAttribute('href'), a.outerHTML).toContain(KIOSK);
    // … including links the runtime renders later, at the moment they are followed
    const late = document.createElement('a');
    late.href = '../inventory.html#d=x';
    document.body.append(late);
    late.addEventListener('click', (e) => e.preventDefault());
    click(late);
    expect(late.getAttribute('href')).toBe(`http://localhost:3000/inventory.html#d=x;${KIOSK}`);
    // a host flipping the hash back to full chrome updates the links
    location.hash = '#chrome=full';
    await vi.waitFor(() => expect(root.dataset['chrome']).toBeUndefined());
    expect(links[0]!.getAttribute('href')).toContain('#chrome=full');
    expect(links[0]!.getAttribute('href')).not.toContain('minimap=off');
    expect(document.querySelectorAll(hookSelector('chrome.root')).length).toBe(1);
  });
});
