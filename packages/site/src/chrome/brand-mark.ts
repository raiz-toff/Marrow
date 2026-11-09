/* ── brand resolution ──────────────────────────────────────────────────────────
   Branding is GLOBAL and comes from brand/brand.html only. Topology YAML
   deliberately has no say: a diagram describes a network, not who owns it. */
import type { ChromeOptions } from '../chrome.js';
import { esc } from '../html.js';
import { I } from './icons.js';

/** The logo mark: the company logo when configured, the Marrow mark otherwise. */
export function brandLogo(o: ChromeOptions): string {
  return o.brand?.logo !== undefined ? `<span class="m-brand-logo">${o.brand.logo}</span>` : I.logo;
}

/** The brand name shown next to the logo. */
export function brandName(o: ChromeOptions): string {
  return esc(o.brand?.name ?? 'Marrow');
}

/** The footer note (confidentiality line), if any. */
export function brandNote(o: ChromeOptions): string | undefined {
  return o.brand?.note;
}

/** Company-customizable brand mark used in the sidebar and drawer footers.
 *  With brand.link set it becomes a hyperlink — navigation only, never a
 *  resource load, so the page still renders fully offline. */
export function brandFoot(o: ChromeOptions): string {
  const mark = `${brandLogo(o)}<span>${brandName(o)}</span>`;
  const linked =
    o.brand?.link !== undefined
      ? `<a class="m-brand-link" href="${esc(o.brand.link)}" target="_blank" rel="noopener noreferrer">${mark}</a>`
      : mark;
  const source =
    o.brand?.github !== undefined
      ? `<a class="m-brand-gh" href="${esc(o.brand.github)}" target="_blank" rel="noopener noreferrer"` +
        ` aria-label="Source repository" title="Source repository">${I.github}</a>`
      : '';
  return `${linked}${source}`;
}
