import { describe, expect, test } from 'vitest';
import { EMBED, EMBED_HASH } from '@marrow/runtime';
import { MARROW_EMBED } from '../src/lib/utils.js';

// utils.ts ships to consumers as topology-types.ts and cannot import
// @marrow/runtime, so the embed protocol is a literal copy of the page
// contract's. Keep them in lockstep.
describe('ui embed protocol mirrors the page contract', () => {
  test('message names and embed hash', () => {
    expect(MARROW_EMBED).toEqual({ ...EMBED, hash: EMBED_HASH });
  });
});
