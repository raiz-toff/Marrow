#!/usr/bin/env node
/**
 * Regenerate the committed screenshots in docs/public/showcase/ — the
 * showcase's "Headless and dev" page. They are committed because the docs
 * host has no Chromium. Needs the compiled toolchain, `npm run demos`, and
 * Playwright's Chromium (`npx playwright install chromium`).
 *
 * Run from the repo root:  node docs/scripts/build-showcase-assets.mjs
 */
import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(docs, '..');
const cli = join(repo, 'packages/cli/dist/index.js');
const out = join(docs, 'public/showcase');
const demo = (name) => join(docs, 'demos', name);
mkdirSync(out, { recursive: true });

// 1. `marrow snapshot`: the CLI's own headless PNGs
const SNAPSHOTS = [
  ['snapshot-zoned-1366.png', 'zoned.yaml', ['--width', '1366', '--height', '900']],
  ['snapshot-tiered-light-800.png', 'tiered.yaml', ['--width', '800', '--height', '600', '--theme', 'light']],
  ['snapshot-zoned-focus-800.png', 'zoned.yaml', ['--width', '800', '--height', '600', '--focus', 'dc-srv-02']],
  ['snapshot-hub-spoke-1366.png', 'hub-spoke.yaml', ['--width', '1366', '--height', '900', '--theme', 'light']],
];
for (const [file, yaml, args] of SNAPSHOTS) {
  execFileSync('node', [cli, 'snapshot', demo(yaml), '-o', join(out, file), ...args], { stdio: 'inherit' });
}

const browser = await chromium.launch();
const ready = (page) => page.waitForFunction(() => window.__MARROW_READY__ === true);
const zoned = pathToFileURL(join(docs, 'public/demo/zoned.html')).href;

// 2. the print stylesheet, as Chromium lays out an A4 page (96 dpi)
{
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(zoned);
  await ready(page);
  await page.waitForTimeout(2500); // the entrance sequence finishes first
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'print-zoned.png') });
  await page.close();
}

// 3. the diagram's own export menu: sidebar open, Export menu open
{
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
  await page.goto(zoned);
  await ready(page);
  await page.waitForTimeout(2000);
  await page.locator('[data-m="sidebar.toggle"]').first().click();
  await page.locator('[data-m="menubar.trigger"]', { hasText: 'Export' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, 'export-menu.png') });
  await page.close();
}

// 4. `marrow serve`: save the YAML, the open page reloads itself over SSE
{
  const dir = mkdtempSync(join(tmpdir(), 'marrow-serve-'));
  const yaml = join(dir, 'zoned.yaml');
  copyFileSync(demo('zoned.yaml'), yaml);
  const server = spawn('node', [cli, 'serve', dir, '--port', '5277'], { stdio: ['ignore', 'pipe', 'inherit'] });
  try {
    await new Promise((ok, fail) => {
      server.stdout.on('data', (b) => String(b).includes('5277') && ok());
      server.once('exit', () => fail(new Error('marrow serve exited')));
    });
    const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
    await page.goto('http://127.0.0.1:5277/');
    await ready(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(out, 'serve-before.png') });

    const edited = readFileSync(yaml, 'utf8')
      .replace('    note: Primary — failover to DR nightly', '    status: down\n    note: Primary — failover to DR nightly')
      .replace(
        '\nlinks:',
        '  - id: dc-srv-03\n    name: DR Replica\n    icon: affinity/tile/server\n    tier: endpoint\n    zone: dc\n\nlinks:',
      )
      .concat('  - { from: dc-sw:Te1/0/4, to: dc-srv-03:eno1, kind: dac, speed: 25G }\n');
    const reloaded = page.waitForEvent('load', { timeout: 15000 });
    writeFileSync(yaml, edited);
    await reloaded;
    await ready(page);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(out, 'serve-after.png') });
  } finally {
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

await browser.close();
for (const f of [...SNAPSHOTS.map(([f]) => f), 'print-zoned.png', 'export-menu.png', 'serve-before.png', 'serve-after.png']) {
  console.log(`${f}  ${Math.round(statSync(join(out, f)).size / 1024)} KB`);
}
