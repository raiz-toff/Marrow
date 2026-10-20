import { LineCounter, parseDocument, type Document } from 'yaml';
import {
  buildSnippet,
  closestMatches,
  diag,
  hasErrors,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticInput,
  type SourceLocation,
} from '@marrow/diagnostics';
import type { Topology } from '@marrow/model';
import { hintForMissing, knownKeysAt, normalizePath, type DataPath } from './keys.js';
import { formatPath, locOf, locOfKey } from './locate.js';
import { parseEndpoint } from './endpoint.js';
import { topologySchema, type RawTopology } from './zodSchema.js';
import { rawToTopology } from './normalize.js';

/**
 * The contract the icon catalog fulfills. Kept structural so @marrow/schema
 * does not depend on @marrow/icons — the CLI wires the two together.
 */
export interface IconLookup {
  has(id: string): boolean;
  suggest(id: string, max?: number): string[];
  hasSvg?(id: string): boolean;
}

export interface ValidateOptions {
  icons?: IconLookup;
}

export interface ValidationResult {
  /** True when there are no errors (warnings are allowed). */
  valid: boolean;
  diagnostics: Diagnostic[];
  /** Present only when the topology is fully valid. */
  topology?: Topology;
}

const ICON_ID_RE = /^[a-z0-9-]+(\/[a-z0-9-]+){1,3}$/;
/** Packs installable via `marrow icons fetch` (not shipped in the repo — vendor terms). */
const FETCHABLE_ICON_PACKS = ['aws', 'azure', 'gcp'];
const IDENTIFIER_RE = /^[a-z0-9][a-z0-9._-]*$/;

/**
 * Validate a topology document. NEVER throws: any input — including hostile
 * YAML (alias bombs, circular anchors, prototype-polluting keys) — yields a
 * structured diagnostic list.
 */
export function validateSource(source: string, options: ValidateOptions = {}): ValidationResult {
  try {
    return validateSourceInner(source, options);
  } catch (err) {
    const diagnostic =
      err instanceof CircularDocumentError
        ? diag('MRW-E001', {
            message: 'The document contains self-referential YAML aliases (a value contains itself)',
            path: '',
            hint: 'remove the circular anchor/alias reference — a topology cannot contain itself',
          })
        : diag('MRW-E017', {
            message: `Internal validator error: ${(err as Error).message}`,
            path: '',
            hint: 'this is a Marrow bug — please report it with the YAML that triggered it',
          });
    return { valid: false, diagnostics: [diagnostic] };
  }
}

