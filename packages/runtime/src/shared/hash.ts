/** Deep-link hash (de)serialization — pure, unit-tested. Format: `#d=<id>;c=<x>,<y>,<k>` */

export interface ViewState {
  device?: string;
  camera?: { x: number; y: number; k: number };
}

export function parseHash(hash: string): ViewState {
  const state: ViewState = {};
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of body.split(';')) {
    const [key, value] = part.split('=', 2);
    if (key === 'd' && value) {
      state.device = decodeURIComponent(value);
    } else if (key === 'c' && value) {
      const [x, y, k] = value.split(',').map(Number);
      if ([x, y, k].every((n) => Number.isFinite(n)) && (k as number) > 0) {
        state.camera = { x: x as number, y: y as number, k: k as number };
      }
    }
  }
  return state;
}

export function serializeHash(state: ViewState): string {
  const parts = viewPairs(state);
  return parts.length > 0 ? `#${parts.join(';')}` : '';
}

/** The view state as hash pairs (`d=…`, `c=…`) — the only keys the runtime writes itself. */
export function viewPairs(state: ViewState): string[] {
  const parts: string[] = [];
  if (state.device !== undefined) parts.push(`d=${encodeURIComponent(state.device)}`);
  if (state.camera) {
    const { x, y, k } = state.camera;
    parts.push(`c=${round(x)},${round(y)},${round(k)}`);
  }
  return parts;
}

/** The view-state keys `viewPairs` produces. */
export const VIEW_KEYS = ['d', 'c'] as const;

function pairsOf(hash: string): string[] {
  return (hash.startsWith('#') ? hash.slice(1) : hash).split(/[;&]/).filter(Boolean);
}

function keyOf(pair: string): string {
  return pair.split('=', 1)[0]!;
}

/**
 * `hash` with every pair keyed in `replace` dropped and `add` appended; every
 * other pair (`chrome=minimal`, `minimap=off`, `theme=…`, export flags, keys
 * this version does not know) is kept, in order. How the runtime writes the
 * current view into the URL without wiping kiosk and embed flags it did not set.
 */
export function editHash(hash: string, replace: readonly string[], add: readonly string[]): string {
  const all = [...pairsOf(hash).filter((p) => !replace.includes(keyOf(p))), ...add];
  return all.length > 0 ? `#${all.join(';')}` : '';
}

/** `hash` with `pairs` set: a pair whose key is already there replaces it. */
export function withPairs(hash: string, pairs: readonly string[]): string {
  return editHash(hash, pairs.map(keyOf), pairs);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ModularUiOptions {
  chrome?: 'full' | 'minimal';
  inspector?: 'on' | 'off';
  minimap?: 'on' | 'off';
  theme?: 'dark' | 'light';
  exportTitle?: 'on' | 'off';
  exportLegend?: 'on' | 'off';
  exportPorts?: 'on' | 'off';
  controls?: 'on' | 'off';
}

/** The on/off chrome parts a URL can show or hide, by URL key = option key = root attribute. */
export const ON_OFF_PARTS = ['inspector', 'minimap', 'controls'] as const;

/** `off`/`false` → off, `on`/`true` → on, anything else → not mentioned. */
function onOff(v: string | null): 'on' | 'off' | undefined {
  return v === 'off' || v === 'false' ? 'off' : v === 'on' || v === 'true' ? 'on' : undefined;
}

/**
 * URL query + hash options (`?chrome=minimal`, `#embed=true;inspector=off`, …).
 * The query wins over the hash; hash pairs may be `;`- or `&`-separated.
 * Options the URL does not mention are absent from the result.
 */
export function parseModularParams(search: string, hash: string): ModularUiOptions {
  // URLSearchParams drops a leading '?' itself; '#' must go by hand
  const q = new URLSearchParams(search);
  const hp = new URLSearchParams((hash.startsWith('#') ? hash.slice(1) : hash).replace(/;/g, '&'));
  const get = (k: string) => q.get(k) || hp.get(k);

  const opts: ModularUiOptions = {};
  const set = <K extends keyof ModularUiOptions>(k: K, v: ModularUiOptions[K] | undefined): void => {
    if (v !== undefined) opts[k] = v;
  };
  const embed = get('embed');
  const chrome = get('chrome');
  if (embed === 'true' || embed === '1' || chrome === 'minimal') opts.chrome = 'minimal';
  else if (chrome === 'full' || embed === 'false') opts.chrome = 'full';
  for (const k of ON_OFF_PARTS) set(k, onOff(get(k)));
  const theme = get('theme');
  if (theme === 'dark' || theme === 'light') opts.theme = theme;
  set('exportTitle', onOff(get('export_title') || get('title_block')));
  set('exportLegend', onOff(get('export_legend') || get('legend')));
  set('exportPorts', onOff(get('export_ports')));
  return opts;
}

/**
 * The URL options in effect as hash pairs, normalized (`embed=true` →
 * `chrome=minimal`), so a page the viewer navigates to inside a Site boots in
 * the same embed or kiosk mode: its pre-boot script reads them back.
 */
export function modularPairs(o: ModularUiOptions): string[] {
  const pairs: string[] = [];
  if (o.chrome !== undefined) pairs.push(`chrome=${o.chrome}`);
  for (const k of ON_OFF_PARTS) if (o[k] !== undefined) pairs.push(`${k}=${o[k]}`);
  if (o.theme !== undefined) pairs.push(`theme=${o.theme}`);
  if (o.exportTitle !== undefined) pairs.push(`export_title=${o.exportTitle}`);
  if (o.exportLegend !== undefined) pairs.push(`export_legend=${o.exportLegend}`);
  if (o.exportPorts !== undefined) pairs.push(`export_ports=${o.exportPorts}`);
  return pairs;
}
