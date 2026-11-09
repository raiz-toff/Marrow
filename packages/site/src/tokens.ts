/**
 * Theme overrides from `marrow.config.yaml`, merged onto the visual language's
 * default themes and printed as CSS custom properties. The token table itself
 * — names, defaults, units — lives in @marrow/visual (`themeVars`), the only
 * place a theme variable is spelled; this module only merges and prints.
 */
import { DEFAULT_THEMES, themeVars, type LinkTokens, type PaletteTokens, type StatusTokens, type Theme } from '@marrow/visual';

export type { PaletteTokens, StatusTokens };
/** Link stroke metrics, all in px. */
export type LinkStyleTokens = LinkTokens;

/** A link override: widths are px numbers; dashes are px lists (`"9 6"` or `[9, 6]`). */
export type LinkStyleOverrides = {
  [K in keyof LinkTokens]?: LinkTokens[K] extends number ? number : string | readonly number[];
};

export interface ThemeConfig {
  /** Palette keys, plus status colours either nested under `status` or flat (`up: …`). */
  dark?: Partial<PaletteTokens> & Partial<StatusTokens> & { status?: Partial<StatusTokens> };
  light?: Partial<PaletteTokens> & Partial<StatusTokens> & { status?: Partial<StatusTokens> };
  links?: LinkStyleOverrides;
}

export const DEFAULT_DARK_PALETTE: PaletteTokens = DEFAULT_THEMES.dark.palette;
export const DEFAULT_DARK_STATUS: StatusTokens = DEFAULT_THEMES.dark.status;
export const DEFAULT_LIGHT_PALETTE: PaletteTokens = DEFAULT_THEMES.light.palette;
export const DEFAULT_LIGHT_STATUS: StatusTokens = DEFAULT_THEMES.light.status;
export const DEFAULT_LINK_TOKENS: LinkStyleTokens = DEFAULT_THEMES.dark.links;

/** Parse a px dash override: `"9 6"`, `"9px, 6px"` or `[9, 6]`. */
export function parseDashOverride(v: unknown): number[] | undefined {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.trim().split(/[\s,]+/) : typeof v === 'number' ? [v] : [];
  if (parts.length === 0) return undefined;
  const out: number[] = [];
  for (const p of parts) {
    const n = typeof p === 'number' ? p : typeof p === 'string' ? Number(p.replace(/px$/i, '')) : NaN;
    if (!Number.isFinite(n) || n < 0) return undefined;
    out.push(n);
  }
  return out.reduce((a, b) => a + b, 0) > 0 ? out : undefined;
}

function pick<T extends object>(defaults: T, ...sources: Array<object | undefined>): T {
  const out = { ...defaults } as Record<string, unknown>;
  for (const src of sources) {
    if (!src) continue;
    for (const [k, v] of Object.entries(src)) {
      if (k in defaults && typeof v === 'string' && v.trim() !== '') out[k] = v.trim();
    }
  }
  return out as T;
}

function mergeLinks(base: LinkTokens, o: LinkStyleOverrides | undefined): LinkTokens {
  const out = { ...base } as Record<string, number | readonly number[]>;
  for (const [k, v] of Object.entries(o ?? {})) {
    const cur = out[k];
    if (typeof cur === 'number') {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    } else if (cur !== undefined) {
      const d = parseDashOverride(v);
      if (d !== undefined) out[k] = d;
    }
  }
  return out as unknown as LinkTokens;
}

/** Merge user overrides onto a default theme. */
export function mergeTheme(scheme: 'dark' | 'light', config?: ThemeConfig): Theme {
  const base = DEFAULT_THEMES[scheme];
  const block = config?.[scheme];
  return {
    palette: pick(base.palette, block),
    status: pick(base.status, block, block?.status),
    links: mergeLinks(base.links, config?.links),
  };
}

/**
 * CSS custom properties for `:root` (dark) and `:root[data-theme="light"]`
 * (only the values that differ from dark), with user overrides merged in.
 */
export function generateThemeCss(config?: ThemeConfig): string {
  const dark = themeVars(mergeTheme('dark', config));
  const darkMap = new Map(dark);
  const light = themeVars(mergeTheme('light', config)).filter(([k, v]) => darkMap.get(k) !== v);
  const block = (vars: ReadonlyArray<readonly [string, string]>): string => vars.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `:root {\n${block(dark)}\n}\n:root[data-theme="light"] {\n${block(light)}\n}`;
}
