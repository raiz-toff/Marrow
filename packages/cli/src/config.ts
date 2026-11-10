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
import {
  type WatermarkConfig,
  type WatermarkMode,
  type WatermarkCasing,
  type WatermarkFont,
  WATERMARK_MODES,
  WATERMARK_CASINGS,
  WATERMARK_FONTS,
} from '@marrow/model';
import {
  hasBrand,
  isSafeLink,
  parseDashOverride,
  sanitizeLogo,
  type Brand,
  type LayoutDefaults,
  type ThemeConfig,
  type PaletteTokens,
  type StatusTokens,
  type LinkStyleTokens,
  type LinkStyleOverrides,
} from '@marrow/site';

export const DEFAULT_CONFIG_FILE = 'marrow.config.yaml';

export interface LoadedConfig {
  brand?: Brand;
  theme?: ThemeConfig;
  layout?: LayoutDefaults;
  watermark?: WatermarkConfig;
  /** Non-fatal issues, already human-readable. */
  problems: string[];
}

const BRAND_KEYS = ['name', 'note', 'logo', 'link', 'github'] as const;
const ROOT_KEYS = ['brand', 'theme', 'layout', 'watermark'] as const;
const THEME_KEYS = ['dark', 'light', 'links'] as const;
const LAYOUT_KEYS = ['density', 'scale'] as const;

const SAFE_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla|oklch|lab|color|color-mix|var)\([^;{}<>]+\)|[a-zA-Z_-]+)$/;

type ThemeColorKey = keyof PaletteTokens | keyof StatusTokens;

/**
 * Every palette token, exactly once — a `Record` over the key union, so adding
 * a token to @marrow/visual without listing it here (or listing one that does
 * not exist) is a compile error. The value says how the config value is
 * checked: `color` against SAFE_COLOR_REGEX, `shadow` as a box-shadow list.
 */
const PALETTE_KEYS: Record<keyof PaletteTokens, 'color' | 'shadow'> = {
  bg: 'color',
  bgRaise: 'color',
  panel: 'color',
  line: 'color',
  lineStrong: 'color',
  ink: 'color',
  inkDim: 'color',
  inkFaint: 'color',
  chip: 'color',
  chipLine: 'color',
  gridDot: 'color',
  accent: 'color',
  accentInk: 'color',
  ring: 'color',
  zone: 'color',
  edge: 'color',
  sidebar: 'color',
  sidebarFg: 'color',
  sidebarAccent: 'color',
  sidebarBorder: 'color',
  shadow: 'shadow',
  shadowSm: 'shadow',
};

/** Every status colour, exactly once (same compile-time closure as PALETTE_KEYS). */
const STATUS_KEYS: Record<keyof StatusTokens, true> = {
  up: true,
  down: true,
  degraded: true,
  planned: true,
  unknown: true,
};

/**
 * Deprecated single-word names that still mean exactly one palette token.
 * Accepted with a warning naming the canonical key; anything without an
 * unambiguous target (`subtle`, `accent_hover`, `accent_subtle`,
 * `admin_down`) is deliberately absent: it warns instead of being dropped.
 */
const PALETTE_ALIASES: Record<string, keyof PaletteTokens> = {
  surface: 'panel',
  muted: 'inkDim',
  faint: 'inkFaint',
};

const snake = (k: string): string => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** The canonical snake_case keys, in token order — what warnings and docs list. */
const CANONICAL_PALETTE_KEYS = Object.keys(PALETTE_KEYS).map(snake);
const CANONICAL_STATUS_KEYS = Object.keys(STATUS_KEYS);

/**
 * `theme.dark` / `theme.light` keys → theme token names. Every palette and
 * status key in snake_case and camelCase, plus PALETTE_ALIASES. Typed against
 * the token interfaces so a target that does not exist cannot compile.
 */
const PALETTE_STATUS_MAP: Record<string, ThemeColorKey> = Object.fromEntries([
  ...[...Object.keys(PALETTE_KEYS), ...Object.keys(STATUS_KEYS)].flatMap((k) => [
    [k, k],
    [snake(k), k],
  ]),
  ...Object.entries(PALETTE_ALIASES),
]) as Record<string, ThemeColorKey>;

const isStatusKey = (k: ThemeColorKey): k is keyof StatusTokens => k in STATUS_KEYS;

