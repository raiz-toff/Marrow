// @vitest-environment happy-dom
/** The runtime booted against a compiled inventory page (see support/boot-harness). */
import { describe, expect, test } from 'vitest';
import { hookSelector } from '../src/shared/page-contract.js';
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

describe('runtime boots against a compiled inventory page', () => {
  test('inventory page', async () => {
    await boot('inventory');
    const panel = hook('inspector.panel');

    // click a row → device drawer
    const row = hook('inventory.row');
    click(q('td', row));
    expect(panel.hidden).toBe(false);
    expect(hook('inspector.title').textContent).not.toBe('');

    // filter narrows the rows
    const filter = hook<HTMLInputElement>('inventory.filter');
    filter.value = 'zzz-no-such-device';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
    const rows = [...document.querySelectorAll<HTMLElement>(hookSelector('inventory.row'))];
    expect(rows.every((r) => r.hidden)).toBe(true);

    // Ctrl+K and the Help menu → About dialog
    key('k', { ctrlKey: true });
    expect(hook('spotlight.root').hidden).toBe(false);
    key('k', { ctrlKey: true });
    click(q(`${hookSelector('menubar.trigger')}[data-menu="help"]`));
    click(q('.m-ctx-item[data-act="about"]', q('.m-menupop')));
    expect(hook('about.dialog').hidden).toBe(false);
    expect(hook('about.title').textContent).toBe('Small Office');

    expectContractHolds('inventory');
  });
});
