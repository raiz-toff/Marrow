import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, ArrowLeft, Terminal, Shield, Layers } from 'lucide-react';
import { DemoStudio } from '@/components/demo-studio';

export const metadata = {
  title: 'Interactive Demo Studio',
  description: 'Live interactive preview of compiled Marrow topologies across multiple layout archetypes, chrome modes, and theme synchronization.',
};

export default function DemoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/80 bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <Image src="/icon.svg" alt="Marrow" width={24} height={24} />
            <span className="font-bold tracking-tight text-foreground">Marrow</span>
          </Link>
          <div className="h-4 w-px bg-border/80 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>studio</span>
            <span>/</span>
            <span className="text-foreground">live-demo</span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-xs font-medium">
          <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Back to Docs
          </Link>
          <Link href="/docs/components" className="text-muted-foreground hover:text-foreground transition-colors hidden md:block">
            Components
          </Link>
          <Link href="/docs/guides/authoring" className="text-muted-foreground hover:text-foreground transition-colors hidden md:block">
            Authoring Guide
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

      {/* Main Studio Container */}
      <main className="flex-1 container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-2 mb-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span>Declarative Viewer Studio</span>
            <span>·</span>
            <span>Single-File Offline Outputs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Interactive Topology Studio
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Test real Marrow network diagrams compiled from YAML definitions. Switch between minimal embedded stages and full workbench chrome, toggle the telemetry inspector drawer, and verify live theme synchronization.
          </p>
        </div>

        {/* Demo Studio Interactive Component */}
        <DemoStudio />

        {/* Technical Capabilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-border/60">
          <div className="rounded-xl border border-border/80 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="size-4 text-primary" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Automatic Layouts</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Coordinates are calculated dynamically by the compiler based on declared tiers, HA pairs, and zones. No manual box dragging required.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-4 text-emerald-500" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">100% Offline Portability</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every diagram compiles into a standalone, single-file HTML or SVG with zero external CDN dependencies. Safe for air-gapped field deployments.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-card/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="size-4 text-sky-500" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">CLI Compilation</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Compile any YAML file locally with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">npm run build input/file.yaml</code> or export vector diagrams headlessly.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background py-6 px-6 text-center text-xs text-muted-foreground">
        <p>MIT © 2026 rajkumar · Marrow is a compiler, not a SaaS.</p>
      </footer>
    </div>
  );
}
