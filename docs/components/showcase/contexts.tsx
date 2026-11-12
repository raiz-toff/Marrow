import type { ReactNode } from 'react';
import { MarrowEmbed } from '@marrow/ui';
import { LiveFrame, WhenNear } from './frames';
import { Code } from './plates';

/**
 * Host-page mock-ups: each renders a compiled diagram the way a site would,
 * and shows the markup that does it. Both come from the same constants, so
 * the snippet is exactly what runs.
 */

interface Embed {
  src: string;
  title: string;
  height: number;
}

const iframe = ({ src, title, height }: Embed, indent = '') =>
  [
    `<iframe`,
    `  src="${src}"`,
    `  title="${title}"`,
    `  loading="lazy"`,
    `  style="display:block; width:100%; height:${height}px; border:0;"`,
    `></iframe>`,
  ]
    .map((l) => indent + l)
    .join('\n');

function Frame({ src, title, height }: Embed) {
  return (
    <div style={{ height }} className="w-full">
      <LiveFrame src={src} title={title} />
    </div>
  );
}

/** The host page: paper, a hairline, and a note saying whose page it is. */
function Host({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="not-prose mt-6 border border-ink/70 bg-paper">
      <p className="border-b border-rule px-4 py-2 text-xs text-ink-dim">{label}</p>
      {children}
    </div>
  );
}

const P = 'text-[15px] leading-relaxed text-ink-dim';

// ─── in prose ───────────────────────────────────────────────────────────────

const PROSE: Embed = { src: '/demo/zoned.html#chrome=minimal', title: 'Two sites: headquarters and datacenter', height: 360 };

export function InProse() {
  return (
    <>
      <Host label="A runbook page with a 62-character text column">
        <article className="mx-auto max-w-[62ch] px-4 py-8 sm:px-6">
          <h3 className="text-xl tracking-[-0.01em] text-ink">Database failover</h3>
          <p className={`mt-3 ${P}`}>
            The database in the datacenter fails over to DR nightly. Before a failover test, trace the path from
            headquarters: firewall, the site-to-site WAN link, the DC router, the DC switch.
          </p>
          <div className="my-6 border border-rule">
            <Frame {...PROSE} />
          </div>
          <p className={P}>Click a device or a link to inspect it without leaving the page.</p>
        </article>
      </Host>
      <Code lang="html" title="runbook.html" code={`<p>The database in the datacenter fails over to DR nightly. …</p>\n${iframe(PROSE)}`} />
    </>
  );
}

// ─── card grid ──────────────────────────────────────────────────────────────

const CARDS: (Embed & { caption: string })[] = [
  { src: '/demo/zoned.html#chrome=minimal;controls=off', title: 'Two sites', height: 240, caption: 'Headquarters and the datacenter, joined by one WAN link.' },
  { src: '/demo/hub-spoke.html#chrome=minimal;controls=off', title: 'WAN branches', height: 240, caption: 'One hub; every branch reaches only the hub.' },
];

export function CardGrid() {
  return (
    <>
      <Host label="An index page with a two-column card grid">
        <div className="grid gap-6 p-4 sm:grid-cols-2 sm:p-6">
          {CARDS.map((c) => (
            <figure key={c.src} className="min-w-0 border border-ink/70 bg-sheet">
              <Frame {...c} />
              <figcaption className="border-t border-rule p-4">
                <p className="text-ink">{c.title}</p>
                <p className="mt-1 text-sm text-ink-dim">{c.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Host>
      <Code
        lang="html"
        title="networks.html"
        code={[
          `<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:24px;">`,
          ...CARDS.flatMap((c) => [
            `  <figure style="margin:0; border:1px solid currentColor;">`,
            iframe(c, '    '),
            `    <figcaption>${c.title}</figcaption>`,
            `  </figure>`,
          ]),
          `</div>`,
        ].join('\n')}
      />
    </>
  );
}

// ─── hero band ──────────────────────────────────────────────────────────────

const HERO: Embed = { src: '/demo/tiered.html#chrome=minimal;inspector=off;controls=off', title: 'Enterprise campus backbone', height: 440 };

export function HeroBand() {
  return (
    <>
      <Host label="A landing page whose hero is the network, edge to edge">
        <div className="px-4 pt-8 pb-6 sm:px-6">
          <h3 className="max-w-[20ch] text-2xl tracking-[-0.02em] text-ink sm:text-3xl">The campus network, as it is today</h3>
        </div>
        <div className="border-y border-rule">
          <Frame {...HERO} />
        </div>
        <p className={`px-4 py-6 sm:px-6 ${P}`}>The inspector and the zoom buttons are off. Dragging to pan and scrolling to zoom still work.</p>
      </Host>
      <Code
        lang="html"
        title="index.html"
        code={`<section style="width:100vw; margin-left:calc(50% - 50vw);">\n${iframe(HERO, '  ')}\n</section>`}
      />
    </>
  );
}

// ─── sidebar ────────────────────────────────────────────────────────────────

const ASIDE: Embed = { src: '/demo/zoned.html#chrome=minimal;minimap=off', title: 'Two sites', height: 420 };

export function Sidebar() {
  return (
    <>
      <Host label="A wiki page with a 320 px aside">
        <div className="grid gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h3 className="text-xl tracking-[-0.01em] text-ink">Headquarters</h3>
            <p className={`mt-3 ${P}`}>
              Two core switches in an HA pair, bundled as port-channel po1, carry the access switch and the firewall. The
              firewall&apos;s second port is the site-to-site link to the datacenter.
            </p>
            <p className={`mt-3 ${P}`}>
              At 320 px the diagram is narrower than 768 px, so it uses its phone layout: tap a device and the inspector
              opens as a bottom sheet inside the aside.
            </p>
          </div>
          <aside className="w-[320px] max-w-full border border-ink/70 bg-sheet">
            <Frame {...ASIDE} />
          </aside>
        </div>
      </Host>
      <Code lang="html" title="wiki/headquarters.html" code={`<aside style="width:320px;">\n${iframe(ASIDE, '  ')}\n</aside>`} />
    </>
  );
}

// ─── React ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Two sites', src: '/demo/zoned.html' },
  { label: 'Campus', src: '/demo/tiered.html' },
  { label: 'WAN', src: '/demo/hub-spoke.html' },
];

export function ReactEmbed() {
  return (
    <>
      <div className="not-prose mt-6">
        <WhenNear height={520}>
          <MarrowEmbed presets={PRESETS} height={520} title="Marrow demo diagrams" />
        </WhenNear>
      </div>
      <Code
        lang="tsx"
        title="app/network/page.tsx"
        code={`import { MarrowEmbed } from '@/components/marrow/topology-canvas';

const presets = [
${PRESETS.map((p) => `  { label: '${p.label}', src: '${p.src}' },`).join('\n')}
];

export default function NetworkPage() {
  // theme defaults to "auto": it follows your site's light or dark theme
  return <MarrowEmbed presets={presets} height={520} title="Marrow demo diagrams" />;
}`}
      />
    </>
  );
}
