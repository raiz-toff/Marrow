#!/usr/bin/env node
/**
 * Compile docs/demos/*.yaml into docs/public/demo/*.html — the diagrams embedded
 * on the landing page. Embeds load the same file with `?chrome=minimal`.
 *
 * The outputs are generated, not committed: `npm run docs:build` runs this
 * before the Next.js build, so the toolchain must be compiled first.
 *
 * Run from the repo root:  npm run demos
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(docs, '..');
const cli = join(repo, 'packages/cli/dist/index.js');
const out = join(docs, 'public/demo');

mkdirSync(out, { recursive: true });

const demos = readdirSync(join(docs, 'demos')).filter(f => f.endsWith('.yaml'));
if (demos.length === 0) {
  console.error('no demos found in docs/demos/');
  process.exit(1);
}

for (const file of demos) {
  const src = join(docs, 'demos', file);
  const dest = join(out, file.replace(/\.yaml$/, '.html'));

  // never ship a demo that does not validate
  execFileSync('node', [cli, 'validate', src], { stdio: 'inherit' });
  execFileSync('node', [cli, 'build', src, '--single', '-o', dest], { stdio: 'inherit' });
}

console.log(`\n${demos.length} demo diagram(s) written to docs/public/demo/`);
