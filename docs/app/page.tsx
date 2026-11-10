import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { DemoExample, type Example } from '@/components/live-diagram';
import { CopyCommand, SetupPrompt } from '@/components/agent-setup-card';
import { PixelArt } from '@/components/pixel-art';
import { HeroScene, OfficeScene } from '@/components/pixel-scenes';
import * as S from '@/components/pixel-sprites';

const REPO = 'https://github.com/raiz-toff/Marrow';
const AGENTS = ['Claude Code', 'Cursor', 'Cline', 'Windsurf', 'Antigravity'];

const demo = (id: string, label: string, file: string): Example => ({
  id,
  label,
  file,
  yaml: readFileSync(join(process.cwd(), 'demos', file), 'utf8'),
});

// An excerpt of fixtures/valid/small-office.yaml, verbatim.
const OFFICE_YAML = `zones:
  - id: edge
    name: Internet Edge
  - id: office
    name: Office LAN

devices:
  - id: edge-rt-01
    name: Edge Router
    icon: affinity/tile/router
    tier: edge
    zone: edge
  - id: fw-01
    name: Perimeter Firewall
    icon: affinity/tile/firewall
    tier: edge
    zone: edge
  - id: core-sw-01
    name: Core Switch
    icon: affinity/tile/switch-multilayer
    tier: core
    zone: office
  # … seven more devices, then the links`;

// A real run, abridged: two mistakes, the fix, then the rest of the loop.
type Line = [kind: 'cmd' | 'err' | 'warn' | 'ok' | 'dim' | 'out', text: string];
const SESSION: Line[] = [
  ['cmd', 'npm run validate -- input/office.yaml'],
  ['err', '✖ MRW-E010 devices[1].icon:8:50  Unknown icon "affinity/tile/firewal" for device "fw-01"'],
  ['dim', '    did you mean: affinity/tile/firewall, affinity/tile/firewall3, affinity/tile/camera'],
  ['dim', '    hint: browse the catalog with `marrow icons search <keyword>`'],
  ['err', '✖ MRW-E009 links[1].to:12:31  Link references unknown device "core-sw-02"'],
  ['dim', '    did you mean: core-sw-01'],
  ['warn', '▲ MRW-W103 devices[2]:9:5  Device "core-sw-01" has no links'],
  ['err', '✖ 2 errors, 1 warning — input/office.yaml'],
  ['dim', '# the agent fixes the icon id and the device reference'],
  ['cmd', 'npm run validate -- input/office.yaml'],
  ['ok', '✔ 0 errors, 0 warnings — input/office.yaml'],
  ['cmd', 'npm run snapshot -- input/office.yaml -o office.png'],
  ['out', 'snapshot office.png — 3 nodes, 2 edges'],
  ['cmd', 'npm run build -- input/office.yaml --single -o office.html'],
  ['out', 'built office.html — 3 nodes, 2 edges, 288 KB, lint clean'],
];
const TONE = { cmd: 'text-ink', err: 'text-sig-err', warn: 'text-sig-warn', ok: 'text-sig-ok', dim: 'text-ink-dim', out: 'text-ink' };

const LOOP = [
  ['validate', 'Checks the schema, every reference and the geometry of the computed layout. Exit code 0 means ready.'],
  ['snapshot', 'Renders a PNG in headless Chromium, so the agent looks at the picture before you do.'],
  ['build', 'Compiles one self-contained HTML file, or a multi-page site when the network is large.'],
];

const FACTS: [S.Sprite, string, string][] = [
  [S.FILE, 'One HTML file', 'Styles, the runtime and the icons a diagram uses are inlined. Commit it next to the YAML or attach it to a change.'],
  [S.LAPTOP, 'No network requests', 'No CDN, no web fonts, no telemetry. It opens on an air-gapped network exactly as it does on your laptop.'],
  [S.TWINS, 'Byte-identical builds', 'The same YAML produces the same bytes, and a geometry defect fails the build instead of shipping.'],
];

