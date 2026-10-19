import type { Device, DeviceStatus, Link, LinkStatus, Tier, Topology } from '@marrow/model';
import type { NodeMeta } from '@marrow/layout';
import { extractSvg } from '@marrow/render-svg';
import type { SitePlan } from './planner.js';
import { esc } from './shell.js';

/** Sub-topology builders for the multi-page site. All ids stay real device
 *  ids so deep links (`#d=`) work identically on every page. */

const STATUS_RANK: Record<DeviceStatus, number> = { down: 0, degraded: 1, planned: 2, unknown: 3, up: 4 };
const RANK_TIER: Record<number, Tier> = { 0: 'edge', 1: 'core', 2: 'distribution', 3: 'access', 4: 'endpoint' };
const TIER_RANK: Record<string, number> = { edge: 0, core: 1, distribution: 2, access: 3, endpoint: 4, management: 4 };

export interface PageTopo {
  topology: Topology;
  nodeMeta: Map<string, NodeMeta>;
}

export interface ZoneIndex {
  /** top-level content zone per device id */
  topZoneOf: Map<string, string>;
  subtreeOf: Map<string, Set<string>>;
}

export function indexZones(t: Topology, plan: SitePlan): ZoneIndex {
  const childrenOf = new Map<string, string[]>();
  for (const z of t.zones) {
    if (z.parent) (childrenOf.get(z.parent) ?? childrenOf.set(z.parent, []).get(z.parent)!).push(z.id);
  }
  const subtreeOf = new Map<string, Set<string>>();
  const collect = (zoneId: string, seen: Set<string>): void => {
    if (seen.has(zoneId)) return;
    seen.add(zoneId);
    for (const c of childrenOf.get(zoneId) ?? []) collect(c, seen);
  };
  for (const page of plan.zonePages) {
    const seen = new Set<string>();
    collect(page.zoneId, seen);
    subtreeOf.set(page.zoneId, seen);
  }
  const topZoneOf = new Map<string, string>();
  for (const d of t.devices) {
    if (d.zone === undefined) continue;
    for (const [top, subtree] of subtreeOf) {
      if (subtree.has(d.zone)) {
        topZoneOf.set(d.id, top);
        break;
      }
    }
  }
  return { topZoneOf, subtreeOf };
}

/** shadcn ResizableHandle (withHandle): a divider between zone panels — dragging
 *  trades viewport height between the sections above and below it. */
const RSZ_V_HANDLE =
  '<div class="m-rsz-v" role="separator" aria-orientation="vertical" aria-label="Resize columns">' +
  '<span class="m-rsz-grip"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/>' +
  '</svg></span></div>';

const RSZ_HANDLE =
  '\n<div class="m-rsz-handle" role="separator" aria-orientation="horizontal" aria-label="Resize sections">' +
  '<span class="m-rsz-grip"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/>' +
  '</svg></span></div>\n';

/** Where a device's canonical page lives (device-360 page wins over zone page). */
export function pageOf(deviceId: string, plan: SitePlan, zi: ZoneIndex): string {
  if (plan.devicePages.includes(deviceId)) return `devices/${deviceId}.html`;
  const top = zi.topZoneOf.get(deviceId);
  return top !== undefined ? `zones/${top}.html` : 'index.html';
}

/** The hero overview: one aggregate node per top-level zone, ×N trunk edges. */
export function overviewTopology(t: Topology, plan: SitePlan, zi: ZoneIndex): PageTopo {
  const nodeMeta = new Map<string, NodeMeta>();
  const zoneMeta = new Map(t.zones.map((z) => [z.id, z]));
  const devices: Device[] = plan.zonePages.map((page) => {
    const members = t.devices.filter((d) => zi.topZoneOf.get(d.id) === page.zoneId);
    const worst = members.reduce<DeviceStatus>(
      (acc, m) => (STATUS_RANK[m.status] < STATUS_RANK[acc] ? m.status : acc),
      'up',
    );
    const minRank = Math.min(...members.map((m) => (m.tier !== undefined ? (TIER_RANK[m.tier] ?? 4) : 4)));
    const icon = representativeIcon(members);
    const meta = zoneMeta.get(page.zoneId);
    nodeMeta.set(page.zoneId, { href: `zones/${page.zoneId}.html`, badge: String(members.length) });
    const device: Device = {
      id: page.zoneId,
      name: meta?.name ?? page.zoneId,
      icon,
      tier: RANK_TIER[minRank] ?? 'endpoint',
      status: worst,
      hero: false,
      interfaces: [],
    };
    if (meta?.accent !== undefined) device.accent = meta.accent;
    return device;
  });

  const aggregates = new Map<string, { link: Link; count: number; worst: LinkStatus; animated: boolean }>();
  for (const l of t.links) {
    const a = zi.topZoneOf.get(l.from.device);
    const b = zi.topZoneOf.get(l.to.device);
    if (a === undefined || b === undefined || a === b) continue;
    const [x, y] = [a, b].sort();
    const key = `${x}--${y}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.count++;
      existing.animated ||= l.animated;
      if (STATUS_RANK[l.status] < STATUS_RANK[existing.worst]) existing.worst = l.status;
    } else {
      aggregates.set(key, {
        link: { id: `${key}#trunk`, from: { device: x! }, to: { device: y! }, status: l.status, animated: l.animated },
        count: 1,
        worst: l.status,
        animated: l.animated,
      });
    }
  }
  const links: Link[] = [...aggregates.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, agg]) => {
      const link: Link = { ...agg.link, status: agg.worst, animated: agg.animated };
      if (agg.count > 1) link.label = `×${agg.count}`;
      return link;
    });

  return {
    topology: {
      version: 2,
      name: t.name,
      theme: t.theme,
      ...(t.density ? { density: t.density } : {}),
      ...(t.scale !== undefined ? { scale: t.scale } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.author ? { author: t.author } : {}),
      ...(t.revision ? { revision: t.revision } : {}),
      ...(t.date ? { date: t.date } : {}),
      ...(t.about !== undefined ? { about: t.about } : {}),
      zones: [],
      devices,
      links,
    },
    nodeMeta,
  };
}

