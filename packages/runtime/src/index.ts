import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export * from './shared/page-contract.js';
export { parseModularParams, type ModularUiOptions } from './shared/hash.js';

/**
 * Node-side entry: hands the prebuilt client bundles to the site compiler.
 * Both are produced by `npm run bundle -w @marrow/runtime` (esbuild).
 */
export function getRuntimeSource(): string {
  return readBundle('runtime.js');
}

/**
 * The pre-boot `<head>` script: applies URL query/hash options (embed, kiosk,
 * inspector, minimap, theme) and resolves `theme: auto` to `<html>` before
 * first paint. Byte-identical on every page — it reads everything it needs
 * from the URL and the `<html>` attributes.
 */
export function getPrebootSource(): string {
  return readBundle('preboot.js').trim();
}

function readBundle(name: string): string {
  // a path, not a URL object: callers may run with a DOM's URL as the global
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', name);
  try {
    return readFileSync(file, 'utf8');
  } catch {
    throw new Error(`${name} bundle missing — run: npm run compile (which bundles @marrow/runtime)`);
  }
}
