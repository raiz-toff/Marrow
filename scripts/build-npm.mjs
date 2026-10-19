#!/usr/bin/env node
/**
 * Package the Marrow toolchain into ONE publishable CLI: `marrow-cli`.
 *
 * The repo is a private monorepo of ~13 interdependent `@marrow/*` packages.
 * Rather than publish all of them, this bundles their code into a single ESM
 * file with the `marrow` bin, so users just `npm i -g marrow-cli`.
 *
 *   - `@marrow/*` workspace code is INLINED by esbuild.
 *   - npm deps (yaml, zod, elkjs, libavoid-js + its .wasm, fflate) stay EXTERNAL
 *     and are declared as real dependencies — bundling the wasm/worker ones
 *     would break them.
 *   - runtime.js and the committed icon packs are shipped as files; the CLI
 *     resolves them relative to the bundle exactly as it does in the monorepo.
 *
 * Run:  npm run compile && node scripts/build-npm.mjs
 * Then: cd dist-npm && npm publish   (after `npm login`)
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(repo, 'dist-npm');
const VERSION = '0.1.0'; // the published marrow-cli version — bump per release

// committed, redistributable packs only. aws/azure/gcp are fetched per-clone
// under vendor terms and must never be shipped.
const PACKS = ['affinity', 'cisco', 'generic', 'k8s', 'LICENSES.md'];
// npm deps kept external (declared in package.json), NOT bundled
const EXTERNAL_DEPS = {
  elkjs: '^0.12.0',
  fflate: '^0.8.3',
  'libavoid-js': '0.5.0-beta.5',
  yaml: '^2.5.0',
  zod: '^4.0.0',
};

const README = `# marrow-cli

Compile network-topology **YAML** into a single self-contained, offline,
interactive **HTML** diagram. You declare structure — the engine computes the
layout.

\`\`\`bash
npm i -g marrow-cli

marrow validate net.yaml     # schema + reference check
marrow build net.yaml        # → net.html (one file, works offline)
marrow icons search switch   # find real vendor icon ids
\`\`\`

A minimal topology:

\`\`\`yaml
marrow: 2
name: Small Office
devices:
  - { id: edge, icon: cisco/routers/router, tier: edge }
  - { id: core, icon: cisco/switches/layer-3-switch, tier: core }
  - { id: acc, icon: cisco/switches/workgroup-switch, tier: access }
links:
  - { from: edge, to: core, speed: 10G }
  - { from: core, to: acc, mode: trunk, vlans: "10,20,30" }
\`\`\`

## Commands

| Command | Purpose |
| --- | --- |
| \`marrow validate <file...>\` | Schema + reference check (exit 1 on errors) |
| \`marrow build <file> [-o OUT]\` | Compile to HTML; auto-splits into a site above ~150 devices |
| \`marrow serve <file-or-dir>\` | Live-reload preview server |
| \`marrow snapshot <file> [-o OUT.png]\` | Render to PNG (needs \`npm i -D playwright && npx playwright install chromium\`) |
| \`marrow icons search <keyword>\` | Find icon ids |
| \`marrow icons fetch [pack...]\` | Install the aws/azure/gcp packs from the vendors |
| \`marrow import <v1-file>\` | Convert legacy v1 YAML |
| \`marrow schema\` | Emit the JSON Schema |

Bundled icon packs: **cisco, affinity, generic, k8s** (~2,000 icons). The
**aws / azure / gcp** packs are fetched on demand with \`marrow icons fetch\`
(vendor terms forbid redistribution).

Full documentation: **https://marrowdiagram.vercel.app**

MIT © Marrow
`;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'dist'), { recursive: true });

// ── 1 · bundle the CLI, inlining @marrow/* and externalizing everything else ──
const externalizeNpm = {
  name: 'externalize-npm',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === 'entry-point') return null;
      // relative / absolute imports → let esbuild bundle them
      if (args.path.startsWith('.') || args.path.startsWith('/')) return null;
      // our own workspace packages → bundle (inline)
      if (args.path === '@marrow' || args.path.startsWith('@marrow/')) return null;
      // any other bare import (npm dep, node: builtin) → external
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: [join(repo, 'packages/cli/dist/index.js')],
  outfile: join(out, 'dist/marrow.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'none',
  plugins: [externalizeNpm],
});

// ensure exactly one shebang on line 1
const bundlePath = join(out, 'dist/marrow.mjs');
let code = readFileSync(bundlePath, 'utf8');
code = code.replace(/^#![^\n]*\n/, '');
writeFileSync(bundlePath, `#!/usr/bin/env node\n${code}`);

// ── 2 · ship the runtime (read relative to the bundle) + committed icon packs ──
cpSync(join(repo, 'packages/runtime/dist/runtime.js'), join(out, 'dist/runtime.js'));
mkdirSync(join(out, 'icon-packs'), { recursive: true });
for (const p of PACKS) cpSync(join(repo, 'icon-packs', p), join(out, 'icon-packs', p), { recursive: true });

// ── 3 · license, readme, package manifest ──
cpSync(join(repo, 'LICENSE'), join(out, 'LICENSE'));
writeFileSync(join(out, 'README.md'), README);
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: 'marrow-cli',
      version: VERSION,
      description:
        'Compile network-topology YAML into self-contained, offline, interactive HTML diagrams. You declare structure; the engine computes the layout.',
      type: 'module',
      bin: { marrow: 'dist/marrow.mjs' },
      files: ['dist', 'icon-packs', 'README.md', 'LICENSE'],
      engines: { node: '>=20' },
      dependencies: EXTERNAL_DEPS,
      keywords: [
        'network',
        'topology',
        'network-diagram',
        'diagram',
        'cisco',
        'yaml',
        'cli',
        'offline',
        'svg',
        'netdevops',
        'documentation',
      ],
      license: 'MIT',
      homepage: 'https://marrowdiagram.vercel.app',
      repository: { type: 'git', url: 'git+https://github.com/raiz-toff/Marrow.git' },
      bugs: { url: 'https://github.com/raiz-toff/Marrow/issues' },
    },
    null,
    2,
  ) + '\n',
);

console.log(`\n✓ staged marrow-cli@${VERSION} → dist-npm/`);
console.log('  next:  cd dist-npm && npm pack   (dry run)   |   npm publish   (after npm login)');
