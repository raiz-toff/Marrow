'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, Code2, Terminal } from 'lucide-react';
import { copyToClipboard } from '../lib/copy';

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
  const [copiedTarget, setCopiedTarget] = useState<'cli' | 'code' | null>(null);

  // Normalize component name if variant suffix was passed (e.g. device-link-cisco -> device-link)
  const canonicalName = name.startsWith('device-link')
    ? 'device-link'
    : name.startsWith('cable-badge')
    ? 'cable-badge'
    : name.startsWith('topology-canvas')
    ? 'topology-canvas'
    : name;

  const defaultInstall =
    installCommand ??
    `npx shadcn@latest add https://marrowdiagram.vercel.app/r/${canonicalName}.json`;

  const handleCopy = async (text: string, target: 'cli' | 'code') => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget((curr) => (curr === target ? null : curr)), 2000);
    }
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
            title={tab === 'code' ? 'Copy code to clipboard' : 'Copy install command'}
            onClick={() => {
              if (tab === 'code' && code) {
                handleCopy(code, 'code');
              } else {
                handleCopy(defaultInstall, 'cli');
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-fd-border bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors cursor-pointer select-none"
          >
            {copiedTarget === (tab === 'code' ? 'code' : 'cli') ? (
              <>
                <Check className="size-3.5 text-emerald-500" />
                <span className="text-emerald-500 text-[11px] font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span className="text-[11px] font-medium">{tab === 'code' ? 'Copy Code' : 'Copy CLI'}</span>
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
        <div className="relative rounded-2xl border border-fd-border bg-fd-background font-mono text-xs overflow-hidden shadow-xs group">
          {/* Dedicated copy button inside code block */}
          <div className="absolute top-2.5 right-2.5 z-10">
            <button
              type="button"
              onClick={() => handleCopy(code, 'code')}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium rounded-md border border-fd-border bg-fd-card/90 backdrop-blur-xs text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-colors shadow-xs cursor-pointer select-none"
              title="Copy code snippet"
            >
              {copiedTarget === 'code' ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-4 pt-5 overflow-x-auto">
            <pre className="text-fd-foreground leading-relaxed whitespace-pre font-mono">{code}</pre>
          </div>
        </div>
      )}

      {tab === 'cli' && (
        <div className="p-5 rounded-2xl border border-fd-border bg-fd-background flex flex-col gap-3 shadow-xs">
          <span className="text-xs font-medium text-fd-muted-foreground">
            Install this component into your React / Next.js project:
          </span>
          <div className="flex items-center justify-between rounded-xl border border-fd-border bg-fd-muted/30 px-3.5 py-2.5 font-mono text-xs text-fd-foreground">
            <span className="truncate select-all">{defaultInstall}</span>
            <button
              type="button"
              onClick={() => handleCopy(defaultInstall, 'cli')}
              className="ms-2 inline-flex items-center justify-center size-7 rounded-md hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground cursor-pointer transition-colors"
              title="Copy install command"
            >
              {copiedTarget === 'cli' ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-fd-muted-foreground">
            <span>
              Or via GitHub shorthand:{' '}
              <button
                type="button"
                onClick={() => handleCopy(`npx shadcn@latest add raiz-toff/Marrow/${canonicalName}`, 'cli')}
                className="text-fd-foreground font-mono hover:underline cursor-pointer bg-fd-muted/50 px-1.5 py-0.5 rounded"
              >
                npx shadcn@latest add raiz-toff/Marrow/{canonicalName}
              </button>
            </span>
            <span>
              Or via Marrow CLI:{' '}
              <button
                type="button"
                onClick={() => handleCopy(`npx marrow add ${canonicalName}`, 'cli')}
                className="text-fd-foreground font-mono hover:underline cursor-pointer bg-fd-muted/50 px-1.5 py-0.5 rounded"
              >
                npx marrow add {canonicalName}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
