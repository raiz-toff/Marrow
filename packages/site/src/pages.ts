import { byId, compareIds, TIER_RANK, worseStatus, type Device, type DeviceStatus, type Link, type LinkStatus, type Tier, type Topology } from '@marrow/model';
import type { NodeMeta } from '@marrow/layout';
import { extractSvg } from '@marrow/render-svg';
import { ATTR, hookAttr, type InventoryView } from '@marrow/runtime';
import { cssSafe, escapeHtml as esc } from '@marrow/visual';
import { modalIcon } from './collapse.js';
import type { SitePlan } from './planner.js';

/** Sub-topology builders for the multi-page site. All ids stay real device
 *  ids so deep links (`#d=`) work identically on every page. */

const RANK_TIER: Record<number, Tier> = { 0: 'edge', 1: 'core', 2: 'distribution', 3: 'access', 4: 'endpoint' };

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
  `<div class="m-rsz-v" ${hookAttr('inventory.resizeCol')} role="separator" aria-orientation="vertical" aria-label="Resize columns">` +
  '<span class="m-rsz-grip"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/>' +
  '</svg></span></div>';

const RSZ_HANDLE =
  `\n<div class="m-rsz-handle" ${hookAttr('inventory.resizeRow')} role="separator" aria-orientation="horizontal" aria-label="Resize sections">` +
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
    const worst = members.reduce<DeviceStatus>((acc, m) => worseStatus(acc, m.status), 'up');
    const minRank = Math.min(...members.map((m) => (m.tier !== undefined ? (TIER_RANK[m.tier] ?? 4) : 4)));
    const infra = members.filter((m) => m.tier === 'core' || m.tier === 'distribution' || m.tier === 'edge');
    const icon = modalIcon(infra.length > 0 ? infra : members);
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
    const [x, y] = [a, b].sort(compareIds);
    const key = `${x}--${y}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.count++;
      existing.animated ||= l.animated;
      existing.worst = worseStatus(existing.worst, l.status);
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
    .sort((a, b) => compareIds(a[0], b[0]))
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
  const symbols: string[] = [];
  const symbolOf = new Map<string, string>();
  if (iconSvg) {
    for (const id of [...new Set(t.devices.map((d) => d.icon))].sort(compareIds)) {
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
      `<tr class="m-inv-row" ${hookAttr('inventory.row')} ${ATTR.id}="${esc(d.id)}" ${ATTR.search}="${esc([d.id, d.name, d.tier, d.zone, leaf, d.mgmtIp, d.role].filter(Boolean).join(' ').toLowerCase())}">` +
      `<td><span class="m-inv-name">${iconChip(d)}<a href="${esc(href)}">${esc(d.name)}</a></span></td>` +
      `<td class="m-dim">${esc(d.id)}</td>` +
      `<td class="m-dim">${esc(d.tier ?? '')}</td>` +
      `<td class="m-dim">${esc(d.role ?? '')}</td>` +
      `<td><span class="m-inv-status m-status-${esc(d.status)}"><i></i>${esc(d.status)}</span></td>` +
      `<td class="m-dim">${esc(d.mgmtIp ?? '')}</td>` +
      `</tr>`
    );
  };
  const sortable = hookAttr('inventory.sort');
  const thead = `<thead><tr>${['name', 'id', 'tier', 'role', 'status', 'mgmt ip'].map((c) => `<th ${sortable}>${c}</th>`).join('')}</tr></thead>`;
  const table = `<table class="m-table m-inventory" ${hookAttr('inventory.table')}>`;
  const pager = (label: string): string => `<nav class="m-pagination" ${hookAttr('inventory.pager')} aria-label="${label}"></nav>`;
  const filter = `<input class="m-inv-filter" ${hookAttr('inventory.filter')} type="text" placeholder="Filter devices…" aria-label="Filter inventory">`;
  const view = (v: InventoryView, extra = ''): string => `<div class="m-inv-view${extra}" ${hookAttr('inventory.view')} ${ATTR.view}="${v}"`;
  const head = `
  <h1>Inventory</h1>
  <p class="m-dim">${t.devices.length} devices · ${t.links.length} links · click a column to sort</p>`;
  const flatTable = (): string =>
    `${table}${thead}<tbody>${[...t.devices]
      .sort(byId)
      .map(row)
      .join('\n')}</tbody></table>`;

  // no zone pages (site split by device count alone) → the classic flat table
  if (plan.zonePages.length === 0) {
    return `<div class="m-doc-inner">${sprite}${head}
  <div class="m-inv-bar">${filter}</div>
  ${view('all')}>${flatTable()}${pager('Pagination')}</div>
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
          .sort((a, b) => tierRank(a) - tierRank(b) || compareIds(a.name.toLowerCase(), b.name.toLowerCase()) || compareIds(a.name, b.name));
        const isNested = href !== undefined && key !== '' && `zones/${key}.html` !== href;
        const sub = isNested
          ? `<tr class="m-inv-sub" ${hookAttr('inventory.sub')}><td colspan="6">${esc(zoneName.get(key) ?? key)}</td></tr>`
          : '';
        return `<tbody>${sub}${devices.map(row).join('\n')}</tbody>`;
      })
      .join('\n');
    const name = href !== undefined ? `<a href="${esc(href)}">${esc(title)}</a>` : esc(title);
    return `<section class="m-inv-group" ${hookAttr('inventory.group')}>
  <header>${name}<em>${members.length} devices</em></header>
  <div class="m-inv-scroll" ${hookAttr('inventory.scroll')}>${table}${thead}${tbodies}</table></div>
  ${pager('Section pagination')}
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
      <button class="m-tab active" ${hookAttr('inventory.tab')} type="button" ${ATTR.tab}="zones" role="tab">By zone</button>
      <button class="m-tab" ${hookAttr('inventory.tab')} type="button" ${ATTR.tab}="all" role="tab">All devices</button>
    </div>
    ${filter}
  </div>
  ${view('zones', ' m-inv-cols')}>${colHtml}</div>
  ${view('all')} hidden>${flatTable()}${pager('Pagination')}</div>
</div>`;
}
