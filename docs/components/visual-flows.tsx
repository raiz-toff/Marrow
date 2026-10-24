'use client';

import React, { useState } from 'react';
import {
  FileCode,
  Clock,
  Cpu,
  CheckCircle2,
  RefreshCw,
  Radio,
  Monitor,
  ArrowDown,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  GitFork,
  Search,
  Eye,
  Terminal,
  FileCheck,
  Workflow,
  Network,
  Maximize2,
  Box,
  Compass,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
 * 1. Live Reloading Workflow Visualizer
 * Replaces the raw ASCII diagram in docs/getting-started/live-preview.mdx
 * ───────────────────────────────────────────────────────────── */

export function ReloadWorkflowVisual() {
  const [activeBranch, setActiveBranch] = useState<'unchanged' | 'changed'>('unchanged');

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center justify-between pb-5 border-b border-fd-border/50">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
            <RefreshCw className="size-4 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-fd-foreground">How Live Reloading Works</h4>
            <p className="text-xs text-fd-muted-foreground">Reactive filesystem watcher with memoized differential compilation</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-fd-background/80 border border-fd-border/60 text-xs">
          <button
            type="button"
            onClick={() => setActiveBranch('unchanged')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              activeBranch === 'unchanged'
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold shadow-2xs'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            Shape Unchanged (Fast)
          </button>
          <button
            type="button"
            onClick={() => setActiveBranch('changed')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              activeBranch === 'changed'
                ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20 font-semibold shadow-2xs'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            Shape Changed (Global)
          </button>
        </div>
      </div>

      {/* Workflow Diagram Nodes */}
      <div className="pt-6 flex flex-col items-center gap-3">
        {/* Step 1: Save YAML */}
        <div className="w-full max-w-md p-3.5 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-fd-muted flex items-center justify-center text-fd-foreground">
              <FileCode className="size-4 text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-fd-foreground">1. Developer Saves File</span>
              <span className="font-mono text-[11px] text-fd-muted-foreground">input/branch.yaml</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500">
            fs write
          </span>
        </div>

        {/* Connector */}
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-3 bg-fd-border" />
          <ArrowDown className="size-3.5 text-fd-muted-foreground" />
        </div>

        {/* Step 2: fs.watch & debounce */}
        <div className="w-full max-w-md p-3.5 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-fd-muted flex items-center justify-center text-fd-foreground">
              <Clock className="size-4 text-purple-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-fd-foreground">2. File Watcher & Debounce</span>
              <span className="text-[11px] text-fd-muted-foreground">Batches rapid IDE bursts (50ms window)</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-500">
            fs.watch
          </span>
        </div>

        {/* Connector */}
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-3 bg-fd-border" />
          <ArrowDown className="size-3.5 text-fd-muted-foreground" />
        </div>

        {/* Step 3: Validation & Build Engine */}
        <div className="w-full max-w-md p-3.5 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-fd-muted flex items-center justify-center text-fd-foreground">
              <Cpu className="size-4 text-fd-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-fd-foreground">3. Schema Validation & Differential Build</span>
              <span className="text-[11px] text-fd-muted-foreground">Strict schema check + geometric memoization</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fd-primary/10 border border-fd-primary/20 text-fd-primary">
            marrow-core
          </span>
        </div>

        {/* Connector with Branching */}
        <div className="w-full max-w-xl flex items-center justify-center my-1 relative">
          <div className="w-48 h-5 border-t-2 border-x-2 border-fd-border/70 rounded-t-xl" />
        </div>

        {/* Branch Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
          {/* Branch A: Shape Unchanged */}
          <div
            onClick={() => setActiveBranch('unchanged')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeBranch === 'unchanged'
                ? 'border-emerald-500/80 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-sm'
                : 'border-fd-border/70 bg-fd-background/60 opacity-65 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <strong className="text-xs font-semibold text-fd-foreground">Shape Unchanged</strong>
            </div>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Metadata, IP, or title edit. Only recompiles the single zone or device page that changed.
            </p>
            <div className="mt-2.5 pt-2 border-t border-fd-border/40 font-mono text-[10px] text-emerald-500 font-medium">
              ⚡ ~12ms differential refresh
            </div>
          </div>

          {/* Branch B: Shape Changed */}
          <div
            onClick={() => setActiveBranch('changed')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
              activeBranch === 'changed'
                ? 'border-sky-500/80 bg-sky-500/5 ring-2 ring-sky-500/20 shadow-sm'
                : 'border-fd-border/70 bg-fd-background/60 opacity-65 hover:opacity-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <GitFork className="size-4 text-sky-500" />
              <strong className="text-xs font-semibold text-fd-foreground">Shape Changed</strong>
            </div>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              New links, added devices, or modified tiers. Re-runs ELK placement and reloads all pages.
            </p>
            <div className="mt-2.5 pt-2 border-t border-fd-border/40 font-mono text-[10px] text-sky-500 font-medium">
              🔄 Full graph recalculation
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-3 bg-fd-border" />
          <ArrowDown className="size-3.5 text-fd-muted-foreground" />
        </div>

        {/* Step 4: SSE Push to Browser */}
        <div className="w-full max-w-md p-3.5 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Radio className="size-4 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-fd-foreground">4. Server-Sent Events (SSE) Push</span>
              <span className="text-[11px] text-fd-muted-foreground">Open browser viewport hot-reloads live</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold">
            text/event-stream
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 2. The 6-Stage Compiler Pipeline Visualizer
 * Replaces ASCII diagram in docs/contributing/architecture.mdx & guides/layout.mdx
 * ───────────────────────────────────────────────────────────── */

export function CompilePipelineVisual() {
  const [selectedStage, setSelectedStage] = useState<number>(0);

  const STAGES = [
    {
      title: '1. Schema & Validation',
      package: 'packages/schema',
      badge: 'Diagnostics',
      summary: 'Parses YAML with exact line/column tracking. Validates strictly against schema.',
      details: [
        'Unknown keys fail with MRW-E005 (x- prefix allowed for private metadata)',
        'Normalizes device coordinates, interfaces, and link bundles into Topology',
        'Did-you-mean fuzzy suggestions for typos and vendor icon IDs',
      ],
      tag: 'AST → Topology',
    },
    {
      title: '2. Layout & Classification',
      package: 'packages/layout',
      badge: 'ELK + Libavoid',
      summary: 'Evaluates structural rules top-to-bottom to pick 1 of 6 archetypes.',
      details: [
        'Deterministic text measurement via static font glyph metrics tables',
        'ELK layered placement for tiered/zoned, polar for hub-and-spoke',
        'Orthogonal edge routing with libavoid collision avoidance',
      ],
      tag: 'Topology → Scene',
    },
    {
      title: '3. Cable Tidy Pass',
      package: 'packages/layout/tidy.ts',
      badge: 'Cable Tray',
      summary: 'Eliminates edge spaghetti by routing coincident runs onto shared lanes.',
      details: [
        'Parallels between identical pairs collapse into a single stroked bundle with ×N count',
        'Gutter buses for 3+ downstream children from a common parent spine',
        'Draw order ensures alarms and degraded links float to the visual top',
      ],
      tag: 'Reduced Crossings',
    },
    {
      title: '4. Geometry Linter Gate',
      package: 'packages/lint',
      badge: 'Zero Overlap Gate',
      summary: 'Guarantees the diagram is never physically broken before rendering.',
      details: [
        'L1 (Fatal): Node overlaps, cables crossing through node bodies → Build stops',
        'L2 (Auto-repair): Nudges port labels and clears minor geometry anomalies',
        'L3 (Advisory): Warns of non-optimal aspect ratios or high crossing density',
      ],
      tag: 'Gatekeeper',
    },
    {
      title: '5. Dual Renderer Tier',
      package: 'packages/render-svg',
      badge: 'Hero / Scale Tier',
      summary: 'Dispatches to the optimal rendering strategy based on device count.',
      details: [
        '< 300 devices: SVG Hero Tier with inlined icon sprites and crisp CSS filters',
        '> 300 devices: Canvas Scale Tier with Level-of-Detail (LOD) radar culling',
        'Zero external asset requests: inlines all vector symbols and stylesheets',
      ],
      tag: 'SVG / Canvas',
    },
    {
      title: '6. Site Bundler & Runtime',
      package: 'packages/site & runtime',
      badge: 'Self-Contained',
      summary: 'Compiles single-file HTML or multi-page site with ~20KB client.',
      details: [
        'Single-file mode (--single): Entire diagram packaged in a portable offline .html',
        'Multi-page mode: Auto-splits topologies >150 nodes into zone and device pages',
        'Runtime client: Camera pan/zoom, Ctrl+K spotlight, minimap, 5-tab inspector',
      ],
      tag: 'Offline Output',
    },
  ];

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Workflow className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">The Marrow Compiler Pipeline</h4>
          <p className="text-xs text-fd-muted-foreground">End-to-end deterministic compilation from declarative YAML to self-contained HTML</p>
        </div>
      </div>

      {/* Stage Flow Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-6">
        {STAGES.map((s, idx) => {
          const isActive = selectedStage === idx;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setSelectedStage(idx)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? 'border-fd-primary bg-fd-primary/10 ring-2 ring-fd-primary/20 shadow-xs'
                  : 'border-fd-border/70 bg-fd-background/70 hover:border-fd-border hover:bg-fd-accent/40'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[10px] font-mono text-fd-muted-foreground">0{idx + 1}</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-fd-muted border border-fd-border/50 text-fd-muted-foreground">
                  {s.tag}
                </span>
              </div>
              <strong className="text-xs font-semibold text-fd-foreground truncate w-full">
                {s.title.split('. ')[1]}
              </strong>
            </button>
          );
        })}
      </div>

      {/* Active Stage Detail Panel */}
      <div className="mt-4 p-5 rounded-xl border border-fd-border/80 bg-fd-background/90 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h5 className="text-sm font-semibold text-fd-foreground">{STAGES[selectedStage].title}</h5>
            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-fd-primary/10 border border-fd-primary/20 text-fd-primary font-medium">
              {STAGES[selectedStage].package}
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-fd-muted border border-fd-border text-fd-muted-foreground">
            {STAGES[selectedStage].badge}
          </span>
        </div>

        <p className="text-xs text-fd-foreground/80 mb-3 leading-relaxed">
          {STAGES[selectedStage].summary}
        </p>

        <ul className="space-y-1.5 list-none m-0 p-0">
          {STAGES[selectedStage].details.map((d) => (
            <li key={d} className="flex items-start gap-2 text-xs text-fd-muted-foreground">
              <span className="text-fd-primary font-bold mt-0.5">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 3. Layout Archetype Decision Matrix Visualizer
 * Replaces ASCII/Mermaid decision trees in docs/guides/layout.mdx
 * ───────────────────────────────────────────────────────────── */

export function ArchetypeDecisionVisual() {
  const [activeArchetype, setActiveArchetype] = useState<string>('tiered');

  const ARCHETYPES = [
    {
      id: 'zoned',
      title: 'Zoned Mosaic',
      rule: '≥ 2 zones declare devices',
      strategy: 'Independent ELK per zone packed via 2D bin-packing mosaic',
      color: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
      dot: 'bg-blue-400',
      description: 'Used for campus campuses, multi-region clouds, and physical facilities partition.',
    },
    {
      id: 'tiered',
      title: 'Hierarchical Tiered',
      rule: 'Every device declares a tier',
      strategy: 'Top-down ELK layered alignment with horizontal rank separation',
      color: 'border-purple-500/50 text-purple-400 bg-purple-500/10',
      dot: 'bg-purple-400',
      description: 'Classic enterprise hierarchy: Edge (rank 0) → Core → Distribution → Access → Endpoint.',
    },
    {
      id: 'ring',
      title: 'Token Ring',
      rule: '4+ devices, connected, exactly 2 neighbors each',
      strategy: 'Circular polar geometry with single closed polyline circuit',
      color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
      dot: 'bg-emerald-400',
      description: 'Metropolitan Area Networks (MANs), OT rings, and industrial SCADA topologies.',
    },
    {
      id: 'hub-spoke',
      title: 'Hub & Spoke',
      rule: '1-2 high-degree hubs, pure hub-only spoke links',
      strategy: 'Central core router nucleus with radially distributed orbital spokes',
      color: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
      dot: 'bg-amber-400',
      description: 'SD-WAN corporate networks, branch office interconnects, and IPsec VPN overlays.',
    },
    {
      id: 'mesh',
      title: 'Full / Partial Mesh',
      rule: '≤ 16 devices, density ≥ 0.4, avg degree ≥ 3',
      strategy: 'Circular node distribution with direct cross-connect polylines',
      color: 'border-rose-500/50 text-rose-400 bg-rose-500/10',
      dot: 'bg-rose-400',
      description: 'High-availability spine-leaf pods, database clusters, and carrier peering fabrics.',
    },
    {
      id: 'flat',
      title: 'Flat Layered',
      rule: 'Fallback (missing tiers or mixed structures)',
      strategy: 'Standard unconstrained ELK layered flow',
      color: 'border-zinc-500/50 text-zinc-400 bg-zinc-500/10',
      dot: 'bg-zinc-400',
      description: 'General purpose un-tiered topologies and early design scratchpads.',
    },
  ];

  const current = ARCHETYPES.find((a) => a.id === activeArchetype) || ARCHETYPES[1];

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Compass className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">The 6 Layout Archetypes</h4>
          <p className="text-xs text-fd-muted-foreground">Evaluated top-to-bottom in strict precedence order. First match wins.</p>
        </div>
      </div>

      {/* Grid of Archetypes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6">
        {ARCHETYPES.map((arch, idx) => {
          const isSelected = arch.id === activeArchetype;
          return (
            <button
              key={arch.id}
              type="button"
              onClick={() => setActiveArchetype(arch.id)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-fd-primary bg-fd-primary/10 ring-2 ring-fd-primary/20 shadow-xs'
                  : 'border-fd-border/70 bg-fd-background/70 hover:border-fd-border'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-fd-muted-foreground">Priority {idx + 1}</span>
                  <span className={`size-2 rounded-full ${arch.dot}`} />
                </div>
                <strong className="text-xs font-semibold text-fd-foreground block mb-1">
                  {arch.title}
                </strong>
                <span className="text-[11px] font-mono text-fd-muted-foreground block line-clamp-1">
                  {arch.rule}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Archetype Inspection Box */}
      <div className="mt-4 p-5 rounded-xl border border-fd-border/80 bg-fd-background/90 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-semibold text-fd-foreground">{current.title}</h5>
          <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${current.color}`}>
            Rule: {current.rule}
          </span>
        </div>
        <p className="text-xs text-fd-foreground/80 mb-2 leading-relaxed">
          {current.description}
        </p>
        <div className="text-xs text-fd-muted-foreground font-mono bg-fd-muted/50 p-2.5 rounded-lg border border-fd-border/50">
          <strong>Engine Placement:</strong> {current.strategy}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 4. Autonomous Agent Golden Loop Visualizer
 * Replaces ASCII/Mermaid in docs/agents/golden-loop.mdx
 * ───────────────────────────────────────────────────────────── */

export function AgentGoldenLoopVisual() {
  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <RefreshCw className="size-4 animate-spin-slow" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">The Autonomous Golden Loop</h4>
          <p className="text-xs text-fd-muted-foreground">The required 5-step feedback cycle for AI agents authoring topologies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-6 relative">
        {/* Step 1: Understand */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-fd-muted-foreground">STEP 1</span>
              <Search className="size-4 text-purple-400" />
            </div>
            <strong className="text-xs font-semibold text-fd-foreground block mb-1">Understand</strong>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Identify devices, core/dist/access hierarchy, zones, and the narrative story.
            </p>
          </div>
          <span className="text-[9px] font-mono mt-3 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 w-fit">
            Natural Input
          </span>
        </div>

        {/* Step 2: Author */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-fd-muted-foreground">STEP 2</span>
              <FileCode className="size-4 text-blue-400" />
            </div>
            <strong className="text-xs font-semibold text-fd-foreground block mb-1">Author</strong>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Write <code>input/*.yaml</code>. Query verified vendor icon catalog; never guess.
            </p>
          </div>
          <span className="text-[9px] font-mono mt-3 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 w-fit">
            Explicit YAML
          </span>
        </div>

        {/* Step 3: Validate */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-fd-muted-foreground">STEP 3</span>
              <FileCheck className="size-4 text-amber-400" />
            </div>
            <strong className="text-xs font-semibold text-fd-foreground block mb-1">Validate</strong>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Run <code>validate --json</code>. Fix all errors autonomously before continuing.
            </p>
          </div>
          <span className="text-[9px] font-mono mt-3 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit">
            Exit Code 0
          </span>
        </div>

        {/* Step 4: Snapshot & See */}
        <div className="p-4 rounded-xl border border-fd-primary/50 bg-fd-primary/5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-fd-primary font-bold">STEP 4</span>
              <Eye className="size-4 text-fd-primary" />
            </div>
            <strong className="text-xs font-semibold text-fd-foreground block mb-1">Snapshot & See</strong>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Render PNG and review image directly. Catch layout flaws invisible to syntax linter.
            </p>
          </div>
          <span className="text-[9px] font-mono mt-3 px-2 py-0.5 rounded bg-fd-primary/10 text-fd-primary border border-fd-primary/20 font-bold w-fit">
            Mandatory Eyes
          </span>
        </div>

        {/* Step 5: Deliver */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-fd-muted-foreground">STEP 5</span>
              <CheckCircle2 className="size-4 text-emerald-400" />
            </div>
            <strong className="text-xs font-semibold text-fd-foreground block mb-1">Deliver</strong>
            <p className="text-[11px] text-fd-muted-foreground leading-relaxed">
              Compile single HTML or site bundle. Zero errors guaranteed.
            </p>
          </div>
          <span className="text-[9px] font-mono mt-3 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
            Ready to Ship
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 5. Bi-Directional postMessage Protocol Visualizer
 * Replaces ASCII/Mermaid in docs/guides/embedding.mdx
 * ───────────────────────────────────────────────────────────── */

export function EmbeddingProtocolVisual() {
  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Radio className="size-4 animate-pulse" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">Bi-Directional postMessage Protocol</h4>
          <p className="text-xs text-fd-muted-foreground">Event bus connecting parent portal (Next.js/React) with isolated Marrow diagram</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center pt-6">
        {/* Host App */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="size-4 text-blue-400" />
            <strong className="text-xs font-semibold text-fd-foreground">Host Application</strong>
          </div>
          <span className="text-[11px] text-fd-muted-foreground block mb-3">
            Next.js Portal, NOC Dashboard, Documentation Wiki
          </span>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="p-2 rounded bg-fd-muted/60 text-fd-foreground">
              <code>postMessage({`{ type: 'marrow:theme', theme: 'dark' }`})</code>
            </div>
            <div className="p-2 rounded bg-fd-muted/60 text-fd-foreground">
              <code>postMessage({`{ type: 'marrow:select', deviceId: 'sw-01' }`})</code>
            </div>
          </div>
        </div>

        {/* Exchange Center Arrows */}
        <div className="flex flex-col items-center justify-center gap-2 py-2">
          <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
            <span>marrow:ready</span>
            <ArrowRight className="size-3" />
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
            <ArrowRight className="size-3 rotate-180" />
            <span>marrow:theme</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-purple-500 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
            <ArrowRight className="size-3 rotate-180" />
            <span>marrow:select</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
            <span>marrow:selected</span>
            <ArrowRight className="size-3" />
          </div>
        </div>

        {/* Embedded Marrow Diagram */}
        <div className="p-4 rounded-xl border border-fd-border bg-fd-background/90 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Network className="size-4 text-emerald-400" />
            <strong className="text-xs font-semibold text-fd-foreground">Marrow Diagram Iframe</strong>
          </div>
          <span className="text-[11px] text-fd-muted-foreground block mb-3">
            Offline self-contained viewer with hash flags
          </span>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="p-2 rounded bg-fd-muted/60 text-fd-foreground">
              <code>parent.postMessage({`{ type: 'marrow:ready' }`})</code>
            </div>
            <div className="p-2 rounded bg-fd-muted/60 text-fd-foreground">
              <code>parent.postMessage({`{ type: 'marrow:selected', id }`})</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 6. Fumadocs Spacious Grid Architecture Visualizer
 * Replaces ASCII diagram in docs/components/spacious-layout.mdx
 * ───────────────────────────────────────────────────────────── */

export function SpaciousGridArchitectureVisual() {
  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Box className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">Fumadocs Spacious Grid Architecture</h4>
          <p className="text-xs text-fd-muted-foreground">3-column island card layout over a recessed <code>bg-fd-card</code> gutter background</p>
        </div>
      </div>

      {/* Interactive Representation of the 3 Island Columns */}
      <div className="pt-6">
        <div className="p-4 rounded-2xl bg-fd-card border border-fd-border/60 shadow-inner">
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_260px] gap-3 min-h-[220px]">
            {/* Sidebar Column */}
            <div className="p-3 rounded-xl border border-fd-border bg-fd-background shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider block mb-1">
                  grid-area: sidebar
                </span>
                <strong className="text-xs font-semibold text-fd-foreground block mb-1">#nd-sidebar (268px)</strong>
                <p className="text-[11px] text-fd-muted-foreground">
                  Collapsible navigation tree, inventory counters, and telemetry legend. Collapses to 0px on toggle.
                </p>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 w-fit">
                TopologySidebar
              </span>
            </div>

            {/* Main Stage Panel */}
            <div className="p-3 rounded-xl border border-fd-border bg-fd-background shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                    grid-area: main
                  </span>
                  <span className="text-[10px] font-mono text-fd-muted-foreground">Floating Header</span>
                </div>
                <strong className="text-xs font-semibold text-fd-foreground block mb-1">#nd-page-panel (Island Card)</strong>
                <p className="text-[11px] text-fd-muted-foreground">
                  Interactive stage canvas running standalone SVG hero renderer or WebGL scale tier with camera navigation.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-fd-border/40 text-[10px] font-mono">
                <span className="text-blue-400">TopologyCanvas / Stage</span>
                <span className="text-fd-muted-foreground">Floating HUD Controls</span>
              </div>
            </div>

            {/* Right Telemetry Inspector Panel */}
            <div className="p-3 rounded-xl border border-fd-border bg-fd-background shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block mb-1">
                  grid-area: right
                </span>
                <strong className="text-xs font-semibold text-fd-foreground block mb-1">#nd-inspector-panel (320px)</strong>
                <p className="text-[11px] text-fd-muted-foreground">
                  5-tab hardware telemetry drawer for interfaces, LLDP neighbors, and copyable vendor CLI configurations.
                </p>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 w-fit">
                TopologyInspector
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 7. Autonomous Self-Healing Loop Visualizer
 * Replaces Mermaid in docs/agents/updates-and-self-healing.mdx
 * ───────────────────────────────────────────────────────────── */

export function SelfHealingLoopVisual() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const STEPS = [
    {
      title: '1. Upstream Update',
      desc: 'Toolchain or schema update applied via git pull or npm.',
      icon: RefreshCw,
      badge: 'Trigger',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: '2. Run Diagnostics',
      desc: 'Validator executed with --json output for machine parsing.',
      icon: Terminal,
      badge: 'validate --json',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      title: '3. Parse Fix Hints',
      desc: 'Extract error codes (MRW-Exxx), spans, and did-you-mean suggestions.',
      icon: Search,
      badge: 'AST Errors',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: '4. Autonomous Patch',
      desc: 'Agent patches renamed attributes, updates icon IDs, and recompiles.',
      icon: Cpu,
      badge: 'Auto-Remediate',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    {
      title: '5. Zero-Error Proof',
      desc: 'Re-validation passes with exit code 0. No human intervention needed.',
      icon: ShieldCheck,
      badge: 'Self-Healed',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">Autonomous Self-Healing Loop</h4>
          <p className="text-xs text-fd-muted-foreground">Self-contained diagnostic and automated remediation feedback loop for AI agents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-6">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isSelected = activeStep === idx;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => setActiveStep(idx)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-fd-primary bg-fd-primary/10 ring-2 ring-fd-primary/20 shadow-xs'
                  : 'border-fd-border/70 bg-fd-background/70 hover:border-fd-border'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-fd-muted-foreground">0{idx + 1}</span>
                  <Icon className="size-4 text-fd-primary" />
                </div>
                <strong className="text-xs font-semibold text-fd-foreground block mb-1">
                  {s.title.split('. ')[1]}
                </strong>
                <p className="text-[11px] text-fd-muted-foreground leading-relaxed line-clamp-2">
                  {s.desc}
                </p>
              </div>
              <span className={`text-[9px] font-mono mt-3 px-1.5 py-0.5 rounded border w-fit ${s.color}`}>
                {s.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 8. Package Layers Visualizer
 * Replaces Mermaid in docs/contributing/packages.mdx
 * ───────────────────────────────────────────────────────────── */

export function PackageLayersVisual() {
  const [selectedPkg, setSelectedPkg] = useState<string>('ui');

  const LAYERS = [
    {
      name: 'Layer 3: Surfaces & Distribution',
      desc: 'Consumer entry points, component registry, and build targets',
      color: 'border-emerald-500/40 bg-emerald-500/5',
      packages: [
        { id: 'cli', name: 'cli', role: 'The marrow command & terminal flags' },
        { id: 'site', name: 'site', role: 'HTML site bundler & single-file compiler' },
        { id: 'ui', name: 'ui (@marrow/ui)', role: 'shadcn React components & registry' },
        { id: 'server', name: 'server', role: 'Live dev server, file watch & SSE reload' },
      ],
    },
    {
      name: 'Layer 2: Engine & Pipeline',
      desc: 'Schema validation, placement, edge routing, and render tiers',
      color: 'border-blue-500/40 bg-blue-500/5',
      packages: [
        { id: 'schema', name: 'schema', role: 'YAML AST parsing & strict validation' },
        { id: 'layout', name: 'layout', role: 'ELK placement & libavoid orthogonal routing' },
        { id: 'lint', name: 'lint', role: 'Geometry gatekeeper (zero node overlap)' },
        { id: 'render-svg', name: 'render-svg', role: 'Hero SVG generator & canvas scene JSON' },
        { id: 'runtime', name: 'runtime', role: '~20KB vanilla client (camera, HUD, inspector)' },
      ],
    },
    {
      name: 'Layer 1: Core Foundations',
      desc: 'Deterministic data contracts, glyph metrics, and icon catalogs',
      color: 'border-purple-500/40 bg-purple-500/5',
      packages: [
        { id: 'model', name: 'model', role: 'Normalized in-memory Topology interfaces' },
        { id: 'diagnostics', name: 'diagnostics', role: 'Stable error registry (MRW-Exxx)' },
        { id: 'metrics', name: 'metrics', role: 'Deterministic text measurement tables' },
        { id: 'icons', name: 'icons', role: 'Vendor icon pack catalog & vector indexing' },
        { id: 'scene', name: 'scene', role: 'Geometric scene contract (boxes & polylines)' },
      ],
    },
  ];

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Layers className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">Monorepo Package Architecture</h4>
          <p className="text-xs text-fd-muted-foreground">The 14 monorepo packages organized by architectural layer and dependency direction</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-6">
        {LAYERS.map((layer) => (
          <div key={layer.name} className={`p-4 rounded-xl border ${layer.color}`}>
            <div className="flex items-center justify-between mb-2">
              <strong className="text-xs font-semibold text-fd-foreground">{layer.name}</strong>
              <span className="text-[11px] text-fd-muted-foreground">{layer.desc}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {layer.packages.map((pkg) => {
                const isSelected = selectedPkg === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-fd-primary bg-fd-primary/15 ring-2 ring-fd-primary/25 shadow-xs'
                        : 'border-fd-border/70 bg-fd-background/80 hover:bg-fd-accent/40'
                    }`}
                  >
                    <span className="font-mono text-xs font-semibold text-fd-foreground block truncate">
                      {pkg.name}
                    </span>
                    <span className="text-[10px] text-fd-muted-foreground block line-clamp-1 mt-0.5">
                      {pkg.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * 9. Tier Hierarchy Visualizer
 * Replaces ASCII tables in docs/guides/zones-and-tiers.mdx
 * ───────────────────────────────────────────────────────────── */

export function TierHierarchyVisual() {
  const TIERS = [
    {
      tier: 'edge',
      rank: 'Rank 0 (Top)',
      role: 'Perimeter Layer',
      devices: 'WAN Routers, Next-Gen Firewalls, BGP Border Gateways',
      accent: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
      badge: '▲ Perimeter',
    },
    {
      tier: 'core',
      rank: 'Rank 1',
      role: 'Core Fabric',
      devices: 'Backbone Spine Switches, EVPN Fabric, High-Speed Interconnects',
      accent: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
      badge: '● Backbone',
    },
    {
      tier: 'distribution',
      rank: 'Rank 2',
      role: 'Distribution Ring',
      devices: 'Campus Aggregation, Leaf Switches, Policy Enforcement',
      accent: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400',
      badge: '◆ Aggregation',
    },
    {
      tier: 'access',
      rank: 'Rank 3',
      role: 'Access Boundary',
      devices: 'Wiring Closet Switches, PoE Switches, Wi-Fi 7 APs',
      accent: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
      badge: '■ Wiring Closet',
    },
    {
      tier: 'endpoint',
      rank: 'Rank 4 (Bottom)',
      role: 'Workload & OOB Plane',
      devices: 'Servers, Storage Arrays, Kubernetes Nodes, Out-of-Band Switches',
      accent: 'border-zinc-500/50 bg-zinc-500/10 text-zinc-400',
      badge: '▼ Workload',
    },
  ];

  return (
    <div className="my-8 rounded-2xl border border-fd-border/70 bg-fd-card/40 backdrop-blur-md p-6 shadow-sm">
      <div className="flex items-center gap-2.5 pb-5 border-b border-fd-border/50">
        <div className="size-8 rounded-xl bg-fd-primary/10 border border-fd-primary/20 flex items-center justify-center text-fd-primary">
          <Layers className="size-4" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-fd-foreground">Vertical Tier Hierarchy</h4>
          <p className="text-xs text-fd-muted-foreground">ELK layered ranks ordered top-to-bottom across 5 structural tiers</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-6">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            className="p-3.5 rounded-xl border border-fd-border/80 bg-fd-background/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${t.accent}`}>
                {t.tier}
              </span>
              <div>
                <strong className="text-xs font-semibold text-fd-foreground block">{t.role}</strong>
                <span className="text-[11px] text-fd-muted-foreground">{t.devices}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-fd-muted-foreground shrink-0">
              <span className="px-2 py-0.5 rounded bg-fd-muted border border-fd-border">{t.rank}</span>
              <span className={`px-2 py-0.5 rounded border ${t.accent}`}>{t.badge}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



