'use client';

import Link from 'next/link';
import { ArrowLeft, PanelsTopLeft } from 'lucide-react';
import { ComponentWorkbench } from '@/components/component-showcases';

export default function StandaloneWorkbenchPage() {
  return (
    <div className="flex flex-col min-h-screen w-full bg-background text-foreground font-sans p-4 sm:p-6 gap-4">
      {/* Top Bar with Quick Nav */}
      <header className="flex items-center justify-between pb-3 border-b border-border/70">
        <div className="flex items-center gap-3">
          <Link
            href="/docs/components/workbench"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-all shadow-2xs"
          >
            <ArrowLeft className="size-3.5" />
            <span>Docs</span>
          </Link>
          <div className="flex items-center gap-2">
            <PanelsTopLeft className="size-4 text-primary" />
            <h1 className="text-sm font-semibold tracking-tight text-foreground">
              Marrow UI Component Studio &amp; Workbench
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              Zero-Diagram Shell
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground font-mono hidden sm:block">
          Test components before standalone compiler integration
        </div>
      </header>

      {/* Main Full-Screen Workbench Area */}
      <main className="flex-1 w-full min-h-0 flex flex-col">
        <ComponentWorkbench />
      </main>
    </div>
  );
}
