/**
 * @marrow/metrics — DETERMINISTIC text measurement. Layout must produce the
 * same pixels on every machine, so text is measured from a static per-glyph
 * advance-width table (em units), never from a platform canvas/font engine.
 * The table approximates a humanist sans (Inter-class); when the real fonts
 * are bundled in P2, this table is regenerated from the font file — the API
 * stays the same.
 */

const DEFAULT_ADVANCE = 0.6;

/** Advance widths in em for the glyphs that dominate device labels. */
const ADVANCES: Record<string, number> = {
  i: 0.24, j: 0.24, l: 0.24, '!': 0.26, '.': 0.26, ',': 0.26, "'": 0.18, '|': 0.24,
  f: 0.32, t: 0.34, r: 0.38, '(': 0.32, ')': 0.32, '[': 0.32, ']': 0.32, '-': 0.35,
  ' ': 0.28, ':': 0.28, ';': 0.28, '/': 0.32, '\\': 0.32,
  a: 0.53, c: 0.5, e: 0.53, g: 0.55, s: 0.48, z: 0.48, v: 0.5, x: 0.5, y: 0.5, k: 0.52,
  b: 0.56, d: 0.56, h: 0.56, n: 0.56, o: 0.56, p: 0.56, q: 0.56, u: 0.56,
  m: 0.85, w: 0.76,
  '0': 0.56, '1': 0.4, '2': 0.56, '3': 0.56, '4': 0.56, '5': 0.56, '6': 0.56, '7': 0.5, '8': 0.56, '9': 0.56,
  I: 0.28, J: 0.4, L: 0.46, E: 0.52, F: 0.5, T: 0.52, Z: 0.52, S: 0.55, P: 0.55, R: 0.57, B: 0.57,
  A: 0.6, C: 0.6, D: 0.62, G: 0.64, H: 0.64, K: 0.58, N: 0.64, O: 0.66, Q: 0.66, U: 0.62, V: 0.6, X: 0.58, Y: 0.56,
  M: 0.8, W: 0.9,
  '_': 0.5, '#': 0.6, '@': 0.9, '&': 0.66, '+': 0.55, '=': 0.55, '"': 0.34,
};

export interface TextSize {
  w: number;
  h: number;
}

/** Measure a single line of text at `sizePx`. Wide (CJK-class) codepoints count
 *  as 1em. `letterSpacingPx` mirrors CSS letter-spacing (added per character). */
export function measureText(text: string, sizePx: number, letterSpacingPx = 0): TextSize {
  let em = 0;
  let count = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0x2e7f) {
      em += 1; // CJK and other wide scripts
    } else {
      em += ADVANCES[ch] ?? DEFAULT_ADVANCE;
    }
    count++;
  }
  return { w: round2(em * sizePx + count * letterSpacingPx), h: round2(sizePx * 1.3) };
}

/** Measure multi-line text (widest line × line count). */
export function measureLines(lines: readonly string[], sizePx: number): TextSize {
  let w = 0;
  for (const line of lines) {
    w = Math.max(w, measureText(line, sizePx).w);
  }
  return { w, h: round2(lines.length * sizePx * 1.3) };
}

/** Truncate with an ellipsis so the text fits `maxPx` at `sizePx`. */
export function truncateToWidth(text: string, sizePx: number, maxPx: number, letterSpacingPx = 0): string {
  if (measureText(text, sizePx, letterSpacingPx).w <= maxPx) return text;
  const ell = '…';
  let out = '';
  for (const ch of graphemes(text)) {
    if (measureText(out + ch + ell, sizePx, letterSpacingPx).w > maxPx) break;
    out += ch;
  }
  return out.trimEnd() + ell;
}

/** Split into user-perceived characters so truncation never cuts an emoji
 *  ZWJ sequence or combining mark in half. */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...seg.segment(text)].map((s) => s.segment);
  }
  return [...text];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