function validateSourceInner(source: string, options: ValidateOptions): ValidationResult {
  const lc = new LineCounter();
  const doc = parseDocument(source, { lineCounter: lc, keepSourceTokens: true });
  const diagnostics: Diagnostic[] = [];

  const emit = (code: DiagnosticCode, input: DiagnosticInput): void => {
    if (input.loc && !input.snippet) {
      const snippet = buildSnippet(source, input.loc);
      if (snippet) input.snippet = snippet;
    }
    diagnostics.push(diag(code, input));
  };

  // ── 1. YAML syntax ────────────────────────────────────────────────────────
  if (doc.errors.length > 0) {
    for (const err of doc.errors) {
      const offset = err.pos?.[0];
      const loc = typeof offset === 'number' ? toLoc(lc, offset) : undefined;
      emit('MRW-E001', {
        message: firstLine(err.message),
        path: '',
        loc,
        hint: 'fix the YAML syntax; indentation must use spaces and be consistent',
      });
    }
    return { valid: false, diagnostics };
  }

  let data: unknown;
  try {
    data = doc.toJS({ maxAliasCount: 100 });
  } catch (err) {
    // e.g. the yaml library's alias-expansion guard on billion-laughs documents
    emit('MRW-E001', {
      message: firstLine((err as Error).message),
      path: '',
      hint: 'simplify or remove YAML anchors/aliases — the document could not be materialized',
    });
    return { valid: false, diagnostics };
  }

  // ── 2. Root shape + version ───────────────────────────────────────────────
  if (data === null || data === undefined) {
    emit('MRW-E002', {
      message: 'The file is empty',
      path: '',
      hint: 'start with "marrow: 2" followed by name, devices, and links',
    });
    return { valid: false, diagnostics };
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    emit('MRW-E002', {
      message: 'The document root must be a mapping of keys, not a list or scalar',
      path: '',
      loc: { line: 1, col: 1 },
      hint: 'start with "marrow: 2" followed by name, devices, and links',
    });
    return { valid: false, diagnostics };
  }
  const root = data as Record<string, unknown>;
  const version = root['marrow'];
  if (version === undefined) {
    emit('MRW-E003', {
      message: 'Missing "marrow" version key',
      path: '',
      loc: { line: 1, col: 1 },
      hint: 'add "marrow: 2" as the first line of the file',
    });
    return { valid: false, diagnostics };
  }
  if (typeof version !== 'number' || version !== 2) {
    emit('MRW-E004', {
      message: `This compiler supports marrow version 2; got ${formatValue(version)}`,
      path: 'marrow',
      loc: locOf(doc, lc, ['marrow']),
      hint: 'set "marrow: 2"',
    });
    return { valid: false, diagnostics };
  }

  // ── 3. Structural validation (strict keys, types, enums) ─────────────────
  const stripped = stripAnnotations(data) as Record<string, unknown>;

  // Zod v4 silently filters `__proto__` keys as its own pollution defense, so
  // strict mode never reports them — surface the reserved key explicitly
  // instead of silently dropping authored content.
  scanReservedKeys(stripped, [], (objPath, key) => {
    emit('MRW-E005', {
      message: `Unknown key "${key}" in ${describeContainer(objPath, stripped)}`,
      path: formatPath([...objPath, key]),
      loc: locOfKey(doc, lc, objPath, key),
      hint: `remove it — "${key}" is a reserved key and never valid in a topology`,
    });
  });

  const parsed = topologySchema.safeParse(stripped);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      translateIssue(issue as unknown as ZodIssueLike, { doc, lc, data: stripped, emit });
    }
    return { valid: false, diagnostics };
  }

  // ── 4. Semantic checks (references, uniqueness, icons) ───────────────────
  semanticChecks(parsed.data, { doc, lc, emit, icons: options.icons });

  const valid = !hasErrors(diagnostics);
  if (!valid) return { valid, diagnostics };

  // ── 5. Normalize into the model ──────────────────────────────────────────
  return { valid, diagnostics, topology: rawToTopology(parsed.data) };
}

// ─── Zod issue translation ──────────────────────────────────────────────────

interface ZodIssueLike {
  code?: string;
  path: Array<string | number>;
  message: string;
  keys?: string[];
  values?: unknown[];
  expected?: string;
}

interface TranslateCtx {
  doc: Document;
  lc: LineCounter;
  data: unknown;
  emit: (code: DiagnosticCode, input: DiagnosticInput) => void;
}

