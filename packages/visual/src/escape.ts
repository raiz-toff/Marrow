/** Escape text for HTML element content and double-quoted attribute values. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A value as a CSS class/id fragment: lower-case, `[a-z0-9-]` only. */
export function cssSafe(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
