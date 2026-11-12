import Link from 'next/link';
import type { ReactNode } from 'react';
import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc';
import { CopyCommand } from '../agent-setup-card';
import { DemoExample } from '../live-diagram';
import { PixelArt } from '../pixel-art';
import * as S from '../pixel-sprites';
import { Bezel, Fit, LiveFrame, SiteTabs } from './frames';
import { declaredDevices, demoSource, fileBytes, folderFacts, formatBytes, pageFacts } from './stats';

const THEMES = { light: 'github-light', dark: 'github-dark' } as const;

/** A highlighted code block with a file title, like a fenced block in MDX. */
export function Code({ code, lang, title }: { code: string; lang: string; title: string }) {
  return <ServerCodeBlock code={code.trim()} lang={lang} themes={THEMES} codeblock={{ title }} />;
}

/** A file under docs/demos/, shown verbatim. */
export function DemoFile({ path }: { path: string }) {
  return <Code code={demoSource(path)} lang="yaml" title={`docs/demos/${path}`} />;
}

/** One live variant of a diagram with the exact URL that produced it. */
export function Specimen({ title, url, height = 540, children }: { title: string; url: string; height?: number; children: ReactNode }) {
  return (
    <figure className="not-prose my-8 border border-ink/70 bg-sheet">
      <Fit width={900} height={height} fill>
        <LiveFrame src={url} title={title} />
      </Fit>
      <figcaption className="flex flex-col gap-3 border-t border-ink/70 p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="text-[15px] text-ink">{title}</p>
          <div className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-dim [&_code]:font-mono [&_code]:text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4">{children}</div>
        </div>
        <div className="min-w-0 lg:max-w-[55%] lg:shrink-0">
          <CopyCommand command={url} prompt={false} />
        </div>
      </figcaption>
    </figure>
  );
}

// ─── gallery ────────────────────────────────────────────────────────────────

interface Card {
  slug: string;
  title: string;
  sprite: S.Sprite;
  when: string;
  thumb: { src: string } | { phone: string } | { image: string; alt: string };
}

const CARDS: Card[] = [
  {
    slug: 'chrome',
    title: 'Chrome modes',
    sprite: S.WINDOW,
    when: 'Choose how much interface readers get, from the full workbench to the bare diagram, with flags in the URL.',
    thumb: { src: '/demo/zoned.html' },
  },
  {
    slug: 'embedding',
    title: 'Embedding contexts',
    sprite: S.CLOUD,
    when: 'See it in running text, a card grid, a hero band, a 320 px sidebar, and as a React component.',
    thumb: { src: '/demo/tiered.html#chrome=minimal' },
  },
  {
    slug: 'devices',
    title: 'Phones and tablets',
    sprite: S.PHONE,
    when: 'Check what a reader on a phone gets: the bottom bar, the inspector as a bottom sheet, minimal chrome.',
    thumb: { phone: '/demo/zoned.html' },
  },
  {
    slug: 'output',
    title: 'Single file or Site',
    sprite: S.FILE,
    when: 'Know what you ship: one HTML file, or a folder of linked pages once a network passes 150 devices or 5 zones.',
    thumb: { src: '/demo/scale-site/index.html#chrome=minimal' },
  },
  {
    slug: 'density',
    title: 'Density and theme',
    sprite: S.SWITCH,
    when: 'Set spacing and colours for every diagram you build from one marrow.config.yaml.',
    thumb: { src: '/demo/zoned-themed.html#chrome=minimal;inspector=off;d=dc-sw' },
  },
  {
    slug: 'headless',
    title: 'Headless and dev',
    sprite: S.LAPTOP,
    when: 'PNGs for tickets and wikis, printing, the export menu, and live reload while you edit.',
    thumb: { image: '/showcase/snapshot-zoned-1366.png', alt: 'A PNG from marrow snapshot of the two-site demo' },
  },
  {
    slug: 'studio',
    title: 'Studio',
    sprite: S.SPARKLE,
    when: 'Try every demo topology in either chrome, read its YAML and copy its URL.',
    thumb: { src: '/demo/hub-spoke.html#chrome=minimal' },
  },
];

function Thumb({ thumb, title }: Pick<Card, 'thumb' | 'title'>) {
  if ('image' in thumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumb.image} alt={thumb.alt} width={1366} height={900} loading="lazy" className="block aspect-[16/10] w-full object-cover object-top" />
    );
  }
  return (
    <Fit width={960} height={600}>
      {'src' in thumb ? (
        <LiveFrame src={thumb.src} title={`${title}: preview`} />
      ) : (
        <div className="grid h-full place-items-center bg-paper">
          <Bezel w={300} h={560} bezel={14} step={6}>
            <LiveFrame src={thumb.phone} title={`${title}: preview`} />
          </Bezel>
        </div>
      )}
    </Fit>
  );
}