function translateIssue(issue: ZodIssueLike, ctx: TranslateCtx): void {
  const { doc, lc, data, emit } = ctx;
  const path = issue.path.filter((s): s is string | number => typeof s === 'string' || typeof s === 'number');

  if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
    for (const key of issue.keys) {
      const didYouMean = closestMatches(key, knownKeysAt(path));
      emit('MRW-E005', {
        message: `Unknown key "${key}" in ${describeContainer(path, data)}`,
        path: formatPath([...path, key]),
        loc: locOfKey(doc, lc, path, key),
        didYouMean,
        hint: 'remove it, fix the spelling, or prefix it with "x-" to keep it as a private annotation',
      });
    }
    return;
  }

  const value = getAtPath(data, path);
  const field = String(path.at(-1) ?? '');
  const parentPath = path.slice(0, -1);
  const pathStr = formatPath(path);

  if (value === undefined) {
    const hint =
      hintForMissing(normalizePath(pathStr)) ?? `add "${field}:" to ${describeContainer(parentPath, data)}`;
    emit('MRW-E007', {
      message: `Missing required field "${field}" in ${describeContainer(parentPath, data)}`,
      path: pathStr,
      loc: locOf(doc, lc, parentPath),
      hint,
    });
    return;
  }

  if (issue.code === 'invalid_value' && Array.isArray(issue.values)) {
    const values = issue.values.filter((v): v is string => typeof v === 'string');
    emit('MRW-E011', {
      message: `Invalid value ${JSON.stringify(value)} for "${field}" — expected one of: ${values.join(', ')}`,
      path: pathStr,
      loc: locOf(doc, lc, path),
      didYouMean: closestMatches(String(value), values),
      hint: `replace it with one of: ${values.join(', ')}`,
    });
    return;
  }

  if (issue.code === 'invalid_union') {
    emit('MRW-E014', {
      message: `Invalid link endpoint ${JSON.stringify(value)}`,
      path: pathStr,
      loc: locOf(doc, lc, path),
      hint: 'write endpoints as "device-id:PortName" (port optional) or as { device: ..., port: ... }',
    });
    return;
  }

  if (issue.code === 'invalid_type') {
    // A numeric last segment means a LIST ENTRY has the wrong type (e.g. a
    // bare string in devices:) — naming the index as a "field" would be
    // meaningless, so describe the container instead.
    if (typeof path.at(-1) === 'number') {
      emit('MRW-E006', {
        message: `${describeContainer(path, data)} must be a ${issue.expected ?? 'mapping'}, got ${describeValue(value)}`,
        path: pathStr,
        loc: locOf(doc, lc, path),
        hint: `write each entry under "${String(path[0] ?? 'the list')}" as a mapping of key: value fields`,
      });
      return;
    }
    emit('MRW-E006', {
      message: `Expected ${issue.expected ?? 'a different type'} for "${field}", got ${describeValue(value)}`,
      path: pathStr,
      loc: locOf(doc, lc, path),
      hint: `rewrite "${field}" as ${issue.expected ?? 'the expected type'}`,
    });
    return;
  }

  emit('MRW-E006', {
    message: `${issue.message} (at "${field}")`,
    path: pathStr,
    loc: locOf(doc, lc, path),
    hint: 'adjust the value to match the schema',
  });
}

// ─── Semantic checks ────────────────────────────────────────────────────────

interface SemanticCtx {
  doc: Document;
  lc: LineCounter;
  emit: (code: DiagnosticCode, input: DiagnosticInput) => void;
  icons?: IconLookup | undefined;
}

