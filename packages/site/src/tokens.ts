/**
 * Marrow Design Tokens — the single source of truth for all colors, dimensions,
 * and link styles across the SVG vector renderer, CSS stylesheets, and Canvas 2D engine.
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
  accentInk?: string;
  ring: string;
  zone: string;
  edge: string;
  sidebar?: string;
  sidebarFg?: string;
  sidebarAccent?: string;
  sidebarBorder?: string;
  shadow?: string;
  shadowSm?: string;
}

export interface StatusTokens {
  up: string;
  down: string;
  degraded: string;
  planned: string;
  unknown: string;
}

export interface LinkStyleTokens {
  widthDefault: number;
  width10g: number;
  width40g: number;
  widthTrunk: number;
  widthSlot: number;
  widthStack: number;
  dashTunnel: string;
  dashPeering: string;
  dashDegraded: string;
  dashPlanned: string;
}

export interface ThemeConfig {
  dark?: Partial<PaletteTokens> & { status?: Partial<StatusTokens> };
  light?: Partial<PaletteTokens> & { status?: Partial<StatusTokens> };
  links?: Partial<LinkStyleTokens>;
}

export const DEFAULT_DARK_PALETTE: PaletteTokens = {
  bg: '#09090b',
  bgRaise: '#27272a',
  panel: '#18181b',
  line: '#27272a',
  lineStrong: '#3f3f46',
  ink: '#fafafa',
  inkDim: '#a1a1aa',
  inkFaint: '#71717a',
  chip: '#18181b',
  chipLine: '#3f3f46',
  gridDot: '#1c1c1f',
  accent: '#3b82f6',
  accentInk: '#ffffff',
  ring: '#3b82f6',
  zone: '#71717a',
  edge: '#d4d4d8',
  sidebar: 'oklch(0.205 0 0)',
  sidebarFg: '#fafafa',
  sidebarAccent: 'oklch(0.269 0 0)',
  sidebarBorder: 'rgb(255 255 255 / .1)',
  shadow: '0 10px 30px -12px rgb(0 0 0 / .55), 0 4px 10px -6px rgb(0 0 0 / .45)',
  shadowSm: '0 1px 2px 0 rgb(0 0 0 / .4)',
};

export const DEFAULT_DARK_STATUS: StatusTokens = {
  up: '#22c55e',
  down: '#ef4444',
  degraded: '#f59e0b',
  planned: '#71717a',
  unknown: '#71717a',
};

export const DEFAULT_LIGHT_PALETTE: PaletteTokens = {
  bg: '#fafafa',
  bgRaise: '#f4f4f5',
  panel: '#ffffff',
  line: '#e4e4e7',
  lineStrong: '#d4d4d8',
  ink: '#18181b',
  inkDim: '#71717a',
  inkFaint: '#a1a1aa',
  chip: '#ffffff',
  chipLine: '#d4d4d8',
  gridDot: '#e4e4e7',
  accent: '#2563eb',
  accentInk: '#ffffff',
  ring: '#2563eb',
  zone: '#71717a',
  edge: '#71717a',
  sidebar: 'oklch(0.985 0 0)',
  sidebarFg: '#18181b',
  sidebarAccent: 'oklch(0.97 0 0)',
  sidebarBorder: 'oklch(0.922 0 0)',
  shadow: '0 10px 24px -8px rgb(0 0 0 / .10), 0 4px 8px -4px rgb(0 0 0 / .06)',
  shadowSm: '0 1px 2px 0 rgb(0 0 0 / .05)',
};

export const DEFAULT_LIGHT_STATUS: StatusTokens = {
  up: '#16a34a',
  down: '#dc2626',
  degraded: '#d97706',
  planned: '#a1a1aa',
  unknown: '#a1a1aa',
};

export const DEFAULT_LINK_TOKENS: LinkStyleTokens = {
  widthDefault: 1.5,
  width10g: 3,
  width40g: 4.5,
  widthTrunk: 4.5,
  widthSlot: 1.7,
  widthStack: 5,
  dashTunnel: '0.02 0.014',
  dashPeering: '0.004 0.011',
  dashDegraded: '14 7',
  dashPlanned: '2 7',
};

/**
 * Generate standard CSS custom properties for `:root` and `:root[data-theme="light"]`,
 * merging default tokens with user-supplied overrides.
 */
