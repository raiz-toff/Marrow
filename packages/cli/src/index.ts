#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { formatPretty, toJsonReport, type JsonReport } from '@marrow/diagnostics';
import { topologyJsonSchema, validateSource } from '@marrow/schema';
import { buildSingleFile, buildSite, planSite, type Brand } from '@marrow/site';
import { loadConfig } from './config.js';
import { importV1 } from './import-v1.js';
import { loadIconCatalog } from './packs.js';

const USAGE = `marrow — agent-driven network topology studio (v2)

usage:
  marrow validate <file...> [--json] [--no-icons] [--packs <dir>]
  marrow build <file> [-o <out.html>] [--packs <dir>]
  marrow serve <file-or-dir> [--port <n>] [--packs <dir>]
  marrow import <v1-file> [-o <out.yaml>] [--packs <dir>]
  marrow snapshot <file> [-o <out.png>] [--focus <device-id>] [--theme <dark|light>] [--json] [--packs <dir>]
  marrow icons search <query...> [--json] [--max <n>] [--packs <dir>]
  marrow icons packs [--packs <dir>]
  marrow icons fetch [pack...] [--yes] [--packs <dir>]
  marrow schema

exit codes: 0 valid · 1 validation errors · 2 usage or I/O error`;

/** Global settings from marrow.config.yaml; --config points elsewhere. */
function globalBrand(explicit?: string): { brand?: Brand } {
  const { brand, problems } = loadConfig(explicit);
  for (const problem of problems) console.error(`warning: ${problem}`);
  return brand !== undefined ? { brand } : {};
}

function main(argv: string[]): number | Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'validate':
      return cmdValidate(rest);
    case 'build':
      return cmdBuild(rest);
    case 'serve':
      return cmdServe(rest);
    case 'import':
      return cmdImport(rest);
    case 'snapshot':
      return cmdSnapshot(rest);
    case 'icons':
      return cmdIcons(rest);
    case 'schema':
      console.log(JSON.stringify(topologyJsonSchema(), null, 2));
      return 0;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return command === undefined ? 2 : 0;
    default:
      console.error(`unknown command "${command}"\n\n${USAGE}`);
      return 2;
  }
}

type ParsedArgs<T> = { ok: true; args: T } | { ok: false; message: string };

