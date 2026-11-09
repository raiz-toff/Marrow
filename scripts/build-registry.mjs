#!/usr/bin/env node
// Builds the shadcn-compatible registry from packages/ui/src — the single
// source of the Marrow UI components. Consumers COPY these files into their
// codebase, so every item must be self-contained: a component may import only
// allowed npm packages, sibling components (shipped in the same item), and
// ../lib/utils.js (shipped as ./topology-types.js). Anything else fails loudly.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** npm packages a copied component may import (react is a peer of every host). */
const PEER_PACKAGES = new Set(['react', 'react-dom']);

const UTILS_SPECIFIER = '../lib/utils.js';
const TYPES_SPECIFIER = './topology-types.js';

const TYPES_FILE = {
  path: 'ui/topology-types.ts',
  type: 'registry:component',
  target: 'components/marrow/topology-types.ts',
};

// Registry items for Marrow UI (shadcn / React / Next.js TSX). `name` is both
// the public URL id (/r/<name>.json) and the source file
// packages/ui/src/components/<name>.tsx.
const REGISTRY_ITEMS = [
  {
    name: 'topology-canvas',
    type: 'registry:ui',
    title: 'Marrow Diagram Embed',
    description:
      'Component to embed interactive HTML diagrams compiled by Marrow with live theme synchronization, fullscreen, and kiosk modes.',
    dependencies: ['lucide-react'],
  },
  {
    name: 'cable-badge',
    type: 'registry:ui',
    title: 'Cable & Link Badge',
    description:
      'Network cable and link mode visualizer (trunk, routed, tunnel, LAG) with media kind and optional traffic flow animation.',
    dependencies: ['lucide-react'],
  },
  {
    name: 'device-link',
    type: 'registry:ui',
    title: 'Device Link & Micro-Topology',
    description:
      'Compact, inline network link component for rendering peer-to-peer device interconnections without canvas or iframe overhead.',
    dependencies: ['lucide-react'],
  },
];

const IMPORT_RE =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function importSpecifiers(source) {
  return [...source.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2]);
}

function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Assemble every registry item (with inlined, import-rewritten file contents)
 * from packages/ui/src. Pure: reads sources, writes nothing.
 */
export function buildRegistryItems(rootDir = DEFAULT_ROOT) {
  const srcDir = join(rootDir, 'packages', 'ui', 'src');
  const read = (path) => {
    if (!existsSync(path)) throw new Error(`Registry source not found: ${path}`);
    return readFileSync(path, 'utf8');
  };

  const typesContent = read(join(srcDir, 'lib', 'utils.ts'));
  const typesImports = importSpecifiers(typesContent);
  if (typesImports.length > 0) {
    throw new Error(
      `packages/ui/src/lib/utils.ts must not import anything (ships as topology-types.ts); found: ${typesImports.join(', ')}`,
    );
  }

  /** Read one component, validate and rewrite its imports. */
  const loadComponent = (name, allowedPackages) => {
    const sourcePath = join(srcDir, 'components', `${name}.tsx`);
    const siblings = [];
    let usesTypes = false;
    const content = read(sourcePath).replace(IMPORT_RE, (match, from, dynamic) => {
      const spec = from ?? dynamic;
      if (spec === UTILS_SPECIFIER) {
        usesTypes = true;
        return match.replace(spec, TYPES_SPECIFIER);
      }
      const sibling = /^\.\/([a-z0-9-]+)\.js$/.exec(spec);
      if (sibling) {
        siblings.push(sibling[1]);
        return match;
      }
      if (!spec.startsWith('.') && !spec.startsWith('@marrow/')) {
        const pkg = packageName(spec);
        if (PEER_PACKAGES.has(pkg) || allowedPackages.has(pkg)) return match;
        throw new Error(
          `${sourcePath}: imports "${spec}" which is not in the item's dependencies (${[...allowedPackages].join(', ') || 'none'})`,
        );
      }
      throw new Error(
        `${sourcePath}: imports "${spec}" — copied registry files must be self-contained ` +
          `(allowed: npm dependencies, ./<sibling>.js, ${UTILS_SPECIFIER})`,
      );
    });
    return { content, siblings, usesTypes };
  };

  return REGISTRY_ITEMS.map((item) => {
    const allowedPackages = new Set(item.dependencies ?? []);
    const order = [];
    const loaded = new Map();
    const visit = (name) => {
      if (loaded.has(name)) return;
      const component = loadComponent(name, allowedPackages);
      loaded.set(name, component);
      for (const sibling of component.siblings) visit(sibling);
      order.push(name); // dependencies before dependents
    };
    visit(item.name);

    const files = [];
    if ([...loaded.values()].some((c) => c.usesTypes)) {
      files.push({ ...TYPES_FILE, content: typesContent });
    }
    for (const name of order) {
      files.push({
        path: `ui/${name}.tsx`,
        type: 'registry:ui',
        target: `components/marrow/${name}.tsx`,
        content: loaded.get(name).content,
      });
    }

    return {
      $schema: 'https://ui.shadcn.com/schema/registry-item.json',
      ...item,
      files,
    };
  });
}

/** Write registry.json and the docs/public/r endpoints. */
export function writeRegistry(rootDir = DEFAULT_ROOT) {
  const builtItems = buildRegistryItems(rootDir);
  const publicDir = join(rootDir, 'docs', 'public', 'r');
  mkdirSync(join(publicDir, 'styles', 'default'), { recursive: true });

  const registryCatalog = {
    $schema: 'https://ui.shadcn.com/schema/registry.json',
    name: 'marrow',
    homepage: 'https://marrowdiagram.vercel.app',
    items: builtItems,
  };
  const catalogJson = JSON.stringify(registryCatalog, null, 2);

  // 1. Root registry.json (GitHub registry mode: npx shadcn add raiz-toff/Marrow/<item>; also read by `marrow add`)
  writeFileSync(join(rootDir, 'registry.json'), catalogJson);
  console.log('✔ Generated root registry.json (GitHub registry support)');

  // 2. docs/public/r/registry.json and docs/public/r/index.json
  writeFileSync(join(publicDir, 'registry.json'), catalogJson);
  writeFileSync(join(publicDir, 'index.json'), JSON.stringify(builtItems, null, 2));
  console.log('✔ Generated docs/public/r/registry.json and index.json');

  // 3. Individual docs/public/r/[name].json & styles/default/[name].json
  for (const item of builtItems) {
    const itemJson = JSON.stringify(item, null, 2);
    writeFileSync(join(publicDir, `${item.name}.json`), itemJson);
    writeFileSync(join(publicDir, 'styles', 'default', `${item.name}.json`), itemJson);
  }
  console.log(`✔ Generated ${builtItems.length} individual component registry endpoints in docs/public/r/`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeRegistry();
}