function semanticChecks(raw: RawTopology, ctx: SemanticCtx): void {
  const { doc, lc, emit, icons } = ctx;
  const at = (path: DataPath): SourceLocation | undefined => locOf(doc, lc, path);

  const zoneIds = raw.zones.map((z) => z.id);
  const deviceIds = raw.devices.map((d) => d.id);
  const zoneIdSet = new Set(zoneIds);
  const deviceIdSet = new Set(deviceIds);

  // identifiers + duplicates
  const firstZone = new Map<string, number>();
  for (const [i, zone] of raw.zones.entries()) {
    checkIdentifier(zone.id, ['zones', i, 'id'], 'zone', ctx);
    const first = firstZone.get(zone.id);
    if (first === undefined) firstZone.set(zone.id, i);
    else {
      emit('MRW-E008', {
        message: `Duplicate zone id "${zone.id}" (first defined at zones[${first}])`,
        path: formatPath(['zones', i, 'id']),
        loc: at(['zones', i, 'id']),
        hint: 'zone ids must be unique — rename one of them',
      });
    }
  }
  const firstDevice = new Map<string, number>();
  for (const [i, device] of raw.devices.entries()) {
    checkIdentifier(device.id, ['devices', i, 'id'], 'device', ctx);
    const first = firstDevice.get(device.id);
    if (first === undefined) firstDevice.set(device.id, i);
    else {
      emit('MRW-E008', {
        message: `Duplicate device id "${device.id}" (first defined at devices[${first}])`,
        path: formatPath(['devices', i, 'id']),
        loc: at(['devices', i, 'id']),
        hint: 'device ids must be unique — rename one of them',
      });
    }
  }

  // zone parent references + cycles
  const zoneParent = new Map<string, string>();
  for (const [i, zone] of raw.zones.entries()) {
    if (zone.parent === undefined) continue;
    if (!zoneIdSet.has(zone.parent)) {
      emit('MRW-E013', {
        message: `Zone "${zone.id}" references unknown parent zone "${zone.parent}"`,
        path: formatPath(['zones', i, 'parent']),
        loc: at(['zones', i, 'parent']),
        didYouMean: closestMatches(zone.parent, zoneIds),
        hint: 'declare the parent in zones: or fix the reference',
      });
    } else {
      zoneParent.set(zone.id, zone.parent);
    }
  }
  for (const [i, zone] of raw.zones.entries()) {
    const seen = new Set<string>([zone.id]);
    let current = zoneParent.get(zone.id);
    while (current !== undefined) {
      if (seen.has(current)) {
        if (current === zone.id) {
          emit('MRW-E016', {
            message: `Zone "${zone.id}" is its own ancestor (${[...seen, current].join(' → ')})`,
            path: formatPath(['zones', i, 'parent']),
            loc: at(['zones', i, 'parent']),
            hint: 'break the cycle by removing or changing one "parent:"',
          });
        }
        break;
      }
      seen.add(current);
      current = zoneParent.get(current);
    }
  }

  // device references
  for (const [i, device] of raw.devices.entries()) {
    if (device.zone !== undefined && !zoneIdSet.has(device.zone)) {
      emit('MRW-E013', {
        message: `Device "${device.id}" references unknown zone "${device.zone}"`,
        path: formatPath(['devices', i, 'zone']),
        loc: at(['devices', i, 'zone']),
        didYouMean: closestMatches(device.zone, zoneIds),
        hint: 'declare the zone in zones: or fix the reference',
      });
    }
    if (device.ha_pair_with !== undefined) {
      if (device.ha_pair_with === device.id) {
        emit('MRW-E015', {
          message: `Device "${device.id}" cannot HA-pair with itself`,
          path: formatPath(['devices', i, 'ha_pair_with']),
          loc: at(['devices', i, 'ha_pair_with']),
          hint: 'point ha_pair_with at the partner device',
        });
      } else if (!deviceIdSet.has(device.ha_pair_with)) {
        emit('MRW-E015', {
          message: `Device "${device.id}" HA-pairs with unknown device "${device.ha_pair_with}"`,
          path: formatPath(['devices', i, 'ha_pair_with']),
          loc: at(['devices', i, 'ha_pair_with']),
          didYouMean: closestMatches(device.ha_pair_with, deviceIds),
          hint: 'declare the partner in devices: or fix the reference',
        });
      }
    }
    // icon: format first, then catalog
    if (!ICON_ID_RE.test(device.icon)) {
      emit('MRW-E010', {
        message: `Icon id "${device.icon}" is not a valid icon reference`,
        path: formatPath(['devices', i, 'icon']),
        loc: at(['devices', i, 'icon']),
        didYouMean: icons?.suggest(device.icon) ?? [],
        hint: 'icon ids look like "cisco/switches/workgroup-switch" — browse with `marrow icons search <keyword>`',
      });
    } else if (icons && !icons.has(device.icon)) {
      const pack = device.icon.split('/')[0]!;
      const didYouMean = icons.suggest(device.icon);
      // a fetchable pack with no suggestions from it is almost certainly not installed
      const packMissing = FETCHABLE_ICON_PACKS.includes(pack) && !didYouMean.some((s) => s.startsWith(`${pack}/`));
      emit('MRW-E010', {
        message: `Unknown icon "${device.icon}" for device "${device.id}"`,
        path: formatPath(['devices', i, 'icon']),
        loc: at(['devices', i, 'icon']),
        didYouMean,
        hint: packMissing
          ? `the "${pack}" icon pack is not installed — download it from the vendor with \`marrow icons fetch ${pack}\``
          : 'browse the catalog with `marrow icons search <keyword>`',
      });
    } else if (icons && icons.hasSvg && !icons.hasSvg(device.icon)) {
      const pack = device.icon.split('/')[0]!;
      const isFetchable = FETCHABLE_ICON_PACKS.includes(pack);
      emit('MRW-W106', {
        message: isFetchable
          ? `Icon "${device.icon}" is valid, but the "${pack}" icon pack artwork is not downloaded yet`
          : `Icon "${device.icon}" is registered in manifest, but its SVG asset is missing on disk`,
        path: formatPath(['devices', i, 'icon']),
        loc: at(['devices', i, 'icon']),
        hint: isFetchable
          ? `download vendor icon pack with \`marrow icons fetch ${pack}\``
          : `check file on disk or rebuild manifest with \`marrow icons index\``,
      });
    }
  }

  // top-level hero
  if (raw.hero !== undefined && !deviceIdSet.has(raw.hero)) {
    emit('MRW-E015', {
      message: `"hero" references unknown device "${raw.hero}"`,
      path: 'hero',
      loc: at(['hero']),
      didYouMean: closestMatches(raw.hero, deviceIds),
      hint: 'point hero at a declared device id',
    });
  }

  // links
  const portUsage = new Map<string, Array<{ linkIndex: number; side: 'from' | 'to' }>>();
  const linkedDevices = new Set<string>();
  for (const [i, link] of raw.links.entries()) {
    const sides = [
      { side: 'from' as const, raw: link.from },
      { side: 'to' as const, raw: link.to },
    ];
    const resolved: Array<{ device: string; port?: string | undefined }> = [];
    for (const { side, raw: rawEp } of sides) {
      const parsedEp = parseEndpoint(rawEp);
      if (!parsedEp.ok) {
        emit('MRW-E014', {
          message: `Invalid link endpoint: ${parsedEp.reason}`,
          path: formatPath(['links', i, side]),
          loc: at(['links', i, side]),
          hint: 'write endpoints as "device-id:PortName" (port optional), e.g. core-sw-01:Gi1/0/1',
        });
        continue;
      }
      const ep = parsedEp.endpoint;
      resolved.push(ep);
      if (!deviceIdSet.has(ep.device)) {
        emit('MRW-E009', {
          message: `Link references unknown device "${ep.device}"`,
          path: formatPath(['links', i, side]),
          loc: at(['links', i, side]),
          didYouMean: closestMatches(ep.device, deviceIds),
          hint: 'declare the device in devices: or fix the reference',
        });
        continue;
      }
      linkedDevices.add(ep.device);
      if (ep.port !== undefined) {
        const key = `${ep.device}:${ep.port}`;
        const uses = portUsage.get(key);
        if (uses) uses.push({ linkIndex: i, side });
        else portUsage.set(key, [{ linkIndex: i, side }]);
      }
    }
    if (resolved.length === 2 && resolved[0]!.device === resolved[1]!.device) {
      emit('MRW-W104', {
        message: `Link #${i + 1} connects device "${resolved[0]!.device}" to itself`,
        path: formatPath(['links', i]),
        loc: at(['links', i]),
        hint: 'self-links are usually a typo in one endpoint',
      });
    }

    // link semantics consistency (advisory): the logical attributes must match
    // the declared mode. Presence of `encap` alone still means "tunnel" (the
    // renderer derives it), so only a CONTRADICTORY mode is flagged.
    const mode = link.mode;
    if (link.encap !== undefined && mode !== undefined && mode !== 'tunnel') {
      emit('MRW-W105', {
        message: `Link #${i + 1} sets encap: ${link.encap} but mode: ${mode} — encapsulation applies to tunnels`,
        path: formatPath(['links', i, 'encap']),
        loc: at(['links', i, 'encap']),
        hint: 'use mode: tunnel for VPN/overlay links, or drop encap',
      });
    }
    if (link.protocol !== undefined && mode !== undefined && mode !== 'routed' && mode !== 'peering') {
      emit('MRW-W105', {
        message: `Link #${i + 1} sets protocol: ${link.protocol} but mode: ${mode} — a routing protocol applies to routed or peering links`,
        path: formatPath(['links', i, 'protocol']),
        loc: at(['links', i, 'protocol']),
        hint: 'use mode: routed or mode: peering, or drop protocol',
      });
    }
    if (
      (link.vlans !== undefined || link.native_vlan !== undefined) &&
      mode !== undefined &&
      mode !== 'access' &&
      mode !== 'trunk'
    ) {
      const which = link.vlans !== undefined ? 'vlans' : 'native_vlan';
      emit('MRW-W105', {
        message: `Link #${i + 1} sets ${which} but mode: ${mode} — VLANs apply to access or trunk links`,
        path: formatPath(['links', i, which]),
        loc: at(['links', i, which]),
        hint: 'use mode: trunk (or access), or drop the VLAN fields',
      });
    }
    if (link.native_vlan !== undefined && mode === 'access') {
      emit('MRW-W105', {
        message: `Link #${i + 1} sets native_vlan on an access port — a native VLAN is a trunk concept`,
        path: formatPath(['links', i, 'native_vlan']),
        loc: at(['links', i, 'native_vlan']),
        hint: 'use mode: trunk with native_vlan, or set vlans for the access VLAN',
      });
    }
    if (link.lacp !== undefined && link.lag === undefined) {
      emit('MRW-W105', {
        message: `Link #${i + 1} sets lacp: ${link.lacp} but has no lag — LACP negotiates a bundle`,
        path: formatPath(['links', i, 'lacp']),
        loc: at(['links', i, 'lacp']),
        hint: 'give the bundle members a shared lag id, e.g. lag: po1',
      });
    }
  }
  for (const [key, uses] of portUsage) {
    // Count DISTINCT links: a self-link touching the same port on both ends
    // is one link (already covered by W104), not a port conflict.
    const distinct = [...new Set(uses.map((u) => u.linkIndex))];
    if (distinct.length < 2) continue;
    const second = uses.find((u) => u.linkIndex === distinct[1])!;
    emit('MRW-W101', {
      message: `Port "${key}" is used by ${distinct.length} links (links #${distinct.map((i) => i + 1).join(', #')})`,
      path: formatPath(['links', second.linkIndex, second.side]),
      loc: at(['links', second.linkIndex, second.side]),
      hint: 'a physical port normally carries one link — check the port names',
    });
  }

  // structural warnings
  const parentZones = new Set(zoneParent.values());
  for (const [i, zone] of raw.zones.entries()) {
    const hasDevices = raw.devices.some((d) => d.zone === zone.id);
    if (!hasDevices && !parentZones.has(zone.id)) {
      emit('MRW-W102', {
        message: `Zone "${zone.id}" contains no devices`,
        path: formatPath(['zones', i]),
        loc: at(['zones', i]),
        hint: 'assign devices with "zone: ' + zone.id + '" or remove the zone',
      });
    }
  }
  for (const [i, device] of raw.devices.entries()) {
    if (!linkedDevices.has(device.id)) {
      emit('MRW-W103', {
        message: `Device "${device.id}" has no links`,
        path: formatPath(['devices', i]),
        loc: at(['devices', i]),
        hint: 'connect it in links: (or leave it — isolated devices still render)',
      });
    }
  }
}

