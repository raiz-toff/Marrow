// Shared helpers for the Marrow UI components. The registry build
// (scripts/build-registry.mjs) ships this file verbatim as
// `topology-types.ts`, so it must stay self-contained: it may import only
// clsx and tailwind-merge, which every registry item declares.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn's `cn`: conditional classes, with later Tailwind classes winning (`p-2 p-4` → `p-4`). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mirrors DEVICE_STATUSES / LINK_MODES in @marrow/model. Declared as literals
// because copied registry files cannot import @marrow/*; packages/ui/test
// asserts they stay equal to the model's.
export const DEVICE_STATUSES = ['up', 'down', 'degraded', 'planned', 'unknown'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const LINK_MODES = ['access', 'trunk', 'routed', 'tunnel', 'peering', 'stack'] as const;
export type LinkMode = (typeof LINK_MODES)[number];

// Mirrors EMBED / EMBED_HASH in @marrow/runtime's page contract — the
// postMessage names a host and an embedded diagram exchange, and the hash
// that switches a diagram to embed chrome. Literals for the same reason as
// above; packages/ui/test/embed-parity.test.ts asserts they stay equal.
export const MARROW_EMBED = {
  theme: 'marrow:theme',
  ready: 'marrow:ready',
  hash: '#embed=true',
} as const;

// Mirrors ROOT_ATTR in @marrow/runtime's page contract — the <html>
// attributes the pre-boot script and stylesheet key off. MarrowEmbed writes
// them into `html` (srcdoc) markup, which has no URL to carry flags in.
// Same parity test as MARROW_EMBED.
export const MARROW_ROOT_ATTR = {
  theme: 'data-theme',
  themeMode: 'data-theme-mode',
  chrome: 'data-chrome',
  inspector: 'data-inspector',
  minimap: 'data-minimap',
} as const;
