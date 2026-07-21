/**
 * An icon pack is a directory containing `manifest.json` plus the SVG files it
 * references. Dropping a new pack directory in is all it takes to extend the
 * icon library — the validator, search, and (later) the sprite subsetter all
 * read the same manifest.
 */

export interface IconEntry {
  /** Full icon id: `<pack>/<category>/<name>`, kebab-case throughout. */
  id: string;
  title: string;
  category: string;
  keywords: string[];
  /** SVG path relative to the pack directory. */
  file: string;
}

export interface IconPackManifest {
  pack: string;
  title: string;
  version: string;
  icons: IconEntry[];
}

export const ICON_ID_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+){1,3}$/;

/** Structural check for a loaded manifest.json; throws with a plain message. */
export function assertManifest(value: unknown, source: string): IconPackManifest {
  const fail = (why: string): never => {
    throw new Error(`Invalid icon pack manifest at ${source}: ${why}`);
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('not an object');
  const m = value as Record<string, unknown>;
  if (typeof m['pack'] !== 'string' || m['pack'].length === 0) fail('missing "pack"');
  if (typeof m['title'] !== 'string') fail('missing "title"');
  if (typeof m['version'] !== 'string') fail('missing "version"');
  if (!Array.isArray(m['icons'])) fail('missing "icons" array');
  const ids = new Set<string>();
  for (const [i, raw] of (m['icons'] as unknown[]).entries()) {
    if (typeof raw !== 'object' || raw === null) fail(`icons[${i}] is not an object`);
    const e = raw as Record<string, unknown>;
    for (const key of ['id', 'title', 'category', 'file'] as const) {
      if (typeof e[key] !== 'string' || e[key].length === 0) fail(`icons[${i}].${key} missing`);
    }
    if (!ICON_ID_PATTERN.test(e['id'] as string)) fail(`icons[${i}].id "${String(e['id'])}" is not kebab-case pack/category/name`);
    if (ids.has(e['id'] as string)) fail(`duplicate icon id "${String(e['id'])}" at icons[${i}]`);
    ids.add(e['id'] as string);
    if (!Array.isArray(e['keywords']) || !(e['keywords'] as unknown[]).every((k) => typeof k === 'string')) {
      fail(`icons[${i}].keywords must be a string array`);
    }
  }
  return value as unknown as IconPackManifest;
}
