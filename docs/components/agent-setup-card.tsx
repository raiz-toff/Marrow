'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const AGENT_SETUP_PROMPT = `Set up Marrow on this machine and help me draw my first network diagram.

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

export function SetupPrompt() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copy = async () => {
    const success = await copyToClipboard(AGENT_SETUP_PROMPT);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          id="copy-setup-prompt"
          type="button"
          onClick={copy}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring cursor-pointer"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy setup prompt'}
        </button>
        <button
          id="toggle-setup-prompt"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-fd-muted-foreground underline-offset-4 hover:text-fd-foreground hover:underline py-1 cursor-pointer"
        >
          {open ? 'Hide prompt' : 'Read it first'}
        </button>
      </div>
      <p className="max-w-xl text-xs sm:text-sm text-fd-muted-foreground leading-relaxed">
        Paste it into your agent. It clones the repo, runs setup and the tests, then asks what you
        want to draw.
      </p>
      {open && (
        <pre className="max-w-3xl overflow-x-auto rounded-lg border bg-fd-secondary p-3 sm:p-4 font-mono text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap text-fd-secondary-foreground">
          {AGENT_SETUP_PROMPT}
        </pre>
      )}
    </div>
  );
}
