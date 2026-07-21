import { countBySeverity, hasErrors, type Diagnostic } from './diagnostic.js';

export interface JsonReport {
  valid: boolean;
  /** The validated file, when known — lets agents attribute batched reports. */
  file?: string;
  summary: { errors: number; warnings: number; infos: number };
  diagnostics: Diagnostic[];
}

/** The stable JSON shape consumed by agents (`--json`). */
export function toJsonReport(diagnostics: readonly Diagnostic[], file?: string): JsonReport {
  const report: JsonReport = {
    valid: !hasErrors(diagnostics),
    summary: countBySeverity(diagnostics),
    diagnostics: [...diagnostics],
  };
  if (file !== undefined) report.file = file;
  return report;
}

const ANSI = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

const PLAIN = {
  red: (s: string) => s,
  yellow: (s: string) => s,
  green: (s: string) => s,
  dim: (s: string) => s,
  bold: (s: string) => s,
};

export function formatPretty(
  diagnostics: readonly Diagnostic[],
  opts: { color?: boolean; filename?: string } = {},
): string {
  const c = opts.color ? ANSI : PLAIN;
  const out: string[] = [];
  for (const d of diagnostics) {
    const mark = d.severity === 'error' ? c.red('✖') : c.yellow('▲');
    const where = d.loc ? c.dim(`:${d.loc.line}:${d.loc.col}`) : '';
    out.push(`${mark} ${c.bold(d.code)} ${d.path || '(file)'}${where}  ${d.message}`);
    if (d.snippet) out.push(indent(d.snippet, 4));
    if (d.didYouMean?.length) out.push(indent(`did you mean: ${d.didYouMean.join(', ')}`, 4));
    if (d.hint) out.push(indent(c.dim(`hint: ${d.hint}`), 4));
  }
  const { errors, warnings } = countBySeverity(diagnostics);
  const name = opts.filename ? ` — ${opts.filename}` : '';
  out.push(
    errors === 0
      ? c.green(`✔ 0 errors, ${warnings} warning${warnings === 1 ? '' : 's'}${name}`)
      : c.red(`✖ ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}${name}`),
  );
  return out.join('\n');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((l) => pad + l)
    .join('\n');
}
