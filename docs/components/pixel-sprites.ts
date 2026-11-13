/**
 * Hand-authored pixel sprites for the landing page. One character per pixel;
 * `.` is transparent. Colours come from the palette below, which points at CSS
 * custom properties (global.css) so every sprite follows the light/dark theme.
 */
export type Sprite = readonly string[];
export type Palette = Readonly<Record<string, string>>;

export const PX: Palette = {
  '#': 'currentColor', // outline: the ink colour of whatever contains the sprite
  o: 'var(--color-px-fill)',
  s: 'var(--color-px-shade)',
  k: 'var(--color-px-screen)',
  b: 'var(--color-signal)',
  g: 'var(--color-px-up)',
  y: 'var(--color-px-warn)',
  // Marrow's fibre mark (same colours as packages/site/src/chrome/fibre.ts)
  J: '#19A9B8',
  C: '#3f3f46',
  A: '#ffffff',
  L: '#19A9B8',
};

/** Marrow's mark: a fibre stripped back to its glass core, light leaving the
 *  cleaved end. Same grid as packages/site/src/chrome/fibre.ts. Render at a
 *  height that is a whole multiple of 9 px. */
export const FIBRE: Sprite = [
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

/** MARROW in 5×7 block letters, in the text colour. */
export const WORDMARK: Sprite = [
  '#...#..###..####..####...###..#...#',
  '##.##.#...#.#...#.#...#.#...#.#...#',
  '#.#.#.#...#.#...#.#...#.#...#.#...#',
  '#.#.#.#####.####..####..#...#.#.#.#',
  '#...#.#...#.#.#...#.#...#...#.#.#.#',
  '#...#.#...#.#..#..#..#..#...#.##.##',
  '#...#.#...#.#...#.#...#..###..#...#',
];

/** The mark beside the wordmark, 57 × 9. */
export const LOCKUP: Sprite = FIBRE.map((row, y) => row + '....' + (WORDMARK[y - 1] ?? '.'.repeat(35)));

/** The coding agent: a terminal on two legs, prompt on its face. */
export const AGENT: Sprite = [
  '.........#..........',
  '........#b#.........',
  '.........#..........',
  '..################..',
  '.#oooooooooooooooo#.',
  '.#o##############o#.',
  '.#o#kkkkkkkkkkkk#o#.',
  '.#o#kgkkkkkkkkkk#o#.',
  '.#o#kkgkkkkkkkkk#o#.',
  '.#o#kgkkggggkkkk#o#.',
  '.#o#kkkkkkkkkkkk#o#.',
  '.#o##############o#.',
  '.#oooooooooooogoyo#.',
  '..################..',
  '.....#o#....#o#.....',
  '.....#o#....#o#.....',
  '....##o#....#o##....',
  '....####....####....',
];

export const ROUTER: Sprite = [
  '..#.........#...',
  '..#.........#...',
  '..#.........#...',
  '..#.........#...',
  '.##############.',
  '#oooooooooooooo#',
  '#oooooooooooooo#',
  '#osssssssssssso#',
  '#ogogogoyooooso#',
  '#osssssssssssso#',
  '#oooooooooooooo#',
  '.##############.',
  '..##........##..',
];

export const SWITCH: Sprite = [
  '################',
  '#oooooooooooooo#',
  '#o#o#o#o#o#o#og#',
  '#o#o#o#o#o#o#oo#',
  '#oooooooooooooo#',
  '#ssssssssssssss#',
  '################',
];

export const FIREWALL: Sprite = [
  '################',
  '#oooooo#ooooooo#',
  '#oooooo#ooooooo#',
  '################',
  '#ooo#oooooo#ooo#',
  '#ooo#oooooo#ooo#',
  '################',
  '#oooooo#ooooooo#',
  '#oooooo#ooooooo#',
  '################',
  '#ss#ssssss#sss##',
  '################',
];

export const SERVER: Sprite = [
  '.##########.',
  '#oooooooooo#',
  '#o########o#',
  '#o#ssssss#o#',
  '#o########o#',
  '#o#ssssss#o#',
  '#o########o#',
  '#oooooooooo#',
  '#oo##ooooog#',
  '#oo##oooooo#',
  '#oooooooooo#',
  '#ssssssssss#',
  '.##########.',
];

export const LAPTOP: Sprite = [
  '..##############..',
  '..#kkkkkkkkkkkk#..',
  '..#kkkkkbkkkkkk#..',
  '..#kkkkkbkkkkkk#..',
  '..#kkkbbbbbkkkk#..',
  '..#kkkbkkkbkkkk#..',
  '..#kkkkkkkkkkkk#..',
  '..##############..',
  '.#oooooooooooooo#.',
  '#ssssssssssssssss#',
  '##################',
];

export const AP: Sprite = [
  '...########...',
  '..#........#..',
  '.#..######..#.',
  '...#......#...',
  '.....####.....',
  '..............',
  '..##########..',
  '.#oooooooogo#.',
  '.############.',
];

export const CLOUD: Sprite = [
  '........#####.......',
  '......##ooooo##.....',
  '.....#ooooooooo#....',
  '..####ooooooooo###..',
  '.#ooooooooooooooos#.',
  '#ooooooooooooooooss#',
  '#oooooooooooooooss##',
  '.#sssssssssssssss#..',
  '..###############...',
];

/** A phone, a diagram on its screen. */
export const PHONE: Sprite = [
  '.##########.',
  '#oooooooooo#',
  '#oooo##oooo#',
  '#o########o#',
  '#o#kkkkkk#o#',
  '#o#kkbkkk#o#',
  '#o#kkskkk#o#',
  '#o#kbsbkk#o#',
  '#o#kkkkkk#o#',
  '#o#kgkkgk#o#',
  '#o#kkkkkk#o#',
  '#o########o#',
  '#oooooooooo#',
  '#oooo##oooo#',
  '#oooooooooo#',
  '.##########.',
];

/** A file with a folded corner and a tiny diagram on it. */
export const FILE: Sprite = [
  '########....',
  '#oooooo##...',
  '#oooooo#o#..',
  '#oooooo####.',
  '#oooooooooo#',
  '#ooo##ooooo#',
  '#ooo#booooo#',
  '#oooo#ooooo#',
  '#ooooo#oooo#',
  '#oooo#bb#oo#',
  '#oooo#bb#oo#',
  '#oooooooooo#',
  '#oooooooooo#',
  '############',
];

/** A browser window with a diagram inside: the embed. */
export const WINDOW: Sprite = [
  '##################',
  '#o#o#o#ssssssssss#',
  '##################',
  '#oooooooooooooooo#',
  '#ooooooo##ooooooo#',
  '#ooooooo#bboooooo#',
  '#oooooooo##oooooo#',
  '#ooooooo#oo#ooooo#',
  '#oooooo##oo##oooo#',
  '#oooooo#bo#bboooo#',
  '#oooooooooooooooo#',
  '##################',
];

/** Two identical files joined by an equals sign: the same bytes every build. */
const BITS: Sprite = [
  '########....',
  '#oooooo##...',
  '#oooooo#o#..',
  '#oooooo####.',
  '#oooooooooo#',
  '#o#b##b#ooo#',
  '#oooooooooo#',
  '#ob#b#b#ooo#',
  '#oooooooooo#',
  '#o##b#ooooo#',
  '#oooooooooo#',
  '############',
];
export const TWINS: Sprite = BITS.map((r, i) => r + (i === 5 || i === 7 ? '.##.' : '....') + r);

export const SPARKLE: Sprite = [
  '...#...',
  '...#...',
  '..#b#..',
  '##bbb##',
  '..#b#..',
  '...#...',
  '...#...',
];

/** The tail under a speech bubble. Its top row overlaps the bubble's border. */
export const BUBBLE_TAIL: Sprite = [
  '#kkkkk#',
  '.#kkk#.',
  '..#k#..',
  '...#...',
];

/** One tile of the zone panel's dither. */
export const DITHER: Sprite = ['#...', '..#.'];

/**
 * Link modes in pixels — the visual language's dash runs (tunnel 9/6,
 * peering 1.5/5, CSS px) divided by three; a trunk is two rails.
 */
export const LINK = {
  plain: undefined,
  trunk: undefined,
  tunnel: '3 2',
  peering: '1 2',
} as const;
export type LinkMode = keyof typeof LINK;
