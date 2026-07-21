import { z } from 'zod';
import {
  COLLAPSE_MODES,
  DEVICE_STATUSES,
  LINK_KINDS,
  LINK_SPEEDS,
  LINK_STATUSES,
  THEMES,
  TIERS,
} from '@marrow/model';

const asEnum = <T extends string>(values: readonly T[]) => z.enum(values as unknown as [T, ...T[]]);

export const endpointObjectSchema = z.strictObject({
  device: z.string(),
  port: z.string().optional(),
});

export const endpointSchema = z.union([z.string(), endpointObjectSchema]);

export const interfaceSchema = z.strictObject({
  name: z.string(),
  description: z.string().optional(),
  vlan: z.number().int().min(1).max(4094).optional(),
  ip: z.string().optional(),
});

export const zoneSchema = z.strictObject({
  id: z.string(),
  name: z.string().optional(),
  parent: z.string().optional(),
  collapse: asEnum(COLLAPSE_MODES).default('auto'),
  accent: z.string().optional(),
  note: z.string().optional(),
});

export const deviceSchema = z.strictObject({
  id: z.string(),
  name: z.string().optional(),
  icon: z.string(),
  tier: asEnum(TIERS).optional(),
  zone: z.string().optional(),
  role: z.string().optional(),
  status: asEnum(DEVICE_STATUSES).default('up'),
  mgmt_ip: z.string().optional(),
  ha_pair_with: z.string().optional(),
  hero: z.boolean().default(false),
  pin: z.strictObject({ x: z.number(), y: z.number() }).optional(),
  accent: z.string().optional(),
  note: z.string().optional(),
  config: z.string().optional(),
  interfaces: z.array(interfaceSchema).default([]),
});

export const linkSchema = z.strictObject({
  from: endpointSchema,
  to: endpointSchema,
  kind: asEnum(LINK_KINDS).optional(),
  speed: asEnum(LINK_SPEEDS).optional(),
  lag: z.string().optional(),
  status: asEnum(LINK_STATUSES).default('up'),
  animated: z.boolean().default(false),
  label: z.string().optional(),
  note: z.string().optional(),
});

export const topologySchema = z.strictObject({
  marrow: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  theme: asEnum(THEMES).default('dark'),
  hero: z.string().optional(),
  zones: z.array(zoneSchema).default([]),
  devices: z.array(deviceSchema).default([]),
  links: z.array(linkSchema).default([]),
});

export type RawTopology = z.output<typeof topologySchema>;
export type RawDevice = z.output<typeof deviceSchema>;
export type RawZone = z.output<typeof zoneSchema>;
export type RawLink = z.output<typeof linkSchema>;

/** JSON Schema artifact of the authoring format (embedded in the agent skill). */
export function topologyJsonSchema(): unknown {
  // io: 'input' — describe what an AUTHOR must write (defaulted fields are
  // optional), not the post-parse output shape where defaults look required.
  return z.toJSONSchema(topologySchema, { io: 'input' });
}
