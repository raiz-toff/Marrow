'use client';

import {
  ExternalLink,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './topology-types.js';

export interface MarrowEmbedPreset {
  label: string;
  src: string;
}

export interface MarrowEmbedProps {
  /**
   * Path or URL to the compiled Marrow HTML diagram
   * (e.g. "/diagrams/datacenter.html" or "/demo/tiered-embed.html")
   * @default "/demo/tiered-embed.html"
   */
  src?: string;

  /**
   * In-memory raw compiled HTML string from Marrow compiler (rendered directly via srcDoc)
   */
  html?: string;

  /**
   * Accessible diagram title
   * @default "Marrow Network Diagram"
   */
  title?: string;

  /**
   * Embed chrome mode:
   * - "minimal": Strips breadcrumb topbars, search dock, and sidebars (#embed=true).
   * - "full": Displays the complete standalone Marrow workbench.
   * @default "minimal"
   */
  chrome?: 'minimal' | 'full';

  /**
   * Device telemetry and port inspector drawer
   * @default "on"
   */
  inspector?: 'on' | 'off';

  /**
   * Radar navigation minimap overlay
   * @default "on"
   */
  minimap?: 'on' | 'off';

  /**
   * Theme mode:
   * - "auto": Synchronizes live with host dark/light mode via postMessage.
   * - "dark" | "light": Explicitly overrides diagram theme.
   * @default "auto"
   */
  theme?: 'dark' | 'light' | 'auto';

  /**
   * Viewport height (CSS value)
   * @default "600px"
   */
  height?: string | number;

  /**
   * Show floating action controls (fullscreen, open standalone) in the top corner
   * @default true
   */
  floatingActions?: boolean;

  /**
   * Optional preset diagrams for in-stage switching
   */
  presets?: MarrowEmbedPreset[];

  /**
   * Callback fired when Marrow runtime signals "marrow:ready"
   */
  onReady?: () => void;

  /**
   * Optional custom overlay children
   */
  children?: React.ReactNode;

  /**
   * Additional CSS classes on the outer container
   */
  className?: string;
}

/**
 * Builds the effective iframe URL appending Marrow embedding hash flags.
 */
function buildEmbedUrl(
  src: string,
  options: {
    chrome?: 'minimal' | 'full';
    inspector?: 'on' | 'off';
    minimap?: 'on' | 'off';
    theme?: 'dark' | 'light' | 'auto';
  },
): string {
  if (!src) return '';
  const hashIdx = src.indexOf('#');
  const base = hashIdx >= 0 ? src.slice(0, hashIdx) : src;
  const rawHash = hashIdx >= 0 ? src.slice(hashIdx + 1) : '';

  const params = new URLSearchParams(
    rawHash.includes(';') ? rawHash.replace(/;/g, '&') : rawHash,
  );

  if (options.chrome === 'minimal' && !params.has('chrome') && !params.has('embed')) {
    params.set('chrome', 'minimal');
  } else if (options.chrome === 'full') {
    params.delete('chrome');
    params.delete('embed');
  }

  if (options.inspector === 'off') {
    params.set('inspector', 'off');
  } else if (options.inspector === 'on') {
    params.delete('inspector');
  }

  if (options.minimap === 'off') {
    params.set('minimap', 'off');
  } else if (options.minimap === 'on') {
    params.delete('minimap');
  }

  if (options.theme && options.theme !== 'auto') {
    params.set('theme', options.theme);
  }

  const hashString = params.toString();
  return hashString ? `${base}#${hashString}` : base;
}

export function MarrowEmbed({
  src,
  html,
  title = 'Marrow Network Diagram',
  chrome = 'minimal',
  inspector = 'on',
  minimap = 'on',
  theme = 'auto',
  height = '600px',
  floatingActions = true,
  presets,
  onReady,
  children,
  className,
}: MarrowEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Default to the pre-compiled demo diagram if neither src nor html is specified
  const initialSrc = src ?? (html ? undefined : '/demo/tiered-embed.html');
  const [activeSrc, setActiveSrc] = useState<string | undefined>(initialSrc);

  useEffect(() => {
    if (src) setActiveSrc(src);
  }, [src]);

  const effectiveSrc = useMemo(() => {
    if (!activeSrc) return undefined;
    return buildEmbedUrl(activeSrc, { chrome, inspector, minimap, theme });
  }, [activeSrc, chrome, inspector, minimap, theme]);

  // Fullscreen support
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Theme synchronization via postMessage
  useEffect(() => {
    const resolveTheme = (): 'dark' | 'light' => {
      if (theme === 'dark' || theme === 'light') return theme;
      if (typeof document !== 'undefined') {
        if (
          document.documentElement.classList.contains('dark') ||
          document.documentElement.dataset.theme === 'dark'
        ) {
          return 'dark';
        }
      }
      return 'light';
    };

    const sendTheme = () => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'marrow:theme', theme: resolveTheme() },
          '*',
        );
      } catch {}
    };

    sendTheme();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'marrow:ready') {
        setIsLoading(false);
        sendTheme();
        onReady?.();
      }
    };

    window.addEventListener('message', handleMessage);

    const observer = new MutationObserver(() => {
      if (!theme || theme === 'auto') {
        sendTheme();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => {
      window.removeEventListener('message', handleMessage);
      observer.disconnect();
    };
  }, [theme, onReady]);

  const heightStyle = isFullscreen
    ? '100vh'
    : typeof height === 'number'
      ? `${height}px`
      : height;

  return (
    <div
      ref={containerRef}
      style={{ height: heightStyle }}
      className={cn(
        'relative w-full h-full min-h-[420px] overflow-hidden rounded-xl border border-fd-border/70 bg-fd-card/30 select-none transition-all',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0 h-screen w-screen bg-fd-background' : '',
        className,
      )}
    >
      {/* Floating HUD micro-actions directly on the canvas — NO duplicate header box */}
      {floatingActions && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pointer-events-auto">
          {presets && presets.length > 0 && (
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-fd-border/70 bg-fd-background/90 backdrop-blur-md shadow-2xs">
              {presets.map((p) => {
                const isActive = activeSrc === p.src;
                return (
                  <button
                    key={p.src}
                    type="button"
                    onClick={() => {
                      setIsLoading(true);
                      setActiveSrc(p.src);
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                      isActive
                        ? 'bg-fd-accent text-fd-foreground font-semibold shadow-2xs'
                        : 'text-fd-muted-foreground hover:text-fd-foreground',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeSrc && (
            <a
              href={activeSrc}
              target="_blank"
              rel="noreferrer"
              title="Open standalone diagram in new tab"
              className="p-1.5 rounded-lg border border-fd-border/70 bg-fd-background/90 backdrop-blur-md text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-primary/50 transition-all shadow-2xs cursor-pointer"
            >
              <ExternalLink className="size-3.5" />
              <span className="sr-only">Open standalone</span>
            </a>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg border border-fd-border/70 bg-fd-background/90 backdrop-blur-md text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-primary/50 transition-all shadow-2xs cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </button>
        </div>
      )}

      {/* Main Diagram Viewport: Edge-to-edge flush with zero double-box nesting */}
      <div className="relative w-full h-full min-h-0 bg-transparent overflow-hidden">
        {/* Loading Spinner Indicator */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-fd-background/60 backdrop-blur-xs transition-opacity duration-300">
            <Loader2 className="size-5 animate-spin text-fd-primary" />
            <span className="text-xs font-mono text-fd-muted-foreground">
              Initializing Marrow layout engine…
            </span>
          </div>
        )}

        {/* Embedded Marrow Diagram Iframe */}
        {effectiveSrc || html ? (
          <iframe
            ref={iframeRef}
            src={effectiveSrc}
            srcDoc={html}
            title={title}
            onLoad={() => setIsLoading(false)}
            className="w-full h-full border-0 block"
            allow="fullscreen"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-fd-muted-foreground">
            Provide a diagram URL (<code>src</code>) or raw compiled markup (<code>html</code>).
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// Aliases for seamless drop-in compatibility
export const TopologyCanvas = MarrowEmbed;
export const TopologyViewport = MarrowEmbed;
export const TopologyStage = MarrowEmbed;
export const MarrowDiagram = MarrowEmbed;
export type TopologyStageProps = MarrowEmbedProps;
