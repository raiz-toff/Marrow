/* ── Marrow's own mark (shown only when marrow.config.yaml sets no brand) ─────
   A fibre with its jacket stripped back to the glass core: the core is the
   marrow. The jacket is TIA-598-C aqua, the OM3/OM4 multimode colour. Pixel
   art, so it stays crisp only at heights that are whole multiples of 9 px. */

/** TIA-598-C aqua (OM3/OM4 multimode jacket): Marrow's brand colour. */
export const FIBRE_AQUA = '#19A9B8';

// J jacket · C cladding · A lit core · L light leaving the cleaved end
const STRAND = [
  '.JJJJJJJJJ........',
  'JJJJJJJJJJ........',
  'JJJJJJJJJJCCCC....',
  'JAAAAAAAAAAAAC.L..',
  'JAAAAAAAAAAAAC.L.L',
  'JAAAAAAAAAAAAC.L..',
  'JJJJJJJJJJCCCC....',
  'JJJJJJJJJJ........',
  '.JJJJJJJJJ........',
];

// MARROW in 5×7 block letters; `#` takes the text colour.
const WORD = [
  '#...#..###..####..####...###..#...#',
  '##.##.#...#.#...#.#...#.#...#.#...#',
  '#.#.#.#...#.#...#.#...#.#...#.#...#',
  '#.#.#.#####.####..####..#...#.#.#.#',
  '#...#.#...#.#.#...#.#...#...#.#.#.#',
  '#...#.#...#.#..#..#..#..#...#.##.##',
  '#...#.#...#.#...#.#...#..###..#...#',
];

const FILL: Readonly<Record<string, string>> = {
  J: FIBRE_AQUA,
  C: '#3f3f46',
  A: '#ffffff',
  L: FIBRE_AQUA,
  '#': 'currentColor',
};

/** One rect per horizontal run of identical cells, offset by (`ox`, `oy`). */
function cells(grid: readonly string[], ox = 0, oy = 0): string {
  let out = '';
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      const c = row[x]!;
      let n = 1;
      while (row[x + n] === c) n++;
      const fill = FILL[c];
      if (fill !== undefined) out += `<rect x="${ox + x}" y="${oy + y}" width="${n}" height="1" fill="${fill}"/>`;
      x += n;
    }
  });
  return out;
}

const svg = (cols: number, height: number, body: string, a11y: string): string =>
  `<svg class="m-fibre" width="${(cols * height) / 9}" height="${height}" viewBox="0 0 ${cols} 9" shape-rendering="crispEdges" ${a11y}>${body}</svg>`;

/** The mark alone, decorative. */
export function fibreMark(height = 18): string {
  return svg(STRAND[0]!.length, height, cells(STRAND), 'aria-hidden="true"');
}

/** The mark beside the MARROW block wordmark, named for assistive technology. */
export function fibreLockup(height = 18): string {
  const gap = 4;
  const cols = STRAND[0]!.length + gap + WORD[0]!.length;
  return svg(cols, height, cells(STRAND) + cells(WORD, STRAND[0]!.length + gap, 1), 'role="img" aria-label="Marrow"');
}