/** parseArgs throws on unknown flags — surface that as a usage error (exit 2), never a stack trace. */
function safeParseArgs<T>(fn: () => T): ParsedArgs<T> {
  try {
    return { ok: true, args: fn() };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function cmdValidate(rest: string[]): number {
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: rest,
      options: {
        json: { type: 'boolean', default: false },
        'no-icons': { type: 'boolean', default: false },
        packs: { type: 'string' },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\nusage: marrow validate <file...> [--json] [--no-icons] [--packs <dir>]`);
    return 2;
  }
  const { values, positionals: files } = parsed.args;
  if (files.length === 0) {
    console.error('usage: marrow validate <file...> [--json]');
    return 2;
  }

  let icons;
  if (!values['no-icons']) {
    const packs = loadIconCatalog(values.packs);
    if (packs.error) {
      console.error(packs.error);
      return 2;
    }
    for (const problem of packs.catalog.problems) {
      console.error(`warning: ${problem}`);
    }
    if (packs.catalog.size > 0) {
      icons = packs.catalog;
    } else {
      console.error('warning: no icon packs found — icon ids were NOT checked (use --packs <dir>)');
    }
  }

  const reports: JsonReport[] = [];
  const pretty: string[] = [];
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, 'utf8');
    } catch (err) {
      console.error(`cannot read ${file}: ${(err as Error).message}`);
      return 2;
    }
    const result = validateSource(source, icons ? { icons } : {});
    reports.push(toJsonReport(result.diagnostics, file));
    if (!values.json) {
      pretty.push(formatPretty(result.diagnostics, { color: process.stdout.isTTY ?? false, filename: file }));
    }
  }

  if (values.json) {
    console.log(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
  } else {
    console.log(pretty.join('\n\n'));
  }
  return reports.every((r) => r.valid) ? 0 : 1;
}

async function cmdBuild(rest: string[]): Promise<number> {
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: rest,
      options: {
        out: { type: 'string', short: 'o' },
        packs: { type: 'string' },
        single: { type: 'boolean', default: false },
        config: { type: 'string' },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(
      `${parsed.message}\n\nusage: marrow build <file> [-o <out>] [--single] [--packs <dir>] [--config <file.yaml>]`,
    );
    return 2;
  }
  const { values, positionals } = parsed.args;
  const file = positionals[0];
  if (!file || positionals.length > 1) {
    console.error('usage: marrow build <file> [-o <out.html>]');
    return 2;
  }
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`cannot read ${file}: ${(err as Error).message}`);
    return 2;
  }
  const packs = loadIconCatalog(values.packs);
  if (packs.error) {
    console.error(packs.error);
    return 2;
  }
  for (const problem of packs.catalog.problems) console.error(`warning: ${problem}`);
  if (packs.catalog.size === 0) {
    console.error('error: no icon packs found — a build needs the icon library (use --packs <dir>)');
    return 2;
  }

  const result = validateSource(source, { icons: packs.catalog });
  if (!result.topology) {
    console.error(formatPretty(result.diagnostics, { color: process.stderr.isTTY ?? false, filename: file }));
    return 1;
  }
  for (const d of result.diagnostics) {
    console.error(`warning: ${d.code} ${d.path} — ${d.message}`);
  }

  const baseName = basename(file).replace(/\.ya?ml$/i, '');
  const brand = globalBrand(values.config);
  const plan = planSite(result.topology);
  try {
    if (plan.mode === 'site' && !values.single) {
      const outDir = values.out ?? join('output', `${baseName}-site`);
      const site = await buildSite(result.topology, { icons: packs.catalog, ...brand });
      let bytes = 0;
      for (const [rel, content] of site.files) {
        const full = join(outDir, rel);
        mkdirSync(dirname(full), { recursive: true });
        writeFileSync(full, content);
        bytes += Buffer.byteLength(content);
      }
      const maxNodes = Math.max(...site.pageStats.map((p) => p.nodes));
      console.log(
        `built site ${outDir}/ — ${site.files.size} files (${site.plan.zonePages.length} zone pages, ` +
          `${site.plan.devicePages.length} device pages), ${Math.round(bytes / 1024)} KB total, ` +
          `max ${maxNodes} nodes/page — open ${join(outDir, 'index.html')}`,
      );
      return 0;
    }
    const outPath = values.out ?? join('output', `${baseName}.html`);
    const built = await buildSingleFile(result.topology, { icons: packs.catalog, ...brand });
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, built.html);
    const kb = Math.round(Buffer.byteLength(built.html) / 1024);
    console.log(
      `built ${outPath} — ${built.scene.nodes.length} nodes, ${built.scene.edges.length} edges, ${kb} KB, lint clean` +
        (built.lint.l3.length ? ` (${built.lint.l3.length} advisories)` : ''),
    );
    return 0;
  } catch (err) {
    console.error(`build failed: ${(err as Error).message}`);
    return 1;
  }
}

async function cmdServe(rest: string[]): Promise<number> {
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: rest,
      options: {
        port: { type: 'string', default: '5200' },
        host: { type: 'string', default: '127.0.0.1' },
        packs: { type: 'string' },
        config: { type: 'string' },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\nusage: marrow serve <file-or-dir> [--port <n>] [--host <addr>]`);
    return 2;
  }
  const { values, positionals } = parsed.args;
  const input = positionals[0];
  if (!input) {
    console.error('usage: marrow serve <file-or-dir> [--port <n>]');
    return 2;
  }
  const packs = loadIconCatalog(values.packs);
  if (packs.error) {
    console.error(packs.error);
    return 2;
  }
  for (const problem of packs.catalog.problems) console.error(`warning: ${problem}`);
  const { serve } = await import('@marrow/server');
  try {
    const running = await serve({
      input,
      icons: packs.catalog,
      ...globalBrand(values.config),
      port: Number(values.port) || 5200,
      host: values.host ?? '127.0.0.1',
    });
    const modeNote = running.mode() === 'site' ? 'multi-page site — zone/device pages + inventory served live' : 'single page';
    console.log(`marrow serve — ${running.url} (current: ${running.currentFile()}, ${modeNote})`);
    if (values.host === '0.0.0.0') {
      console.log('bound to all interfaces — reachable from your network at this machine’s IP');
    }
    console.log('watching for YAML changes; the browser reloads itself. Ctrl-C to stop.');
    await new Promise(() => {}); // run until killed
    return 0;
  } catch (err) {
    console.error(`serve failed: ${(err as Error).message}`);
    return 2;
  }
}

function cmdImport(rest: string[]): number {
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: rest,
      options: {
        out: { type: 'string', short: 'o' },
        packs: { type: 'string' },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\nusage: marrow import <v1-file> [-o <out.yaml>]`);
    return 2;
  }
  const { values, positionals } = parsed.args;
  const file = positionals[0];
  if (!file) {
    console.error('usage: marrow import <v1-file> [-o <out.yaml>]');
    return 2;
  }
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`cannot read ${file}: ${(err as Error).message}`);
    return 2;
  }
  try {
    const result = importV1(source);
    const outPath = values.out ?? join('input', basename(file).replace(/\.ya?ml$/i, '') + '.v2.yaml');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, result.yaml);
    console.log(`imported ${outPath} — ${result.devices} devices, ${result.links} links, ${result.zones} zones`);
    for (const note of result.notes) console.error(`note: ${note}`);
    // immediately validate the conversion so icon typos etc. surface with hints
    const packs = loadIconCatalog(values.packs);
    for (const problem of packs.catalog.problems) console.error(`warning: ${problem}`);
    const validation = validateSource(result.yaml, packs.catalog.size > 0 ? { icons: packs.catalog } : {});
    console.log(formatPretty(validation.diagnostics, { color: process.stdout.isTTY ?? false, filename: outPath }));
    return validation.valid ? 0 : 1;
  } catch (err) {
    console.error(`import failed: ${(err as Error).message}`);
    return 1;
  }
}

async function cmdSnapshot(rest: string[]): Promise<number> {
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: rest,
      options: {
        out: { type: 'string', short: 'o' },
        focus: { type: 'string' },
        theme: { type: 'string' },
        width: { type: 'string', default: '1440' },
        height: { type: 'string', default: '900' },
        json: { type: 'boolean', default: false },
        packs: { type: 'string' },
        config: { type: 'string' },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\nusage: marrow snapshot <file> [-o <out.png>] [--focus <device-id>]`);
    return 2;
  }
  const { values, positionals } = parsed.args;
  const file = positionals[0];
  if (!file) {
    console.error('usage: marrow snapshot <file> [-o <out.png>]');
    return 2;
  }
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`cannot read ${file}: ${(err as Error).message}`);
    return 2;
  }
  const packs = loadIconCatalog(values.packs);
  if (packs.error) {
    console.error(packs.error);
    return 2;
  }
  const result = validateSource(source, { icons: packs.catalog });
  if (!result.topology) {
    console.error(formatPretty(result.diagnostics, { color: process.stderr.isTTY ?? false, filename: file }));
    return 1;
  }
  if (values.theme === 'dark' || values.theme === 'light') result.topology.theme = values.theme;

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('snapshot needs playwright — install it with: npm i -D playwright && npx playwright install chromium');
    return 2;
  }

  try {
    const built = await buildSingleFile(result.topology, { icons: packs.catalog, ...globalBrand(values.config) });
    const tmpHtml = join(tmpdir(), `marrow-snapshot-${process.pid}.html`);
    writeFileSync(tmpHtml, built.html);
    const outPath = values.out ?? join('output', basename(file).replace(/\.ya?ml$/i, '') + '.png');
    mkdirSync(dirname(outPath), { recursive: true });

    const browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: Number(values.width) || 1440, height: Number(values.height) || 900 },
      reducedMotion: 'reduce',
    });
    const hash = values.focus ? `#d=${encodeURIComponent(values.focus)}` : '';
    await page.goto(`file://${tmpHtml}${hash}`);
    await page.waitForTimeout(values.focus ? 1100 : 450);
    await page.screenshot({ path: outPath });
    await browser.close();
    rmSync(tmpHtml, { force: true });

    const summary = {
      file,
      png: outPath,
      nodes: built.scene.nodes.length,
      edges: built.scene.edges.length,
      size: built.scene.size,
      advisories: built.lint.l3.map((i) => i.message),
    };
    if (values.json) console.log(JSON.stringify(summary, null, 2));
    else console.log(`snapshot ${outPath} — ${summary.nodes} nodes, ${summary.edges} edges`);
    return 0;
  } catch (err) {
    console.error(`snapshot failed: ${(err as Error).message}`);
    return 1;
  }
}

