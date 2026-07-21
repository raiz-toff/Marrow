import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';
import { generateManifestFromSvgDir, kebab } from './generate.js';

/**
 * Fetch vendor icon packs from their OFFICIAL sources. The repo never ships
 * these assets — each user downloads them from the vendor's own servers,
 * under the vendor's terms. This module only knows how to find the current
 * package (some vendors rotate URLs) and reshape the archive into the
 * `icon-packs/<pack>/svg/<Category>/<name>.svg` layout the catalog expects.
 */

export interface IconSource {
  title: string;
  /** One-line terms summary, shown to the user before downloading. */
  license: string;
  licenseUrl: string;
  /** Static download URLs… */
  urls?: string[];
  /** …or scrape the vendor's page for the current package link. */
  discover?: { page: string; pattern: string };
}

export type IconSourceMap = Record<string, IconSource>;

export interface FetchResult {
  pack: string;
  icons: number;
  files: number;
  urls: string[];
}

/** Packs `marrow icons fetch` knows how to install (kept in sync with icon-sources.json). */
export const FETCHABLE_PACKS = ['aws', 'azure', 'gcp'];

export async function fetchPack(
  pack: string,
  source: IconSource,
  packsRoot: string,
  log: (message: string) => void = () => {},
): Promise<FetchResult> {
  const extract = EXTRACTORS[pack];
  if (!extract) throw new Error(`no extractor for pack "${pack}" — supported: ${Object.keys(EXTRACTORS).join(', ')}`);

  const urls = [...(source.urls ?? [])];
  if (source.discover) {
    log(`discovering current package link on ${source.discover.page} …`);
    urls.push(await discoverUrl(source.discover));
  }
  if (urls.length === 0) throw new Error(`source for "${pack}" lists no urls and no discover rule`);

  const files = new Map<string, Uint8Array>();
  for (const url of urls) {
    log(`downloading ${url} …`);
    const zip = await download(url);
    log(`extracting (${Math.round(zip.byteLength / 1024)} KB) …`);
    extract(unzipEntries(zip), url, files);
  }
  if (files.size === 0) throw new Error(`no SVGs found in the ${pack} package — the vendor may have restructured it`);

  const packDir = join(packsRoot, pack);
  rmSync(packDir, { recursive: true, force: true });
  for (const [rel, data] of files) {
    const dest = join(packDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
  }
  const manifest = generateManifestFromSvgDir(join(packDir, 'svg'), { pack, title: source.title, fileBase: 'svg' });
  writeFileSync(join(packDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return { pack, icons: manifest.icons.length, files: files.size, urls };
}

async function discoverUrl(discover: { page: string; pattern: string }): Promise<string> {
  const res = await fetch(discover.page, { headers: { 'User-Agent': 'marrow-icons-fetch' } });
  if (!res.ok) throw new Error(`cannot read ${discover.page}: HTTP ${res.status}`);
  const html = await res.text();
  const match = new RegExp(discover.pattern).exec(html);
  if (!match) throw new Error(`no package link matching /${discover.pattern}/ on ${discover.page} — the vendor page may have changed; update icon-sources.json`);
  return match[0];
}

async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'User-Agent': 'marrow-icons-fetch' } });
  if (!res.ok) throw new Error(`download failed: ${url} → HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

function unzipEntries(zip: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(unzipSync(zip))) {
    if (path.endsWith('/') || path.includes('__MACOSX/')) continue;
    out.set(path, data);
  }
  return out;
}

// ─── per-vendor archive reshaping ───────────────────────────────────────────
// Each extractor maps vendor-archive entries onto `svg/<Category>/<name>.svg`
// with the noise stripped from filenames (prefixes, size suffixes) so the
// generated search keywords stay meaningful. First occurrence of a dest wins.

type Extractor = (entries: Map<string, Uint8Array>, url: string, out: Map<string, Uint8Array>) => void;

const put = (out: Map<string, Uint8Array>, dest: string, data: Uint8Array): void => {
  if (!out.has(dest)) out.set(dest, data);
};

export const EXTRACTORS: Record<string, Extractor> = {
  aws: (entries, _url, out) => {
    for (const [path, data] of entries) {
      if (!path.toLowerCase().endsWith('.svg')) continue;
      const parts = path.split('/');
      const base = parts.at(-1)!.replace(/\.svg$/i, '');
      if (parts[0]?.startsWith('Architecture-Service-Icons') && /_48$/.test(base)) {
        const cat = parts.find((p) => p.startsWith('Arch_'))?.replace(/^Arch_/, '');
        if (cat) put(out, `svg/${cat}/${base.replace(/^Arch_/, '').replace(/_48$/, '')}.svg`, data);
      } else if (parts[0]?.startsWith('Architecture-Group-Icons')) {
        put(out, `svg/Groups/${base.replace(/_32$/, '')}.svg`, data);
      } else if (parts[0]?.startsWith('Resource-Icons') && !base.includes('_Dark')) {
        const cat = parts.find((p) => p.startsWith('Res_'))?.replace(/^Res_/, '');
        const name = base.replace(/^Res_/, '').replace(/(_48)?(_Light)?$/, '');
        if (cat) put(out, `svg/Resource-${cat}/${name}.svg`, data);
      }
    }
  },

  azure: (entries, _url, out) => {
    for (const [path, data] of entries) {
      if (!path.toLowerCase().endsWith('.svg')) continue;
      const parts = path.split('/');
      const iconsAt = parts.indexOf('Icons');
      if (iconsAt === -1 || parts.length < iconsAt + 3) continue;
      const cat = parts[iconsAt + 1]!;
      const name = parts.at(-1)!.replace(/\.svg$/i, '').replace(/^\d+-icon-(service|resource)-/, '');
      put(out, `svg/${cat}/${name}.svg`, data);
    }
  },

  gcp: (entries, url, out) => {
    if (url.includes('legacy')) {
      // one folder per product, the svg inside carries the product name
      for (const [path, data] of entries) {
        if (path.toLowerCase().endsWith('.svg')) put(out, `svg/${path.split('/').at(-1)}`, data);
      }
      return;
    }
    // current style: Unique Icons/<Product>/SVG/<variant>.svg — prefer the color variant
    const byProduct = new Map<string, Array<[string, Uint8Array]>>();
    for (const [path, data] of entries) {
      if (!path.toLowerCase().endsWith('.svg')) continue;
      const parts = path.split('/');
      const svgAt = parts.indexOf('SVG');
      if (svgAt < 1) continue;
      const product = parts[svgAt - 1]!;
      (byProduct.get(product) ?? byProduct.set(product, []).get(product)!).push([path, data]);
    }
    for (const [product, variants] of byProduct) {
      variants.sort((a, b) => a[0].localeCompare(b[0]));
      const pick = variants.find(([p]) => p.includes('-color')) ?? variants[0];
      if (pick) put(out, `svg/current/${kebab(product)}.svg`, pick[1]);
    }
  },
};
