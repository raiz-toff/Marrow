import { describe, expect, test } from 'vitest';
import { EMBED, EMBED_HASH, ROOT_ATTR } from '@marrow/runtime';
import { MARROW_EMBED, MARROW_ROOT_ATTR } from '../src/lib/utils.js';

// utils.ts ships to consumers as topology-types.ts and cannot import
// @marrow/runtime, so the embed protocol is a literal copy of the page
// contract's. Keep them in lockstep.
describe('ui embed protocol mirrors the page contract', () => {
  test('message names and embed hash', () => {
    expect(MARROW_EMBED).toEqual({ ...EMBED, hash: EMBED_HASH });
  });

  test('<html> root attributes written into srcdoc markup', () => {
    for (const [key, attr] of Object.entries(MARROW_ROOT_ATTR)) {
      expect(attr, key).toBe(ROOT_ATTR[key as keyof typeof ROOT_ATTR]);
    }
  });
});