const FLAGS = [
  ['?chrome=minimal', 'hides the command bar, sidebar and minimap'],
  ['&inspector=off', 'keeps the inspector closed on click'],
  ['&theme=dark', 'overrides the authored theme'],
  ['#d=core-sw-01', 'opens with that device selected'],
];

const IFRAME = `<iframe
  src="/diagrams/branch.html?chrome=minimal"
  title="Branch office network"
  style="width:100%; height:600px; border:none;"
></iframe>`;

function Yaml({ source }: { source: string }) {
  return source.split('\n').map((line, i) => {
    const m = /^(\s*-?\s*)([\w-]+:)(.*)$/.exec(line);
    return (
      <span key={i} className="block">
        {m ? (
          <>
            {m[1]}
            <span className="text-ink-dim">{m[2]}</span>
            {m[3]}
          </>
        ) : (
          <span className="text-ink-dim">{line || ' '}</span>
        )}
      </span>
    );
  });
}

function FileBlock({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <figure className={`min-w-0 border border-ink/70 bg-sheet ${className}`}>
      <figcaption className="border-b border-rule px-4 py-2 font-mono text-xs text-ink-dim">{title}</figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-ink">
        <code>{children}</code>
      </pre>
    </figure>
  );
}

function Section({ id, sprite, title, lead, children }: { id: string; sprite?: S.Sprite; title: string; lead: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-rule py-16 sm:py-24">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        {sprite && <PixelArt sprite={sprite} scale={3} className="shrink-0 text-ink" />}
        <div>
          <h2 id={id} className="max-w-[24ch] text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-ink">
            {title}
          </h2>
          <p className="mt-3 max-w-[60ch] text-base sm:text-lg leading-relaxed text-ink-dim">{lead}</p>
        </div>
      </div>
      <div className="mt-10 sm:mt-14">{children}</div>
    </section>
  );
}

const LINK = 'text-ink underline underline-offset-4 decoration-rule hover:decoration-ink';

