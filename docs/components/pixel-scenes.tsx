import type { CSSProperties, ReactNode } from 'react';
import { PixelArt } from './pixel-art';
import * as S from './pixel-sprites';

/* Compositions of the pixel sprites. Units are sprite pixels; every coordinate
   is a cell index, and 1-unit strokes sit on cell centres so they stay crisp. */

type Pt = readonly [number, number];
const MONO = 'var(--font-mono)';
const vars = (v: Record<string, string | number>) => v as CSSProperties;

function Cable({ pts, mode = 'plain', className }: { pts: Pt[]; mode?: S.LinkMode; className?: string }) {
  const line = (dx: number, dy: number) => pts.map(([x, y]) => `${x + 0.5 + dx},${y + 0.5 + dy}`).join(' ');
  const props = { fill: 'none', stroke: 'currentColor', strokeDasharray: S.LINK[mode], className };
  if (mode !== 'trunk') return <polyline points={line(0, 0)} {...props} />;
  const vertical = pts[0]![0] === pts[1]![0];
  return (
    <>
      <polyline points={line(vertical ? -1 : 0, vertical ? 0 : -1)} {...props} />
      <polyline points={line(vertical ? 1 : 0, vertical ? 0 : 1)} {...props} />
    </>
  );
}

/** A 1-px box with notched corners, the pixel way of rounding. */
function Box({ x, y, w, h, fill, children }: { x: number; y: number; w: number; h: number; fill: string; children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={fill} />
      <path d={`M${x + 1} ${y}h${w - 2}v1h-${w - 2}zM${x + 1} ${y + h - 1}h${w - 2}v1h-${w - 2}zM${x} ${y + 1}h1v${h - 2}h-1zM${x + w - 1} ${y + 1}h1v${h - 2}h-1z`} fill="currentColor" />
      {children}
    </g>
  );
}

function Zone({ x, y, w, h, label, pattern, bottom }: { x: number; y: number; w: number; h: number; label: string; pattern: string; bottom?: boolean }) {
  return (
    <g>
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h - 1} fill={`url(#${pattern})`} stroke="var(--color-ink-dim)" />
      <text x={x + 3} y={bottom ? y + h - 3 : y + 7} fontFamily={MONO} fontSize={4.5} fill="var(--color-ink-dim)">
        {label}
      </text>
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width={4} height={2} patternUnits="userSpaceOnUse">
        <PixelArt sprite={S.DITHER} palette={{ '#': 'var(--color-px-dot)' }} width={4} height={2} />
      </pattern>
    </defs>
  );
}

function Chip({ x, y, label, d }: { x: number; y: number; label: string; d?: number }) {
  const w = label.length * 3 + 12;
  return (
    <Box x={x} y={y} w={w} h={11} fill="var(--color-sheet)">
      <rect x={x + 3} y={y + 4} width={3} height={3} fill="var(--color-signal)" className={d === undefined ? undefined : 'px-done'} style={vars({ '--d': `${d ?? 0}s` })} />
      <text x={x + 8} y={y + 7.5} fontFamily={MONO} fontSize={5} fill="currentColor">
        {label}
      </text>
    </Box>
  );
}

const TYPED = ['devices:', '  - id: fw-01', '    tier: edge', '    zone: edge', '  - id: core-sw-01', '    tier: core'];
const CHAR_S = 0.03;

/**
 * The hero: the agent types a topology into its speech bubble; when the YAML
 * is done the devices arrive in their zones, and the tunnel starts to flow.
 */
