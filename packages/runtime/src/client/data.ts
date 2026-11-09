/** The embedded payload, as the runtime sees it. Its shape is the page
 *  contract's (`EmbeddedData`), typed from the model — never retyped here. */
import type { InspectorTabConfig, TitleBlock } from '@marrow/model';
import {
  DATA_SCRIPT_ID,
  decodePageData,
  SEARCH_GLOBAL,
  type EmbeddedData,
  type PageDevice,
  type PageLink,
  type SearchIndexDoc,
} from '../shared/page-contract.js';

export type { EmbeddedData, InspectorTabConfig };
export type DataDevice = PageDevice;
export type DataLink = PageLink;
export type DataTitleBlock = TitleBlock;
export type GlobalSearchDoc = SearchIndexDoc;

export function globalSearchDocs(): GlobalSearchDoc[] | undefined {
  const g = (window as unknown as Record<string, { docs?: GlobalSearchDoc[] } | undefined>)[SEARCH_GLOBAL];
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

/** Read the page's payload; throws `PageContractError` when absent or malformed. */
export function loadData(): EmbeddedData {
  return decodePageData(document.getElementById(DATA_SCRIPT_ID)?.textContent);
}
