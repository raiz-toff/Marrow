#!/usr/bin/env node
/**
 * Marrow setup & onboarding.
 *
 * Brings a fresh clone (or a stale one after `git pull`) to a working state, then
 * offers to make it yours: your organization's branding, your accent color, and a
 * drop-in icon pack for your own proprietary logos.
 *
 * Safe to re-run at any time — every step is idempotent and nothing is overwritten
 * without asking.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const HELP = `
Marrow setup — install, build, and personalize your Marrow clone.

  node scripts/setup.mjs [options]      (or: npm run setup)

Options:
  -y, --yes            Non-interactive. Installs and builds, downloads the
                       aws/azure/gcp icon packs, and skips personalization.
      --skip-icons     Don't download vendor icon packs.
      --skip-brand     Don't run the personalization wizard.
      --skip-verify    Don't run the closing smoke test.
  -h, --help           Show this help.
`;

const REQUIRED_NODE_MAJOR = 24;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'packages/cli/dist/index.js';

// ── formatting ────────────────────────────────────────────────────────────────
const useColor = stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c('1', s);
const dim = (s) => c('2', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const red = (s) => c('31', s);
const cyan = (s) => c('36', s);

const ok = (m) => console.log(`  ${green('✔')} ${m}`);
const warn = (m) => console.log(`  ${yellow('!')} ${m}`);
const info = (m) => console.log(`  ${dim('·')} ${dim(m)}`);

let stepNo = 0;
const step = (t) => console.log(`\n${bold(`[${++stepNo}]`)} ${bold(t)}`);

function fail(title, detail) {
  console.error(`\n${red('✖ Setup failed:')} ${title}`);
  if (detail) console.error(`\n${detail}`);
  console.error(`\nIf this looks like a bug: https://github.com/raiz-toff/Marrow/issues\n`);
  process.exit(1);
}

function run(cmd, args, { quiet = false } = {}) {
  const res = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    encoding: 'utf8',
  });
  if (res.error) return { okay: false, output: String(res.error.message) };
  return { okay: res.status === 0, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

// ── args ──────────────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2));
if (argv.has('--help') || argv.has('-h')) {
  console.log(HELP);
  process.exit(0);
}
const assumeYes = argv.has('--yes') || argv.has('-y');
const skipIcons = argv.has('--skip-icons');
const skipBrand = argv.has('--skip-brand') || assumeYes;
const skipVerify = argv.has('--skip-verify');
const interactive = stdin.isTTY && stdout.isTTY && !assumeYes;

// ── prompts ───────────────────────────────────────────────────────────────────
let rl;
const readline = () => (rl ??= createInterface({ input: stdin, output: stdout }));
const closeReadline = () => {
  rl?.close();
  rl = undefined;
};

async function ask(question, fallback = '') {
  if (!interactive) return fallback;
  const hint = fallback ? ` ${dim(`[${fallback}]`)}` : '';
  const answer = (await readline().question(`  ${cyan('?')} ${question}${hint} `)).trim();
  return answer || fallback;
}

async function confirm(question, fallback = true) {
  if (!interactive) return fallback;
  const hint = fallback ? '[Y/n]' : '[y/N]';
  const a = (await readline().question(`  ${cyan('?')} ${question} ${dim(hint)} `)).trim().toLowerCase();
  if (!a) return fallback;
  return a === 'y' || a === 'yes';
}

// ── helpers ───────────────────────────────────────────────────────────────────
const FETCHABLE = ['aws', 'azure', 'gcp'];

function packInstalled(pack) {
  const dir = join(repoRoot, 'icon-packs', pack, 'svg');
  try {
    return existsSync(dir) && readdirSync(dir).length > 0;
  } catch {
    return false;
  }
}

/** kebab-case id the schema accepts: [a-z0-9._-], starting alphanumeric. */
function slugify(input, fallback) {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-+$/, '');
  return s || fallback;
}

const isHex = (s) => /^#[0-9a-fA-F]{6}$/.test(s);

