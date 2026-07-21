import type { Device, DeviceStatus, Link, LinkStatus, Topology } from '@marrow/model';

/**
 * Build-time cluster collapse (the Auvik pattern): endpoint devices that hang
 * off a single parent fold into ONE stack node per parent — "8 endpoints",
 * worst-status LED, an aggregated ×N edge. Applied when a page would
 * otherwise exceed its rendered-node budget; the members stay reachable
 * through the inspector (and the zone/device pages in site mode).
 */

const STATUS_RANK: Record<DeviceStatus, number> = { down: 0, degraded: 1, planned: 2, unknown: 3, up: 4 };

export interface CollapseOptions {
  /** Collapse only when the topology exceeds this many devices. */
  activateAbove?: number;
  /** Minimum members hanging off one parent before they fold. */
  minMembers?: number;
}

export function collapseEndpoints(t: Topology, options: CollapseOptions = {}): Topology {
  const activateAbove = options.activateAbove ?? 120;
  const minMembers = options.minMembers ?? 5;
  if (t.devices.length <= activateAbove) return t;

  // degree + sole-neighbor per device
  const neighbor = new Map<string, Set<string>>();
  for (const l of t.links) {
    if (l.from.device === l.to.device) continue;
    (neighbor.get(l.from.device) ?? neighbor.set(l.from.device, new Set()).get(l.from.device)!).add(l.to.device);
    (neighbor.get(l.to.device) ?? neighbor.set(l.to.device, new Set()).get(l.to.device)!).add(l.from.device);
  }

  // candidates: endpoint-tier devices with exactly one neighbor, grouped by it
  const groups = new Map<string, Device[]>();
  for (const d of t.devices) {
    if (d.tier !== 'endpoint' || d.hero) continue;
    const nbs = neighbor.get(d.id);
    if (!nbs || nbs.size !== 1) continue;
    const parent = [...nbs][0]!;
    (groups.get(parent) ?? groups.set(parent, []).get(parent)!).push(d);
  }

  const folded = new Map<string, Device>(); // member id → its stack node
  const stacks: Device[] = [];
  for (const [parentId, members] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (members.length < minMembers) continue;
    members.sort((a, b) => a.id.localeCompare(b.id));
    const worst = members.reduce<DeviceStatus>(
      (acc, m) => (STATUS_RANK[m.status] < STATUS_RANK[acc] ? m.status : acc),
      'up',
    );
    const icon = modalIcon(members);
    const parent = t.devices.find((d) => d.id === parentId);
    const stack: Device = {
      id: `${parentId}~endpoints`,
      name: `${members.length} endpoints`,
      icon,
      tier: 'endpoint',
      status: worst,
      hero: false,
      interfaces: [],
      stack: { members: members.map((m) => m.id), worstStatus: worst },
    };
    if (parent?.zone !== undefined) stack.zone = parent.zone;
    stacks.push(stack);
    for (const m of members) folded.set(m.id, stack);
  }
  if (stacks.length === 0) return t;

  const devices = [...t.devices.filter((d) => !folded.has(d.id)), ...stacks];

  // aggregate member links parent→stack; keep everything else as-is
  const links: Link[] = [];
  const aggregate = new Map<string, { link: Link; count: number; worst: LinkStatus }>();
  for (const l of t.links) {
    const fromStack = folded.get(l.from.device);
    const toStack = folded.get(l.to.device);
    if (!fromStack && !toStack) {
      links.push(l);
      continue;
    }
    const stack = (fromStack ?? toStack)!;
    const other = fromStack ? l.to.device : l.from.device;
    const key = `${other}--${stack.id}`;
    const existing = aggregate.get(key);
    if (existing) {
      existing.count++;
      if (STATUS_RANK[l.status] < STATUS_RANK[existing.worst]) existing.worst = l.status;
    } else {
      aggregate.set(key, {
        link: {
          id: `${key}#agg`,
          from: { device: other },
          to: { device: stack.id },
          status: l.status,
          animated: false,
        },
        count: 1,
        worst: l.status,
      });
    }
  }
  for (const [, agg] of [...aggregate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    agg.link.status = agg.worst;
    agg.link.label = `×${agg.count}`;
    links.push(agg.link);
  }

  return { ...t, devices, links };
}

function modalIcon(members: readonly Device[]): string {
  const counts = new Map<string, number>();
  for (const m of members) counts.set(m.icon, (counts.get(m.icon) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
}
