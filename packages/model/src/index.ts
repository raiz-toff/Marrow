/**
 * @marrow/model — the normalized in-memory network. This is what the schema
 * package produces and what layout, lint, and the site compiler consume.
 * Semantics here are always DECLARED by the author (agent); nothing in the
 * model is inferred from names.
 */

export type Tier = 'core' | 'distribution' | 'access' | 'edge' | 'endpoint' | 'management';
export type DeviceStatus = 'up' | 'down' | 'degraded' | 'planned' | 'unknown';
export type LinkStatus = 'up' | 'down' | 'degraded' | 'planned';
export type LinkKind = 'copper' | 'fiber' | 'dac' | 'wireless' | 'virtual' | 'wan' | 'serial';
/**
 * The link's LOGICAL function — what the cable carries — orthogonal to `kind`
 * (the physical medium). Drives the edge's symbol: access = plain line,
 * trunk = double rail, routed = L3 hop, peering = control-plane dots,
 * tunnel = overlay dash + lock, stack = backplane bar.
 */
export type LinkMode = 'access' | 'trunk' | 'routed' | 'tunnel' | 'peering' | 'stack';
/** Overlay/VPN encapsulation on a `tunnel` link. */
export type TunnelEncap = 'ipsec' | 'gre' | 'vxlan' | 'wireguard' | 'dmvpn' | 'mpls' | 'l2tp' | 'geneve' | 'ssl';
/** Routing / control-plane protocol on a `routed` or `peering` link. */
export type RoutingProtocol = 'ospf' | 'ebgp' | 'ibgp' | 'bgp' | 'eigrp' | 'isis' | 'rip' | 'static';
/** Aggregation control mode; pairs with `lag`. `on`/`static` = no protocol. */
export type LacpMode = 'active' | 'passive' | 'on' | 'static' | 'pagp';
export type LinkSpeed =
  | '10M'
  | '100M'
  | '1G'
  | '2.5G'
  | '5G'
  | '10G'
  | '25G'
  | '40G'
  | '100G'
  | '400G';
export type CollapseMode = 'auto' | 'open' | 'closed';
/** `auto` follows the viewer's OS colour scheme (and lets a host drive it). */
export type Theme = 'dark' | 'light' | 'auto';
export type Density = 'compact' | 'standard' | 'spacious';
export type WatermarkMode = 'off' | 'minimal' | 'subtle' | 'blueprint' | 'full';
export type WatermarkCasing = 'uppercase' | 'sentence' | 'as-is';
export type WatermarkFont = 'mono' | 'sans';

export interface WatermarkConfig {
  enabled?: boolean;
  mode?: WatermarkMode;
  opacity?: number;
  casing?: WatermarkCasing;
  font?: WatermarkFont;
}

export const WATERMARK_MODES: readonly WatermarkMode[] = ['off', 'minimal', 'subtle', 'blueprint', 'full'];
export const WATERMARK_CASINGS: readonly WatermarkCasing[] = ['uppercase', 'sentence', 'as-is'];
export const WATERMARK_FONTS: readonly WatermarkFont[] = ['mono', 'sans'];

export const TIERS: readonly Tier[] = ['core', 'distribution', 'access', 'edge', 'endpoint', 'management'];
export const DEVICE_STATUSES: readonly DeviceStatus[] = ['up', 'down', 'degraded', 'planned', 'unknown'];
export const LINK_STATUSES: readonly LinkStatus[] = ['up', 'down', 'degraded', 'planned'];
export const LINK_KINDS: readonly LinkKind[] = ['copper', 'fiber', 'dac', 'wireless', 'virtual', 'wan', 'serial'];
export const LINK_SPEEDS: readonly LinkSpeed[] = ['10M', '100M', '1G', '2.5G', '5G', '10G', '25G', '40G', '100G', '400G'];
export const LINK_MODES: readonly LinkMode[] = ['access', 'trunk', 'routed', 'tunnel', 'peering', 'stack'];
export const TUNNEL_ENCAPS: readonly TunnelEncap[] = ['ipsec', 'gre', 'vxlan', 'wireguard', 'dmvpn', 'mpls', 'l2tp', 'geneve', 'ssl'];
export const ROUTING_PROTOCOLS: readonly RoutingProtocol[] = ['ospf', 'ebgp', 'ibgp', 'bgp', 'eigrp', 'isis', 'rip', 'static'];
export const LACP_MODES: readonly LacpMode[] = ['active', 'passive', 'on', 'static', 'pagp'];
export const COLLAPSE_MODES: readonly CollapseMode[] = ['auto', 'open', 'closed'];
export const THEMES: readonly Theme[] = ['dark', 'light', 'auto'];
export const DENSITIES: readonly Density[] = ['compact', 'standard', 'spacious'];

