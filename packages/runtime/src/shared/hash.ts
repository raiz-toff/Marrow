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
  const parts: string[] = [];
  if (state.device !== undefined) parts.push(`d=${encodeURIComponent(state.device)}`);
  if (state.camera) {
    const { x, y, k } = state.camera;
    parts.push(`c=${round(x)},${round(y)},${round(k)}`);
  }
  return parts.length > 0 ? `#${parts.join(';')}` : '';
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
  layout?: 'spacious';
}

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
  if (get('layout') === 'spacious') opts.layout = 'spacious';
  set('inspector', onOff(get('inspector')));
  set('minimap', onOff(get('minimap')));
  const theme = get('theme');
  if (theme === 'dark' || theme === 'light') opts.theme = theme;
  set('exportTitle', onOff(get('export_title') || get('title_block')));
  set('exportLegend', onOff(get('export_legend') || get('legend')));
  set('exportPorts', onOff(get('export_ports')));
  return opts;
}
