'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, Code2, Terminal } from 'lucide-react';
import { useTopologyShell } from '@marrow/ui';

export function TopologySearchTrigger() {
  const { setSearchOpen } = useTopologyShell();
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border border-fd-border bg-fd-card text-fd-foreground hover:bg-fd-accent transition-colors shadow-xs font-medium text-xs cursor-pointer"
    >
      <span>Open Command Search</span>
      <kbd className="px-2 py-0.5 text-[11px] font-mono bg-fd-muted border border-fd-border rounded">Ctrl K</kbd>
    </button>
  );
}

interface ComponentPreviewProps {
  title?: string;
  name: string;
  description?: string;
  children: React.ReactNode;
  code?: string;
  height?: string;
  align?: 'center' | 'start' | 'stretch';
  installCommand?: string;
}

export function ComponentPreview({
  title,
  name,
  description,
  children,
  code,
  height = '420px',
  align = 'stretch',
  installCommand,
}: ComponentPreviewProps) {
  const [tab, setTab] = useState<'preview' | 'code' | 'cli'>('preview');
  const [copied, setCopied] = useState(false);

  const defaultInstall =
    installCommand ??
    `npx shadcn@latest add https://marrow.run/r/${name}.json`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 flex flex-col gap-2.5">
      {/* Top action & tab bar */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-fd-muted/60 border border-fd-border">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              tab === 'preview'
                ? 'bg-fd-background text-fd-foreground shadow-xs font-semibold'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            <Eye className="size-3.5" />
            <span>Preview</span>
          </button>
          {code && (
            <button
              type="button"
              onClick={() => setTab('code')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                tab === 'code'
                  ? 'bg-fd-background text-fd-foreground shadow-xs font-semibold'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              <Code2 className="size-3.5" />
              <span>Code</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('cli')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              tab === 'cli'
                ? 'bg-fd-background text-fd-foreground shadow-xs font-semibold'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            <Terminal className="size-3.5" />
            <span>Install</span>
          </button>
        </div>

        {/* Right quick copy button */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Copy command or code"
            onClick={() => {
              if (tab === 'code' && code) {
                copyToClipboard(code);
              } else {
                copyToClipboard(defaultInstall);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-fd-border bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-500 text-[11px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span className="text-[11px]">{tab === 'code' ? 'Copy Code' : 'Copy CLI'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab View */}
      {tab === 'preview' && (
        <div
          style={{ minHeight: height }}
          className="relative flex w-full p-4 sm:p-6 rounded-2xl border border-fd-border bg-fd-card/30 backdrop-blur-xs overflow-hidden items-center justify-center shadow-xs"
        >
          {children}
        </div>
      )}

      {tab === 'code' && code && (
        <div className="relative rounded-2xl border border-fd-border p-4 bg-fd-background font-mono text-xs overflow-x-auto shadow-xs">
          <pre className="text-fd-foreground leading-relaxed whitespace-pre">{code}</pre>
        </div>
      )}

      {tab === 'cli' && (
        <div className="p-5 rounded-2xl border border-fd-border bg-fd-background flex flex-col gap-3 shadow-xs">
          <span className="text-xs font-medium text-fd-muted-foreground">
            Install this component into your React / Next.js project:
          </span>
          <div className="flex items-center justify-between rounded-xl border border-fd-border bg-fd-muted/30 px-3.5 py-2.5 font-mono text-xs text-fd-foreground">
            <span className="truncate">{defaultInstall}</span>
            <button
              type="button"
              onClick={() => copyToClipboard(defaultInstall)}
              className="ms-2 inline-flex items-center justify-center size-6 rounded hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground cursor-pointer"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            </button>
          </div>
          <span className="text-[11px] text-fd-muted-foreground">
            Or install directly via GitHub: <code className="text-fd-foreground font-mono">npx shadcn@latest add raiz-toff/Marrow/{name}</code>
          </span>
        </div>
      )}
    </div>
  );
}
