/**
 * Theme tokens. ONE table of rows `{ cssVar, group, key, kind, dark, light }`
 * is the only place a CSS custom-property name is spelled: the defaults, the
 * stylesheet variables (`themeVars`) and the canvas reader (`readTheme`) are
 * all folds over it, so they cannot disagree.
 */

export interface PaletteTokens {
  bg: string;
  bgRaise: string;
  panel: string;
  line: string;
  lineStrong: string;
  ink: string;
  inkDim: string;
  inkFaint: string;
  chip: string;
  chipLine: string;
  gridDot: string;
  accent: string;
  accentInk: string;
  ring: string;
  zone: string;
  edge: string;
  sidebar: string;
  sidebarFg: string;
  sidebarAccent: string;
  sidebarBorder: string;
  shadow: string;
  shadowSm: string;
}

export interface StatusTokens {
  up: string;
  down: string;
  degraded: string;
  planned: string;
  unknown: string;
}

/** Link stroke metrics. Every value is in CSS px — widths and dash runs alike. */
export interface LinkTokens {
  widthDefault: number;
  width10g: number;
  width40g: number;
  widthTrunk: number;
  widthSlot: number;
  widthStack: number;
  dashTunnel: readonly number[];
  dashPeering: readonly number[];
  dashDegraded: readonly number[];
  dashPlanned: readonly number[];
  dashFlow: readonly number[];
}

export interface Theme {
  palette: PaletteTokens;
  status: StatusTokens;
  links: LinkTokens;
}

type Kind = 'color' | 'raw' | 'px' | 'dash';
type Value = string | number | readonly number[];

/** @internal */
interface TokenRow {
  readonly cssVar: string;
  readonly group: keyof Theme;
  readonly key: string;
  readonly kind: Kind;
  readonly dark: Value;
  readonly light: Value;
}

const pal = (cssVar: string, key: keyof PaletteTokens, dark: string, light: string, kind: Kind = 'color'): TokenRow => ({
  cssVar,
  group: 'palette',
  key,
  kind,
  dark,
  light,
});
const st = (key: keyof StatusTokens, dark: string, light: string): TokenRow => ({
  cssVar: `--${key}`,
  group: 'status',
  key,
  kind: 'color',
  dark,
  light,
});
const ln = (cssVar: string, key: keyof LinkTokens, v: number | readonly number[]): TokenRow => ({
  cssVar,
  group: 'links',
  key,
  kind: typeof v === 'number' ? 'px' : 'dash',
  dark: v,
  light: v,
});

/** @internal Emission order of the theme variables. */
const TOKEN_ROWS: readonly TokenRow[] = [
  pal('--bg', 'bg', '#09090b', '#fafafa'),
  pal('--bg-raise', 'bgRaise', '#18181b', '#f4f4f5'),
  pal('--panel', 'panel', '#111113', '#ffffff'),
  pal('--line', 'line', '#27272a', '#e4e4e7'),
  pal('--line-strong', 'lineStrong', '#3f3f46', '#d4d4d8'),
  pal('--ink', 'ink', '#fafafa', '#18181b'),
  pal('--ink-dim', 'inkDim', '#a1a1aa', '#52525b'),
  pal('--ink-faint', 'inkFaint', '#71717a', '#6b6b74'),
  pal('--chip', 'chip', '#18181b', '#ffffff'),
  pal('--chip-line', 'chipLine', '#27272a', '#d4d4d8'),
  pal('--grid-dot', 'gridDot', '#1e293b', '#e4e4e7'),
  pal('--m-accent', 'accent', '#3b82f6', '#2563eb'),
  pal('--m-accent-ink', 'accentInk', '#ffffff', '#ffffff'),
  pal('--ring', 'ring', '#3b82f6', '#2563eb'),
  pal('--zone', 'zone', '#71717a', '#71717a'),
  st('up', '#22c55e', '#16a34a'),
  st('down', '#ef4444', '#dc2626'),
  st('degraded', '#f59e0b', '#d97706'),
  st('planned', '#71717a', '#a1a1aa'),
  st('unknown', '#71717a', '#a1a1aa'),
  pal('--edge', 'edge', '#d4d4d8', '#71717a'),
  ln('--edge-width-default', 'widthDefault', 1.5),
  ln('--edge-width-10g', 'width10g', 3),
  ln('--edge-width-40g', 'width40g', 4.5),
  ln('--edge-width-trunk', 'widthTrunk', 4.5),
  ln('--edge-width-slot', 'widthSlot', 1.7),
  ln('--edge-width-stack', 'widthStack', 5),
  ln('--dash-tunnel', 'dashTunnel', [9, 6]),
  ln('--dash-peering', 'dashPeering', [1.5, 5]),
  ln('--dash-degraded', 'dashDegraded', [14, 7]),
  ln('--dash-planned', 'dashPlanned', [2, 7]),
  ln('--dash-flow', 'dashFlow', [8, 6]),
  pal('--sidebar', 'sidebar', 'oklch(0.205 0 0)', 'oklch(0.985 0 0)'),
  pal('--sidebar-fg', 'sidebarFg', '#fafafa', '#18181b'),
  pal('--sidebar-accent', 'sidebarAccent', 'oklch(0.269 0 0)', 'oklch(0.97 0 0)'),
  pal('--sidebar-border', 'sidebarBorder', 'rgb(255 255 255 / .1)', 'oklch(0.922 0 0)'),
  pal(
    '--shadow',
    'shadow',
    '0 10px 30px -12px rgb(0 0 0 / .55), 0 4px 10px -6px rgb(0 0 0 / .45)',
    '0 10px 24px -8px rgb(0 0 0 / .10), 0 4px 8px -4px rgb(0 0 0 / .06)',
    'raw',
  ),
  pal('--shadow-sm', 'shadowSm', '0 1px 2px 0 rgb(0 0 0 / .4)', '0 1px 2px 0 rgb(0 0 0 / .05)', 'raw'),
];

