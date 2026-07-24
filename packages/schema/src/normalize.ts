import type { Device, Link, Topology, Zone } from '@marrow/model';
import { parseEndpoint } from './endpoint.js';
import type { RawTopology } from './zodSchema.js';

/**
 * Turn a structurally + semantically valid raw document into the normalized
 * model. Only called after validation reports zero errors, so endpoint
 * parsing here cannot fail.
 */
export function rawToTopology(raw: RawTopology): Topology {
  const zones: Zone[] = raw.zones.map((z) => {
    const zone: Zone = { id: z.id, name: z.name ?? z.id, collapse: z.collapse };
    if (z.parent !== undefined) zone.parent = z.parent;
    if (z.accent !== undefined) zone.accent = z.accent;
    if (z.note !== undefined) zone.note = z.note;
    return zone;
  });

  const devices: Device[] = raw.devices.map((d) => {
    const device: Device = {
      id: d.id,
      name: d.name ?? d.id,
      icon: d.icon,
      status: d.status,
      hero: d.hero,
      interfaces: d.interfaces.map((i) => {
        const itf: Device['interfaces'][number] = { name: i.name };
        if (i.description !== undefined) itf.description = i.description;
        if (i.vlan !== undefined) itf.vlan = i.vlan;
        if (i.ip !== undefined) itf.ip = i.ip;
        return itf;
      }),
    };
    if (d.tier !== undefined) device.tier = d.tier;
    if (d.zone !== undefined) device.zone = d.zone;
    if (d.role !== undefined) device.role = d.role;
    if (d.mgmt_ip !== undefined) device.mgmtIp = d.mgmt_ip;
    if (d.ha_pair_with !== undefined) device.haPairWith = d.ha_pair_with;
    if (d.pin !== undefined) device.pin = { x: d.pin.x, y: d.pin.y };
    if (d.accent !== undefined) device.accent = d.accent;
    if (d.note !== undefined) device.note = d.note;
    if (d.config !== undefined) device.config = d.config;
    return device;
  });

  const pairCounter = new Map<string, number>();
  const links: Link[] = raw.links.map((l) => {
    const from = mustParse(l.from);
    const to = mustParse(l.to);
    const pairKey = `${from.device}--${to.device}`;
    const n = (pairCounter.get(pairKey) ?? 0) + 1;
    pairCounter.set(pairKey, n);
    const link: Link = {
      id: `${pairKey}#${n}`,
      from,
      to,
      status: l.status,
      animated: l.animated,
    };
    if (l.kind !== undefined) link.kind = l.kind;
    if (l.speed !== undefined) link.speed = l.speed;
    if (l.lag !== undefined) link.lag = l.lag;
    if (l.mode !== undefined) link.mode = l.mode;
    if (l.vlans !== undefined) link.vlans = String(l.vlans);
    if (l.native_vlan !== undefined) link.nativeVlan = l.native_vlan;
    if (l.encap !== undefined) link.encap = l.encap;
    if (l.protocol !== undefined) link.protocol = l.protocol;
    if (l.lacp !== undefined) link.lacp = l.lacp;
    if (l.label !== undefined) link.label = l.label;
    if (l.note !== undefined) link.note = l.note;
    return link;
  });

  const topology: Topology = {
    version: 2,
    name: raw.name,
    theme: raw.theme,
    zones,
    devices,
    links,
  };
  if (raw.description !== undefined) topology.description = raw.description;
  if (raw.hero !== undefined) topology.hero = raw.hero;
  return topology;
}

function mustParse(raw: string | { device: string; port?: string | undefined }): { device: string; port?: string } {
  const parsed = parseEndpoint(raw);
  if (!parsed.ok) throw new Error(`normalize called on invalid endpoint: ${parsed.reason}`);
  return parsed.endpoint;
}
