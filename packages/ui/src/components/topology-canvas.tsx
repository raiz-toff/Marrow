'use client';

import {
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn, MARROW_EMBED, MARROW_ROOT_ATTR } from '../lib/utils.js';

export interface MarrowEmbedPreset {
  label: string;
  src: string;
}

type Theme = 'dark' | 'light';

interface MarrowEmbedOptions {
  /**
   * Accessible diagram title (the iframe's `title`)
   * @default "Marrow Network Diagram"
   */
  title?: string;

  /**
   * Embed chrome mode:
   * - "minimal": hides the command bar, breadcrumbs, sidebar, backdrop,
   *   watermark and minimap; the canvas stays interactive.
   * - "full": the complete standalone Marrow workbench.
   * @default "minimal"
   */
  chrome?: 'minimal' | 'full';

  /**
   * Device and link inspector drawer
   * @default "on"
   */
  inspector?: 'on' | 'off';

  /**
   * Minimap overlay
   * @default "on"
   */
  minimap?: 'on' | 'off';

  /**
   * Theme mode:
   * - "auto": resolved from the host when the frame first loads (a `dark` /
   *   `light` class or `data-theme` on `<html>`, else `prefers-color-scheme`),
   *   then kept in sync over postMessage.
   * - "dark" | "light": explicit.
   * @default "auto"
   */
  theme?: Theme | 'auto';

  /**
   * Fixed height (CSS value, numbers are px). Without it the container is
   * 600px tall unless `aspectRatio` or a `className` height says otherwise.
   */
  height?: string | number;

  /** CSS aspect-ratio for the container, e.g. "16 / 9". Replaces the default height. */
  aspectRatio?: string;

  /**
   * Minimum height (CSS value, numbers are px). Without it a `min-h-[320px]`
   * class applies, which `className` can override.
   */
  minHeight?: string | number;

  /**
   * Show floating action controls (presets, open standalone, fullscreen)
   * @default true
   */
  floatingActions?: boolean;

  /**
   * How long to wait for the diagram's `marrow:ready` message before
   * treating the load as failed (ms)
   * @default 8000
   */
  loadTimeout?: number;

  /** Fired when the embedded diagram posts `marrow:ready`. */
  onReady?: () => void;

  /** Fired when no `marrow:ready` arrives within `loadTimeout`. */
  onError?: (error: Error) => void;

  /** Rendered over the frame when the load fails (replaces the default message). */
  fallback?: React.ReactNode | ((error: Error) => React.ReactNode);

  /** Custom overlay children, rendered over the frame */
  children?: React.ReactNode;

  /** Classes for the outer container; they win over the defaults (tailwind-merge). */
  className?: string;
}

/**
 * Exactly one diagram source is required: a URL (`src`), compiled markup
 * (`html`, rendered via `srcdoc`), or `presets` (the first is shown unless
 * `src` picks another).
 */
export type MarrowEmbedSource =
  | { src: string; html?: never; presets?: MarrowEmbedPreset[] }
  | { presets: MarrowEmbedPreset[]; src?: string; html?: never }
  | { html: string; src?: never; presets?: never };

export type MarrowEmbedProps = MarrowEmbedOptions & MarrowEmbedSource;

interface Flags {
  chrome: 'minimal' | 'full';
  inspector: 'on' | 'off';
  minimap: 'on' | 'off';
  theme?: Theme;
}

const stripHash = (src: string): string => {
  const i = src.indexOf('#');
  return i >= 0 ? src.slice(0, i) : src;
};

/**
 * The iframe URL: `src` with the flags merged into its hash. Pairs are kept
 * raw and `;`-joined — Marrow's own hash format — so an author's `d=<id>` or
 * `c=<x>,<y>,<k>` survives untouched.
 */
export function buildEmbedUrl(src: string, flags: Flags): string {
  const hashIdx = src.indexOf('#');
  const base = hashIdx >= 0 ? src.slice(0, hashIdx) : src;
  const pairs = (hashIdx >= 0 ? src.slice(hashIdx + 1) : '').split(/[;&]/).filter(Boolean);
  const keyOf = (pair: string) => pair.split('=', 1)[0];
  const has = (key: string) => pairs.some((p) => keyOf(p) === key);
  const drop = (key: string) => {
    for (let i = pairs.length - 1; i >= 0; i--) if (keyOf(pairs[i]!) === key) pairs.splice(i, 1);
  };
  const put = (key: string, value: string) => {
    drop(key);
    pairs.push(`${key}=${value}`);
  };

  if (flags.chrome === 'minimal') {
    if (!has('chrome') && !has('embed')) put('chrome', 'minimal');
  } else {
    drop('chrome');
    drop('embed');
  }
  if (flags.inspector === 'off') put('inspector', 'off');
  else drop('inspector');
  if (flags.minimap === 'off') put('minimap', 'off');
  else drop('minimap');
  if (flags.theme) put('theme', flags.theme);

  return pairs.length > 0 ? `${base}#${pairs.join(';')}` : base;
}

