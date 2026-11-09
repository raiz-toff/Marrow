// @vitest-environment happy-dom
/**
 * The runtime booted against a hero-tier page the compiler really produced:
 * proof that both sides of the page contract agree (see support/boot-harness).
 *
 * Scale-tier (canvas) pages are NOT booted here: happy-dom has no 2D canvas
 * context. They stay covered by the Playwright path (`marrow snapshot`,
 * which waits on the ready flag).
 */
import { describe, expect, test } from 'vitest';
import { hookSelector, STAGE_HOOKS } from '../src/shared/page-contract.js';
import {
  boot,
  buildPagesOnce,
  click,
  expectContractHolds,
  hook,
  installHarness,
  key,
  q,
} from './support/boot-harness.js';

buildPagesOnce();
installHarness();

describe('runtime boots against a compiled diagram page', () => {
  test('hero-tier diagram page', async () => {
    await boot('stage');
    const panel = hook('inspector.panel');

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
    click(q(`${hookSelector('theme.option')}[data-theme-val="light"]`));
    expect(document.documentElement.dataset['theme']).toBe('light');
    // a browser drops focus from the now-hidden search input; happy-dom doesn't
    (document.activeElement as HTMLElement | null)?.blur();
    key('Escape');
    expect(panel.hidden).toBe(true);

    expectContractHolds('stage');
  });
});
