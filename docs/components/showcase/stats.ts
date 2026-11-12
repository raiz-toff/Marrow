import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Facts about the built demo pages, read from docs/public/demo at build time
 * (npm run demos runs before next build), so no number on a page can rot.
 */
const PUBLIC = join(process.cwd(), 'public');

export interface PageFacts {
  bytes: number;
  renderer: 'svg' | 'canvas' | 'none';
  /** Nodes the page draws (after endpoint collapse, on canvas pages). */
  nodes: number;
  /** Width and height of the drawn scene in px, SVG pages only. */
  size?: { w: number; h: number };
}

const cache = new Map<string, PageFacts>();

/** `path` is the public URL path, e.g. `/demo/zoned.html`. */
export function pageFacts(path: string): PageFacts {
  const hit = cache.get(path);
  if (hit) return hit;
  const file = join(PUBLIC, path);
  const html = readFileSync(file, 'utf8');
  const json = /<script type="application\/json" id="marrow-data">([\s\S]*?)<\/script>/.exec(html)?.[1];
  const data = json ? (JSON.parse(json) as { devices?: unknown[]; scene?: { nodes?: unknown[] } }) : {};
  const svg = /class="m-svg" data-w="([\d.]+)" data-h="([\d.]+)"/.exec(html);
  const facts: PageFacts = {
    bytes: statSync(file).size,
    renderer: html.includes('<canvas class="m-canvas"') ? 'canvas' : svg ? 'svg' : 'none',
    nodes: data.scene?.nodes?.length ?? data.devices?.length ?? 0,
    ...(svg ? { size: { w: Number(svg[1]), h: Number(svg[2]) } } : {}),
  };
  cache.set(path, facts);
  return facts;
}

/** Every file under a public directory: count and total bytes. */
export function folderFacts(path: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        files++;
        bytes += statSync(p).size;
      }
    }
  };
  walk(join(PUBLIC, path));
  return { files, bytes };
}

export function fileBytes(path: string): number {
  return statSync(join(PUBLIC, path)).size;
}

/** Devices a demo declares: the `- id:` entries under its top-level `devices:`. */
export function declaredDevices(demo: string): number {
  let inside = false;
  let n = 0;
  for (const line of readFileSync(join(process.cwd(), 'demos', demo), 'utf8').split('\n')) {
    if (/^devices:/.test(line)) inside = true;
    else if (/^\S/.test(line)) inside = false;
    else if (inside && /^ {2}- (?:id:|\{ *id:)/.test(line)) n++;
  }
  return n;
}

/** A file under docs/demos, verbatim. */
export function demoSource(path: string): string {
  return readFileSync(join(process.cwd(), 'demos', path), 'utf8');
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