export interface Zone {
  id: string;
  name: string;
  parent?: string;
  collapse: CollapseMode;
  accent?: string;
  note?: string;
}

export interface Endpoint {
  device: string;
  port?: string;
}

export interface Link {
  /** Stable synthetic id: `<from>--<to>#<n>` in declaration order. */
  id: string;
  from: Endpoint;
  to: Endpoint;
  kind?: LinkKind;
  speed?: LinkSpeed;
  /** Links sharing a lag id between the same device pair render bundled. */
  lag?: string;
  /** Logical function (access/trunk/routed/tunnel/peering/stack) — drives the symbol. */
  mode?: LinkMode;
  /** VLANs carried (trunk) or the access VLAN — free-form set/range, e.g. "10,20,30-39". */
  vlans?: string;
  /** Native (untagged) VLAN on a trunk. */
  nativeVlan?: number;
  /** Overlay/VPN encapsulation — marks the link as a tunnel. */
  encap?: TunnelEncap;
  /** Routing / control-plane protocol on a routed or peering link. */
  protocol?: RoutingProtocol;
  /** Aggregation control mode; pairs with `lag`. */
  lacp?: LacpMode;
  status: LinkStatus;
  animated: boolean;
  label?: string;
  note?: string;
  customFields?: CustomFieldMap;
  sections?: CustomSectionMap;
}

export type CustomFieldValue = string | number | boolean;
export type CustomFieldMap = Record<string, CustomFieldValue>;
export type CustomSectionContent =
  | string
  | Record<string, CustomFieldValue>
  | Array<Record<string, CustomFieldValue>>;
export type CustomSectionMap = Record<string, CustomSectionContent>;

export interface DeviceInterface {
  name: string;
  description?: string;
  vlan?: number;
  ip?: string;
}

export interface Device {
  id: string;
  name: string;
  icon: string;
  tier?: Tier;
  zone?: string;
  role?: string;
  status: DeviceStatus;
  mgmtIp?: string;
  haPairWith?: string;
  hero: boolean;
  pin?: { x: number; y: number };
  accent?: string;
  note?: string;
  config?: string;
  interfaces: DeviceInterface[];
  customFields?: CustomFieldMap;
  sections?: CustomSectionMap;
  /** Synthetic collapse artifacts (never authored): the members this node stands in for. */
  stack?: { members: string[]; worstStatus: DeviceStatus };
}

export interface TitleBlock {
  title?: string;
  author?: string;
  date?: string;
  revision?: string;
  logo?: string;
}

export interface InspectorTabConfig {
  id: string;
  label: string;
  target?: 'device' | 'edge' | 'both';
  field?: string;
  fields?: string[];
  template?: string;
}

export interface InspectorConfig {
  tabs?: InspectorTabConfig[];
}

export interface Topology {
  version: 2;
  name: string;
  description?: string;
  theme: Theme;
  density?: Density;
  scale?: number;
  hero?: string;
  author?: string;
  revision?: string;
  date?: string;
  about?: unknown;
  watermark?: WatermarkConfig;
  titleBlock?: TitleBlock;
  inspector?: InspectorConfig;
  zones: Zone[];
  devices: Device[];
  links: Link[];
}

export interface TopologyIndex {
  deviceById: ReadonlyMap<string, Device>;
  zoneById: ReadonlyMap<string, Zone>;
  linksByDevice: ReadonlyMap<string, readonly Link[]>;
  devicesByZone: ReadonlyMap<string, readonly Device[]>;
}

export function indexTopology(t: Topology): TopologyIndex {
  const deviceById = new Map<string, Device>();
  for (const d of t.devices) deviceById.set(d.id, d);
  const zoneById = new Map<string, Zone>();
  for (const z of t.zones) zoneById.set(z.id, z);
  const linksByDevice = new Map<string, Link[]>();
  for (const l of t.links) {
    for (const id of [l.from.device, l.to.device]) {
      const arr = linksByDevice.get(id);
      if (arr) arr.push(l);
      else linksByDevice.set(id, [l]);
    }
  }
  const devicesByZone = new Map<string, Device[]>();
  for (const d of t.devices) {
    if (!d.zone) continue;
    const arr = devicesByZone.get(d.zone);
    if (arr) arr.push(d);
    else devicesByZone.set(d.zone, [d]);
  }
  return { deviceById, zoneById, linksByDevice, devicesByZone };
}

/** Distinct neighbor device ids, in first-link order. */
export function neighborsOf(idx: TopologyIndex, deviceId: string): string[] {
  const links = idx.linksByDevice.get(deviceId) ?? [];
  const seen = new Set<string>();
  for (const l of links) {
    const other = l.from.device === deviceId ? l.to.device : l.from.device;
    if (other !== deviceId) seen.add(other);
  }
  return [...seen];
}
