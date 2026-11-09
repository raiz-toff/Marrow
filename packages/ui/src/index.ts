// Marrow UI — the public React interface (ADR-0019): MarrowEmbed, CableBadge,
// DeviceLink. The same sources are copied into consumer codebases by the
// shadcn registry (scripts/build-registry.mjs).

export { cn, type DeviceStatus, type LinkMode } from './lib/utils.js';

export { MarrowEmbed, type MarrowEmbedProps } from './components/topology-canvas.js';

export { CableBadge, type CableBadgeProps } from './components/cable-badge.js';

export { DeviceLink, type DeviceLinkProps } from './components/device-link.js';
