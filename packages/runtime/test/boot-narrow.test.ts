// @vitest-environment happy-dom
/** The inventory page at tablet width (happy-dom's 1024 px): the sidebar is a
 *  drawer that starts closed, whatever a desktop session remembered. */
import { describe, expect, test } from 'vitest';
import { storageKey } from '../src/shared/page-contract.js';
import { boot, buildPagesOnce, click, hook, installHarness, pointer } from './support/boot-harness.js';

buildPagesOnce();
installHarness();

describe('≤ 1024 px', () => {
  test('the drawer starts closed, opens from the mobile bar, and leaves the desktop preference alone', async () => {
    expect(window.innerWidth).toBe(1024);
    await boot('inventory', () => localStorage.setItem(storageKey('sidebar'), 'open'));
    const sidebar = hook('sidebar.panel');
    expect(sidebar.classList.contains('open')).toBe(false);

    click(hook('mobile.selector'));
    expect(sidebar.classList.contains('open')).toBe(true);
    // a press outside the drawer closes it
    pointer(hook('chrome.commandBar'), 'pointerdown', 600, 20);
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(localStorage.getItem(storageKey('sidebar'))).toBe('open');

    // without kiosk flags in the URL, links stay exactly as the page shipped them
    for (const a of document.querySelectorAll('a[href]')) expect(a.getAttribute('href')).not.toContain('chrome=');
  });
});