function checkIdentifier(id: string, path: DataPath, kind: 'zone' | 'device', ctx: SemanticCtx): void {
  if (IDENTIFIER_RE.test(id)) return;
  const suggestion = id
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[^a-z0-9]+/, '');
  ctx.emit('MRW-E012', {
    message: `Invalid ${kind} id ${JSON.stringify(id)}`,
    path: formatPath(path),
    loc: locOf(ctx.doc, ctx.lc, path),
    hint: `ids use lowercase letters, digits, ".", "_", "-" and start with a letter or digit${suggestion ? ` — e.g. "${suggestion}"` : ''}`,
  });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function toLoc(lc: LineCounter, offset: number): SourceLocation {
  const { line, col } = lc.linePos(offset);
  return { line, col };
}

function firstLine(text: string): string {
  return text.split('\n', 1)[0] ?? text;
}

/** Thrown when a YAML alias makes the document contain itself. */
export class CircularDocumentError extends Error {
  constructor() {
    super('circular document');
    this.name = 'CircularDocumentError';
  }
}

/**
 * Deep-copy `value`, dropping any object key that starts with `x-`.
 * Hardened: detects circular alias structures (throws CircularDocumentError,
 * caught by validateSource) and uses defineProperty so hostile keys like
 * `__proto__` become ordinary own properties (which Zod's strict mode then
 * rejects as unknown keys) instead of silently rewriting the prototype.
 */
