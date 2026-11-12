'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

const AGENT_SETUP_PROMPT = `Set up Marrow on this machine and help me draw my first network diagram.

Marrow compiles network topology YAML into an interactive HTML diagram that works offline.
Repo: https://github.com/raiz-toff/Marrow

1. Setup
   - Marrow needs Node.js 24 or newer. Check with: node --version
   - If you are not inside the repo yet: git clone https://github.com/raiz-toff/Marrow.git && cd Marrow
   - Run the non-interactive setup (installs, compiles, fetches icon packs, builds a test diagram): npm run setup -- --yes
   - Run the tests: npm test

2. Working in the repo
   - Read AGENTS.md first. It lists the rules and commands.
   - Write topologies in input/<name>.yaml. Declare tier, zone and ha_pair_with. Never set coordinates.
   - Never guess icon IDs. Look them up: npm run icons search <words...>
   - Validate until there are zero errors: npm run validate -- input/<name>.yaml --json
   - Build one offline file: npm run build -- input/<name>.yaml --single -o output/<name>.html
   - Live preview while editing: npm run dev (http://127.0.0.1:5200)

When setup passes, ask me what network I want to diagram.`;

import { copyToClipboard } from '../lib/copy';

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyToClipboard(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return [copied, copy] as const;
}

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal';

/** The primary call to action: copy a prompt that sets Marrow up through your agent. */
export function SetupPrompt({ children, id = 'setup' }: { children?: ReactNode; id?: string }) {
  const [copied, copy] = useCopy(AGENT_SETUP_PROMPT);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          id={`copy-${id}-prompt`}
          type="button"
          onClick={copy}
          className={`inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 bg-ink px-5 text-[15px] font-medium text-paper transition-opacity hover:opacity-85 cursor-pointer ${FOCUS}`}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy setup prompt'}
        </button>
        {children}
      </div>
      <div className="flex max-w-xl flex-col items-start gap-1 sm:block">
        <p className="inline text-sm text-ink-dim leading-relaxed">
          Paste it into your agent. It clones the repo, runs setup and the tests, then asks which
          network to diagram.{' '}
        </p>
        <button
          id={`toggle-${id}-prompt`}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex min-h-11 sm:min-h-0 items-center text-sm text-ink underline underline-offset-4 decoration-rule hover:decoration-ink cursor-pointer ${FOCUS}`}
        >
          {open ? 'Hide the prompt' : 'Read it first'}
        </button>
      </div>
      {open && (
        <pre className="max-w-3xl overflow-x-auto border border-rule bg-sheet p-4 font-mono text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
          {AGENT_SETUP_PROMPT}
        </pre>
      )}
    </div>
  );
}

/** A shell command (or, with `prompt={false}`, a URL) in a box, with a copy button. */
export function CopyCommand({ command, prompt = true }: { command: string; prompt?: boolean }) {
  const [copied, copy] = useCopy(command);
  return (
    <div className="flex h-11 w-full sm:w-auto min-w-0 items-stretch border border-ink/70 bg-sheet font-mono text-xs sm:text-[13px]">
      <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap px-3 text-ink">
        {prompt && <span className="select-none text-ink-dim">$&nbsp;</span>}
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : `Copy ${command}`}
        className={`grid w-11 shrink-0 place-items-center border-l border-ink/70 text-ink-dim hover:text-ink cursor-pointer ${FOCUS}`}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