/** A box-shadow list: no declaration/rule breakers, no resource loads. */
const SAFE_SHADOW_REGEX = /^(?!.*\b(?:url|image|image-set|expression)\s*\()[^;{}<>\\"'`]+$/i;

/**
 * `theme.links` keys → LinkTokens fields. Every value is px. The accepted
 * spellings are the canonical `width_*` / `dash_*` keys in snake_case or
 * camelCase.
 */
const LINK_STYLE_MAP: Record<string, keyof LinkStyleTokens> = {
  width_default: 'widthDefault',
  widthDefault: 'widthDefault',
  width_10g: 'width10g',
  width10g: 'width10g',
  width_40g: 'width40g',
  width40g: 'width40g',
  width_trunk: 'widthTrunk',
  widthTrunk: 'widthTrunk',
  width_slot: 'widthSlot',
  widthSlot: 'widthSlot',
  width_stack: 'widthStack',
  widthStack: 'widthStack',
  dash_tunnel: 'dashTunnel',
  dashTunnel: 'dashTunnel',
  dash_peering: 'dashPeering',
  dashPeering: 'dashPeering',
  dash_degraded: 'dashDegraded',
  dashDegraded: 'dashDegraded',
  dash_planned: 'dashPlanned',
  dashPlanned: 'dashPlanned',
  dash_flow: 'dashFlow',
  dashFlow: 'dashFlow',
};

/**
 * Deprecated `*_stroke` spellings of the width keys — the ones the docs have
 * shown. Still accepted, with a warning naming the canonical key; slated for
 * removal. (The other legacy spellings — `*_stroke_width`, `*StrokeWidth`,
 * `teng_stroke`, `fortyg_stroke` — were never documented and are gone.)
 */
const LINK_STYLE_ALIASES: Record<string, keyof LinkStyleTokens> = {
  default_stroke: 'widthDefault',
  ten_g_stroke: 'width10g',
  forty_g_stroke: 'width40g',
  trunk_stroke: 'widthTrunk',
  slot_stroke: 'widthSlot',
  stack_stroke: 'widthStack',
};

/** One-line deprecation warning for an alias key. */
function deprecated(scope: string, key: string, canonical: string): string {
  return `${scope}.${key} is deprecated — use ${scope}.${canonical}`;
}

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

/** Own-property lookup, so `constructor` / `toString` are unknown keys, not Object internals. */
function lookup<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

function unknownThemeKey(scope: string, key: string, statusOnly: boolean): string {
  const supported = statusOnly ? CANONICAL_STATUS_KEYS : [...CANONICAL_PALETTE_KEYS, ...CANONICAL_STATUS_KEYS];
  const aliases = statusOnly
    ? ''
    : `; deprecated aliases: ${Object.entries(PALETTE_ALIASES)
        .map(([a, t]) => `${a} → ${snake(t)}`)
        .join(', ')}`;
  return `unknown key "${scope}.${key}" — no theme token by that name; supported: ${supported.join(', ')} (camelCase also accepted${aliases})`;
}

function parseTokenValue(scope: string, key: string, val: unknown, target: ThemeColorKey, problems: string[]): string | undefined {
  const value = str(val);
  if (value === undefined) return undefined;
  const shadow = !isStatusKey(target) && PALETTE_KEYS[target] === 'shadow';
  if ((shadow ? SAFE_SHADOW_REGEX : SAFE_COLOR_REGEX).test(value)) return value;
  problems.push(
    shadow
      ? `${scope}.${key}: invalid shadow "${value}" — must be a CSS box-shadow list`
      : `${scope}.${key}: invalid color "${value}" — must be hex, rgb, hsl, oklch, or named color`,
  );
  return undefined;
}

type ThemeBlock = NonNullable<ThemeConfig['dark']>;

/** A status block nested under `theme.<scheme>.status:` — status colours only. */
function parseStatusBlock(raw: unknown, scope: string, problems: string[]): Partial<StatusTokens> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push(`\`${scope}:\` must be a mapping`);
    return undefined;
  }
  const result: Partial<StatusTokens> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith('x-')) continue;
    const target = lookup(PALETTE_STATUS_MAP, key);
    if (target === undefined || !isStatusKey(target)) {
      problems.push(unknownThemeKey(scope, key, true));
      continue;
    }
    const value = parseTokenValue(scope, key, val, target, problems);
    if (value !== undefined) result[target] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseTokensBlock(raw: unknown, scope: 'theme.dark' | 'theme.light', problems: string[]): ThemeBlock | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push(`\`${scope}:\` must be a mapping`);
    return undefined;
  }
  const result: Partial<Record<ThemeColorKey, string>> = {};
  let status: Partial<StatusTokens> | undefined;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (key.startsWith('x-')) continue;
    if (key === 'status') {
      status = parseStatusBlock(val, `${scope}.status`, problems);
      continue;
    }
    const target = lookup(PALETTE_STATUS_MAP, key);
    if (target === undefined) {
      problems.push(unknownThemeKey(scope, key, false));
      continue;
    }
    if (lookup(PALETTE_ALIASES, key) !== undefined) problems.push(deprecated(scope, key, snake(target)));
    const value = parseTokenValue(scope, key, val, target, problems);
    if (value !== undefined) result[target] = value;
  }
  const block: ThemeBlock = { ...result, ...(status ? { status } : {}) };
  return Object.keys(block).length > 0 ? block : undefined;
}

