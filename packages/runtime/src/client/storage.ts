import { storageKey, type StorageName } from '../shared/page-contract.js';

/**
 * Viewer preferences in localStorage, guarded: opaque origins (`data:` URLs,
 * `srcdoc` iframes, sandboxed frames) throw on access, and a preference is
 * never worth failing the boot for.
 */
export function readStored(name: StorageName): string | null {
  try {
    return localStorage.getItem(storageKey(name));
  } catch {
    return null;
  }
}

export function writeStored(name: StorageName, value: string): void {
  try {
    localStorage.setItem(storageKey(name), value);
  } catch {
    /* storage blocked: the preference simply does not persist */
  }
}
