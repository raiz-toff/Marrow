export type Severity = 'error' | 'warning' | 'info';

/**
 * The stable diagnostic code registry. Codes are part of the public contract:
 * agents and tests key off them, so codes are never renumbered or reused.
 */
export const DIAGNOSTIC_CODES = {
  'MRW-E001': 'YAML syntax error',
  'MRW-E002': 'Document root must be a mapping',
  'MRW-E003': 'Missing marrow version',
  'MRW-E004': 'Unsupported marrow version',
  'MRW-E005': 'Unknown key',
  'MRW-E006': 'Invalid type',
  'MRW-E007': 'Missing required field',
  'MRW-E008': 'Duplicate identifier',
  'MRW-E009': 'Unknown device reference',
  'MRW-E010': 'Unknown icon',
  'MRW-E011': 'Invalid value',
  'MRW-E012': 'Invalid identifier',
  'MRW-E013': 'Unknown zone reference',
  'MRW-E014': 'Invalid link endpoint',
  'MRW-E015': 'Unknown reference',
  'MRW-E016': 'Zone hierarchy cycle',
  'MRW-E017': 'Internal validator error',
  'MRW-W101': 'Port used by multiple links',
  'MRW-W102': 'Empty zone',
  'MRW-W103': 'Isolated device',
  'MRW-W104': 'Self-link',
  'MRW-W105': 'Link semantics mismatch',
} as const;

export type DiagnosticCode = keyof typeof DIAGNOSTIC_CODES;

export function severityOf(code: DiagnosticCode): Severity {
  return code.startsWith('MRW-E') ? 'error' : 'warning';
}

export function titleOf(code: DiagnosticCode): string {
  return DIAGNOSTIC_CODES[code];
}
