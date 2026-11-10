import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

// Smoke test for the published CLI: scripts/build-npm.mjs stages `marrow-cli`
// into a temp dir, and the bundle must build a diagram on its own. Guards the
// files the bundle reads relative to itself (runtime.js, preboot.js, packs).
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'marrow-npm-'));
const pkg = join(tmp, 'pkg');
const bin = join(pkg, 'dist', 'marrow.mjs');

beforeAll(() => {
  if (!existsSync(join(repoRoot, 'packages', 'cli', 'dist', 'index.js'))) {
    throw new Error('CLI not built — run npm run compile first');
  }
  const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'build-npm.mjs'), '--out', pkg], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  expect(res.status, res.stderr).toBe(0);
  // npm deps stay external (yaml, zod, elkjs, …): resolve them like an install would
  symlinkSync(join(repoRoot, 'node_modules'), join(pkg, 'node_modules'), 'dir');
}, 60_000);

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('bundled marrow-cli', () => {
  test('ships the runtime and pre-boot bundles next to the CLI', () => {
    for (const f of ['marrow.mjs', 'runtime.js', 'preboot.js']) expect(existsSync(join(pkg, 'dist', f)), f).toBe(true);
  });

  test('build --single on a fixture exits 0 and inlines the pre-boot script', () => {
    const out = join(tmp, 'small-office.html');
    const res = spawnSync(
      process.execPath,
      [bin, 'build', '--single', join(repoRoot, 'fixtures', 'valid', 'small-office.yaml'), '-o', out],
      { cwd: tmp, encoding: 'utf8' },
    );
    expect(res.status, res.stderr).toBe(0);
    const html = readFileSync(out, 'utf8');
    const preboot = readFileSync(join(repoRoot, 'packages', 'runtime', 'dist', 'preboot.js'), 'utf8').trim();
    expect(html).toContain(`<script>${preboot}</script>`);
  }, 60_000);
});
