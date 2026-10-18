import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

export function titleize(fileBase: string): string {
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

      // Validate SVG structure and viewBox presence
      try {
        const content = readFileSync(full, 'utf8');
        const open = content.match(/<svg\b[^>]*>/i);
        if (!open) {
          console.warn(`warning: ${relPath} is not a valid SVG file — skipping`);
          continue;
        }
        const hasViewBox = /viewBox=["'][^"']+["']/i.test(open[0]);
        const hasWidth = /width=["'][^"']+["']/i.test(open[0]);
        const hasHeight = /height=["'][^"']+["']/i.test(open[0]);
        if (!hasViewBox && (!hasWidth || !hasHeight) && !process.env['VITEST']) {
          console.warn(`warning: ${relPath} lacks viewBox and width/height — may scale unpredictably`);
        }
      } catch (err) {
        if (!process.env['VITEST']) console.warn(`warning: cannot read ${relPath}: ${(err as Error).message}`);
        continue;
      }

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

export interface IndexPackResult {
  pack: string;
  count: number;
  manifestPath: string;
}

/**
 * Automatically index all icon packs under a root folder (or a specific target pack).
 * Rebuilds each pack's manifest.json without manual script invocation or package.json editing.
 */
export function indexIconPacks(packsDir: string, targetPack?: string): IndexPackResult[] {
  const results: IndexPackResult[] = [];
  if (!existsSync(packsDir)) return results;

  const entries = targetPack ? [targetPack] : readdirSync(packsDir).sort();
  for (const name of entries) {
    const packDir = join(packsDir, name);
    if (!existsSync(packDir) || !statSync(packDir).isDirectory()) continue;
    const svgDir = join(packDir, 'svg');
    if (!existsSync(svgDir) || !statSync(svgDir).isDirectory()) continue;

    const packName = kebab(name) || name;
    let title = titleize(name);
    const existingManifest = join(packDir, 'manifest.json');
    if (existsSync(existingManifest)) {
      try {
        const parsed = JSON.parse(readFileSync(existingManifest, 'utf8')) as { title?: string };
        if (parsed.title) title = parsed.title;
      } catch {
        // preserve derived title
      }
    }

    const manifest = generateManifestFromSvgDir(svgDir, {
      pack: packName,
      title,
      fileBase: 'svg',
    });
    writeFileSync(existingManifest, JSON.stringify(manifest, null, 2) + '\n');
    results.push({
      pack: packName,
      count: manifest.icons.length,
      manifestPath: existingManifest,
    });
  }

  return results;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
