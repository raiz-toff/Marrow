/**
 * Global branding — the parts of a page that are identical across every diagram
 * a user builds. Topology YAML deliberately has no say: a topology describes a
 * network, this describes who it belongs to.
 *
 * The values are authored in `marrow.config.yaml` and loaded by the CLI; this
 * module owns the types and the sanitizing, because the logo markup is inlined
 * verbatim into every page and built output must stay self-contained/offline.
 */

export interface Brand {
  /** Sanitized inline markup for the logo (inline <svg> or an <img src="data:…">). */
  logo?: string;
  /** Plain-text brand name. */
  name?: string;
  /** Plain-text footer note, e.g. a confidentiality line. */
  note?: string;
  /**
   * Optional http(s) URL the brand mark links to — typically the company site.
   * A hyperlink is not a resource load — the page still renders fully offline;
   * following it is an explicit user action.
   */
  link?: string;
  /** Optional http(s) source/repo URL, shown as a small mark beside the brand. */
  github?: string;
}

/** True when a URL would reach outside the document (breaking the offline gate). */
function isExternalUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith('data:')) return false;
  if (v.startsWith('#')) return false;
  return true; // http(s):, //host, relative paths — none survive in a single file
}

/**
 * Strip anything from logo markup that could execute or phone home. Conservative
 * by design: this is inlined verbatim into every page Marrow builds.
 */
export function sanitizeLogo(markup: string, problems: string[] = []): { logo: string; problems: string[] } {
  let out = markup;

  const before = out;
  out = out.replace(/<(script|iframe|object|embed|link|meta)\b[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<(script|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '');
  if (out !== before) problems.push('removed script/iframe/object/embed/link/meta from the logo');

  const beforeHandlers = out;
  out = out.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  if (out !== beforeHandlers) problems.push('removed inline event handlers from the logo');

  let strippedExternal = false;
  out = out.replace(
    /\s(src|href|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (whole, _attr: string, dq?: string, sq?: string, bare?: string) => {
      const value = dq ?? sq ?? bare ?? '';
      if (!isExternalUrl(value)) return whole;
      strippedExternal = true;
      return '';
    },
  );
  if (strippedExternal) {
    problems.push(
      'removed an external/relative URL from the logo — diagrams must stay self-contained, ' +
        'so use an inline <svg> or an embedded image instead',
    );
    // an <img> whose src we just stripped would render broken; drop it entirely
    out = out.replace(/<img\b(?![^>]*\bsrc\s*=)[^>]*>/gi, '');
  }

  // XML prolog / doctype are meaningless once inlined into HTML
  out = out.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '');

  return { logo: out.trim(), problems };
}

/** Only http(s) links are allowed; javascript:/data:/relative are rejected. */
export function isSafeLink(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

/** True when the brand carries anything worth applying. */
export function hasBrand(brand: Brand | undefined): boolean {
  return (
    brand !== undefined &&
    (brand.logo !== undefined ||
      brand.name !== undefined ||
      brand.note !== undefined ||
      brand.link !== undefined ||
      brand.github !== undefined)
  );
}
