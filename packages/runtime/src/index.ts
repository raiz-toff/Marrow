import { readFileSync } from 'node:fs';

/**
 * Node-side entry: hands the prebuilt client bundle to the site compiler.
 * The bundle is produced by `npm run bundle -w @marrow/runtime` (esbuild).
 */
export function getRuntimeSource(): string {
  const url = new URL('../dist/runtime.js', import.meta.url);
  try {
    return readFileSync(url, 'utf8');
  } catch {
    throw new Error('runtime bundle missing — run: npm run build (which bundles @marrow/runtime)');
  }
}
