'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  ChevronDown,
  Check,
  Copy,
} from 'lucide-react';
import { MarrowEmbed, cn } from '@marrow/ui';

export interface TopologyDemoPreset {
  id: string;
  name: string;
  description: string;
  archetype: 'tiered' | 'zoned' | 'hub-spoke' | 'scale';
  tags: string[];
  src: string;
  fullSrc: string;
}

export const DEMO_PRESETS: TopologyDemoPreset[] = [
  {
    id: 'tiered',
    name: 'Tiered Campus Core',
    description: 'Hierarchical Core, Distribution, and Access switching fabric with dual HA uplinks.',
    archetype: 'tiered',
    tags: ['Hierarchical', 'HA Pair', 'Campus'],
    src: '/demo/tiered-embed.html',
    fullSrc: '/demo/tiered.html',
  },
  {
    id: 'zoned',
    name: 'Multi-Zone Datacenter',
    description: 'Isolated perimeter DMZ, application tier, and database subnets partitioned into mosaic cards.',
    archetype: 'zoned',
    tags: ['Zoned Mosaic', 'DMZ', 'Datacenter'],
    src: '/demo/zoned-embed.html',
    fullSrc: '/demo/zoned.html',
  },
  {
    id: 'hub-spoke',
    name: 'Hub & Spoke Fabric',
    description: 'Radial WAN topology connecting remote regional offices into redundant central spine hubs.',
    archetype: 'hub-spoke',
    tags: ['Radial', 'WAN Spine', 'Spokes'],
    src: '/demo/hub-spoke-embed.html',
    fullSrc: '/demo/hub-spoke.html',
  },
  {
    id: 'trunk-vlans',
    name: '802.1Q Trunk VLANs',
    description: 'VLAN tagging semantics visualized with double-line trunks and native VLAN indicators.',
    archetype: 'tiered',
    tags: ['802.1Q', 'Trunking', 'VLANs'],
    src: '/demo/trunk-vlans-embed.html',
    fullSrc: '/demo/trunk-vlans.html',
  },
  {
    id: 'vpn-tunnels',
    name: 'IPsec VPN Tunnels',
    description: 'Encrypted overlay tunnels with animated dashed flows and protocol telemetry chips.',
    archetype: 'hub-spoke',
    tags: ['Overlay', 'IPsec', 'Animated'],
    src: '/demo/vpn-tunnels-embed.html',
    fullSrc: '/demo/vpn-tunnels.html',
  },
  {
    id: 'lacp-portchannel',
    name: 'LACP Port-Channels',
    description: 'Physical link aggregation with bundled interface indicators and member negotiation states.',
    archetype: 'tiered',
    tags: ['LACP', 'LAG', 'Bundles'],
    src: '/demo/lacp-portchannel-embed.html',
    fullSrc: '/demo/lacp-portchannel.html',
  },
  {
    id: 'scale',
    name: 'Scale Test (300+ Nodes)',
    description: 'High-density multi-rack cloud fabric demonstrating canvas LOD streaming and radar minimap.',
    archetype: 'scale',
    tags: ['High Density', '300+ Nodes', 'Canvas'],
    src: '/demo/scale-embed.html',
    fullSrc: '/demo/scale.html',
  },
];

export function DemoStudio() {
  const [activePreset, setActivePreset] = useState<TopologyDemoPreset>(DEMO_PRESETS[0]);
  const [chromeMode, setChromeMode] = useState<'minimal' | 'full'>('minimal');
  const [copied, setCopied] = useState(false);

  const activeSrc = chromeMode === 'minimal' ? activePreset.src : activePreset.fullSrc;

  const copyUrl = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${activeSrc}#chrome=${chromeMode}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full rounded-2xl border border-fd-border/80 bg-fd-card/40 overflow-hidden shadow-sm not-prose my-6">
      {/* 1. Sleek, Single-Row Header Toolbar */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-fd-border/70 bg-fd-background/70 backdrop-blur-xs">
        {/* Left: Compact Preset Selector & Archetype */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <select
              id="topology-preset-select"
              aria-label="Select topology preset"
              value={activePreset.id}
              onChange={(e) => {
                const found = DEMO_PRESETS.find((p) => p.id === e.target.value);
                if (found) setActivePreset(found);
              }}
              className="appearance-none bg-fd-background hover:bg-fd-accent text-xs font-semibold text-fd-foreground py-1.5 pl-3 pr-7 rounded-lg border border-fd-border/70 hover:border-fd-border cursor-pointer transition-colors focus:outline-hidden shadow-2xs"
            >
              {DEMO_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-fd-background text-fd-foreground font-normal">
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="size-3.5 pointer-events-none absolute right-2 text-fd-muted-foreground" />
          </div>

          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-medium bg-fd-primary/10 text-fd-primary border border-fd-primary/20">
            {activePreset.archetype}
          </span>
        </div>

        {/* Right: Mode Switcher & Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-fd-border/70 p-0.5 bg-fd-background/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setChromeMode('minimal')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                chromeMode === 'minimal'
                  ? 'bg-fd-accent text-fd-foreground font-semibold shadow-2xs'
                  : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              Embed
            </button>
            <button
              type="button"
              onClick={() => setChromeMode('full')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer',
                chromeMode === 'full'
                  ? 'bg-fd-accent text-fd-foreground font-semibold shadow-2xs'
                  : 'text-fd-muted-foreground hover:text-fd-foreground',
              )}
            >
              Workbench
            </button>
          </div>

          <div className="h-4 w-px bg-fd-border/70 mx-0.5" />

          {/* Share URL */}
          <button
            type="button"
            onClick={copyUrl}
            title="Copy parameterized URL"
            className="p-1.5 rounded-lg border border-fd-border/70 bg-fd-background/80 hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-all cursor-pointer shadow-2xs"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            <span className="sr-only">Copy URL</span>
          </button>

          {/* Open Standalone */}
          <a
            href={activeSrc}
            target="_blank"
            rel="noreferrer"
            title="Open standalone diagram in new tab"
            className="p-1.5 rounded-lg border border-fd-border/70 bg-fd-background/80 hover:bg-fd-accent text-fd-muted-foreground hover:text-fd-foreground transition-all shadow-2xs"
          >
            <ExternalLink className="size-3.5" />
            <span className="sr-only">Open standalone</span>
          </a>
        </div>
      </div>

      {/* 2. Topology Viewport */}
      <div className="relative w-full">
        <MarrowEmbed
          src={activeSrc}
          chrome={chromeMode}
          height="620px"
          floatingActions={true}
          className="border-0 rounded-none"
        />
      </div>

      {/* 3. Subtle Footer Description */}
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-fd-border/70 bg-fd-background/50 text-xs text-fd-muted-foreground">
        <span className="truncate">{activePreset.description}</span>
        <div className="flex items-center gap-1.5 shrink-0 hidden md:flex">
          {activePreset.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded border border-fd-border/60 bg-fd-card text-[10px]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