/** @internal Derived from `links.dashFlow`: one full dash period, the flow keyframe's travel. */
export const FLOW_PERIOD_VAR = '--flow-period';

const ROW_BY_VAR = new Map(TOKEN_ROWS.map((r) => [r.cssVar, r]));

/** @internal Look up a theme value by its CSS variable name. */
export function tokenValue(t: Theme, cssVar: string): Value | undefined {
  const row = ROW_BY_VAR.get(cssVar);
  if (row === undefined) return undefined;
  return (t[row.group] as unknown as Record<string, Value>)[row.key];
}

function freeze<T>(o: T): T {
  if (o !== null && typeof o === 'object') {
    for (const v of Object.values(o as object)) freeze(v);
    Object.freeze(o);
  }
  return o;
}

function build(scheme: 'dark' | 'light'): Theme {
  const t = { palette: {}, status: {}, links: {} } as Record<keyof Theme, Record<string, Value>>;
  for (const r of TOKEN_ROWS) {
    const v = r[scheme];
    t[r.group][r.key] = Array.isArray(v) ? [...v] : v;
  }
  return t as unknown as Theme;
}

export const DEFAULT_THEMES: Readonly<{ dark: Theme; light: Theme }> = freeze({ dark: build('dark'), light: build('light') });

const num = (n: number): string => String(n);

function format(kind: Kind, v: Value): string {
  if (kind === 'px') return `${num(v as number)}px`;
  if (kind === 'dash') return (v as readonly number[]).map(num).join(' ');
  return String(v);
}

/** @internal */
export function dashPeriod(dash: readonly number[]): number {
  const sum = dash.reduce((a, b) => a + b, 0);
  return Math.round((dash.length % 2 === 1 ? sum * 2 : sum) * 100) / 100;
}

/**
 * The theme as CSS custom properties, in table order. Values are plain
 * strings ready for a declaration (`1.5px`, `9 6`, `#09090b`).
 */
export function themeVars(t: Theme): ReadonlyArray<readonly [cssVar: string, value: string]> {
  const out: Array<readonly [string, string]> = [];
  for (const r of TOKEN_ROWS) {
    const v = tokenValue(t, r.cssVar) ?? r.dark;
    out.push([r.cssVar, format(r.kind, v)]);
    if (r.key === 'dashFlow') out.push([FLOW_PERIOD_VAR, `${num(dashPeriod(v as readonly number[]))}px`]);
  }
  return out;
}

function parsePx(raw: string): number | undefined {
  const m = /^(\d*\.?\d+)(px)?$/i.exec(raw);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** @internal Parse a dash list: `9 6`, `9px 6px`, `9, 6`. */
function parseDash(raw: string): number[] | undefined {
  const parts = raw.split(/[\s,]+/).filter((s) => s !== '');
  if (parts.length === 0) return undefined;
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d*\.?\d+)(px)?$/i.exec(p);
    if (!m) return undefined;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 0) return undefined;
    out.push(n);
  }
  return out.reduce((a, b) => a + b, 0) > 0 ? out : undefined;
}

/**
 * Rebuild a Theme from CSS variables (e.g. `getComputedStyle`). DOM-free: the
 * caller supplies the getter. Any empty or malformed value falls back to the
 * matching `DEFAULT_THEMES[scheme]` entry; never throws.
 */
export function readTheme(get: (cssVar: string) => string | undefined, scheme: 'dark' | 'light'): Theme {
  const base = DEFAULT_THEMES[scheme === 'light' ? 'light' : 'dark'];
  const t = { palette: { ...base.palette }, status: { ...base.status }, links: { ...base.links } } as unknown as Record<
    keyof Theme,
    Record<string, Value>
  >;
  for (const r of TOKEN_ROWS) {
    let raw: string | undefined;
    try {
      const v = get(r.cssVar);
      raw = typeof v === 'string' ? v.trim() : undefined;
    } catch {
      raw = undefined;
    }
    if (!raw) continue;
    if (r.kind === 'px') {
      const n = parsePx(raw);
      if (n !== undefined) t[r.group][r.key] = n;
    } else if (r.kind === 'dash') {
      const d = parseDash(raw);
      if (d !== undefined) t[r.group][r.key] = d;
    } else {
      t[r.group][r.key] = raw;
    }
  }
  return t as unknown as Theme;
}
