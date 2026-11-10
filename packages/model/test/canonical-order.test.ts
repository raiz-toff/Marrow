import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { byId, compareIds } from '@marrow/model';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

describe('compareIds — the one canonical string order', () => {
  test('is code-unit order: the order a bare sort() gives, in every locale', () => {
    const ids = ['za-1', 'aaa-01', 'ya-1', 'ab-sw1', 'ja-1', 'a_b', 'a.b', 'a-b', 'a1', 'B', 'å'];
    expect([...ids].sort(compareIds)).toEqual([...ids].sort());
    expect(compareIds('aaa', 'ab')).toBe(-1); // da_DK collation says +1 ("aa" = "å", after "z")
    expect(compareIds('ya', 'ja')).toBe(1); // lt_LT collation says -1 ("y" sorts with "i")
    expect(compareIds('x', 'x')).toBe(0);
  });

  test('byId sorts records by their id field', () => {
    expect([{ id: 'b' }, { id: 'aa' }, { id: 'a' }].sort(byId).map((r) => r.id)).toEqual(['a', 'aa', 'b']);
  });
});

/**
 * Static guard: `localeCompare` / `Intl.Collator` follow the process locale,
 * so any use that reaches compiled output or diagnostics makes builds
 * machine-dependent (ADR-0007). Every package source must use `compareIds`
 * instead. The allowlist holds only viewer-side sorts of DISPLAY text, which
 * run in the browser and never reach a compiled byte.
 */
const ALLOWED: Record<string, number> = {
  // inventory table column sort: user-facing, numeric-aware, viewer's locale
  'packages/runtime/src/client/main.ts': 1,
};

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test('no locale-dependent comparison outside the allowlist', () => {
  const found: Record<string, number> = {};
  for (const pkg of readdirSync(join(repoRoot, 'packages'))) {
    const src = join(repoRoot, 'packages', pkg, 'src');
    try {
      statSync(src);
    } catch {
      continue;
    }
    for (const file of sources(src)) {
      const hits = readFileSync(file, 'utf8').match(/\.localeCompare\(|Intl\.Collator\b/g);
      if (hits) found[relative(repoRoot, file).split('\\').join('/')] = hits.length;
    }
  }
  expect(found, 'use compareIds/byId from @marrow/model (see ALLOWED for the only exceptions)').toEqual(ALLOWED);
});
