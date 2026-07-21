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
  status: string;
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

export function loadData(): EmbeddedData {
  const el = document.getElementById('marrow-data');
  if (!el?.textContent) throw new Error('marrow: embedded data missing');
  return JSON.parse(el.textContent) as EmbeddedData;
}
