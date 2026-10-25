import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { DemoExample } from '@/components/interactive-hero';
import { SetupPrompt } from '@/components/agent-setup-card';

const REPO = 'https://github.com/raiz-toff/Marrow';

// The agent loop from docs/agents/golden-loop — a real sequence, so it is numbered.
const LOOP = [
  {
    title: 'You describe the network',
    body: 'In plain words, or by pasting device configs, lab notes or discovery output. The agent asks only what it cannot work out.',
  },
  {
    title: 'The agent writes the YAML',
    body: 'It looks up real icon IDs instead of guessing, and declares each device’s tier, zone and HA partner. Marrow works out the layout, so there are no coordinates to get wrong.',
  },
  {
    title: 'Marrow checks it',
    body: 'validate reports every error with the line, a fix hint and did-you-mean suggestions. The agent fixes them and runs it again until it is clean.',
  },
  {
    title: 'The agent looks at the picture',
    body: 'It renders a snapshot and checks it by eye, then builds a single HTML file you can pan, zoom, search and open offline.',
  },
];

const EXAMPLE_ASK = `Read our branch router config and create input/branch-office.yaml.
Put the WAN router in an edge zone, connect it to an HA firewall pair,
and link down to the access switches. Validate it and show me a snapshot.`;

const RUN_LOCALLY = `git clone ${REPO}.git
cd Marrow
npm run setup

# write input/network.yaml, then
npm run validate -- input/network.yaml
npm run build -- input/network.yaml --single -o network.html`;

export default function HomePage() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <section className="pt-16 pb-12 md:pt-24">
          <h1 className="text-4xl font-semibold tracking-tight text-fd-foreground md:text-5xl">
            Marrow
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-fd-muted-foreground md:text-xl">
            Network diagrams you make by talking to your coding agent. Describe the network, the
            agent writes and checks the topology, and Marrow turns it into an interactive diagram
            that works offline.
          </p>
          <p className="mt-3 max-w-2xl text-fd-muted-foreground">
            There is no drawing canvas. Works with Claude Code, Cursor, Cline, Windsurf, Antigravity
            or any agent that can run commands.
          </p>
          <div className="mt-8">
            <SetupPrompt />
          </div>
        </section>

        <section aria-labelledby="example-heading" className="pb-20">
          <h2 id="example-heading" className="sr-only">
            Example
          </h2>
          <DemoExample />
          <p className="mt-3 text-sm text-fd-muted-foreground">
            Left is the kind of file your agent writes. Right is what Marrow builds from it. Click a
            device or a link to inspect it.
          </p>
        </section>

        <section aria-labelledby="how-heading" className="border-t py-16">
          <h2 id="how-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
            How a diagram gets made
          </h2>
          <p className="mt-3 max-w-2xl text-fd-muted-foreground">
            The repo ships an <code className="font-mono text-sm text-fd-foreground">AGENTS.md</code>{' '}
            and a topology skill, so your agent already knows the rules when it opens the folder.
          </p>
          <ol className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
            {LOOP.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="font-mono text-sm text-fd-muted-foreground tabular-nums">{i + 1}</span>
                <div>
                  <p className="font-medium text-fd-foreground">{step.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-14 font-medium text-fd-foreground">What you might ask it</h3>
          <pre className="mt-3 max-w-3xl overflow-x-auto rounded-lg border bg-fd-secondary p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-fd-secondary-foreground">
            {EXAMPLE_ASK}
          </pre>
          <p className="mt-4 text-sm text-fd-muted-foreground">
            More on this in{' '}
            <Link href="/docs/agents/golden-loop" className="text-fd-foreground underline underline-offset-4">
              the agent loop
            </Link>{' '}
            and{' '}
            <Link href="/docs/decisions/0002-agent-driven-no-gui" className="text-fd-foreground underline underline-offset-4">
              why there is no GUI
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="run-heading" className="border-t py-16">
          <h2 id="run-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
            Without an agent
          </h2>
          <p className="mt-3 max-w-2xl text-fd-muted-foreground">
            Everything the agent does is a plain command, so you can run it by hand. It is a local
            tool, not a hosted service, and needs Node.js 24 or newer.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-lg border bg-fd-secondary p-4 font-mono text-[13px] leading-relaxed text-fd-secondary-foreground">
            <code>{RUN_LOCALLY}</code>
          </pre>
          <p className="mt-4 text-sm text-fd-muted-foreground">
            Next:{' '}
            <Link href="/docs/getting-started/first-diagram" className="text-fd-foreground underline underline-offset-4">
              your first diagram
            </Link>
            ,{' '}
            <Link href="/docs/reference/schema" className="text-fd-foreground underline underline-offset-4">
              the schema
            </Link>
            , or{' '}
            <Link href="/docs/showcase" className="text-fd-foreground underline underline-offset-4">
              more examples
            </Link>
            .
          </p>
        </section>

        <footer className="flex flex-col gap-2 border-t py-8 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Marrow is a hobby project by rajkumar, released under the MIT license.</p>
          <div className="flex gap-4">
            <a href={REPO} className="hover:text-fd-foreground">
              GitHub
            </a>
            <a href={`${REPO}/issues`} className="hover:text-fd-foreground">
              Report a bug
            </a>
          </div>
        </footer>
      </main>
    </HomeLayout>
  );
}