export default function HomePage() {
  const examples = [
    demo('tiered', 'Enterprise backbone', 'tiered.yaml'),
    demo('trunks', 'VLAN trunks', 'trunk-vlans.yaml'),
    demo('hub', 'WAN hub', 'hub-spoke.yaml'),
  ];

  return (
    <HomeLayout {...baseOptions()} className="landing">
      <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-8">
        <section className="grid items-center gap-12 pt-12 pb-16 sm:pt-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:pb-24">
          <div>
            <h1 className="text-[clamp(2.1rem,0.45rem+7.3vw,4rem)] lg:text-[min(calc(0.25rem+4.6vw),4.1rem)] font-normal leading-[1.02] tracking-[-0.045em] text-ink">
              Describe the network.
              <br />
              Get the diagram.
            </h1>
            <p className="mt-6 max-w-[54ch] text-base sm:text-lg leading-relaxed text-ink-dim">
              Marrow is an agentic diagram tool. Tell your coding agent what the network is; it
              writes the topology as YAML, checks it, looks at the result and builds an interactive
              diagram in one HTML file that works offline. There is no canvas to draw on.
            </p>
            <div className="mt-8">
              <SetupPrompt>
                <CopyCommand command="npm run build -- input/net.yaml" />
              </SetupPrompt>
            </div>
            <p className="mt-6 text-sm text-ink-dim">
              Works with <span className="text-ink">{AGENTS.join(', ')}</span> and any agent that runs commands.
            </p>
          </div>
          <HeroScene className="mx-auto w-full max-w-[640px] text-ink" />
        </section>

        <Section id="live" sprite={S.WINDOW} title="This is a compiled diagram, not a screenshot." lead="Pick a topology, then click a device or a cable to inspect it. Show the YAML it was built from.">
          <DemoExample examples={examples} />
        </Section>

        <Section id="declare" sprite={S.ROUTER} title="Say what the network is, not where things go." lead="Each device declares its tier and its zone. Marrow computes one layout from that, so a change to the network is a change in one place.">
          <div className="grid gap-8 lg:grid-cols-2">
            <FileBlock title="fixtures/valid/small-office.yaml">
              <Yaml source={OFFICE_YAML} />
            </FileBlock>
            <figure className="flex flex-col justify-center">
              <OfficeScene className="w-full text-ink" />
              <figcaption className="mt-4 text-sm text-ink-dim">
                All ten devices: tiers set the rank, top to bottom; zones draw the boundary. No
                coordinates anywhere in the file.
              </figcaption>
            </figure>
          </div>
        </Section>

        <Section id="loop" sprite={S.AGENT} title="Your agent runs the loop." lead="Every diagnostic carries a stable code, the line and column, a fix hint and did-you-mean suggestions, so the agent corrects itself before you look.">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <FileBlock title="terminal">
              {SESSION.map(([kind, text], i) => (
                <span key={i} className={`block ${TONE[kind]}`}>
                  {kind === 'cmd' && <span className="select-none text-ink-dim">$ </span>}
                  {text || ' '}
                </span>
              ))}
            </FileBlock>
            <ol className="flex flex-col gap-6">
              {LOOP.map(([cmd, body], i) => (
                <li key={cmd} className="flex gap-4">
                  <span className="pt-0.5 font-mono text-sm text-ink-dim tabular-nums">{i + 1}</span>
                  <div>
                    <p className="font-mono text-sm text-ink">{cmd}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-dim">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>

        <Section id="offline" title="One file. Works offline. Same bytes every time." lead="A diagram built today opens the same way in five years, because nothing it depends on can go away.">
          <ul className="grid gap-10 sm:grid-cols-3">
            {FACTS.map(([sprite, title, body]) => (
              <li key={title}>
                <PixelArt sprite={sprite} scale={3} className="text-ink" />
                <p className="mt-5 text-lg text-ink">{title}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-dim">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="embed" sprite={S.CLOUD} title="Embed it anywhere." lead="Put the HTML file in an iframe and set its chrome from the URL, or install the React component from the shadcn registry.">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="min-w-0">
              <FileBlock title="index.html">{IFRAME}</FileBlock>
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {FLAGS.map(([flag, effect]) => (
                  <div key={flag} className="contents">
                    <dt className="font-mono text-ink">{flag}</dt>
                    <dd className="text-ink-dim">{effect}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="min-w-0">
              <CopyCommand command="npx shadcn@latest add https://marrowdiagram.vercel.app/r/topology-canvas.json" />
              <p className="mt-6 max-w-[56ch] text-[15px] leading-relaxed text-ink-dim">
                Adds <code className="font-mono text-ink">&lt;MarrowEmbed /&gt;</code>, which follows your
                site&apos;s light or dark theme and opens the diagram full screen. See{' '}
                <Link href="/docs/guides/embedding" className={LINK}>
                  embedding
                </Link>{' '}
                for every flag.
              </p>
            </div>
          </div>
        </Section>

        <section aria-labelledby="start" className="border-t border-rule py-20 sm:py-28">
          <div className="flex items-end gap-3">
            <PixelArt sprite={S.AGENT} scale={4} className="text-ink" />
            <PixelArt sprite={S.SPARKLE} scale={3} className="mb-16 text-ink" />
          </div>
          <h2 id="start" className="mt-8 max-w-[18ch] text-[clamp(2rem,1.2rem+3.4vw,3.75rem)] font-normal leading-[1.04] tracking-[-0.04em] text-ink">
            Your next diagram is one prompt away.
          </h2>
          <div className="mt-8">
            <SetupPrompt id="closing">
              <Link
                href="/docs"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center border border-ink/70 px-5 text-[15px] text-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              >
                Read the docs
              </Link>
            </SetupPrompt>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-rule py-8 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
          <p>Marrow is a hobby project by rajkumar, released under the MIT license.</p>
          <div className="flex gap-6">
            <a href={REPO} className="inline-flex min-h-11 items-center hover:text-ink">
              GitHub
            </a>
            <a href={`${REPO}/issues`} className="inline-flex min-h-11 items-center hover:text-ink">
              Report a bug
            </a>
          </div>
        </footer>
      </div>
    </HomeLayout>
  );
}