function parseLinksBlock(raw: unknown, problems: string[]): LinkStyleOverrides | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push('`theme.links:` must be a mapping');
    return undefined;
  }
  const result: Record<string, number | number[]> = {};
  const map = raw as Record<string, unknown>;
  for (const [key, val] of Object.entries(map)) {
    if (key.startsWith('x-')) continue;
    const alias = lookup(LINK_STYLE_ALIASES, key);
    const target = alias ?? lookup(LINK_STYLE_MAP, key);
    if (!target) {
      problems.push(`unknown key "theme.links.${key}"`);
      continue;
    }
    if (alias) {
      // the first spelling listed per field is the canonical snake_case one
      const canonical = Object.keys(LINK_STYLE_MAP).find((k) => LINK_STYLE_MAP[k] === alias)!;
      problems.push(deprecated('theme.links', key, canonical));
    }
    if (target.startsWith('dash')) {
      const dash = parseDashOverride(val);
      if (dash === undefined) {
        problems.push(`theme.links.${key}: must be a px dash pattern like "9 6", got "${String(val)}"`);
        continue;
      }
      if (dash.every((n) => n < 1)) {
        problems.push(`theme.links.${key}: "${dash.join(' ')}" looks like a legacy normalized value; dashes are px now (e.g. "9 6")`);
      }
      result[target] = dash;
      continue;
    }
    const num = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val.trim()) : NaN;
    if (Number.isFinite(num) && num > 0) {
      result[target] = num;
    } else {
      problems.push(`theme.links.${key}: must be a positive number, got "${String(val)}"`);
    }
  }
  return Object.keys(result).length > 0 ? (result as LinkStyleOverrides) : undefined;
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

function parseLayout(rawLayout: unknown, problems: string[]): LayoutDefaults | undefined {
  if (rawLayout === undefined || rawLayout === null) return undefined;
  if (typeof rawLayout !== 'object' || Array.isArray(rawLayout)) {
    problems.push('`layout:` must be a mapping');
    return undefined;
  }
  const l = rawLayout as Record<string, unknown>;
  const res: LayoutDefaults = {};
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

      const rawLogo = b['logo'];
      if (typeof rawLogo === 'string') {
        const logo = inlineLogo(rawLogo, configDir, problems);
        if (logo !== undefined) parsedBrand.logo = logo;
      } else if (typeof rawLogo === 'object' && rawLogo !== null) {
        const logoMap = rawLogo as Record<string, unknown>;
        const src = str(logoMap['src'] ?? logoMap['dark']);
        if (src !== undefined) {
          const logo = inlineLogo(src, configDir, problems);
          if (logo !== undefined) parsedBrand.logo = logo;
        }
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
  const watermark = parseWatermark(root['watermark'], problems);

  return {
    ...(brand ? { brand } : {}),
    ...(theme ? { theme } : {}),
    ...(layout ? { layout } : {}),
    ...(watermark ? { watermark } : {}),
    problems,
  };
}

function parseWatermark(raw: unknown, problems: string[]): WatermarkConfig | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    problems.push('`watermark:` must be a mapping');
    return undefined;
  }
  const w = raw as Record<string, unknown>;
  const res: WatermarkConfig = {};
  if (w['enabled'] !== undefined) res.enabled = Boolean(w['enabled']);
  if (w['mode'] !== undefined) {
    const m = str(w['mode']) as WatermarkMode;
    if (WATERMARK_MODES.includes(m)) res.mode = m;
    else problems.push(`watermark.mode: unknown mode "${w['mode']}"`);
  }
  if (w['opacity'] !== undefined) {
    const op = typeof w['opacity'] === 'number' ? w['opacity'] : parseFloat(String(w['opacity']));
    if (Number.isFinite(op) && op >= 0.01 && op <= 1) res.opacity = op;
  }
  if (w['casing'] !== undefined) {
    const c = str(w['casing']) as WatermarkCasing;
    if (WATERMARK_CASINGS.includes(c)) res.casing = c;
  }
  if (w['font'] !== undefined) {
    const f = str(w['font']) as WatermarkFont;
    if (WATERMARK_FONTS.includes(f)) res.font = f;
  }
  return Object.keys(res).length > 0 ? res : undefined;
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
