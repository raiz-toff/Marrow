// Shared helpers for the Marrow UI components. The registry build
// (scripts/build-registry.mjs) ships this file verbatim as
// `topology-types.ts`, so it must stay self-contained: no imports.

export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
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
