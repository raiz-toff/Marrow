'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal';

/** True once the element comes within `margin` of the viewport; never flips back. */
function useNear<T extends Element>(margin = '100px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}

/** Renders its children once scrolled close; until then, an empty box `height` px tall. */
export function WhenNear({ height, children }: { height: number; children: ReactNode }) {
  const [ref, near] = useNear<HTMLDivElement>();
  return (
    <div ref={ref} style={near ? undefined : { height }}>
      {near && children}
    </div>
  );
}

/** The element's content width, live. 0 until measured. */
function useWidth<T extends Element>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Lays its child out at a fixed CSS size and scales it down to fit the width
 * available, so an iframe keeps the viewport it was given (and the diagram
 * the layout that viewport earns) on a narrow screen. With `fill`, the child
 * is never narrower than the container: `width` is only the floor.
 */
export function Fit({ width, height, fill = false, children }: { width: number; height: number; fill?: boolean; children: ReactNode }) {
  const [ref, avail] = useWidth<HTMLDivElement>();
  const k = avail > 0 ? Math.min(1, avail / width) : 1;
  const inner = fill && avail >= width ? avail : width;
  return (
    <div ref={ref} className="w-full min-w-0 overflow-hidden" style={{ height: Math.round(height * k) }}>
      <div
        className={fill ? undefined : 'mx-auto'}
        style={{ width: inner, height, transform: k < 1 ? `scale(${k})` : undefined, transformOrigin: 'top left', maxWidth: avail > 0 ? undefined : '100%' }}
      >
        {children}
      </div>
    </div>
  );
}

interface LiveFrameProps {
  src: string;
  title: string;
  /** `near`: load when scrolled close. `click`: wait for the reader (heavy pages). */
  load?: 'near' | 'click';
  /** Shown on the load button, e.g. the page's size. */
  weight?: string;
  /** Inside a frame scaled to about half size: draw the load button large. */
  big?: boolean;
}

/**
 * A compiled Marrow page in an iframe. It loads lazily, and takes no pointer
 * events until clicked, so wheel-zooming the diagram never hijacks the
 * reader's scroll through the page.
 */
export function LiveFrame({ src, title, load = 'near', weight, big = false }: LiveFrameProps) {
  const [ref, near] = useNear<HTMLDivElement>();
  const [requested, setRequested] = useState(false);
  const [live, setLive] = useState(false);
  const shown = load === 'click' ? requested : near;

  return (
    <div ref={ref} className="relative h-full w-full bg-paper">
      {shown && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className={`block h-full w-full border-0 ${live ? '' : 'pointer-events-none'}`}
        />
      )}
      {!shown && load === 'click' && (
        <button
          type="button"
          onClick={() => {
            setRequested(true);
            setLive(true);
          }}
          className={`absolute inset-0 grid place-items-center text-sm text-ink-dim hover:text-ink cursor-pointer ${FOCUS}`}
        >
          <span className={`border border-ink/70 bg-sheet ${big ? 'px-8 py-4 text-3xl' : 'px-4 py-2'}`}>
            Load the diagram{weight ? ` (${weight})` : ''}
          </span>
        </button>
      )}
      {shown && !live && (
        <button
          type="button"
          onClick={() => setLive(true)}
          aria-label={`Interact with ${title}`}
          className={`group absolute inset-0 cursor-pointer ${FOCUS}`}
        >
          <span className="absolute bottom-3 left-3 border border-ink/70 bg-sheet px-2 py-1 text-xs text-ink opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
            Click to interact
          </span>
        </button>
      )}
    </div>
  );
}

/** A device bezel with stepped corners around a `w` × `h` CSS-pixel screen. */
export function Bezel({ w, h, bezel, step, label, children }: { w: number; h: number; bezel: number; step: number; label?: string; children: ReactNode }) {
  return (
    <div className="px-corners bg-bezel" style={{ width: w + 2 * bezel, height: h + 2 * bezel, padding: bezel, ['--px' as string]: `${step}px` }}>
      <div className="h-full w-full overflow-hidden" role={label ? 'group' : undefined} aria-label={label}>
        {children}
      </div>
    </div>
  );
}

const DEVICES = {
  phone: { w: 360, h: 740, bezel: 14, step: 6, label: 'Phone, 360 by 740' },
  tablet: { w: 768, h: 1024, bezel: 22, step: 8, label: 'Tablet, 768 by 1024' },
} as const;

/** A CSS-only phone or tablet around a real iframe of exactly that viewport. */
export function DeviceFrame({ device, src, title }: { device: keyof typeof DEVICES; src: string; title: string }) {
  const d = DEVICES[device];
  return (
    <Fit width={d.w + 2 * d.bezel} height={d.h + 2 * d.bezel}>
      <Bezel {...d}>
        <LiveFrame src={src} title={title} />
      </Bezel>
    </Fit>
  );
}

/** A container the reader resizes by its corner, to watch the chrome adapt. */
export function ResizableFrame({ src, title }: { src: string; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const layout = width === 0 ? '' : width < 768 ? 'phone layout' : width <= 1024 ? 'tablet layout' : 'desktop layout';
  return (
    <div
      ref={ref}
      className="relative h-[560px] w-full min-w-[280px] max-w-full resize-x overflow-hidden border border-ink/70 bg-sheet"
    >
      <div className="flex h-9 items-center justify-between border-b border-rule px-3 font-mono text-xs text-ink-dim">
        <span aria-live="polite">
          {width > 0 ? `${width} px` : ' '} <span className="text-ink">{layout}</span>
        </span>
        <span>drag the corner ↘</span>
      </div>
      <div className="h-[calc(100%-2.25rem)]">
        <LiveFrame src={src} title={title} />
      </div>
    </div>
  );
}

export interface SitePage {
  label: string;
  path: string;
  /** What the page is, measured (size, node count). */
  facts: string;
  /** Its size, for the load button. */
  weight: string;
  /** Load on click only. */
  heavy?: boolean;
}

/** The pages of one Site behind tabs; a page loads only once its tab is open. */
export function SiteTabs({ pages }: { pages: SitePage[] }) {
  const [active, setActive] = useState(0);
  const page = pages[active]!;
  return (
    <div className="border border-ink/70 bg-sheet">
      <div role="tablist" aria-label="Pages of the Site" className="flex overflow-x-auto border-b border-ink/70">
        {pages.map((p, i) => (
          <button
            key={p.path}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`inline-flex h-11 sm:h-9 shrink-0 items-center border-r border-rule px-3 text-sm cursor-pointer ${FOCUS} ${i === active ? 'bg-ink text-paper' : 'text-ink-dim hover:text-ink'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Fit width={1024} height={600} fill>
        <LiveFrame key={page.path} src={page.path} title={`${page.label} of the Site`} load={page.heavy ? 'click' : 'near'} weight={page.weight} />
      </Fit>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-ink/70 pl-3 font-mono text-xs text-ink-dim">
        <span className="min-w-0 truncate py-2">
          <span className="text-ink">{page.path}</span> {page.facts}
        </span>
        <a href={page.path} target="_blank" rel="noreferrer" className={`grid h-9 w-11 shrink-0 place-items-center border-l border-rule hover:text-ink ${FOCUS}`}>
          <ExternalLink className="size-4" />
          <span className="sr-only">Open {page.label} on its own</span>
        </a>
      </div>
    </div>
  );
}