async function cmdIcons(rest: string[]): Promise<number> {
  const [sub, ...subRest] = rest;
  const parsed = safeParseArgs(() =>
    parseArgs({
      args: subRest,
      options: {
        json: { type: 'boolean', default: false },
        packs: { type: 'string' },
        max: { type: 'string', default: '20' },
        yes: { type: 'boolean', default: false },
      },
      allowPositionals: true,
    }),
  );
  if (!parsed.ok) {
    console.error(`${parsed.message}\n\nusage: marrow icons <search|packs|fetch> [--json] [--max <n>] [--yes] [--packs <dir>]`);
    return 2;
  }
  const { values, positionals } = parsed.args;
  if (sub === 'fetch') return cmdIconsFetch(positionals, values.yes ?? false, values.packs);
  const packs = loadIconCatalog(values.packs);
  if (packs.error) {
    console.error(packs.error);
    return 2;
  }
  for (const problem of packs.catalog.problems) {
    console.error(`warning: ${problem}`);
  }
  const catalog = packs.catalog;
  switch (sub) {
    case 'search': {
      const query = positionals.join(' ').trim();
      if (!query) {
        console.error('usage: marrow icons search <query...>');
        return 2;
      }
      const max = Number.parseInt(values.max ?? '20', 10);
      const results = catalog.search(query, Number.isNaN(max) || max <= 0 ? 20 : max);
      if (values.json) {
        console.log(JSON.stringify(results, null, 2));
      } else if (results.length === 0) {
        console.log(`no icons match "${query}" (catalog: ${catalog.size} icons)`);
      } else {
        for (const r of results) console.log(`${r.id}  —  ${r.title} (${r.category})`);
      }
      return 0;
    }
    case 'packs': {
      console.log(`packs root: ${packs.root ?? '(none found)'}`);
      console.log(`icons loaded: ${catalog.size}`);
      return 0;
    }
    default:
      console.error('usage: marrow icons <search|packs|fetch>');
      return 2;
  }
}

