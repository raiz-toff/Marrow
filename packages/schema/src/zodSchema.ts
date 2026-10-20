import { z } from 'zod';
import {
  COLLAPSE_MODES,
  DENSITIES,
  DEVICE_STATUSES,
  LACP_MODES,
  LINK_KINDS,
  LINK_MODES,
  LINK_SPEEDS,
  LINK_STATUSES,
  ROUTING_PROTOCOLS,
  THEMES,
  TIERS,
  TUNNEL_ENCAPS,
  WATERMARK_MODES,
  WATERMARK_CASINGS,
  WATERMARK_FONTS,
} from '@marrow/model';

const asEnum = <T extends string>(values: readonly T[]) => z.enum(values as unknown as [T, ...T[]]);

export const watermarkSchema = z.strictObject({
  enabled: z.boolean().default(true),
  mode: asEnum(WATERMARK_MODES).default('full'),
  opacity: z.number().min(0.01).max(0.5).optional(),
  casing: asEnum(WATERMARK_CASINGS).default('uppercase'),
  font: asEnum(WATERMARK_FONTS).default('sans'),
});

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

export const customFieldsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));

export const customSectionContentSchema = z.union([
  z.string(),
  z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
]);

export const customSectionsSchema = z.record(z.string(), customSectionContentSchema);

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
  custom_fields: customFieldsSchema.optional(),
  sections: customSectionsSchema.optional(),
});

export const linkSchema = z.strictObject({
  from: endpointSchema,
  to: endpointSchema,
  kind: asEnum(LINK_KINDS).optional(),
  speed: asEnum(LINK_SPEEDS).optional(),
  lag: z.string().optional(),
  mode: asEnum(LINK_MODES).optional(),
  vlans: z.union([z.string(), z.number().int()]).optional(),
  native_vlan: z.number().int().min(1).max(4094).optional(),
  encap: asEnum(TUNNEL_ENCAPS).optional(),
  protocol: asEnum(ROUTING_PROTOCOLS).optional(),
  lacp: asEnum(LACP_MODES).optional(),
  status: asEnum(LINK_STATUSES).default('up'),
  animated: z.boolean().default(false),
  label: z.string().optional(),
  note: z.string().optional(),
  custom_fields: customFieldsSchema.optional(),
  sections: customSectionsSchema.optional(),
});

export const titleBlockSchema = z.strictObject({
  title: z.string().optional(),
  author: z.string().optional(),
  date: z.string().optional(),
  revision: z.string().optional(),
  logo: z.string().optional(),
});

export const inspectorTabSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  target: z.enum(['device', 'edge', 'both']).default('device'),
  field: z.string().optional(),
  fields: z.array(z.string()).optional(),
  template: z.string().optional(),
});

export const inspectorSchema = z.strictObject({
  tabs: z.array(inspectorTabSchema).default([]),
});

export const topologySchema = z.strictObject({
  marrow: z.number(),
  name: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  revision: z.string().optional(),
  date: z.string().optional(),
  about: z.unknown().optional(),
  watermark: watermarkSchema.optional(),
  title_block: titleBlockSchema.optional(),
  inspector: inspectorSchema.optional(),
  theme: asEnum(THEMES).default('dark'),
  density: asEnum(DENSITIES).default('standard'),
  scale: z.number().min(0.4).max(2.5).default(1),
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