/** Quote a YAML scalar only when it needs it. */
function yamlStr(s) {
  return /^[A-Za-z0-9 ._@/-]*$/.test(s) && s.trim() === s && s !== '' ? s : JSON.stringify(s);
}

function uniquePath(dir, base, ext) {
  let candidate = join(dir, `${base}${ext}`);
  let n = 2;
  while (existsSync(candidate)) candidate = join(dir, `${base}-${n++}${ext}`);
  return candidate;
}

// ── banner ────────────────────────────────────────────────────────────────────
console.log(bold('\nMarrow setup'));
console.log(dim('Compile topology YAML into interactive, self-contained network diagrams.'));

// 1. Environment
step('Checking your environment');
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (Number.isNaN(nodeMajor) || nodeMajor < REQUIRED_NODE_MAJOR) {
  fail(
    `Node.js ${REQUIRED_NODE_MAJOR}+ is required (you have ${process.versions.node}).`,
    `Install from https://nodejs.org, or with nvm:\n\n  nvm install ${REQUIRED_NODE_MAJOR}\n  nvm use ${REQUIRED_NODE_MAJOR}`,
  );
}
ok(`Node.js ${process.versions.node}`);

if (!existsSync(join(repoRoot, 'package.json')) || !existsSync(join(repoRoot, 'packages'))) {
  fail(
    'This does not look like the Marrow repository.',
    'Run this from inside your clone:\n\n  git clone https://github.com/raiz-toff/Marrow.git\n  cd Marrow\n  npm run setup',
  );
}
ok('Marrow repository found');

// 2. Dependencies
step('Installing dependencies');
info('npm install — can take a minute on a first run');
if (!run('npm', ['install']).okay) {
  fail('`npm install` did not complete.', 'Check the npm output above — usually a network or permissions issue.');
}
ok('Dependencies installed');

// 3. Build
step('Compiling the toolchain');
info('npm run build — TypeScript + the runtime client bundle');
if (!run('npm', ['run', 'build']).okay) fail('`npm run build` did not complete.', 'Check the compiler output above.');
ok('Toolchain compiled (dist/ is fresh)');

// 4. Icon packs
step('Setting up icon packs');
const bundled = ['affinity', 'k8s', 'generic'].filter(packInstalled);
ok(`Bundled packs ready: ${bundled.join(', ') || 'none found'}`);

const missing = FETCHABLE.filter((p) => !packInstalled(p));
if (skipIcons) {
  info('Skipping vendor packs (--skip-icons).');
} else if (missing.length === 0) {
  ok('Cloud packs already installed: aws, azure, gcp');
} else {
  console.log(
    `\n  The ${bold(missing.join(', '))} pack(s) are not installed. Marrow does not\n` +
      `  redistribute them (vendors allow use in diagrams, not redistribution), so they\n` +
      `  download from ${bold('the vendors’ own servers')} onto this machine.\n`,
  );
  if (assumeYes || (await confirm('Download them now?', false))) {
    info(`marrow icons fetch ${missing.join(' ')}`);
    const res = run('node', [CLI, 'icons', 'fetch', ...missing, '--yes']);
    if (res.okay) ok('Cloud icon packs installed');
    else warn('Fetch did not finish. Retry later: npm run marrow -- icons fetch --yes');
  } else {
    info('Skipped. Install later with: npm run marrow -- icons fetch --yes');
  }
}

if (existsSync(join(repoRoot, 'icon-packs', 'cisco', 'manifest.json')) && !packInstalled('cisco')) {
  warn(
    'Cisco pack: metadata only. Those icons are not redistributed and have no download\n' +
      '    endpoint. Devices using them still validate but render as placeholders. To enable,\n' +
      '    add SVGs under icon-packs/cisco/svg/ — see icon-packs/LICENSES.md.',
  );
}

// 5. Personalization
let starterFile = null;
const brand = { org: '', note: '', theme: 'dark', accent: '', project: '' };

