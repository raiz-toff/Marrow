/**
 * The visual language as data: one table per dimension. Everything downstream
 * — link semantics, the paint rule list, the generated stylesheet — reads these.
 */
import { STATUS_SEVERITY, type DeviceStatus } from '@marrow/model';

/** At-a-glance stroke pattern, set by the link's mode. Status dash still wins. */
export type LinkPattern = 'solid' | 'double' | 'dashed' | 'dotted' | 'thick';
/** A small glyph drawn with the midpoint chip. */
export type LinkGlyph = 'lock' | 'bundle' | 'vlan' | 'proto' | 'hop' | 'stack';

export interface LinkFields {
  mode?: string;
  vlans?: string;
  encap?: string;
  protocol?: string;
  lag?: string;
  lacp?: string;
}

export type Cap = 'butt' | 'round';

/** One paint declaration; colour/width/dash name the theme's CSS variable. */
export interface Decl {
  color?: string;
  width?: string;
  dash?: string;
  cap?: Cap;
  opacity?: number;
  /** true → flowing dashes (motion permitting); false → no flow. */
  flow?: boolean;
}

/** Sentinel for "no dash" in a Decl. */
export const NO_DASH = 'none';

// ─── statuses, in draw-rank order (alarms last → on top) ─────────────────────

export interface StatusSpec {
  readonly id: string;
  /** LED / status colour variable. */
  readonly color: string;
  /** Edge paint when the link carries this status. */
  readonly edge?: Decl;
}

export const STATUSES: readonly StatusSpec[] = [
  { id: 'up', color: '--up' },
  { id: 'unknown', color: '--unknown' },
  { id: 'planned', color: '--planned', edge: { color: '--planned', dash: '--dash-planned', cap: 'round', flow: false } },
  { id: 'degraded', color: '--degraded', edge: { color: '--degraded', dash: '--dash-degraded', flow: false } },
  { id: 'down', color: '--down', edge: { color: '--down' } },
];

/** Unknown/foreign status ids collapse to `unknown`. */
export function normalizeStatus(s: string | undefined): string {
  return s !== undefined && Object.hasOwn(STATUS_SEVERITY, s) ? s : 'unknown';
}

/** Draw rank: the reverse of severity, so alarms paint last (on top). */
export function statusRank(s: string): number {
  return STATUS_SEVERITY.up - STATUS_SEVERITY[normalizeStatus(s) as DeviceStatus];
}

// ─── speeds ──────────────────────────────────────────────────────────────────

export interface SpeedSpec {
  readonly ids: readonly string[];
  readonly width: string;
}

export const SPEEDS: readonly SpeedSpec[] = [
  { ids: ['10g', '25g'], width: '--edge-width-10g' },
  { ids: ['40g', '100g', '400g'], width: '--edge-width-40g' },
];

// ─── link modes ──────────────────────────────────────────────────────────────

const ENCAP_LABEL: Record<string, string> = {
  ipsec: 'IPsec',
  gre: 'GRE',
  vxlan: 'VXLAN',
  wireguard: 'WG',
  dmvpn: 'DMVPN',
  mpls: 'MPLS',
  l2tp: 'L2TP',
  geneve: 'Geneve',
  ssl: 'SSL',
};

const PROTO_LABEL: Record<string, string> = {
  ospf: 'OSPF',
  ebgp: 'eBGP',
  ibgp: 'iBGP',
  bgp: 'BGP',
  eigrp: 'EIGRP',
  isis: 'IS-IS',
  rip: 'RIP',
  static: 'static',
};

/** Human label for an encap id (falls back to upper-case). */
export function encapLabel(encap: string): string {
  return ENCAP_LABEL[encap] ?? encap.toUpperCase();
}

/** Human label for a routing-protocol id (falls back to upper-case). */
export function protocolLabel(protocol: string): string {
  return PROTO_LABEL[protocol] ?? protocol.toUpperCase();
}

function clampChip(s: string, max = 10): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export interface ModeSpec {
  readonly id: string;
  readonly pattern: LinkPattern;
  /** Stroke the mode adds to the edge (before flow and status). */
  readonly edge?: Decl;
  /** Draw the bg-coloured slot down the casing → two parallel rails. */
  readonly rail?: boolean;
  /** Midpoint chip text + glyph (a `lag` id overrides this). */
  readonly chip: (l: LinkFields) => readonly [string, LinkGlyph] | undefined;
  /** Inspector words. */
  readonly words: (l: LinkFields & { nativeVlan?: number }) => readonly string[];
}