const ATTR_RE = (name: string) =>
  new RegExp(`\\s${name}(?=[\\s=/>]|$)(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'gi');

/**
 * `html` (srcdoc) markup with the flags written onto `<html>` — the
 * attributes the pre-boot script would set from a URL, which srcdoc lacks.
 * A theme also drops `data-theme-mode` so `theme: auto` does not re-resolve it.
 */
export function withRootFlags(html: string, flags: Flags): string {
  const set: Record<string, string | undefined> = {
    [MARROW_ROOT_ATTR.chrome]: flags.chrome === 'minimal' ? 'minimal' : undefined,
    [MARROW_ROOT_ATTR.inspector]: flags.inspector === 'off' ? 'off' : undefined,
    [MARROW_ROOT_ATTR.minimap]: flags.minimap === 'off' ? 'off' : undefined,
  };
  if (flags.theme) {
    set[MARROW_ROOT_ATTR.theme] = flags.theme;
    set[MARROW_ROOT_ATTR.themeMode] = undefined;
  }
  const rewrite = (attrs: string): string => {
    let out = attrs;
    for (const [name, value] of Object.entries(set)) {
      out = out.replace(ATTR_RE(name), '');
      if (value !== undefined) out += ` ${name}="${value}"`;
    }
    return out;
  };
  const tag = /<html\b([^>]*)>/i.exec(html);
  if (tag) {
    return html.slice(0, tag.index) + `<html${rewrite(tag[1] ?? '')}>` + html.slice(tag.index + tag[0].length);
  }
  // no <html> tag: an explicit one after the doctype carries the attributes
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  const at = doctype ? doctype[0].length : 0;
  return html.slice(0, at) + `<html${rewrite('')}>` + html.slice(at);
}

/** The host page's theme: `dark`/`light` class or `data-theme` on `<html>`, else the OS scheme. */
export function readHostTheme(): Theme {
  const root = document.documentElement;
  const attr = root.getAttribute('data-theme');
  if (root.classList.contains('dark') || attr === 'dark') return 'dark';
  if (root.classList.contains('light') || attr === 'light') return 'light';
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribeHostTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
  const mql = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
  mql?.addEventListener?.('change', onChange);
  return () => {
    observer.disconnect();
    mql?.removeEventListener?.('change', onChange);
  };
}

const readNoTheme = (): Theme | null => null;

/**
 * Embeds a diagram compiled by Marrow in an iframe. The ref is the iframe, so
 * a same-origin host can reach `ref.current.contentWindow.marrow`.
 */
export const MarrowEmbed = forwardRef<HTMLIFrameElement, MarrowEmbedProps>(function MarrowEmbed(
  {
    src,
    html,
    presets,
    title = 'Marrow Network Diagram',
    chrome = 'minimal',
    inspector = 'on',
    minimap = 'on',
    theme = 'auto',
    height,
    aspectRatio,
    minHeight,
    floatingActions = true,
    loadTimeout = 8000,
    onReady,
    onError,
    fallback,
    children,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const setIframe = useCallback(
    (node: HTMLIFrameElement | null) => {
      iframeRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const [activeSrc, setActiveSrc] = useState<string | undefined>(src ?? presets?.[0]?.src);
  useEffect(() => {
    if (src !== undefined) setActiveSrc(src);
  }, [src]);

  // Host theme, live. The server snapshot is null: nothing loads until the
  // client knows the theme (no flash) and its ready listener is attached.
  const hostTheme = useSyncExternalStore(subscribeHostTheme, readHostTheme, readNoTheme);
  const current: Theme | null = hostTheme === null ? null : theme === 'auto' ? hostTheme : theme;

  // The theme baked into the first load of each document; later changes go
  // over postMessage instead of reloading (srcdoc) or rewriting the hash.
  const docKey = html !== undefined ? html : activeSrc !== undefined ? stripHash(activeSrc) : undefined;
  const baked = useRef<{ key: string; theme: Theme } | null>(null);
  if (docKey !== undefined && current !== null && baked.current?.key !== docKey) {
    baked.current = { key: docKey, theme: current };
  }
  const loadTheme = docKey !== undefined && baked.current?.key === docKey ? baked.current.theme : undefined;

  const flags: Flags = { chrome, inspector, minimap, theme: loadTheme };
  const frameSrc = loadTheme && html === undefined && activeSrc ? buildEmbedUrl(activeSrc, flags) : undefined;
  const frameDoc = loadTheme && html !== undefined ? withRootFlags(html, flags) : undefined;
  const loadKey = loadTheme ? docKey : undefined;

  // ── load state: `marrow:ready` from this frame is success, timeout is failure ──
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<Error | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ onReady, onError, current });
  latest.current = { onReady, onError, current };

  const postTheme = useCallback(() => {
    const t = latest.current.current;
    if (!t) return;
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: MARROW_EMBED.theme, theme: t }, '*');
    } catch {
      /* frame gone */
    }
  }, []);

  useEffect(() => {
    if (loadKey === undefined) return;
    setStatus('loading');
    setError(null);
    timer.current = setTimeout(() => {
      const err = new Error(`Marrow diagram did not signal ${MARROW_EMBED.ready} within ${loadTimeout} ms`);
      setStatus('error');
      setError(err);
      latest.current.onError?.(err);
    }, loadTimeout);
    return () => clearTimeout(timer.current);
  }, [loadKey, loadTimeout]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source == null || e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type !== MARROW_EMBED.ready) return;
      clearTimeout(timer.current);
      setStatus('ready');
      setError(null);
      postTheme();
      latest.current.onReady?.();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [postTheme]);

  // later host or prop theme changes
  useEffect(() => {
    if (status === 'ready') postTheme();
  }, [current, status, postTheme]);

  // ── fullscreen: the Fullscreen API, else a fixed overlay (iOS Safari) ──
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [overlayFullscreen, setOverlayFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || overlayFullscreen;

  useEffect(() => {
    const onChange = () => setNativeFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!overlayFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverlayFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayFullscreen]);

  const toggleFullscreen = () => {
    if (overlayFullscreen) return setOverlayFullscreen(false);
    if (nativeFullscreen) {
      void document.exitFullscreen?.().catch(() => {});
      return;
    }
    const el = containerRef.current;
    if (el && typeof el.requestFullscreen === 'function' && document.fullscreenEnabled !== false) {
      el.requestFullscreen().catch(() => setOverlayFullscreen(true));
    } else {
      setOverlayFullscreen(true);
    }
  };

  const px = (v: string | number) => (typeof v === 'number' ? `${v}px` : v);
  const style: React.CSSProperties = isFullscreen
    ? {}
    : {
        ...(height !== undefined ? { height: px(height) } : {}),
        ...(aspectRatio !== undefined ? { aspectRatio } : {}),
        ...(minHeight !== undefined ? { minHeight: px(minHeight) } : {}),
      };

  const hasSource = html !== undefined || activeSrc !== undefined;
  const failed = status === 'error' && error !== null;

  return (
    <div
      ref={containerRef}
      style={style}
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-border/70 bg-card/30 select-none',
        height === undefined && aspectRatio === undefined && 'h-[600px]',
        minHeight === undefined && 'min-h-[320px]',
        className,
        overlayFullscreen && 'fixed inset-0 z-50 h-dvh w-screen min-h-0 rounded-none border-0 bg-background',
      )}
    >
      {floatingActions && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pointer-events-auto">
          {presets && presets.length > 0 && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-border/70 bg-background/90 backdrop-blur-md shadow-2xs">
              {presets.map((p) => {
                const isActive = activeSrc === p.src;
                return (
                  <button
                    key={p.src}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveSrc(p.src)}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                      isActive
                        ? 'bg-accent text-accent-foreground font-semibold shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeSrc && html === undefined && (
            <a
              href={activeSrc}
              target="_blank"
              rel="noreferrer"
              title="Open standalone diagram in new tab"
              className="p-1.5 rounded-lg border border-border/70 bg-background/90 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all shadow-2xs cursor-pointer"
            >
              <ExternalLink className="size-3.5" />
              <span className="sr-only">Open standalone</span>
            </a>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-pressed={isFullscreen}
            className="p-1.5 rounded-lg border border-border/70 bg-background/90 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all shadow-2xs cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            <span className="sr-only">{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      )}

      <div className="relative w-full h-full min-h-0 overflow-hidden">
        {hasSource && status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60"
          >
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="text-xs text-muted-foreground">Loading diagram…</span>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-10">
            {fallback !== undefined ? (
              typeof fallback === 'function' ? fallback(error) : fallback
            ) : (
              <div
                role="alert"
                className="flex h-full flex-col items-center justify-center gap-2 bg-background text-xs text-muted-foreground"
              >
                <span>The diagram did not load.</span>
                {activeSrc && html === undefined && (
                  <a href={activeSrc} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                    Open it directly
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {hasSource ? (
          <iframe
            ref={setIframe}
            src={frameSrc}
            srcDoc={frameDoc}
            title={title}
            className="w-full h-full border-0 block"
            allow="fullscreen"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Provide a diagram URL (<code>src</code>), compiled markup (<code>html</code>) or <code>presets</code>.
          </div>
        )}

        {children}
      </div>
    </div>
  );
});
MarrowEmbed.displayName = 'MarrowEmbed';
