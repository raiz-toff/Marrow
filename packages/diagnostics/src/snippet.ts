import type { SourceLocation } from './diagnostic.js';

/**
 * Render a small source excerpt with a caret under the location, e.g.
 *
 *   12 |     icon: cisco/switchs/layer-3-switch
 *      |           ^
 */
export function buildSnippet(source: string, loc: SourceLocation): string {
  const lines = source.split(/\r\n|\r|\n/);
  const idx = loc.line - 1;
  if (idx < 0 || idx >= lines.length) return '';
  // Tabs are shown as single spaces so the caret (space-padded) stays aligned
  // with the quoted line regardless of the terminal's tab width.
  const text = (lines[idx] ?? '').replace(/\t/g, ' ');
  const gutter = String(loc.line);
  const caretPad = ' '.repeat(Math.max(0, loc.col - 1));
  return `${gutter} | ${text}\n${' '.repeat(gutter.length)} | ${caretPad}^`;
}
