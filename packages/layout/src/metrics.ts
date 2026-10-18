import type { Density } from '@marrow/model';

export interface LayoutMetrics {
  density: Density;
  scale: number;
  /** Size of the square icon chip (default 64) */
  chip: number;
  /** Label font size in px (default 12) */
  labelSize: number;
  /** Gap between icon chip and label box (default 6) */
  labelGap: number;
  /** Maximum width of label box before truncation (default 168) */
  maxLabelW: number;
  /** Spacing between layers in ELK (default 88) */
  layerSpacing: number;
  /** Spacing between nodes in the same layer in ELK (default 48) */
  nodeSpacing: number;
  /** Spacing between disconnected components in ELK (default 56) */
  componentSpacing: number;
  /** Graph padding in ELK (default 48) */
  padding: number;
  /** Spacing in polar/radial layouts between spokes (default 48) */
  ringGap: number;
  /** Minimum radius in polar/radial layouts (default 200) */
  minRadius: number;
  /** Spacing between side-by-side hubs in polar layout (default 72) */
  hubGap: number;
  /** Padding around zone hulls (default 28) */
  zonePad: number;
  /** Gap between zones in shelf layout (default 56) */
  composeGap: number;
  /** Port chip height (default 16) */
  portChipH: number;
  /** Port chip advance width per character (default 5.6) */
  portChipChar: number;
  /** Port chip padding (default 10) */
  portChipPad: number;
}

interface DensityProfile {
  chip: number;
  labelSize: number;
  labelGap: number;
  maxLabelW: number;
  layerSpacing: number;
  nodeSpacing: number;
  componentSpacing: number;
  padding: number;
  ringGap: number;
  minRadius: number;
  hubGap: number;
  zonePad: number;
  composeGap: number;
  portChipH: number;
  portChipChar: number;
  portChipPad: number;
}

const DENSITY_PROFILES: Record<Density, DensityProfile> = {
  compact: {
    chip: 48,
    labelSize: 10,
    labelGap: 4,
    maxLabelW: 130,
    layerSpacing: 60,
    nodeSpacing: 32,
    componentSpacing: 40,
    padding: 32,
    ringGap: 32,
    minRadius: 150,
    hubGap: 48,
    zonePad: 20,
    composeGap: 40,
    portChipH: 14,
    portChipChar: 4.8,
    portChipPad: 8,
  },
  standard: {
    chip: 64,
    labelSize: 12,
    labelGap: 6,
    maxLabelW: 168,
    layerSpacing: 88,
    nodeSpacing: 48,
    componentSpacing: 56,
    padding: 48,
    ringGap: 48,
    minRadius: 200,
    hubGap: 72,
    zonePad: 28,
    composeGap: 56,
    portChipH: 16,
    portChipChar: 5.6,
    portChipPad: 10,
  },
  spacious: {
    chip: 80,
    labelSize: 14,
    labelGap: 8,
    maxLabelW: 210,
    layerSpacing: 116,
    nodeSpacing: 64,
    componentSpacing: 72,
    padding: 64,
    ringGap: 64,
    minRadius: 260,
    hubGap: 96,
    zonePad: 36,
    composeGap: 72,
    portChipH: 18,
    portChipChar: 6.4,
    portChipPad: 12,
  },
};

export function resolveLayoutMetrics(density: Density = 'standard', rawScale = 1): LayoutMetrics {
  const d = DENSITY_PROFILES[density] ? density : 'standard';
  const profile = DENSITY_PROFILES[d];
  const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  if (scale === 1) {
    return {
      density: d,
      scale: 1,
      ...profile,
    };
  }

  return {
    density: d,
    scale,
    chip: Math.round(profile.chip * scale),
    labelSize: Math.max(8, Math.round(profile.labelSize * scale)),
    labelGap: Math.max(2, Math.round(profile.labelGap * scale)),
    maxLabelW: Math.round(profile.maxLabelW * scale),
    layerSpacing: Math.round(profile.layerSpacing * scale),
    nodeSpacing: Math.round(profile.nodeSpacing * scale),
    componentSpacing: Math.round(profile.componentSpacing * scale),
    padding: Math.round(profile.padding * scale),
    ringGap: Math.round(profile.ringGap * scale),
    minRadius: Math.round(profile.minRadius * scale),
    hubGap: Math.round(profile.hubGap * scale),
    zonePad: Math.round(profile.zonePad * scale),
    composeGap: Math.round(profile.composeGap * scale),
    portChipH: Math.round(profile.portChipH * scale),
    portChipChar: Math.round(profile.portChipChar * scale * 10) / 10,
    portChipPad: Math.round(profile.portChipPad * scale),
  };
}
