/** The JSON payload the site compiler embeds in every page. */

export interface DataInterface {
  name: string;
  description?: string;
  vlan?: number;
  ip?: string;
}

export interface DataDevice {
  id: string;
  name: string;
  icon: string;
  tier?: string;
  zone?: string;
  role?: string;
  status: string;
  mgmtIp?: string;
  haPairWith?: string;
  note?: string;
  config?: string;
  interfaces: DataInterface[];
  /** Present on collapse stand-ins: the device ids this node represents. */
  stack?: { members: string[]; worstStatus: string };
}

export interface DataLink {
  id: string;
  from: { device: string; port?: string };
  to: { device: string; port?: string };
  kind?: string;
  speed?: string;
  lag?: string;
  /** logical function — access | trunk | routed | tunnel | peering | stack */
  mode?: string;
  vlans?: string;
  nativeVlan?: number;
  encap?: string;
  protocol?: string;
  lacp?: string;
  status: string;
  /** flowing-dash effect — mirrored in the inspector's link swatch */
  animated?: boolean;
  label?: string;
}

export interface DataZone {
  id: string;
  name: string;
}

export interface EmbeddedData {
  name: string;
  description?: string;
  theme: string;
  /** site-root-relative path of this page ('index.html' for single files) */
  page?: string;
  /** device ids that have dedicated device-360 pages (site mode) */
  devicePages?: string[];
  devices: DataDevice[];
  links: DataLink[];
  zones: DataZone[];
}

export interface GlobalSearchDoc {
  id: string;
  name: string;
  ip?: string;
  zone?: string;
  tier?: string;
  role?: string;
  /** canonical page for this device, site-root-relative */
  page: string;
}

export function globalSearchDocs(): GlobalSearchDoc[] | undefined {
  const g = (window as { __MARROW_SEARCH?: { docs?: GlobalSearchDoc[] } }).__MARROW_SEARCH;
  return g?.docs;
}

/**
 * The set of device ids that have a dedicated device-360 page.
 *
 * Derived from the shared search index (every doc carries its canonical `page`)
 * rather than a per-page `devicePages` list: at scale that list was the same
 * 15k-id array re-embedded into every one of ~15k pages — gigabytes of pure
 * duplication. `data.devicePages` remains a fallback for any page built without
 * the search asset. In single-file mode no device has a separate page, so every
 * doc's page is `index.html` and this correctly yields the empty set.
 */
let devicePageCache: string[] | undefined;
export function devicePageIds(data: EmbeddedData): string[] {
  if (devicePageCache !== undefined) return devicePageCache;
  const docs = globalSearchDocs();
  devicePageCache =
    docs !== undefined
      ? docs.filter((d) => d.page === `devices/${d.id}.html`).map((d) => d.id)
      : (data.devicePages ?? []);
  return devicePageCache;
}

export function loadData(): EmbeddedData {
  const el = document.getElementById('marrow-data');
  if (!el?.textContent) throw new Error('marrow: embedded data missing');
  return JSON.parse(el.textContent) as EmbeddedData;
}