if (skipBrand) {
  step('Personalization');
  info(assumeYes ? 'Skipped in non-interactive mode (--yes).' : 'Skipped (--skip-brand).');
} else if (!interactive) {
  step('Personalization');
  info('Skipped — not an interactive terminal. Run `npm run setup` from a terminal to personalize.');
} else {
  step('Make it yours');
  console.log(
    dim(
      '  Marrow has no global config file — branding lives inside each topology file.\n' +
        '  Answer these and I\'ll write you a branded starter you can copy for every new diagram.\n',
    ),
  );

  if (await confirm('Set up your branding now?', true)) {
    brand.org = await ask('Organization / brand name (shown along the top):', 'Acme Networks');
    brand.note = await ask('Footer note (shown along the bottom):', 'Proprietary & Confidential');

    const theme = (await ask('Default theme — dark or light:', 'dark')).toLowerCase();
    brand.theme = theme === 'light' ? 'light' : 'dark';

    for (;;) {
      const a = await ask('Accent color as a hex code (blank for the default):', '');
      if (!a) break;
      if (isHex(a)) {
        brand.accent = a;
        break;
      }
      warn('That is not a 6-digit hex color — try something like #7aa2ff.');
    }

    // ── the company logo, copied into brand/ and referenced by the config ───
    console.log(
      `\n  ${bold('Your logo.')} It appears in the sidebar footer, the inspector drawer,\n` +
        `  brand strip on every diagram. Diagrams are self-contained, so the file gets\n` +
        `  inlined — SVG is embedded directly, PNG/JPG as a data: URI. Leave blank to keep\n` +
        `  the Marrow mark.\n`,
    );

    let logoRelPath = null;
    for (;;) {
      const logoPath = await ask('Path to your logo (.svg/.png/.jpg), or blank:', '');
      if (!logoPath) break;
      if (!existsSync(logoPath)) {
        warn(`No file at ${logoPath}`);
        continue;
      }
      const ext = (logoPath.toLowerCase().match(/\.(svg|png|jpe?g|webp|gif)$/) ?? [])[0];
      if (!ext) {
        warn('Use an .svg, .png, .jpg, .webp or .gif file.');
        continue;
      }
      try {
        mkdirSync(join(repoRoot, 'brand'), { recursive: true });
        const dest = join(repoRoot, 'brand', `logo${ext}`);
        writeFileSync(dest, readFileSync(logoPath));
        logoRelPath = `brand/logo${ext}`;
        ok(`Logo copied to ${cyan(logoRelPath)}`);
        break;
      } catch (err) {
        warn(`Could not copy it: ${err.message}`);
      }
    }

    // ── optional links on the brand mark ─────────────────────────────────────
    const askUrl = async (question) => {
      for (;;) {
        const v = await ask(question, '');
        if (!v) return '';
        if (/^https?:\/\/\S+$/i.test(v)) return v;
        warn('Needs to be a full http(s) URL, e.g. https://acme.com');
      }
    };
    const siteUrl = await askUrl('Company website the logo links to (optional):');
    const repoUrl = await askUrl('Source repo URL for a GitHub mark (optional):');

    // ── write the ONE global config file ────────────────────────────────────
    const configFile = join(repoRoot, 'marrow.config.yaml');
    const yamlQ = (v) => (/^[A-Za-z0-9 ._@/&+-]*$/.test(v) && v.trim() === v ? v : JSON.stringify(v));

    const writeConfig =
      !existsSync(configFile) || (await confirm('marrow.config.yaml already exists — overwrite it?', false));

    if (writeConfig) {
      writeFileSync(
        configFile,
        `# Marrow — global configuration.
#
# Everything here is static across EVERY diagram you build. Topology files in
# input/ describe a network; this file describes who it belongs to. One edit
# here rebrands everything, and nothing in this file can be set per-diagram.

brand:
  name: ${yamlQ(brand.org)}
  note: ${yamlQ(brand.note)}
${logoRelPath ? `  logo: ${logoRelPath}` : '  # logo: brand/logo.svg   # .svg inlined, .png/.jpg embedded as a data: URI'}

  # http(s) hyperlinks — nothing is fetched unless someone clicks.
${siteUrl ? `  link: ${siteUrl}` : '  # link: https://your-company.example.com'}
${repoUrl ? `  github: ${repoUrl}` : '  # github: https://github.com/you/repo'}
`,
      );
      ok(`Global config written to ${cyan('marrow.config.yaml')}`);
      info('Every build picks this up automatically — edit that one file to rebrand.');
    } else {
      info('Kept your existing marrow.config.yaml.');
    }

    brand.project = slugify(await ask('Name for your first topology file:', 'my-network'), 'my-network');

    // ── your own logos ────────────────────────────────────────────────────────
    console.log(
      `\n  ${bold('Your own icons.')} Any folder under ${cyan('icon-packs/')} with a manifest is\n` +
        `  auto-discovered, so you can use your company logos and proprietary hardware art\n` +
        `  as first-class icons.\n`,
    );

    if (await confirm('Create an icon pack for your own logos?', true)) {
      const packName = slugify(await ask('Pack id (lowercase, no spaces):', slugify(brand.org, 'mycompany')), 'mycompany');
      const packTitle = await ask('Pack display name:', brand.org || packName);
      const packDir = join(repoRoot, 'icon-packs', packName);
      const svgDir = join(packDir, 'svg', 'logos');

      mkdirSync(svgDir, { recursive: true });
      writeFileSync(
        join(packDir, 'README.md'),
        `# ${packTitle} icon pack\n\n` +
          `Drop your own SVG files into subfolders of \`svg/\`. The subfolder becomes the\n` +
          `icon's category, and the filename becomes its name:\n\n` +
          '```\n' +
          `svg/logos/${packName}-logo.svg   →   ${packName}/logos/${packName}-logo\n` +
          `svg/hardware/edge-appliance.svg  →   ${packName}/hardware/edge-appliance\n` +
          '```\n\n' +
          `Then regenerate the manifest so Marrow can see them:\n\n` +
          '```bash\n' +
          `npm run icons:pack -- icon-packs/${packName} ${packName} ${JSON.stringify(packTitle)}\n` +
          '```\n\n' +
          `Find them with \`npm run marrow -- icons search <keyword>\` and use the id in your\n` +
          `topology's \`icon:\` field.\n\n` +
          `Note: this pack is yours — if the artwork is proprietary or third-party, check\n` +
          `whether you want it committed to a public repository.\n`,
      );

      const svgCount = readdirSync(join(packDir, 'svg'), { recursive: true }).filter((f) =>
        String(f).toLowerCase().endsWith('.svg'),
      ).length;

      if (svgCount > 0) {
        const gen = run('node', ['packages/icons/dist/generate-cli.js', `icon-packs/${packName}`, packName, packTitle], {
          quiet: true,
        });
        if (gen.okay) ok(`Icon pack "${packName}" built — ${gen.output.trim()}`);
        else warn(`Could not build the manifest: ${gen.output.trim()}`);
      } else {
        // No manifest yet: an empty pack dir is simply ignored by the catalog.
        ok(`Icon pack scaffolded at ${cyan(`icon-packs/${packName}/`)}`);
        info(`Add SVGs to icon-packs/${packName}/svg/logos/, then run:`);
        info(`npm run icons:pack -- icon-packs/${packName} ${packName} ${JSON.stringify(packTitle)}`);
      }
    }

    // ── write the branded starter ────────────────────────────────────────────
    const inputDir = join(repoRoot, 'input');
    mkdirSync(inputDir, { recursive: true });
    const target = uniquePath(inputDir, brand.project, '.yaml');
    const accentLine = brand.accent ? `\n    accent: "${brand.accent}"` : '';

    writeFileSync(
      target,
      `marrow: 2
name: ${yamlStr(brand.org ? `${brand.org} Network` : 'My Network')}
description: ${yamlStr('Starter topology — edit me')}
theme: ${brand.theme}
hero: edge-fw-01

# Your logo, name and footer note come from marrow.config.yaml and apply to every
# diagram automatically. Uncomment to override them for this one only:
# backdrop:
#   text: ${yamlStr(brand.org)}
#   note: ${yamlStr(brand.note)}

zones:
  - id: edge
    name: Internet Edge${accentLine}
  - id: core
    name: Core

devices:
  - id: edge-fw-01
    name: Perimeter Firewall
    icon: affinity/tile/firewall
    tier: edge
    zone: edge
    role: Perimeter security
  - id: core-sw-01
    name: Core Switch
    icon: affinity/tile/switch-multilayer
    tier: core
    zone: core
    mgmt_ip: 10.0.0.10
  - id: app-srv-01
    name: Application Server
    icon: affinity/tile/server
    tier: endpoint
    zone: core

links:
  - from: edge-fw-01:inside
    to: core-sw-01:Gi1/0/1
    kind: fiber
    speed: 10G
  - from: core-sw-01:Gi1/0/20
    to: app-srv-01:eno1
    kind: copper
    speed: 1G

# Next steps:
#   npm run marrow -- icons search <keyword>     find real icon ids
#   npm run marrow -- serve input/               live preview while you edit
#   npm run marrow -- validate <this file>       always before you ship
# Full schema and layout rules: AGENTS.md
`,
    );
    starterFile = target.slice(repoRoot.length + 1);
    ok(`Branded starter written to ${cyan(starterFile)}`);
    info('Copy this file as the template for every new diagram.');
  } else {
    info('Skipped. You can always set `backdrop:`, `theme:`, and `accent:` by hand.');
  }
}

