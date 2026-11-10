/**
 * Link semantics → symbol (ADR-0009). Pattern comes from the mode; the chip
 * carries the exact detail (VLANs / encap / protocol / lag). A `lag` id always
 * takes the chip — it's the aggregation identity — while the mode still drives
 * the pattern (so a LAG'd trunk reads as a double rail).
 */
import { cssSafe } from './escape.js';
import { effectiveMode, modeSpec, normalizeStatus, type LinkFields, type LinkGlyph, type LinkPattern } from './spec.js';

export interface LinkPresentation {
  /** Effective mode after deriving from attributes (encap ⇒ tunnel). */
  mode?: string;
  pattern: LinkPattern;
  /** Midpoint chip text, or undefined. */
  chip?: string;
  glyph?: LinkGlyph;
}

export function linkPresentation(l: LinkFields): LinkPresentation {
  const mode = effectiveMode(l);
  const spec = modeSpec(mode);
  const out: LinkPresentation = { pattern: spec?.pattern ?? 'solid' };
  if (mode !== undefined) out.mode = mode;
  const chip: readonly [string, LinkGlyph] | undefined =
    l.lag !== undefined ? [l.lag.toUpperCase(), 'bundle'] : spec?.chip(l);
  if (chip !== undefined) {
    out.chip = chip[0];
    out.glyph = chip[1];
  }
  return out;
}

/** One-line human summary of a link's logical semantics for the inspector. */
export function linkSemanticsWords(l: LinkFields & { nativeVlan?: number }): string[] {
  const words = [...(modeSpec(effectiveMode(l))?.words(l) ?? [])];
  if (l.lag !== undefined) words.push(l.lacp !== undefined ? `${l.lag} · LACP ${l.lacp}` : l.lag);
  return words;
}

/** The class list both tiers key paint off: `m-edge m-status-… m-speed-… m-mode-… m-flow`. */
export function edgeClasses(l: { status: string; speed?: string; mode?: string; encap?: string; animated?: boolean }): string {
  const mode = effectiveMode(l);
  return (
    `m-edge m-status-${normalizeStatus(l.status)}` +
    (l.speed ? ` m-speed-${cssSafe(l.speed)}` : '') +
    (mode ? ` m-mode-${cssSafe(mode)}` : '') +
    (l.animated ? ' m-flow' : '')
  );
}
