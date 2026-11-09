import { describe, expect, test } from 'vitest';
import { DEVICE_STATUSES as MODEL_DEVICE_STATUSES, LINK_MODES as MODEL_LINK_MODES } from '@marrow/model';
import { DEVICE_STATUSES, LINK_MODES } from '../src/lib/utils.js';

// utils.ts ships to consumers as topology-types.ts and cannot import
// @marrow/model, so its unions are literal copies. Keep them in lockstep.
describe('ui unions mirror @marrow/model', () => {
  test('DeviceStatus', () => {
    expect([...DEVICE_STATUSES]).toEqual([...MODEL_DEVICE_STATUSES]);
  });

  test('LinkMode', () => {
    expect([...LINK_MODES]).toEqual([...MODEL_LINK_MODES]);
  });
});
