import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { IconEntry, IconPackManifest } from './manifest.js';

/** "LanSwitching" → "lan-switching", "IOT" → "iot", "layer_3 Switch" → "layer-3-switch" */
export function kebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function titleize(fileBase: string): string {
  return fileBase
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Build a manifest from a directory tree of SVGs. Ids are
 * `<pack>/<kebab(category-path)>/<kebab(filename)>`; walk order is sorted so
 * output is deterministic; id collisions get a deterministic `-2`, `-3` suffix.
 */
export function generateManifestFromSvgDir(
  svgDir: string,
  opts: { pack: string; title: string; version?: string; fileBase?: string },
): IconPackManifest {
  const icons: IconEntry[] = [];
  const used = new Set<string>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.toLowerCase().endsWith('.svg')) continue;
      const relPath = relative(svgDir, full);
      const parts = relPath.split(sep);
      const base = name.replace(/\.svg$/i, '');
      const categoryParts = parts.slice(0, -1).map(kebab).filter(Boolean);
      const category = categoryParts.join('/') || 'misc';
      const nameKebab = kebab(base) || 'icon';
      // Collision suffixes must themselves be collision-checked: a directory
      // holding a.svg, a-2.svg and A.svg must yield three distinct ids.
      const baseId = `${opts.pack}/${category}/${nameKebab}`;
      let id = baseId;
      for (let n = 2; used.has(id); n++) id = `${baseId}-${n}`;
      used.add(id);
      const fileBase = opts.fileBase ?? 'svg';
      icons.push({
        id,
        title: titleize(base),
        category,
        keywords: dedupe([...nameKebab.split('-'), ...category.split(/[/-]/)]).filter((k) => k.length > 1),
        file: [fileBase, ...parts].join('/'),
      });
    }
  };
  walk(svgDir);
  return { pack: opts.pack, title: opts.title, version: opts.version ?? '1.0.0', icons };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