export function stripAnnotations(value: unknown): unknown {
  return strip(value, new WeakSet());
}

function strip(value: unknown, pathSeen: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    if (pathSeen.has(value)) throw new CircularDocumentError();
    pathSeen.add(value);
    const out = value.map((v) => strip(v, pathSeen));
    pathSeen.delete(value);
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    if (pathSeen.has(value)) throw new CircularDocumentError();
    pathSeen.add(value);
    const out: Record<string, unknown> = {};
    for (const k of Object.getOwnPropertyNames(value)) {
      if (k.startsWith('x-')) continue;
      Object.defineProperty(out, k, {
        value: strip((value as Record<string, unknown>)[k], pathSeen),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    pathSeen.delete(value);
    return out;
  }
  return value;
}

/** Report every literal `__proto__` mapping key (Zod filters them silently). */
function scanReservedKeys(
  value: unknown,
  path: Array<string | number>,
  report: (objPath: Array<string | number>, key: string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanReservedKeys(v, [...path, i], report));
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const k of Object.getOwnPropertyNames(value)) {
      if (k === '__proto__') {
        report(path, k);
        continue; // never descend into a reserved key's value
      }
      scanReservedKeys((value as Record<string, unknown>)[k], [...path, k], report);
    }
  }
}

/** Render a scalar for messages without JSON.stringify's NaN/Infinity→null trap. */
function formatValue(value: unknown): string {
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value) ?? String(value);
}

