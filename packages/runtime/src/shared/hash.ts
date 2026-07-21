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
