#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const REGISTRY_DIR = join(ROOT_DIR, 'registry');
const PUBLIC_R_DIR = join(ROOT_DIR, 'docs', 'public', 'r');

mkdirSync(PUBLIC_R_DIR, { recursive: true });
mkdirSync(join(PUBLIC_R_DIR, 'styles', 'default'), { recursive: true });

// Registry items for Marrow UI (shadcn / React / Next.js TSX)
const REGISTRY_ITEMS = [
  {
    name: 'topology-shell',
    type: 'registry:block',
    title: 'Spacious Topology Shell',
    description:
      'Complete Fumadocs Spacious-inspired network topology workspace shell in React/Next.js TSX framing compiled Marrow diagrams with collapsible sidebar, floating camera controls, 5-tab telemetry inspector, and Ctrl+K search.',
    dependencies: ['lucide-react'],
    files: [
      {
        path: 'ui/topology-types.ts',
        type: 'registry:component',
        target: 'components/marrow/topology-types.ts',
      },
      {
        path: 'ui/topology-context.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-context.tsx',
      },
      {
        path: 'ui/topology-sidebar.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-sidebar.tsx',
      },
      {
        path: 'ui/topology-controls.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-controls.tsx',
      },
      {
        path: 'ui/topology-canvas.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-canvas.tsx',
      },
      {
        path: 'ui/topology-inspector.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-inspector.tsx',
      },
      {
        path: 'ui/topology-search.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-search.tsx',
      },
      {
        path: 'ui/topology-shell.tsx',
        type: 'registry:component',
        target: 'components/marrow/topology-shell.tsx',
      },
    ],
  },
  {
    name: 'topology-sidebar',
    type: 'registry:ui',
    title: 'Topology Sidebar',
    description:
      'Spacious left navigation rail with zone switcher dropdown, Ctrl+K search trigger, gliding hover highlight block, collapsible device hierarchy, and canvas layer switches.',
    dependencies: ['lucide-react'],
    registryDependencies: ['topology-shell'],
    files: [
      {
        path: 'ui/topology-sidebar.tsx',
        type: 'registry:ui',
        target: 'components/marrow/topology-sidebar.tsx',
      },
    ],
  },
  {
    name: 'topology-canvas',
    type: 'registry:ui',
    title: 'Topology Stage',
    description:
      'Clean workspace stage card that frames the main viewport with live hardware telemetry, dot grid, breadcrumbs, and floating camera controls HUD.',
    dependencies: ['lucide-react'],
    registryDependencies: ['topology-shell'],
    files: [
      {
        path: 'ui/topology-canvas.tsx',
        type: 'registry:ui',
        target: 'components/marrow/topology-canvas.tsx',
      },
    ],
  },
  {
    name: 'topology-inspector',
    type: 'registry:ui',
    title: 'Topology Inspector',
    description:
      'Floating rounded-2xl right sibling card with 5 segmented tabs (Overview, Interfaces, Neighbors, Fields, Config) and copyable CLI configuration stanzas.',
    dependencies: ['lucide-react'],
    registryDependencies: ['topology-shell'],
    files: [
      {
        path: 'ui/topology-inspector.tsx',
        type: 'registry:ui',
        target: 'components/marrow/topology-inspector.tsx',
      },
    ],
  },
  {
    name: 'topology-controls',
    type: 'registry:ui',
    title: 'Topology Controls & Minimap',
    description:
      'Floating vertical zoom/fit/command pill and interactive SVG minimap overlay.',
    dependencies: ['lucide-react'],
    registryDependencies: ['topology-shell'],
    files: [
      {
        path: 'ui/topology-controls.tsx',
        type: 'registry:ui',
        target: 'components/marrow/topology-controls.tsx',
      },
    ],
  },
  {
    name: 'topology-search',
    type: 'registry:ui',
    title: 'Topology Command & Search',
    description:
      'Ctrl+K spotlight modal for searching devices, IPs, security zones, links, and canvas actions.',
    dependencies: ['lucide-react'],
    registryDependencies: ['topology-shell'],
    files: [
      {
        path: 'ui/topology-search.tsx',
        type: 'registry:ui',
        target: 'components/marrow/topology-search.tsx',
      },
    ],
  },
];

// Enrich each item with inlined file contents
const builtItems = REGISTRY_ITEMS.map((item) => {
  const enrichedFiles = item.files.map((file) => {
    const fullPath = join(REGISTRY_DIR, file.path);
    if (!existsSync(fullPath)) {
      throw new Error(`Registry file not found: ${fullPath}`);
    }
    const content = readFileSync(fullPath, 'utf8');
    return {
      ...file,
      content,
    };
  });

  return {
    $schema: 'https://ui.shadcn.com/schema/registry-item.json',
    ...item,
    files: enrichedFiles,
  };
});

// Root catalog schema (for registry.json)
const registryCatalog = {
  $schema: 'https://ui.shadcn.com/schema/registry.json',
  name: 'marrow',
  homepage: 'https://marrow.run',
  items: builtItems,
};

// 1. Write root registry.json (for GitHub repository registry mode: npx shadcn add raiz-toff/Marrow/<item>)
writeFileSync(join(ROOT_DIR, 'registry.json'), JSON.stringify(registryCatalog, null, 2));
console.log('✔ Generated root registry.json (GitHub registry support)');

// 2. Write docs/public/r/registry.json and docs/public/r/index.json
writeFileSync(join(PUBLIC_R_DIR, 'registry.json'), JSON.stringify(registryCatalog, null, 2));
writeFileSync(join(PUBLIC_R_DIR, 'index.json'), JSON.stringify(builtItems, null, 2));
console.log('✔ Generated docs/public/r/registry.json and index.json');

// 3. Write individual docs/public/r/[name].json & styles/default/[name].json
for (const item of builtItems) {
  const itemJson = JSON.stringify(item, null, 2);
  const outPath = join(PUBLIC_R_DIR, `${item.name}.json`);
  const stylePath = join(PUBLIC_R_DIR, 'styles', 'default', `${item.name}.json`);
  writeFileSync(outPath, itemJson);
  writeFileSync(stylePath, itemJson);
}
console.log(`✔ Generated ${builtItems.length} individual component registry endpoints in docs/public/r/`);
