'use client';

/**
 * Robust clipboard copy helper with fallback for non-secure origins (e.g. LAN HTTP, iframes).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Modern Async Clipboard API (requires secure origin: localhost or https)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // If permission is denied or origin is insecure, fall through to textarea fallback
    }
  }

  // Fallback using document.execCommand('copy')
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-999999px';
    textArea.style.left = '-999999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
