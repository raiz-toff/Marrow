#!/usr/bin/env node
/**
 * Compile docs/demos/*.yaml into docs/public/demo/*.html, plus the extra
 * builds the showcase pages embed: zoned.yaml at each density and with a
 * themed config, and scale.yaml as a multi-page Site.
 *
 * The outputs are generated, not committed: `npm run docs:build` runs this
 * before the Next.js build, so the toolchain must be compiled first.
 *
 * Run from the repo root:  npm run demos  [--force]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(docs, '..');
const cli = join(repo, 'packages/cli/dist/index.js');
const demos = join(docs, 'demos');
const out = join(docs, 'public/demo');

mkdirSync(out, { recursive: true });

const yamls = readdirSync(demos).filter((f) => f.endsWith('.yaml'));
if (yamls.length === 0) {
  console.error('no demos found in docs/demos/');
  process.exit(1);
}

/** One build: a demo, where it goes, and how. `site` writes a directory. */
const builds = [
  ...yamls.map((file) => ({ src: file, dest: file.replace(/\.yaml$/, '.html') })),
  ...['compact', 'standard', 'spacious', 'themed'].map((v) => ({ src: 'zoned.yaml', dest: `zoned-${v}.html`, config: `config/${v}.yaml` })),
  { src: 'scale.yaml', dest: 'scale-site', site: true },
];

// A build is fresh when its output is newer than its YAML, its config and the
// compiler that produced it, so `npm run docs` (which runs this first) stays quick.
const mtime = (path) => { try { return statSync(path).mtimeMs; } catch { return 0; } };
const compilerStamp = Math.max(mtime(cli), mtime(join(repo, 'packages/runtime/dist/runtime.js')), mtime(join(repo, 'packages/runtime/dist/preboot.js')));
const force = process.argv.includes('--force');

const validated = new Set();
let built = 0;
for (const { src, dest, config, site } of builds) {
  const input = join(demos, src);
  const target = join(out, dest);
  const stamp = site ? join(target, 'index.html') : target;
  const inputs = [mtime(input), compilerStamp, config ? mtime(join(demos, config)) : 0];
  if (!force && mtime(stamp) > Math.max(...inputs)) continue;

  // never ship a demo that does not validate
  if (!validated.has(src)) execFileSync('node', [cli, 'validate', input], { stdio: 'inherit' });
  validated.add(src);
  if (site) rmSync(target, { recursive: true, force: true });
  const args = [cli, 'build', input, ...(site ? [] : ['--single']), ...(config ? ['--config', join(demos, config)] : []), '-o', target];
  execFileSync('node', args, { stdio: 'inherit' });
  built++;
}

console.log(built === 0 ? `demo diagrams up to date (${builds.length}); pass --force to rebuild` : `\n${built} of ${builds.length} demo build(s) written to docs/public/demo/`);
