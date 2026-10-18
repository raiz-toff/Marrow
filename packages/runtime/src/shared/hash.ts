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
}

export function parseModularParams(search: string, hash: string): ModularUiOptions {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const hp = new URLSearchParams(h.includes(';') ? h.replace(/;/g, '&') : h);
  const get = (k: string) => q.get(k) || hp.get(k);

  const opts: ModularUiOptions = {};
  const embed = get('embed');
  const chrome = get('chrome');
  if (embed === 'true' || embed === '1' || chrome === 'minimal') {
    opts.chrome = 'minimal';
  } else if (chrome === 'full' || embed === 'false') {
    opts.chrome = 'full';
  }

  const inspector = get('inspector');
  if (inspector === 'off' || inspector === 'false') {
    opts.inspector = 'off';
  } else if (inspector === 'on' || inspector === 'true') {
    opts.inspector = 'on';
  }

  const minimap = get('minimap');
  if (minimap === 'off' || minimap === 'false') {
    opts.minimap = 'off';
  } else if (minimap === 'on' || minimap === 'true') {
    opts.minimap = 'on';
  }

  const theme = get('theme');
  if (theme === 'dark' || theme === 'light') {
    opts.theme = theme;
  }

  const exportTitle = get('export_title') || get('title_block');
  if (exportTitle === 'off' || exportTitle === 'false') {
    opts.exportTitle = 'off';
  } else if (exportTitle === 'on' || exportTitle === 'true') {
    opts.exportTitle = 'on';
  }

  const exportLegend = get('export_legend') || get('legend');
  if (exportLegend === 'off' || exportLegend === 'false') {
    opts.exportLegend = 'off';
  } else if (exportLegend === 'on' || exportLegend === 'true') {
    opts.exportLegend = 'on';
  }

  const exportPorts = get('export_ports');
  if (exportPorts === 'off' || exportPorts === 'false') {
    opts.exportPorts = 'off';
  } else if (exportPorts === 'on' || exportPorts === 'true') {
    opts.exportPorts = 'on';
  }

  return opts;
}
