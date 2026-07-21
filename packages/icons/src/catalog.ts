import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { closestMatches } from '@marrow/diagnostics';
import { assertManifest, type IconEntry, type IconPackManifest } from './manifest.js';

export interface CatalogEntry extends IconEntry {
  /** Absolute path of the pack directory this icon came from. */
  packDir: string;
}

export interface SearchResult {
  id: string;
  title: string;
  category: string;
  score: number;
}

/**
 * All loaded icon packs, merged. Implements the `IconLookup` contract the
 * schema validator consumes (has / suggest), plus keyword search for the CLI.
 */
export class IconCatalog {
  private readonly byId = new Map<string, CatalogEntry>();
  /** Non-fatal issues met while loading packs (corrupt manifests, dup ids…). */
  readonly problems: string[] = [];

  addPack(manifest: IconPackManifest, packDir: string): void {
    for (const entry of manifest.icons) {
      if (this.byId.has(entry.id)) {
        this.problems.push(`duplicate icon id "${entry.id}" (pack at ${packDir}) — keeping the first`);
        continue;
      }
      this.byId.set(entry.id, { ...entry, packDir });
    }
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): CatalogEntry | undefined {
    return this.byId.get(id);
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }

  get size(): number {
    return this.byId.size;
  }

  /**
   * Ranked guesses for a misspelled icon id. Compares both the full id and the
   * final segment so `cisco/switchs/layer-3-switch` and a bare `layer3switch`
   * both find their target.
   */
  suggest(input: string, max = 3): string[] {
    const full = closestMatches(input, this.byId.keys(), max);
    if (full.length >= max) return full;
    const lastSegment = input.split('/').at(-1) ?? input;
    const byName = new Map<string, string>();
    for (const id of this.byId.keys()) {
      const name = id.split('/').at(-1) ?? id;
      if (!byName.has(name)) byName.set(name, id);
    }
    const nameHits = closestMatches(lastSegment, byName.keys(), max).map((n) => byName.get(n) as string);
    const merged = [...full];
    for (const hit of nameHits) {
      if (!merged.includes(hit)) merged.push(hit);
    }
    return merged.slice(0, max);
  }

  search(query: string, max = 20): SearchResult[] {
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];
    const results: SearchResult[] = [];
    for (const entry of this.byId.values()) {
      let score = 0;
      let everyTokenHit = true;
      const idSegments = entry.id.split('/');
      const haystacks = [...idSegments, ...entry.keywords, entry.title.toLowerCase(), entry.category];
      for (const token of tokens) {
        let tokenScore = 0;
        for (const hay of haystacks) {
          if (hay === token) tokenScore = Math.max(tokenScore, 10);
          else if (hay.startsWith(token)) tokenScore = Math.max(tokenScore, 5);
          else if (hay.includes(token)) tokenScore = Math.max(tokenScore, 2);
        }
        if (tokenScore === 0) {
          everyTokenHit = false;
          break;
        }
        score += tokenScore;
      }
      // EVERY token must land somewhere — one strong token must not carry a
      // query whose other terms match nothing in the catalog.
      if (everyTokenHit) {
        results.push({ id: entry.id, title: entry.title, category: entry.category, score });
      }
    }
    results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return results.slice(0, max);
  }
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/** Load one pack directory (must contain manifest.json). Throws naming the file. */
export function loadPack(packDir: string): IconPackManifest {
  const manifestPath = join(packDir, 'manifest.json');
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot load icon pack manifest at ${manifestPath}: ${(err as Error).message}`);
  }
  return assertManifest(raw, manifestPath);
}

/**
 * Load every pack under a root directory (each subdirectory with a
 * manifest.json). Never throws: a broken pack (corrupt manifest, dangling
 * symlink) is skipped and recorded in `catalog.problems` so callers can warn
 * without a single bad pack taking down validation entirely.
 */
export function loadCatalog(packsRoot: string): IconCatalog {
  const catalog = new IconCatalog();
  if (!existsSync(packsRoot)) return catalog;
  for (const name of readdirSync(packsRoot).sort()) {
    const dir = join(packsRoot, name);
    try {
      if (!statSync(dir).isDirectory()) continue;
      if (!existsSync(join(dir, 'manifest.json'))) continue;
      catalog.addPack(loadPack(dir), dir);
    } catch (err) {
      catalog.problems.push((err as Error).message);
    }
  }
  return catalog;
}
