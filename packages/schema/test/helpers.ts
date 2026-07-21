import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, type IconCatalog } from '@marrow/icons';

export const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export function fixtureSource(rel: string): string {
  return readFileSync(join(repoRoot, 'fixtures', rel), 'utf8');
}

export function invalidFixtureNames(): string[] {
  return readdirSync(join(repoRoot, 'fixtures', 'invalid'))
    .filter((f) => f.endsWith('.yaml') && !f.endsWith('.fixed.yaml'))
    .sort();
}

let cached: IconCatalog | undefined;
export function ciscoCatalog(): IconCatalog {
  if (!cached) {
    cached = loadCatalog(join(repoRoot, 'icon-packs'));
    if (cached.size === 0) {
      throw new Error(
        'icon catalog is empty — generate it first: npm run build && npm run gen:icons',
      );
    }
  }
  return cached;
}
