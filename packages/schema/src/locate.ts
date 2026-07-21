import { isMap, isScalar, type Document, type LineCounter } from 'yaml';
import type { SourceLocation } from '@marrow/diagnostics';
import type { DataPath } from './keys.js';

export function formatPath(path: DataPath): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out === '' ? seg : `.${seg}`;
  }
  return out;
}

function locFromOffset(lc: LineCounter, offset: number | undefined): SourceLocation | undefined {
  if (typeof offset !== 'number') return undefined;
  const { line, col } = lc.linePos(offset);
  return { line, col };
}

/** Location of the VALUE node at `path` (falls back up the path if absent). */
export function locOf(doc: Document, lc: LineCounter, path: DataPath): SourceLocation | undefined {
  for (let take = path.length; take >= 0; take--) {
    const node = take === 0 ? doc.contents : (doc.getIn(path.slice(0, take), true) as unknown);
    const range = (node as { range?: [number, number, number] } | null)?.range;
    const loc = locFromOffset(lc, range?.[0]);
    if (loc) return loc;
  }
  return undefined;
}

/** Location of a KEY inside the mapping at `objPath` (for unknown-key errors). */
export function locOfKey(
  doc: Document,
  lc: LineCounter,
  objPath: DataPath,
  key: string,
): SourceLocation | undefined {
  const parent = objPath.length === 0 ? doc.contents : (doc.getIn(objPath, true) as unknown);
  if (isMap(parent)) {
    for (const item of parent.items) {
      if (isScalar(item.key) && String(item.key.value) === key) {
        const range = item.key.range;
        return locFromOffset(lc, range?.[0]);
      }
    }
    // Non-scalar keys (`? [a, b]`) get stringified in the JS data, so an exact
    // match is impossible — point at the first non-scalar key instead of the
    // document root.
    for (const item of parent.items) {
      if (!isScalar(item.key)) {
        const range = (item.key as { range?: [number, number, number] } | null)?.range;
        const loc = locFromOffset(lc, range?.[0]);
        if (loc) return loc;
      }
    }
  }
  return locOf(doc, lc, objPath);
}
