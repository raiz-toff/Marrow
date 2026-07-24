/**
 * Link visual-language mirror.
 *
 * The canonical resolver lives in `@marrow/scene` (`linkPresentation`), used by
 * the server SVG renderer. The runtime client is deliberately decoupled from the
 * build packages, so this file mirrors that logic for the canvas tier, the
 * inspector, and the tooltips. Keep the two in sync — the shape and mode→pattern
 * mapping must match `packages/scene/src/index.ts`.
 */

export type LinkPattern = 'solid' | 'double' | 'dashed' | 'dotted' | 'thick';
export type LinkGlyph = 'lock' | 'bundle' | 'vlan' | 'proto' | 'hop' | 'stack';

export interface LinkFields {
  mode?: string;
  vlans?: string;
  encap?: string;
  protocol?: string;
  lag?: string;
  lacp?: string;
}

export interface LinkDisplay {
  mode?: string;
  pattern: LinkPattern;
  chip?: string;
  glyph?: LinkGlyph;
}

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

export function encapLabel(encap: string): string {
  return ENCAP_LABEL[encap] ?? encap.toUpperCase();
}

export function protocolLabel(protocol: string): string {
  return PROTO_LABEL[protocol] ?? protocol.toUpperCase();
}

function clampChip(s: string, max = 10): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function linkDisplay(e: LinkFields): LinkDisplay {
  const mode = e.mode ?? (e.encap !== undefined ? 'tunnel' : undefined);
  const pattern: LinkPattern =
    mode === 'trunk'
      ? 'double'
      : mode === 'tunnel'
        ? 'dashed'
        : mode === 'peering'
          ? 'dotted'
          : mode === 'stack'
            ? 'thick'
            : 'solid';

  let chip: string | undefined;
  let glyph: LinkGlyph | undefined;
  if (e.lag !== undefined) {
    chip = e.lag.toUpperCase();
    glyph = 'bundle';
  } else if (mode === 'tunnel') {
    chip = e.encap !== undefined ? encapLabel(e.encap) : 'VPN';
    glyph = 'lock';
  } else if (mode === 'trunk') {
    chip = e.vlans !== undefined ? clampChip(e.vlans) : 'trunk';
    glyph = 'vlan';
  } else if (mode === 'peering') {
    chip = e.protocol !== undefined ? protocolLabel(e.protocol) : 'peer';
    glyph = 'proto';
  } else if (mode === 'routed') {
    if (e.protocol !== undefined) {
      chip = protocolLabel(e.protocol);
      glyph = 'hop';
    }
  } else if (mode === 'stack') {
    chip = 'stack';
    glyph = 'stack';
  } else if (mode === 'access' && e.vlans !== undefined) {
    chip = 'v' + clampChip(e.vlans, 8);
    glyph = 'vlan';
  }

  const out: LinkDisplay = { pattern };
  if (mode !== undefined) out.mode = mode;
  if (chip !== undefined) out.chip = chip;
  if (glyph !== undefined) out.glyph = glyph;
  return out;
}

/** One-line human summary of a link's logical semantics for the inspector. */
export function linkSemanticsWords(l: LinkFields & { native_vlan?: number; nativeVlan?: number }): string[] {
  const words: string[] = [];
  const mode = l.mode ?? (l.encap !== undefined ? 'tunnel' : undefined);
  if (mode === 'trunk') {
    words.push(l.vlans !== undefined ? `trunk ${l.vlans}` : 'trunk');
    const nv = l.nativeVlan ?? l.native_vlan;
    if (nv !== undefined) words.push(`native ${nv}`);
  } else if (mode === 'access') {
    words.push(l.vlans !== undefined ? `access vlan ${l.vlans}` : 'access');
  } else if (mode === 'tunnel') {
    words.push(l.encap !== undefined ? `${encapLabel(l.encap)} tunnel` : 'tunnel');
  } else if (mode === 'peering') {
    words.push(l.protocol !== undefined ? `${protocolLabel(l.protocol)} peering` : 'peering');
  } else if (mode === 'routed') {
    words.push(l.protocol !== undefined ? `routed · ${protocolLabel(l.protocol)}` : 'routed');
  } else if (mode === 'stack') {
    words.push('stack');
  }
  if (l.lag !== undefined) words.push(l.lacp !== undefined ? `${l.lag} · LACP ${l.lacp}` : l.lag);
  return words;
}
