/**
 * `marrow.config.yaml` — settings that are static across EVERY diagram.
 *
 * Topology YAML describes a network; this file describes who it belongs to.
 * Nothing here can be overridden per-diagram, which is the point: one edit
 * rebrands everything you build.
 *
 *   brand:
 *     name: Marrow
 *     note: Proprietary & Confidential
 *     logo: brand/logo.svg          # relative to this file; inlined at build
 *     link: https://marrow.network
 *     github: https://github.com/marrow-net/marrow
 *
 * A missing config is normal — Marrow just uses its own mark. A malformed one
 * warns and is ignored; it never fails a build.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parse } from 'yaml';
import type { Density } from '@marrow/model';
import {
  hasBrand,
  isSafeLink,
  sanitizeLogo,
  type Brand,
  type ThemeConfig,
  type PaletteTokens,
  type StatusTokens,
  type LinkStyleTokens,
} from '@marrow/site';

export const DEFAULT_CONFIG_FILE = 'marrow.config.yaml';

export interface LayoutConfig {
  density?: Density;
  scale?: number;
}

export interface LoadedConfig {
  brand?: Brand;
  theme?: ThemeConfig;
  layout?: LayoutConfig;
  /** Non-fatal issues, already human-readable. */
  problems: string[];
}

const BRAND_KEYS = ['name', 'note', 'logo', 'link', 'github'] as const;
const ROOT_KEYS = ['brand', 'theme', 'layout'] as const;
const THEME_KEYS = ['dark', 'light', 'links'] as const;
const LAYOUT_KEYS = ['density', 'scale'] as const;

const SAFE_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|lab|color|color-mix|var)\([^;{}<>]+\)|[a-zA-Z_-]+)$/;

const PALETTE_STATUS_MAP: Record<string, string> = {
  bg: 'bg',
  panel: 'panel',
  surface: 'surface',
  line: 'line',
  subtle: 'subtle',
  ink: 'ink',
  muted: 'muted',
  faint: 'faint',
  accent: 'accent',
  accenthover: 'accentHover',
  accent_hover: 'accentHover',
  accentHover: 'accentHover',
  accentsubtle: 'accentSubtle',
  accent_subtle: 'accentSubtle',
  accentSubtle: 'accentSubtle',
  accentink: 'accentInk',
  accent_ink: 'accentInk',
  accentInk: 'accentInk',
  up: 'up',
  down: 'down',
  degraded: 'degraded',
  admindown: 'adminDown',
  admin_down: 'adminDown',
  adminDown: 'adminDown',
  unknown: 'unknown',
};

const LINK_STYLE_MAP: Record<string, string> = {
  default_stroke: 'defaultStrokeWidth',
  default_stroke_width: 'defaultStrokeWidth',
  defaultStrokeWidth: 'defaultStrokeWidth',
  teng_stroke: 'tenGStrokeWidth',
  ten_g_stroke: 'tenGStrokeWidth',
  ten_g_stroke_width: 'tenGStrokeWidth',
  tenGStrokeWidth: 'tenGStrokeWidth',
  fortyg_stroke: 'fortyGStrokeWidth',
  forty_g_stroke: 'fortyGStrokeWidth',
  forty_g_stroke_width: 'fortyGStrokeWidth',
  fortyGStrokeWidth: 'fortyGStrokeWidth',
  trunk_stroke: 'trunkStrokeWidth',
  trunk_stroke_width: 'trunkStrokeWidth',
  trunkStrokeWidth: 'trunkStrokeWidth',
  slot_stroke: 'slotStrokeWidth',
  slot_stroke_width: 'slotStrokeWidth',
  slotStrokeWidth: 'slotStrokeWidth',
  stack_stroke: 'stackStrokeWidth',
  stack_stroke_width: 'stackStrokeWidth',
  stackStrokeWidth: 'stackStrokeWidth',
};

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

function parseTokensBlock(
  raw: unknown,
  scope: 'theme.dark' | 'theme.light',
  problems: string[],
): (Partial<PaletteTokens> & Partial<StatusTokens>) | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push(`\`${scope}:\` must be a mapping`);
    return undefined;
  }
  const result: Record<string, string> = {};
  const map = raw as Record<string, unknown>;
  for (const [key, val] of Object.entries(map)) {
    if (key.startsWith('x-')) continue;
    const target = PALETTE_STATUS_MAP[key];
    if (!target) {
      problems.push(`unknown key "${scope}.${key}"`);
      continue;
    }
    const colorStr = str(val);
    if (!colorStr) continue;
    if (SAFE_COLOR_REGEX.test(colorStr)) {
      result[target] = colorStr;
    } else {
      problems.push(`${scope}.${key}: invalid color "${colorStr}" — must be hex, rgb, hsl, oklch, or named color`);
    }
  }
  return Object.keys(result).length > 0 ? (result as Partial<PaletteTokens> & Partial<StatusTokens>) : undefined;
}