function getAtPath(data: unknown, path: DataPath): unknown {
  let current: unknown = data;
  for (const seg of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[seg];
  }
  return current;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  return typeof value;
}

/** Human name for the object at `path`, e.g. `device "core-sw-01"`. */
function describeContainer(path: DataPath, data: unknown): string {
  if (path.length === 0) return 'the top level';
  const [a, b, c, d] = [path[0], path[1], path[2], path[3]];
  const obj = getAtPath(data, path);
  const idOf = (v: unknown): string | undefined => {
    if (typeof v === 'object' && v !== null && typeof (v as Record<string, unknown>)['id'] === 'string') {
      return (v as Record<string, unknown>)['id'] as string;
    }
    return undefined;
  };
  if (a === 'devices' && typeof b === 'number') {
    const deviceId = idOf(getAtPath(data, ['devices', b]));
    const device = deviceId ? `device "${deviceId}"` : `devices[${b}]`;
    if (path.length === 2) return device;
    if (c === 'interfaces' && typeof d === 'number') {
      const name = (getAtPath(data, [...path.slice(0, 4), 'name']) ?? undefined) as string | undefined;
      return name ? `interface "${name}" of ${device}` : `interfaces[${d}] of ${device}`;
    }
    if (c === 'pin') return `pin of ${device}`;
    return device;
  }
  if (a === 'zones' && typeof b === 'number') {
    const zoneId = idOf(obj) ?? idOf(getAtPath(data, ['zones', b]));
    return zoneId ? `zone "${zoneId}"` : `zones[${b}]`;
  }
  if (a === 'links' && typeof b === 'number') {
    if (path.length === 2) return `link #${b + 1}`;
    return `link #${b + 1} ${String(c)}`;
  }
  return formatPath(path);
}