/** The showcase index: one card per way a diagram can appear. */
export function Gallery() {
  return (
    <div className="not-prose grid gap-6 sm:grid-cols-2">
      {CARDS.map((c, i) => {
        const wide = i === CARDS.length - 1 && CARDS.length % 2 === 1;
        return (
          <article key={c.slug} className={`flex min-w-0 flex-col border border-ink/70 bg-sheet ${wide ? 'sm:col-span-2 lg:grid lg:grid-cols-[3fr_2fr]' : ''}`}>
            <div className={`min-w-0 border-ink/70 ${wide ? 'border-b lg:border-b-0 lg:border-r' : 'border-b'}`}>
              <Thumb thumb={c.thumb} title={c.title} />
            </div>
            <div className="flex gap-4 p-5">
              <PixelArt sprite={c.sprite} scale={2} className="mt-1 shrink-0 text-ink" />
              <div>
                <h2 className="text-lg font-normal tracking-[-0.01em] text-ink">
                  <Link href={`/docs/showcase/${c.slug}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                    {c.title}
                  </Link>
                </h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-dim">{c.when}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── output shapes ──────────────────────────────────────────────────────────

const rendererName = (r: string) => (r === 'canvas' ? 'canvas' : r === 'svg' ? 'SVG' : 'no diagram');

/** Single file versus Site, every number read from the built files. */
export function ShapeTable() {
  const zoned = pageFacts('/demo/zoned.html');
  const scale = pageFacts('/demo/scale.html');
  const site = folderFacts('/demo/scale-site');
  const rows = [
    ['zoned.html', 'build zoned.yaml --single', `${declaredDevices('zoned.yaml')}`, '1', formatBytes(zoned.bytes), `${rendererName(zoned.renderer)}, ${zoned.nodes} nodes`],
    ['scale.html', 'build scale.yaml --single', `${declaredDevices('scale.yaml')}`, '1', formatBytes(scale.bytes), `${rendererName(scale.renderer)}, ${scale.nodes} nodes`],
    ['scale-site/', 'build scale.yaml', `${declaredDevices('scale.yaml')}`, site.files.toLocaleString('en'), formatBytes(site.bytes), 'per page'],
  ];
  return (
    <div className="not-prose my-8 overflow-x-auto border border-ink/70 bg-sheet">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="border-b border-ink/70 text-ink-dim">
          <tr>
            {['Output', 'Command', 'Devices', 'Files', 'Size', 'Renderer'].map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([out, cmd, ...rest]) => (
            <tr key={out} className="border-b border-rule last:border-0">
              <th scope="row" className="px-4 py-2 font-mono text-xs font-normal text-ink">
                {out}
              </th>
              <td className="px-4 py-2 font-mono text-xs text-ink-dim">{cmd}</td>
              {rest.map((v, i) => (
                <td key={i} className="px-4 py-2 tabular-nums text-ink">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The Site's shared assets, measured. */
export function SiteAssets() {
  const files = ['runtime.js', 'styles.css', 'search-data.js'];
  return (
    <>
      {files.map((f, i) => (
        <span key={f}>
          <code>assets/{f}</code> ({formatBytes(fileBytes(`/demo/scale-site/assets/${f}`))}){i < files.length - 2 ? ', ' : i === files.length - 2 ? ' and ' : ''}
        </span>
      ))}
    </>
  );
}

export function SitePages() {
  const page = (label: string, path: string, heavy = false) => {
    const f = pageFacts(path);
    const what = f.renderer === 'none' ? 'a table of every device' : `${rendererName(f.renderer)}, ${f.nodes} nodes`;
    return { label, path, weight: formatBytes(f.bytes), facts: `${formatBytes(f.bytes)}, ${what}`, heavy };
  };
  return (
    <div className="not-prose my-8">
      <SiteTabs
        pages={[
          page('Overview', '/demo/scale-site/index.html'),
          page('Zone page', '/demo/scale-site/zones/dc1.html', true),
          page('Device page', '/demo/scale-site/devices/dc1-spine-01.html'),
          page('Inventory', '/demo/scale-site/inventory.html', true),
        ]}
      />
    </div>
  );
}

/** One page per renderer tier, side by side, with what each draws. */
export function TierPair() {
  const tiers = [
    { path: '/demo/zoned.html', heavy: false },
    { path: '/demo/scale.html', heavy: true },
  ];
  return (
    <div className="not-prose my-8 grid gap-6 lg:grid-cols-2">
      {tiers.map(({ path, heavy }) => {
        const f = pageFacts(path);
        return (
          <figure key={path} className="min-w-0 border border-ink/70 bg-sheet">
            <Fit width={900} height={600}>
              <LiveFrame src={`${path}#chrome=minimal`} title={`${path}: ${f.renderer} tier`} load={heavy ? 'click' : 'near'} weight={formatBytes(f.bytes)} big />
            </Fit>
            <figcaption className="border-t border-ink/70 px-4 py-3 text-sm text-ink-dim">
              <span className="font-mono text-xs text-ink">{path.split('/').pop()}</span>: {f.nodes} nodes drawn on {f.renderer === 'canvas' ? 'a canvas' : 'SVG'}, {formatBytes(f.bytes)}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ─── density and theme ──────────────────────────────────────────────────────

/** zoned.yaml at each density, all at zoom 1 so the sizes compare directly. */
export function DensityRow() {
  return (
    <div className="not-prose my-8 grid gap-6 md:grid-cols-3">
      {(['compact', 'standard', 'spacious'] as const).map((d) => {
        const path = `/demo/zoned-${d}.html`;
        const { size } = pageFacts(path);
        const c = size ? `;c=${size.w / 2},${size.h / 2},1` : '';
        const url = `${path}#chrome=minimal;controls=off;inspector=off${c}`;
        return (
          <figure key={d} className="min-w-0 border border-ink/70 bg-sheet">
            <Fit width={680} height={960}>
              <LiveFrame src={url} title={`zoned.yaml at ${d} density`} />
            </Fit>
            <figcaption className="border-t border-ink/70 p-4">
              <p className="text-[15px] text-ink">{d}</p>
              <p className="mt-1 text-sm text-ink-dim tabular-nums">{size ? `Scene ${size.w} × ${size.h} px at zoom 1` : ''}</p>
              <div className="mt-3">
                <CopyCommand command={url} prompt={false} />
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/** The same diagram under Marrow's own theme and under a config theme. */
export function ThemePair() {
  const variants = [
    ['zoned-standard.html', 'config/standard.yaml: Marrow’s own theme'],
    ['zoned-themed.html', 'config/themed.yaml: accent, up colour, 10G width'],
  ] as const;
  return (
    <div className="not-prose my-8 grid gap-6 lg:grid-cols-2">
      {variants.map(([file, caption]) => {
        const url = `/demo/${file}#chrome=minimal;inspector=off;d=dc-sw`;
        return (
          <figure key={file} className="min-w-0 border border-ink/70 bg-sheet">
            <Fit width={900} height={620}>
              <LiveFrame src={url} title={`zoned.yaml built with ${caption}`} />
            </Fit>
            <figcaption className="border-t border-ink/70 p-4">
              <p className="text-sm text-ink-dim">{caption}</p>
              <div className="mt-3">
                <CopyCommand command={url} prompt={false} />
              </div>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ─── headless ───────────────────────────────────────────────────────────────

/** A committed screenshot from docs/public/showcase/, with the command that made it. */
export function Shot({ src, alt, w, h, command, children }: { src: string; alt: string; w: number; h: number; command?: string; children?: ReactNode }) {
  return (
    <figure className="not-prose my-8 min-w-0 border border-ink/70 bg-sheet">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/showcase/${src}`} alt={alt} width={w} height={h} loading="lazy" className="block h-auto w-full" />
      <figcaption className="border-t border-ink/70 p-4">
        {children && <div className="max-w-[62ch] text-sm leading-relaxed text-ink-dim [&_code]:font-mono [&_code]:text-ink [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4">{children}</div>}
        {command && (
          <div className={children ? 'mt-3' : undefined}>
            <CopyCommand command={command} />
          </div>
        )}
      </figcaption>
    </figure>
  );
}

/** Two figures side by side from lg up. */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="not-prose grid gap-6 lg:grid-cols-2 [&>figure]:my-0 my-8">{children}</div>;
}


// ─── studio ─────────────────────────────────────────────────────────────────

const STUDIO: [file: string, label: string][] = [
  ['tiered.yaml', 'Campus backbone'],
  ['zoned.yaml', 'Two sites'],
  ['hub-spoke.yaml', 'WAN branches'],
  ['trunk-vlans.yaml', 'VLAN trunks'],
  ['vpn-tunnels.yaml', 'VPN tunnels'],
  ['lacp-portchannel.yaml', 'Port-channels'],
];

/** Every small demo, either chrome, with its YAML. */
export function Studio() {
  const examples = STUDIO.map(([file, label]) => ({ id: file, label, file, yaml: demoSource(file) }));
  return (
    <div className="not-prose my-8">
      <DemoExample examples={examples} modes />
    </div>
  );
}

// ─── inline facts ───────────────────────────────────────────────────────────

/** Devices a demo declares, counted from its YAML. */
export function Devices({ demo }: { demo: string }) {
  return <>{declaredDevices(demo)}</>;
}

/** A built page's size. */
export function Size({ path }: { path: string }) {
  return <>{formatBytes(fileBytes(path))}</>;
}

/** Nodes a built page draws. */
export function Nodes({ path }: { path: string }) {
  return <>{pageFacts(path).nodes}</>;
}
