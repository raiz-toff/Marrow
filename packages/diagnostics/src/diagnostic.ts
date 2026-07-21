import { type DiagnosticCode, type Severity, severityOf } from './codes.js';

/** 1-indexed position in the source YAML. */
export interface SourceLocation {
  line: number;
  col: number;
}

/**
 * The machine-readable unit every Marrow tool emits. An agent must be able to
 * repair a topology using nothing but a list of these.
 */
export interface Diagnostic {
  code: DiagnosticCode;
  severity: Severity;
  /** Plain-language statement of what is wrong, naming the offending value. */
  message: string;
  /** Data path into the YAML, e.g. `devices[2].icon`. Empty string = whole file. */
  path: string;
  loc?: SourceLocation;
  /** Source excerpt with a caret marking the location. */
  snippet?: string;
  /** Actionable instruction for fixing it. */
  hint?: string;
  didYouMean?: string[];
}

export interface DiagnosticInput {
  message: string;
  path: string;
  loc?: SourceLocation | undefined;
  snippet?: string | undefined;
  hint?: string | undefined;
  didYouMean?: string[] | undefined;
}

export function diag(code: DiagnosticCode, input: DiagnosticInput): Diagnostic {
  const d: Diagnostic = {
    code,
    severity: severityOf(code),
    message: input.message,
    path: input.path,
  };
  if (input.loc) d.loc = input.loc;
  if (input.snippet) d.snippet = input.snippet;
  if (input.hint) d.hint = input.hint;
  if (input.didYouMean && input.didYouMean.length > 0) d.didYouMean = input.didYouMean;
  return d;
}

export function countBySeverity(diagnostics: readonly Diagnostic[]): {
  errors: number;
  warnings: number;
  infos: number;
} {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos };
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}
