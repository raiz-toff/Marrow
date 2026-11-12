'use client';

import { useState } from 'react';
import { MarrowEmbed } from '@marrow/ui';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { copyToClipboard } from '../lib/copy';

export interface Example {
  id: string;
  label: string;
  /** File under docs/demos/, compiled into public/demo/. */
  file: string;
  yaml: string;
}

const TAB = 'inline-flex h-11 sm:h-9 shrink-0 items-center px-3 text-sm cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-signal';

/**
 * The live diagram: a compiled Marrow page with the YAML it came from. With
 * `modes`, the reader also switches between minimal and full chrome.
 */
export function DemoExample({ examples, modes = false }: { examples: Example[]; modes?: boolean }) {
  const [active, setActive] = useState(examples[0]!);
  const [yamlOpen, setYamlOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chrome, setChrome] = useState<'minimal' | 'full'>('minimal');
  const page = `/demo/${active.file.replace(/\.yaml$/, '.html')}`;
  const url = chrome === 'minimal' ? `${page}#chrome=minimal` : page;

  const copy = async () => {
    if (await copyToClipboard(active.yaml)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-ink/70 bg-sheet">
      <div className="flex flex-wrap items-stretch border-b border-ink/70">
        <div role="tablist" aria-label="Example topologies" className="flex w-full sm:w-auto min-w-0 sm:flex-1 overflow-x-auto">
          {examples.map((ex) => (
            <button
              key={ex.id}
              id={`example-tab-${ex.id}`}
              type="button"
              role="tab"
              aria-selected={ex.id === active.id}
              onClick={() => setActive(ex)}
              className={`${TAB} border-r border-rule ${ex.id === active.id ? 'bg-ink text-paper' : 'text-ink-dim hover:text-ink'}`}
            >
              {ex.label}
            </button>
          ))}
        </div>
        <div className="flex w-full sm:w-auto items-stretch border-t sm:border-t-0 border-rule">
          {modes &&
            (['minimal', 'full'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={chrome === c}
                onClick={() => setChrome(c)}
                className={`${TAB} border-r border-rule font-mono text-xs ${chrome === c ? 'text-ink underline underline-offset-4' : 'text-ink-dim hover:text-ink'}`}
              >
                {c}
              </button>
            ))}
          <button
            type="button"
            aria-expanded={yamlOpen}
            onClick={() => setYamlOpen((v) => !v)}
            className={`${TAB} flex-1 sm:flex-none gap-2 font-mono text-xs ${yamlOpen ? 'text-ink' : 'text-ink-dim hover:text-ink'}`}
          >
            {yamlOpen ? 'Hide' : 'Show'} {active.file}
          </button>
          <a href={url} target="_blank" rel="noreferrer" title="Open the diagram on its own page" className={`${TAB} justify-center border-l border-rule text-ink-dim hover:text-ink`}>
            <ExternalLink className="size-4" />
            <span className="sr-only">Open {active.label} on its own page</span>
          </a>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {yamlOpen && (
          <div className="flex w-full lg:w-[340px] shrink-0 flex-col border-b lg:border-b-0 lg:border-r border-rule">
            <div className="flex h-9 items-center justify-between border-b border-rule pl-3 font-mono text-xs text-ink-dim">
              <span>{active.yaml.trim().split('\n').length} lines</span>
              <button type="button" onClick={copy} className={`${TAB} h-9 gap-1.5 text-xs text-ink-dim hover:text-ink`}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="h-[240px] lg:h-0 lg:flex-1 overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-ink">
              <code>{active.yaml}</code>
            </pre>
          </div>
        )}
        <div className="relative h-[420px] sm:h-[520px] lg:h-[640px] w-full min-w-0 lg:flex-1 bg-paper">
          <MarrowEmbed
            key={url}
            src={page}
            title={`${active.label} diagram compiled by Marrow`}
            chrome={chrome}
            height="100%"
            floatingActions={false}
            className="h-full min-h-0 rounded-none border-0"
          />
        </div>
      </div>
    </div>
  );
}
