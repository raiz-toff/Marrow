import Link from 'next/link';
import Image from 'next/image';
import { Terminal, Layers, Cpu, ShieldCheck, Download, ExternalLink } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Image src="/icon.svg" alt="Marrow" width={24} height={24} />
          <span className="font-bold tracking-tight text-foreground">Marrow</span>
        </div>
        <nav className="flex items-center gap-4 text-xs font-medium">
          <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
            Documentation
          </Link>
          <Link href="/docs/components" className="text-muted-foreground hover:text-foreground transition-colors">
            Components
          </Link>
          <Link href="/docs/guides/authoring" className="text-muted-foreground hover:text-foreground transition-colors">
            Guides
          </Link>
          <a
            href="https://github.com/raiz-toff/Marrow"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors"
          >
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-20 md:py-32 border-b border-border/40">
          <div className="container mx-auto max-w-5xl px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <span>Marrow 2.0</span>
              <span>·</span>
              <span>Now with shadcn Component Registry</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground max-w-3xl mx-auto leading-tight">
              Declarative Network Topology Studio
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Compile YAML topologies into self-contained, interactive, offline HTML network diagrams. Declare structure and redundancy; the compiler computes the layout.
            </p>

            {/* Quick Actions */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/docs/getting-started/quickstart"
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                Quickstart Guide
              </Link>
              <Link
                href="/docs/components/overview"
                className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Explore Components
              </Link>
              <Link
                href="/docs/components/catalog"
                className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Live Catalog
              </Link>
            </div>

            {/* CLI Scaffolding Snippet */}
            <div className="mt-12 max-w-xl mx-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-left font-mono text-xs shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-zinc-400">
                <span className="text-[11px]">Install with shadcn CLI</span>
                <span className="text-[10px] text-zinc-400">terminal</span>
              </div>
              <div className="pt-3 space-y-1.5 text-zinc-200">
                <div><span className="text-emerald-400">$</span> npx shadcn add raiz-toff/Marrow/switch-faceplate</div>
                <div><span className="text-emerald-400">$</span> npx shadcn add @marrow/cable-strip</div>
                <div><span className="text-emerald-400">$</span> marrow export input/branch.yaml --format svg</div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-20 bg-muted/20">
          <div className="container mx-auto max-w-5xl px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Layers className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Declare Structure</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Tiers, zones, and HA pairs are explicitly declared. The deterministic ELK layout engine computes coordinates automatically.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">100% Offline Output</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Single-file HTML or multi-page sites with zero runtime HTTP fetches. Built for air-gapped operations, field USBs, and compliance.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">shadcn Registry</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Composable React components for network engineers. Distribute switch faceplates, CLI consoles, and cable strips into any Next.js app.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background py-6 px-6 text-center text-xs text-muted-foreground">
        <p>MIT © 2026 rajkumar · Marrow is a compiler, not a SaaS.</p>
      </footer>
    </div>
  );
}
