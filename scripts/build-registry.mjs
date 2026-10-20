#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const REGISTRY_DIR = join(ROOT_DIR, 'registry');
const PUBLIC_R_DIR = join(ROOT_DIR, 'docs', 'public', 'r');

mkdirSync(PUBLIC_R_DIR, { recursive: true });
mkdirSync(join(PUBLIC_R_DIR, 'styles', 'default'), { recursive: true });

// Registry items are added here as components are built one by one.
const REGISTRY_ITEMS = [];

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