export const MODES: readonly ModeSpec[] = [
  {
    id: 'access',
    pattern: 'solid',
    chip: (l) => (l.vlans !== undefined ? ['v' + clampChip(l.vlans, 8), 'vlan'] : undefined),
    words: (l) => [l.vlans !== undefined ? `access vlan ${l.vlans}` : 'access'],
  },
  {
    id: 'trunk',
    pattern: 'double',
    edge: { width: '--edge-width-trunk' },
    rail: true,
    chip: (l) => [l.vlans !== undefined ? clampChip(l.vlans) : 'trunk', 'vlan'],
    words: (l) => [
      l.vlans !== undefined ? `trunk ${l.vlans}` : 'trunk',
      ...(l.nativeVlan !== undefined ? [`native ${l.nativeVlan}`] : []),
    ],
  },
  {
    id: 'routed',
    pattern: 'solid',
    chip: (l) => (l.protocol !== undefined ? [protocolLabel(l.protocol), 'hop'] : undefined),
    words: (l) => [l.protocol !== undefined ? `routed · ${protocolLabel(l.protocol)}` : 'routed'],
  },
  {
    id: 'tunnel',
    pattern: 'dashed',
    edge: { dash: '--dash-tunnel' },
    chip: (l) => [l.encap !== undefined ? encapLabel(l.encap) : 'VPN', 'lock'],
    words: (l) => [l.encap !== undefined ? `${encapLabel(l.encap)} tunnel` : 'tunnel'],
  },
  {
    id: 'peering',
    pattern: 'dotted',
    edge: { dash: '--dash-peering', cap: 'round', opacity: 0.82 },
    chip: (l) => [l.protocol !== undefined ? protocolLabel(l.protocol) : 'peer', 'proto'],
    words: (l) => [l.protocol !== undefined ? `${protocolLabel(l.protocol)} peering` : 'peering'],
  },
  {
    id: 'stack',
    pattern: 'thick',
    edge: { width: '--edge-width-stack', cap: 'round' },
    chip: () => ['stack', 'stack'],
    words: () => ['stack'],
  },
];

const MODE_BY_ID = new Map(MODES.map((m) => [m.id, m]));

export function modeSpec(mode: string | undefined): ModeSpec | undefined {
  return mode === undefined ? undefined : MODE_BY_ID.get(mode);
}

/** Effective mode: declared, else derived from attributes (encap ⇒ tunnel). */
export function effectiveMode(l: { mode?: string; encap?: string }): string | undefined {
  return l.mode ?? (l.encap !== undefined ? 'tunnel' : undefined);
}

// ─── flow & proportions ──────────────────────────────────────────────────────

/** Seconds for one flow period. */
export const FLOW_SECONDS = 1.1;

/** Chip proportions, as fractions of the chip width (designed at 64 px). */
export const CHIP = {
  radius: 13 / 64,
  iconInset: 8 / 64,
  ledRadius: 4.2 / 64,
  ledMin: 2.5,
  ringWidth: 1.25,
  heroWidth: 1.5,
  selectedWidth: 2,
  ghostDash: [4, 3] as readonly number[],
  ghostOpacity: 0.55,
  dimOpacity: 0.15,
} as const;

/** Edge opacity states. */
export const EDGE_OPACITY = { base: 0.92, path: 1, far: 0.18, dimmed: 0.08 } as const;

/** Midpoint pills. Widths are estimated per character (deterministic). */
export const PILL = {
  label: { maxChars: 6, charW: 8, pad: 6, h: 18, fontPx: 11, textDy: 4 },
  chip: { charW: 6.3, minTextW: 5, padX: 7, glyphW: 12, h: 16, fontPx: 10.5, textDy: 3.6, belowLabel: 16 },
  badge: { charW: 7, pad: 12, minW: 17, h: 17, fontPx: 11, textDy: 4 },
} as const;

/** Polyline bend fillet radius (the chrome's --radius). */
export const BEND_RADIUS = 8;
/** Chords used to measure one quadratic fillet. */
export const FILLET_CHORDS = 8;

