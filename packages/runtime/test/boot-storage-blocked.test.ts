// @vitest-environment happy-dom
/**
 * Opaque origins (`data:` URLs, `srcdoc` iframes, sandboxed frames) throw on
 * every localStorage access. Preferences then simply do not persist; the boot
 * must still complete and the minimap must still appear. The snapshot command
 * loads pages as a `data:` URL, so this is the path it exercises.
 */
import { describe, expect, test } from 'vitest';
import { READY_FLAG } from '../src/shared/page-contract.js';
import { boot, buildPagesOnce, hook, installHarness, viewport } from './support/boot-harness.js';

buildPagesOnce();
installHarness();

describe('boot with storage blocked', () => {
  test('boots, reports ready and shows the minimap when localStorage throws', async () => {
    viewport(1366);
    history.replaceState(null, '', '/zones/office.html');
    await boot('stage', () => {
      hook('stage.root').getBoundingClientRect = () => new DOMRect(0, 0, 1200, 800);
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException("Storage is disabled inside 'data:' URLs.", 'SecurityError');
        },
      });
    });
    expect((window as unknown as Record<string, unknown>)[READY_FLAG]).toBe(true);
    expect(hook('minimap.root').hidden).toBe(false);
  });
});