/** A zone page: the zone's subtree + ghost "door" stubs grouped by neighbor zone. */
export function zoneTopology(t: Topology, zoneId: string, plan: SitePlan, zi: ZoneIndex): PageTopo {
  const subtree = zi.subtreeOf.get(zoneId) ?? new Set([zoneId]);
  const inside = t.devices.filter((d) => d.zone !== undefined && subtree.has(d.zone));
  const insideIds = new Set(inside.map((d) => d.id));
  const nodeMeta = new Map<string, NodeMeta>();
  const zoneMeta = new Map(t.zones.map((z) => [z.id, z]));

  const ghosts: Device[] = [];
  const ghostZones = new Map<string, string>(); // ghost zone id → source top zone
  const links: Link[] = [];
  for (const l of t.links) {
    const fromIn = insideIds.has(l.from.device);
    const toIn = insideIds.has(l.to.device);
    if (!fromIn && !toIn) continue;
    if (fromIn && toIn) {
      links.push(l);
      continue;
    }
    const outsideId = fromIn ? l.to.device : l.from.device;
    const outside = t.devices.find((d) => d.id === outsideId);
    if (!outside) continue;
    if (!ghosts.some((g) => g.id === outsideId)) {
      const top = zi.topZoneOf.get(outsideId);
      const ghostZone = top !== undefined ? `door-${top}` : undefined;
      if (top !== undefined && ghostZone !== undefined && !ghostZones.has(ghostZone)) {
        ghostZones.set(ghostZone, top);
      }
      const ghost: Device = {
        id: outside.id,
        name: outside.name,
        icon: outside.icon,
        status: outside.status,
        hero: false,
        interfaces: [],
      };
      if (outside.tier !== undefined) ghost.tier = outside.tier;
      if (ghostZone !== undefined) ghost.zone = ghostZone;
      ghosts.push(ghost);
      nodeMeta.set(outside.id, { ghost: true, href: pageOf(outsideId, plan, zi) + `#d=${encodeURIComponent(outsideId)}` });
    }
    links.push(l);
  }

  const zones = [
    ...t.zones.filter((z) => subtree.has(z.id)).map((z) => (z.parent !== undefined && subtree.has(z.parent) ? z : { ...z, parent: undefined })),
    ...[...ghostZones.entries()].map(([ghostZone, top]) => {
      const meta = zoneMeta.get(top);
      return {
        id: ghostZone,
        name: `⇢ ${meta?.name ?? top}`,
        collapse: 'auto' as const,
        ...(meta?.accent !== undefined ? { accent: meta.accent } : {}),
      };
    }),
  ];

  return {
    topology: {
      version: 2,
      name: t.name,
      theme: t.theme,
      ...(t.density ? { density: t.density } : {}),
      ...(t.scale !== undefined ? { scale: t.scale } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.author ? { author: t.author } : {}),
      ...(t.revision ? { revision: t.revision } : {}),
      ...(t.date ? { date: t.date } : {}),
      ...(t.about !== undefined ? { about: t.about } : {}),
      zones,
      devices: [...inside, ...ghosts],
      links,
    },
    nodeMeta,
  };
}

