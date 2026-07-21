import type { Topology } from '@marrow/model';

/**
 * The page planner: decides whether a topology ships as ONE self-contained
 * file or as a multi-page site, and which pages the site gets. Budgets are
 * hard rules from the v2 plan — no page may carry more devices than a reader
 * (or a renderer) can handle.
 */

export interface SitePlan {
  mode: 'single' | 'site';
  /** top-level content zones, one page each */
  zonePages: Array<{ zoneId: string; devices: number }>;
  /** devices that earn a dedicated device-360 page */
  devicePages: string[];
}

export const SITE_DEVICE_THRESHOLD = 150;
export const SITE_ZONE_THRESHOLD = 5;

export function planSite(t: Topology): SitePlan {
  const zonesWithDevices = new Set(t.devices.map((d) => d.zone).filter((z) => z !== undefined));
  const site = t.devices.length > SITE_DEVICE_THRESHOLD || zonesWithDevices.size > SITE_ZONE_THRESHOLD;
  if (!site) return { mode: 'single', zonePages: [], devicePages: [] };

  const childrenOf = new Map<string, string[]>();
  for (const z of t.zones) {
    if (z.parent) (childrenOf.get(z.parent) ?? childrenOf.set(z.parent, []).get(z.parent)!).push(z.id);
  }
  const subtree = (zoneId: string, seen = new Set<string>()): string[] => {
    if (seen.has(zoneId)) return [];
    seen.add(zoneId);
    return [zoneId, ...(childrenOf.get(zoneId) ?? []).flatMap((c) => subtree(c, seen))];
  };

  const zonePages: SitePlan['zonePages'] = [];
  for (const z of [...t.zones].sort((a, b) => a.id.localeCompare(b.id))) {
    if (z.parent !== undefined) continue;
    const zoneIds = new Set(subtree(z.id));
    const devices = t.devices.filter((d) => d.zone !== undefined && zoneIds.has(d.zone)).length;
    if (devices > 0) zonePages.push({ zoneId: z.id, devices });
  }

  // device-360 pages: infrastructure tiers + anything carrying documentation
  const devicePages = t.devices
    .filter(
      (d) =>
        d.tier === 'core' ||
        d.tier === 'distribution' ||
        d.tier === 'edge' ||
        d.note !== undefined ||
        d.config !== undefined,
    )
    .map((d) => d.id)
    .sort();

  return { mode: 'site', zonePages, devicePages };
}
