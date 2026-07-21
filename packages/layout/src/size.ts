import { measureText, truncateToWidth } from '@marrow/metrics';
import type { Device } from '@marrow/model';

/** Visual constants shared with the (future) renderers. */
export const CHIP = 64;
/** MUST match the font-size renderers draw labels at (.m-label CSS + canvas
 *  engine) — the reservation is only honest if we measure what we draw. */
export const LABEL_SIZE = 12;
export const LABEL_GAP = 6;
export const MAX_LABEL_W = 168;

export interface NodeSizing {
  /** Full node footprint (chip ∪ label), what layout must reserve. */
  w: number;
  h: number;
  labelText: string;
  labelW: number;
  labelH: number;
  /** Untruncated name, present only when labelText lost characters. */
  labelFull?: string;
}

/**
 * Nodes are sized from their CONTENT — v1's hardcoded device_size constants
 * are exactly how labels ended up colliding.
 */
export function sizeNode(device: Device): NodeSizing {
  // Collapse whitespace the way SVG rendering will (newlines/tabs in YAML
  // names would otherwise desync measurement from drawing); never let a
  // blank name produce an unlabeled node.
  const name = device.name.replace(/\s+/g, ' ').trim() || device.id;
  const labelText = truncateToWidth(name, LABEL_SIZE, MAX_LABEL_W);
  const measured = measureText(labelText, LABEL_SIZE);
  const w = Math.max(CHIP, Math.ceil(measured.w));
  const h = CHIP + LABEL_GAP + Math.ceil(measured.h);
  const sizing: NodeSizing = {
    w,
    h,
    labelText,
    labelW: Math.ceil(measured.w),
    labelH: Math.ceil(measured.h),
  };
  if (labelText !== name) sizing.labelFull = name;
  return sizing;
}