export function HeroScene({ className }: { className?: string }) {
  let t = 0.5;
  const lines = TYPED.map((text) => {
    const d = t;
    t += text.length * CHAR_S + 0.1;
    return { text, d, n: text.length };
  });
  const done = t + 0.1;
  const pop = (i: number) => ({ className: 'px-pop', style: vars({ '--d': `${(done + i * 0.14).toFixed(2)}s` }) });
  const last = TYPED.at(-1)!;

  return (
    <svg viewBox="0 0 200 126" className={className} aria-hidden="true" shapeRendering="crispEdges">
      <defs>
        <pattern id="px-canvas" width={6} height={6} patternUnits="userSpaceOnUse">
          <rect width={1} height={1} fill="var(--color-px-dot)" />
        </pattern>
      </defs>
      <Defs id="px-dither-hero" />
      <rect width={200} height={126} fill="url(#px-canvas)" />

      {/* the agent and what it is typing */}
      <Box x={4} y={10} w={80} h={54} fill="var(--color-ink)">
        {lines.map(({ text, d, n }, i) => {
          const [, indent, key, value] = /^(\s*-?\s*)([\w-]+:)(.*)$/.exec(text)!;
          const y = 21 + i * 7;
          return (
            <g key={text}>
              <text x={10} y={y} fontFamily={MONO} fontSize={5} fill="var(--color-paper)" xmlSpace="preserve">
                {indent}
                <tspan fill="var(--color-px-shade)">{key}</tspan>
                {value}
              </text>
              <rect x={8} y={y - 6} width={n * 3 + 4} height={8} fill="var(--color-ink)" className="px-type" style={vars({ '--n': n, '--d': `${d.toFixed(2)}s` })} />
            </g>
          );
        })}
        <rect x={10 + last.length * 3 + 1} y={21 + (TYPED.length - 1) * 7 - 4} width={3} height={5} fill="var(--color-signal)" className="px-blink" />
      </Box>
      <PixelArt sprite={S.BUBBLE_TAIL} palette={{ '#': 'currentColor', k: 'var(--color-ink)' }} x={16} y={63} />
      <PixelArt sprite={S.AGENT} x={10} y={70} />
      <PixelArt sprite={S.SPARKLE} x={92} y={4} />
      <PixelArt sprite={S.SPARKLE} x={188} y={8} className="px-blink" style={{ animationDuration: '2.4s' }} />

      {/* YAML → Scene → Diagram */}
      <Chip x={4} y={100} label="YAML" />
      <Cable pts={[[29, 105], [34, 105]]} mode="peering" />
      <Chip x={35} y={100} label="Scene" d={done} />
      <Cable pts={[[62, 105], [67, 105]]} mode="peering" />
      <Chip x={68} y={100} label="Diagram" d={done + 0.9} />

      {/* the diagram it describes */}
      <Zone x={112} y={20} w={86} h={42} label="Internet Edge" pattern="px-dither-hero" bottom />
      <Zone x={112} y={66} w={86} h={56} label="Office LAN" pattern="px-dither-hero" bottom />
      <g {...pop(0)}>
        <PixelArt sprite={S.CLOUD} x={144} y={2} />
      </g>
      <g {...pop(1)}>
        <Cable pts={[[143, 6], [130, 6], [130, 33]]} mode="peering" />
        <PixelArt sprite={S.ROUTER} x={122} y={34} />
      </g>
      <g {...pop(2)}>
        <Cable pts={[[163, 6], [178, 6], [178, 34]]} mode="tunnel" className="px-flow" />
        <Cable pts={[[138, 41], [169, 41]]} />
        <PixelArt sprite={S.FIREWALL} x={170} y={35} />
      </g>
      <g {...pop(3)}>
        <Cable pts={[[178, 47], [178, 75]]} mode="trunk" />
        <PixelArt sprite={S.SWITCH} x={170} y={76} />
      </g>
      <g {...pop(4)}>
        <Cable pts={[[172, 83], [172, 90], [130, 90], [130, 96]]} />
        <PixelArt sprite={S.SERVER} x={124} y={97} />
      </g>
      <g {...pop(5)}>
        <Cable pts={[[178, 83], [178, 101]]} />
        <PixelArt sprite={S.LAPTOP} x={169} y={102} />
      </g>
    </svg>
  );
}

const TIERS: [string, number][] = [
  ['edge', 22],
  ['core', 52],
  ['access', 74],
  ['endpoint', 106],
];

/** fixtures/valid/small-office.yaml, drawn: tiers set the rank, zones the boundary. */
export function OfficeScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 118" className={className} role="img" aria-label="The ten devices of small-office.yaml: router and firewall in the Internet Edge zone on the edge tier; core switch, two access switches, an access point, two servers and two laptops in the Office LAN zone on the core, access and endpoint tiers." shapeRendering="crispEdges">
      <Defs id="px-dither-office" />
      {TIERS.map(([tier, y]) => (
        <text key={tier} x={0} y={y} fontFamily={MONO} fontSize={5} fill="var(--color-ink-dim)">
          {tier}
        </text>
      ))}
      <Zone x={34} y={2} w={132} h={30} label="Internet Edge" pattern="px-dither-office" />
      <Zone x={34} y={36} w={132} h={80} label="Office LAN" pattern="px-dither-office" />
      <Cable pts={[[76, 20], [119, 20]]} />
      <Cable pts={[[128, 26], [128, 40], [100, 40], [100, 45]]} />
      <Cable pts={[[94, 53], [94, 59], [52, 59], [52, 67]]} />
      <Cable pts={[[105, 53], [105, 59], [138, 59], [138, 67]]} />
      <Cable pts={[[97, 53], [97, 89], [88, 89], [88, 95]]} />
      <Cable pts={[[102, 53], [102, 89], [106, 89], [106, 95]]} />
      <Cable pts={[[60, 72], [66, 72]]} />
      <Cable pts={[[52, 75], [52, 97]]} />
      <Cable pts={[[138, 75], [138, 97]]} />
      <PixelArt sprite={S.ROUTER} x={60} y={13} />
      <PixelArt sprite={S.FIREWALL} x={120} y={14} />
      <PixelArt sprite={S.SWITCH} x={92} y={46} />
      <PixelArt sprite={S.SWITCH} x={44} y={68} />
      <PixelArt sprite={S.AP} x={66} y={65} />
      <PixelArt sprite={S.SWITCH} x={130} y={68} />
      <PixelArt sprite={S.LAPTOP} x={43} y={98} />
      <PixelArt sprite={S.SERVER} x={82} y={96} />
      <PixelArt sprite={S.SERVER} x={100} y={96} />
      <PixelArt sprite={S.LAPTOP} x={129} y={98} />
    </svg>
  );
}
