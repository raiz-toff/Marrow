export {
  validateSource,
  stripAnnotations,
  CircularDocumentError,
  type IconLookup,
  type ValidateOptions,
  type ValidationResult,
} from './validate.js';
export { parseEndpoint, type EndpointParse } from './endpoint.js';
export { rawToTopology } from './normalize.js';
export {
  topologySchema,
  topologyJsonSchema,
  zoneSchema,
  deviceSchema,
  linkSchema,
  interfaceSchema,
  type RawTopology,
  type RawDevice,
  type RawZone,
  type RawLink,
} from './zodSchema.js';
export {
  knownKeysAt,
  normalizePath,
  hintForMissing,
  ROOT_KEYS,
  ZONE_KEYS,
  DEVICE_KEYS,
  LINK_KEYS,
  INTERFACE_KEYS,
  type DataPath,
} from './keys.js';
export { formatPath } from './locate.js';