closeReadline();

// 6. Verify
if (skipVerify) {
  step('Verification');
  info('Skipped (--skip-verify).');
} else {
  step('Verifying the install');
  const sample = starterFile ?? join('fixtures', 'valid', 'small-office.yaml');

  const validate = run('node', [CLI, 'validate', sample], { quiet: true });
  if (!validate.okay) fail(`${sample} failed to validate.`, validate.output.trim());
  ok(`validate ${sample} — 0 errors`);

  // No -o: the CLI already defaults to output/<name>.html (or <name>-site/).
  const build = run('node', [CLI, 'build', sample], { quiet: true });
  if (!build.okay) fail(`${sample} failed to build.`, build.output.trim());
  const builtPath = /built (\S+)/.exec(build.output)?.[1] ?? 'output/';
  ok(`build → ${cyan(builtPath)} ${dim('(open it in a browser)')}`);
}

// ── done ──────────────────────────────────────────────────────────────────────
console.log(`\n${green(bold('Marrow is ready.'))}\n`);
console.log(bold('Try it:'));
const openFile = starterFile ?? 'fixtures/valid/small-office.yaml';
const commands = [
  [`npm run marrow -- serve ${openFile}`, 'live preview, hot reload'],
  ['npm run marrow -- icons search switch', 'find real icon ids'],
  [`npm run marrow -- validate ${openFile}`, 'always, before you ship'],
  [`npm run marrow -- build ${openFile}`, 'writes to output/'],
];
const gutter = Math.max(...commands.map(([cmd]) => cmd.length)) + 2;
for (const [cmd, note] of commands) console.log(`  ${cmd.padEnd(gutter)}${dim(`# ${note}`)}`);
if (starterFile) console.log(`\n  ${bold('Your branded starter:')} ${cyan(starterFile)}`);
if (existsSync(join(repoRoot, 'marrow.config.yaml'))) {
  console.log(`  ${bold('Rebrand every diagram:')} edit ${cyan('marrow.config.yaml')} ${dim('(logo, name, note, links)')}`);
}
console.log(`\n  Schema & layout rules: ${cyan('AGENTS.md')}    Contributing: ${cyan('CONTRIBUTING.md')}\n`);