function parseLinksBlock(
  raw: unknown,
  problems: string[],
): Partial<LinkStyleTokens> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push('`theme.links:` must be a mapping');
    return undefined;
  }
  const result: Record<string, number> = {};
  const map = raw as Record<string, unknown>;
  for (const [key, val] of Object.entries(map)) {
    if (key.startsWith('x-')) continue;
    const target = LINK_STYLE_MAP[key];
    if (!target) {
      problems.push(`unknown key "theme.links.${key}"`);
      continue;
    }
    const num = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val.trim()) : NaN;
    if (Number.isFinite(num) && num > 0) {
      result[target] = num;
    } else {
      problems.push(`theme.links.${key}: must be a positive number, got "${String(val)}"`);
    }
  }
  return Object.keys(result).length > 0 ? (result as Partial<LinkStyleTokens>) : undefined;
}

function parseTheme(rawTheme: unknown, problems: string[]): ThemeConfig | undefined {
  if (rawTheme === undefined || rawTheme === null) return undefined;
  if (typeof rawTheme !== 'object' || Array.isArray(rawTheme)) {
    problems.push('unknown top-level key "theme" or invalid format — "theme" must be a mapping');
    return undefined;
  }
  const t = rawTheme as Record<string, unknown>;
  for (const key of Object.keys(t)) {
    if (!key.startsWith('x-') && !(THEME_KEYS as readonly string[]).includes(key as any)) {
      problems.push(`unknown key "theme.${key}" — expected: ${THEME_KEYS.join(', ')}`);
    }
  }
  const dark = parseTokensBlock(t['dark'], 'theme.dark', problems);
  const light = parseTokensBlock(t['light'], 'theme.light', problems);
  const links = parseLinksBlock(t['links'], problems);

  if (!dark && !light && !links) return undefined;
  return {
    ...(dark ? { dark } : {}),
    ...(light ? { light } : {}),
    ...(links ? { links } : {}),
  };
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

function parseLayout(rawLayout: unknown, problems: string[]): LayoutConfig | undefined {
  if (rawLayout === undefined || rawLayout === null) return undefined;
  if (typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
    problems.push('`layout:` must be a mapping');
    return undefined;
  }
  const l = rawLayout as Record<string, unknown>;
  const res: LayoutConfig = {};
  for (const key of Object.keys(l)) {
    if (!key.startsWith('x-') && !(LAYOUT_KEYS as readonly string[]).includes(key as any)) {
      problems.push(`unknown key "layout.${key}" — expected: ${LAYOUT_KEYS.join(', ')}`);
    }
  }
  if (l['density'] !== undefined) {
    const d = str(l['density']);
    if (d === 'compact' || d === 'standard' || d === 'spacious') {
      res.density = d;
    } else {
      problems.push(`layout.density: must be "compact", "standard", or "spacious" — got "${String(l['density'])}"`);
    }
  }
  if (l['scale'] !== undefined) {
    const s = typeof l['scale'] === 'number' ? l['scale'] : typeof l['scale'] === 'string' ? parseFloat(l['scale'].trim()) : NaN;
    if (Number.isFinite(s) && s >= 0.4 && s <= 2.5) {
      res.scale = s;
    } else {
      problems.push(`layout.scale: must be a number between 0.4 and 2.5 — got "${String(l['scale'])}"`);
    }
  }
  return Object.keys(res).length > 0 ? res : undefined;
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
    if (!key.startsWith('x-') && !(ROOT_KEYS as readonly string[]).includes(key as any)) {
      problems.push(`unknown top-level key "${key}" — expected: ${ROOT_KEYS.join(', ')}`);
    }
  }

  const rawBrand = root['brand'];
  let brand: Brand | undefined;
  if (rawBrand !== undefined && rawBrand !== null) {
    if (typeof rawBrand !== 'object' || Array.isArray(rawBrand)) {
      problems.push('`brand:` must be a mapping');
    } else {
      const b = rawBrand as Record<string, unknown>;
      for (const key of Object.keys(b)) {
        if (!key.startsWith('x-') && !(BRAND_KEYS as readonly string[]).includes(key as any)) {
          problems.push(`unknown key "brand.${key}" — expected: ${BRAND_KEYS.join(', ')}`);
        }
      }

      const parsedBrand: Brand = {};
      const name = str(b['name']);
      if (name !== undefined) parsedBrand.name = name;
      const note = str(b['note']);
      if (note !== undefined) parsedBrand.note = note;

      const logoPath = str(b['logo']);
      if (logoPath !== undefined) {
        const logo = inlineLogo(logoPath, configDir, problems);
        if (logo !== undefined) parsedBrand.logo = logo;
      }

      for (const key of ['link', 'github'] as const) {
        const url = str(b[key]);
        if (url === undefined) continue;
        if (isSafeLink(url)) parsedBrand[key] = url;
        else problems.push(`brand.${key}: "${url}" ignored — only http(s) URLs are allowed`);
      }
      if (hasBrand(parsedBrand)) {
        brand = parsedBrand;
      }
    }
  }

  const theme = parseTheme(root['theme'], problems);
  const layout = parseLayout(root['layout'], problems);

  return {
    ...(brand ? { brand } : {}),
    ...(theme ? { theme } : {}),
    ...(layout ? { layout } : {}),
    problems,
  };
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