export function generateThemeCss(config?: ThemeConfig): string {
  const darkPal = { ...DEFAULT_DARK_PALETTE, ...config?.dark };
  const darkStat = { ...DEFAULT_DARK_STATUS, ...config?.dark?.status };
  const lightPal = { ...DEFAULT_LIGHT_PALETTE, ...config?.light };
  const lightStat = { ...DEFAULT_LIGHT_STATUS, ...config?.light?.status };
  const links = { ...DEFAULT_LINK_TOKENS, ...config?.links };

  return `:root {
  --bg: ${darkPal.bg}; --bg-raise: ${darkPal.bgRaise}; --panel: ${darkPal.panel};
  --line: ${darkPal.line}; --line-strong: ${darkPal.lineStrong};
  --ink: ${darkPal.ink}; --ink-dim: ${darkPal.inkDim}; --ink-faint: ${darkPal.inkFaint};
  --chip: ${darkPal.chip}; --chip-line: ${darkPal.chipLine}; --grid-dot: ${darkPal.gridDot};
  --m-accent: ${darkPal.accent}; --m-accent-ink: ${darkPal.accentInk ?? '#ffffff'}; --ring: ${darkPal.ring}; --zone: ${darkPal.zone};
  --up: ${darkStat.up}; --down: ${darkStat.down}; --degraded: ${darkStat.degraded}; --planned: ${darkStat.planned}; --unknown: ${darkStat.unknown};
  --edge: ${darkPal.edge};
  --edge-width-default: ${links.widthDefault}px;
  --edge-width-10g: ${links.width10g}px;
  --edge-width-40g: ${links.width40g}px;
  --edge-width-trunk: ${links.widthTrunk}px;
  --edge-width-slot: ${links.widthSlot}px;
  --edge-width-stack: ${links.widthStack}px;
  --dash-tunnel: ${links.dashTunnel};
  --dash-peering: ${links.dashPeering};
  --dash-degraded: ${links.dashDegraded};
  --dash-planned: ${links.dashPlanned};
  --sidebar: ${darkPal.sidebar}; --sidebar-fg: ${darkPal.sidebarFg};
  --sidebar-accent: ${darkPal.sidebarAccent}; --sidebar-border: ${darkPal.sidebarBorder};
  --radius-sm: 6px; --radius: 8px; --radius-lg: 12px;
  --topbar-height: 48px;
  --statusbar-height: 28px;
  --sidebar-width: 260px;
  --inspector-width: 380px;
  --inspector-offset: 0px;
  --mobile-nav-height: 56px;
  --frame-top: 52px; --frame-x: 20px; --frame-bottom: 20px; --frame-left: 20px;
  --shadow: ${darkPal.shadow};
  --shadow-sm: ${darkPal.shadowSm};
  --inspector-w: 380px;
}
:root[data-theme="light"] {
  --bg: ${lightPal.bg}; --bg-raise: ${lightPal.bgRaise}; --panel: ${lightPal.panel};
  --line: ${lightPal.line}; --line-strong: ${lightPal.lineStrong};
  --ink: ${lightPal.ink}; --ink-dim: ${lightPal.inkDim}; --ink-faint: ${lightPal.inkFaint};
  --chip: ${lightPal.chip}; --chip-line: ${lightPal.chipLine}; --grid-dot: ${lightPal.gridDot};
  --m-accent: ${lightPal.accent}; --m-accent-ink: ${lightPal.accentInk ?? '#ffffff'}; --ring: ${lightPal.ring}; --zone: ${lightPal.zone};
  --up: ${lightStat.up}; --down: ${lightStat.down}; --degraded: ${lightStat.degraded}; --planned: ${lightStat.planned}; --unknown: ${lightStat.unknown};
  --edge: ${lightPal.edge};
  --sidebar: ${lightPal.sidebar}; --sidebar-fg: ${lightPal.sidebarFg};
  --sidebar-accent: ${lightPal.sidebarAccent}; --sidebar-border: ${lightPal.sidebarBorder};
  --shadow: ${lightPal.shadow};
  --shadow-sm: ${lightPal.shadowSm};
}`;
}