/** A device-360 page: the device + its 1-hop neighborhood as door stubs. */
export function deviceTopology(t: Topology, deviceId: string, plan: SitePlan, zi: ZoneIndex): PageTopo {
  const device = t.devices.find((d) => d.id === deviceId);
  if (!device) throw new Error(`no such device: ${deviceId}`);
  const nodeMeta = new Map<string, NodeMeta>();
  const neighbors: Device[] = [];
  const links: Link[] = [];
  for (const l of t.links) {
    let other: string | undefined;
    if (l.from.device === deviceId) other = l.to.device;
    else if (l.to.device === deviceId) other = l.from.device;
    if (other === undefined || other === deviceId) continue;
    const outside = t.devices.find((d) => d.id === other);
    if (!outside) continue;
    if (!neighbors.some((n) => n.id === other)) {
      const ghost: Device = {
        id: outside.id,
        name: outside.name,
        icon: outside.icon,
        status: outside.status,
        hero: false,
        interfaces: [],
      };
      if (outside.tier !== undefined) ghost.tier = outside.tier;
      neighbors.push(ghost);
      nodeMeta.set(other, { ghost: true, href: pageOf(other, plan, zi) + `#d=${encodeURIComponent(other)}` });
    }
    links.push(l);
  }
  const hero: Device = { ...device, zone: undefined as never, hero: true };
  delete (hero as { zone?: string }).zone;
  return {
    topology: {
      version: 2,
      name: t.name,
      theme: t.theme,
      ...(t.density ? { density: t.density } : {}),
      ...(t.scale !== undefined ? { scale: t.scale } : {}),
      ...(t.description ? { description: t.description } : {}),
      ...(t.author ? { author: t.author } : {}),
      ...(t.revision ? { revision: t.revision } : {}),
      ...(t.date ? { date: t.date } : {}),
      ...(t.about !== undefined ? { about: t.about } : {}),
      zones: [],
      devices: [hero, ...neighbors],
      links,
    },
    nodeMeta,
  };
}

/**
 * The inventory page body, organized as a hierarchy: one card per top-level
 * zone (linked to its page), nested zones as sub-headers inside it, devices
 * ordered by tier. Filter + per-column sort stay client-side; sorting works
 * WITHIN each zone bucket so the hierarchy survives it.
 */
