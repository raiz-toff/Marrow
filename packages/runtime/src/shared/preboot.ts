/**
 * The pre-boot script, inlined at the top of every page's `<head>`. Bundled
 * on its own (`dist/preboot.js`) so it shares `parseModularParams` and
 * `applyModularParams` with the runtime instead of carrying a hand-minified
 * copy. It must stay tiny and must never throw.
 */
import { parseModularParams } from './hash.js';
import { applyModularParams, readRoot, storageKey, writeRoot } from './page-contract.js';

try {
  const root = document.documentElement;
  const options = parseModularParams(location.search, location.hash);
  applyModularParams(root, options);
  // `theme: auto` follows the OS scheme unless the viewer chose one in-diagram
  if (options.theme === undefined && readRoot(root, 'themeMode') === 'auto') {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(storageKey('theme'));
    } catch {
      /* storage blocked (sandboxed iframe) */
    }
    if (stored !== 'dark' && stored !== 'light') {
      writeRoot(root, 'theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
  }
} catch {
  /* never block first paint */
}