/**
 * Download vendor icon packs from their OFFICIAL sources (icon-sources.json).
 * These packs are never redistributed with the repo — each user fetches them
 * from the vendor's servers under the vendor's terms, after consenting.
 */
async function cmdIconsFetch(requested: string[], yes: boolean, packsFlag: string | undefined): Promise<number> {
  const { fetchPack } = await import('@marrow/icons');
  const packsRoot = resolvePacksRoot(packsFlag);
  const sourcesPath = join(dirname(packsRoot), 'icon-sources.json');
  let sources: import('@marrow/icons').IconSourceMap;
  try {
    const raw = JSON.parse(readFileSync(sourcesPath, 'utf8')) as Record<string, unknown>;
    delete raw['$comment'];
    sources = raw as import('@marrow/icons').IconSourceMap;
  } catch (err) {
    console.error(`cannot read ${sourcesPath}: ${(err as Error).message}`);
    return 2;
  }

  const targets = requested.length > 0 ? requested : Object.keys(sources);
  for (const t of targets) {
    if (!sources[t]) {
      console.error(`unknown pack "${t}" — fetchable packs: ${Object.keys(sources).join(', ')}`);
      return 2;
    }
  }

  console.log('The following icon packs will be downloaded from their vendors:');
  for (const t of targets) {
    console.log(`\n  ${t} — ${sources[t]!.title}`);
    console.log(`    ${sources[t]!.license}`);
    console.log(`    terms: ${sources[t]!.licenseUrl}`);
  }
  console.log('');
  if (!yes) {
    if (!process.stdin.isTTY) {
      console.error('not a terminal — pass --yes to consent to the downloads non-interactively');
      return 2;
    }
    const { createInterface } = await import('node:readline/promises');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question('Download from these official sources? [y/N] ')).trim().toLowerCase();
    rl.close();
    if (answer !== 'y' && answer !== 'yes') {
      console.log('aborted — nothing downloaded');
      return 2;
    }
  }

  mkdirSync(packsRoot, { recursive: true });
  let failures = 0;
  for (const t of targets) {
    try {
      const result = await fetchPack(t, sources[t]!, packsRoot, (m) => console.log(`  [${t}] ${m}`));
      console.log(`✔ ${t}: ${result.icons} icons installed → ${join(packsRoot, t)}`);
    } catch (err) {
      failures++;
      console.error(`✖ ${t}: ${(err as Error).message}`);
    }
  }
  if (failures === 0) console.log('\ndone — verify with `marrow icons search <keyword>`');
  return failures === 0 ? 0 : 2;
}

/** The icon-packs dir the fetcher installs into (mirrors loadIconCatalog's walk). */
function resolvePacksRoot(explicit?: string): string {
  if (explicit) return explicit;
  const found = loadIconCatalog(undefined).root;
  return found ?? join(process.cwd(), 'icon-packs');
}

process.exit(await main(process.argv.slice(2)));