export function inventoryBody(
  t: Topology,
  plan: SitePlan,
  zi: ZoneIndex,
  iconSvg?: (id: string) => string | undefined,
): string {
  const zoneName = new Map(t.zones.map((z) => [z.id, z.name]));
  const zoneOrder = new Map(t.zones.map((z, i) => [z.id, i]));
  const tierRank = (d: Device): number => (d.tier !== undefined ? (TIER_RANK[d.tier] ?? 9) : 9);

  // subset sprite of the icons this inventory actually uses, referenced per
  // row via <use> — one copy per icon, not one per device
  const cssSafe = (v: string): string => v.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const symbols: string[] = [];
  const symbolOf = new Map<string, string>();
  if (iconSvg) {
    for (const id of [...new Set(t.devices.map((d) => d.icon))].sort()) {
      const raw = iconSvg(id);
      const extracted = raw !== undefined ? extractSvg(raw) : undefined;
      if (!extracted) continue;
      const sid = `ic-${cssSafe(id)}`;
      symbols.push(`<symbol id="${sid}" viewBox="${esc(extracted.viewBox)}">${extracted.inner}</symbol>`);
      symbolOf.set(id, sid);
    }
  }
  const sprite = symbols.length > 0 ? `<svg class="m-sprite" width="0" height="0" aria-hidden="true"><defs>${symbols.join('\n')}</defs></svg>` : '';
  const iconChip = (d: Device): string => {
    const sid = symbolOf.get(d.icon);
    return `<span class="m-inv-ic">${sid !== undefined ? `<svg aria-hidden="true"><use href="#${sid}"/></svg>` : ''}</span>`;
  };

  const row = (d: Device): string => {
    const href = `${pageOf(d.id, plan, zi)}#d=${encodeURIComponent(d.id)}`;
    const leaf = d.zone !== undefined ? (zoneName.get(d.zone) ?? d.zone) : '';
    return (
      `<tr class="m-inv-row" data-id="${esc(d.id)}" data-search="${esc([d.id, d.name, d.tier, d.zone, leaf, d.mgmtIp, d.role].filter(Boolean).join(' ').toLowerCase())}">` +
      `<td><span class="m-inv-name">${iconChip(d)}<a href="${esc(href)}">${esc(d.name)}</a></span></td>` +
      `<td class="m-dim">${esc(d.id)}</td>` +
      `<td class="m-dim">${esc(d.tier ?? '')}</td>` +
      `<td class="m-dim">${esc(d.role ?? '')}</td>` +
      `<td><span class="m-inv-status m-status-${esc(d.status)}"><i></i>${esc(d.status)}</span></td>` +
      `<td class="m-dim">${esc(d.mgmtIp ?? '')}</td>` +
      `</tr>`
    );
  };
  const thead = `<thead><tr><th data-sort>name</th><th data-sort>id</th><th data-sort>tier</th><th data-sort>role</th><th data-sort>status</th><th data-sort>mgmt ip</th></tr></thead>`;
  const head = `
  <h1>Inventory</h1>
  <p class="m-dim">${t.devices.length} devices · ${t.links.length} links · click a column to sort</p>`;
  const flatTable = (): string =>
    `<table class="m-table m-inventory">${thead}<tbody>${[...t.devices]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(row)
      .join('\n')}</tbody></table>`;

  // no zone pages (site split by device count alone) → the classic flat table
  if (plan.zonePages.length === 0) {
    return `<div class="m-doc-inner">${sprite}${head}
  <div class="m-inv-bar"><input class="m-inv-filter" type="text" placeholder="Filter devices…" aria-label="Filter inventory"></div>
  <div class="m-inv-view" data-view="all">${flatTable()}<nav class="m-pagination" aria-label="Pagination"></nav></div>
</div>`;
  }

  const section = (title: string, href: string | undefined, members: Device[]): string => {
    // bucket by leaf zone: the top zone's own devices first, nested zones after,
    // in declaration order; devices sort by tier rank then name inside a bucket
    const buckets = new Map<string, Device[]>();
    for (const d of members) {
      const key = d.zone ?? '';
      (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(d);
    }
    const orderedKeys = [...buckets.keys()].sort((a, b) => (zoneOrder.get(a) ?? -1) - (zoneOrder.get(b) ?? -1));
    const tbodies = orderedKeys
      .map((key) => {
        const devices = buckets
          .get(key)!
          .sort((a, b) => tierRank(a) - tierRank(b) || a.name.localeCompare(b.name));
        const isNested = href !== undefined && key !== '' && `zones/${key}.html` !== href;
        const sub = isNested
          ? `<tr class="m-inv-sub"><td colspan="6">${esc(zoneName.get(key) ?? key)}</td></tr>`
          : '';
        return `<tbody>${sub}${devices.map(row).join('\n')}</tbody>`;
      })
      .join('\n');
    const name = href !== undefined ? `<a href="${esc(href)}">${esc(title)}</a>` : esc(title);
    return `<section class="m-inv-group">
  <header>${name}<em>${members.length} devices</em></header>
  <div class="m-inv-scroll"><table class="m-table m-inventory">${thead}${tbodies}</table></div>
  <nav class="m-pagination" aria-label="Section pagination"></nav>
</section>`;
  };

  const orderedPages = [...plan.zonePages].sort(
    (a, b) => (zoneOrder.get(a.zoneId) ?? 0) - (zoneOrder.get(b.zoneId) ?? 0),
  );
  const sections = orderedPages.map((page) =>
    section(
      zoneName.get(page.zoneId) ?? page.zoneId,
      `zones/${page.zoneId}.html`,
      t.devices.filter((d) => zi.topZoneOf.get(d.id) === page.zoneId),
    ),
  );
  const unzoned = t.devices.filter((d) => zi.topZoneOf.get(d.id) === undefined);
  if (unzoned.length > 0) sections.push(section('No zone', undefined, unzoned));

  // shadcn Tabs switch the hierarchy view against the classic flat list.
  // Zones lay out as a ResizablePanelGroup: side-by-side columns split by
  // vertical handles, sections within a column split by horizontal ones.
  const COLS = Math.min(3, sections.length);
  const cols: string[][] = Array.from({ length: COLS }, () => []);
  sections.forEach((sec, i) => cols[i % COLS]!.push(sec));
  const colHtml = cols.map((c) => `<div class="m-inv-col">${c.join(RSZ_HANDLE)}</div>`).join(RSZ_V_HANDLE);
  return `<div class="m-doc-inner">${sprite}${head}
  <div class="m-inv-bar">
    <div class="m-tabs m-inv-tabs" role="tablist">
      <button class="m-tab active" type="button" data-tab="zones" role="tab">By zone</button>
      <button class="m-tab" type="button" data-tab="all" role="tab">All devices</button>
    </div>
    <input class="m-inv-filter" type="text" placeholder="Filter devices…" aria-label="Filter inventory">
  </div>
  <div class="m-inv-view m-inv-cols" data-view="zones">${colHtml}</div>
  <div class="m-inv-view" data-view="all" hidden>${flatTable()}<nav class="m-pagination" aria-label="Pagination"></nav></div>
</div>`;
}

function representativeIcon(members: readonly Device[]): string {
  const infra = members.filter((m) => m.tier === 'core' || m.tier === 'distribution' || m.tier === 'edge');
  const pool = infra.length > 0 ? infra : members;
  const counts = new Map<string, number>();
  for (const m of pool) counts.set(m.icon, (counts.get(m.icon) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'cisco/misc/generic';
}
