/**
 * `marrow.config.yaml` — settings that are static across EVERY diagram.
 *
 * Topology YAML describes a network; this file describes who it belongs to.
 * Nothing here can be overridden per-diagram, which is the point: one edit
 * rebrands everything you build.
 *
 *   brand:
 *     name: Acme Networks
 *     note: Proprietary & Confidential
 *     logo: brand/logo.svg          # relative to this file; inlined at build
 *     link: https://acme.example.com
 *     github: https://github.com/acme/network
 *
 * A missing config is normal — Marrow just uses its own mark. A malformed one
 * warns and is ignored; it never fails a build.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parse } from 'yaml';
import { hasBrand, isSafeLink, sanitizeLogo, type Brand } from '@marrow/site';

export const DEFAULT_CONFIG_FILE = 'marrow.config.yaml';

export interface LoadedConfig {
  brand?: Brand;
  /** Non-fatal issues, already human-readable. */
  problems: string[];
}

const BRAND_KEYS = ['name', 'note', 'logo', 'link', 'github'] as const;
const ROOT_KEYS = ['brand'] as const;

const RASTER_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

/** Read a string field, treating blank as unset. */
function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t === '' ? undefined : t;
}

/**
 * Inline a logo file. SVG is embedded as markup so it inherits `currentColor`
 * and the light/dark theme; raster formats become a `data:` URI. Either way the
 * bytes travel inside the diagram — nothing is fetched at view time.
 */
function inlineLogo(logoPath: string, configDir: string, problems: string[]): string | undefined {
  const full = isAbsolute(logoPath) ? logoPath : resolve(configDir, logoPath);
  if (!existsSync(full)) {
    problems.push(`brand.logo: no file at ${logoPath}`);
    return undefined;
  }
  const ext = full.toLowerCase().split('.').pop() ?? '';
  const mime = RASTER_MIME[ext];
  if (mime === undefined) {
    problems.push(`brand.logo: unsupported file type ".${ext}" — use .svg, .png, .jpg, .webp or .gif`);
    return undefined;
  }
  try {
    if (ext === 'svg') {
      const raw = readFileSync(full, 'utf8');
      const match = /<svg[\s\S]*<\/svg>/i.exec(raw);
      if (!match) {
        problems.push(`brand.logo: ${logoPath} contains no <svg> element`);
        return undefined;
      }
      const { logo } = sanitizeLogo(match[0], problems);
      return logo || undefined;
    }
    const b64 = readFileSync(full).toString('base64');
    if (b64.length > 400_000) {
      problems.push(`brand.logo: ${logoPath} is large (~${Math.round(b64.length / 1365)} KB) and is embedded in every diagram`);
    }
    return `<img src="data:${mime};base64,${b64}" alt="">`;
  } catch (err) {
    problems.push(`brand.logo: could not read ${logoPath} — ${(err as Error).message}`);
    return undefined;
  }
}

/** Parse an already-read config document. Exported for tests. */
export function parseConfig(source: string, configDir: string): LoadedConfig {
  const problems: string[] = [];
  let doc: unknown;
  try {
    doc = parse(source);
  } catch (err) {
    return { problems: [`could not parse config: ${(err as Error).message}`] };
  }
  if (doc === null || doc === undefined) return { problems };
  if (typeof doc !== 'object' || Array.isArray(doc)) {
    return { problems: ['config must be a mapping (e.g. `brand:` at the top level)'] };
  }

  const root = doc as Record<string, unknown>;
  for (const key of Object.keys(root)) {
    if (!key.startsWith('x-') && !(ROOT_KEYS as readonly string[]).includes(key)) {
      problems.push(`unknown top-level key "${key}" — expected: ${ROOT_KEYS.join(', ')}`);
    }
  }

  const rawBrand = root['brand'];
  if (rawBrand === undefined || rawBrand === null) return { problems };
  if (typeof rawBrand !== 'object' || Array.isArray(rawBrand)) {
    problems.push('`brand:` must be a mapping');
    return { problems };
  }

  const b = rawBrand as Record<string, unknown>;
  for (const key of Object.keys(b)) {
    if (!key.startsWith('x-') && !(BRAND_KEYS as readonly string[]).includes(key)) {
      problems.push(`unknown key "brand.${key}" — expected: ${BRAND_KEYS.join(', ')}`);
    }
  }

  const brand: Brand = {};
  const name = str(b['name']);
  if (name !== undefined) brand.name = name;
  const note = str(b['note']);
  if (note !== undefined) brand.note = note;

  const logoPath = str(b['logo']);
  if (logoPath !== undefined) {
    const logo = inlineLogo(logoPath, configDir, problems);
    if (logo !== undefined) brand.logo = logo;
  }

  for (const key of ['link', 'github'] as const) {
    const url = str(b[key]);
    if (url === undefined) continue;
    if (isSafeLink(url)) brand[key] = url;
    else problems.push(`brand.${key}: "${url}" ignored — only http(s) URLs are allowed`);
  }

  return { ...(hasBrand(brand) ? { brand } : {}), problems };
}

/**
 * Load global config. `explicit` comes from --config; otherwise the default file
 * is used when present. Missing is silent unless the user named the file.
 */
export function loadConfig(explicit?: string): LoadedConfig {
  const path = explicit ?? DEFAULT_CONFIG_FILE;
  if (!existsSync(path)) {
    return { problems: explicit ? [`config file not found: ${path}`] : [] };
  }
  try {
    return parseConfig(readFileSync(path, 'utf8'), dirname(resolve(path)));
  } catch (err) {
    return { problems: [`could not read ${path}: ${(err as Error).message}`] };
  }
}
