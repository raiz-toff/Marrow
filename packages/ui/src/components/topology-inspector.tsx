'use client';

import {
  Activity,
  ArrowRight,
  Cable,
  Check,
  Copy,
  Cpu,
  FileCode2,
  Layers,
  Network,
  Server,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn, type DeviceStatus } from '../lib/utils.js';
import { useTopologyShell, type InspectorTab } from './topology-context.js';

const STATUS_BADGE: Record<DeviceStatus, { label: string; className: string; dot: string }> = {
  up: {
    label: 'Operational',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  degraded: {
    label: 'Degraded',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  down: {
    label: 'Fault / Down',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  planned: {
    label: 'Planned Window',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  unknown: {
    label: 'Unknown',
    className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
    dot: 'bg-zinc-400',
  },
};

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'interfaces', label: 'Interfaces' },
  { id: 'neighbors', label: 'Neighbors' },
  { id: 'metadata', label: 'Fields' },
  { id: 'config', label: 'Config' },
];

export function TopologyInspector({ className }: { className?: string }) {
  const {
    data,
    selectedDevice,
    selectedLink,
    inspectorOpen,
    setInspectorOpen,
    inspectorTab,
    setInspectorTab,
    focusDevice,
    selectLink,
    neighborsByDevice,
    linksByDevice,
  } = useTopologyShell();

  const [copied, setCopied] = useState(false);

  if (!inspectorOpen) return null;

  const deviceById = new Map(data.devices.map((d) => [d.id, d]));
  const zoneById = new Map(data.zones.map((z) => [z.id, z]));

  const handleCopyConfig = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      aria-label="Topology Inspector"
      className={cn(
        '[grid-area:right] flex flex-col w-[360px] xl:w-[380px] my-2 me-2 rounded-2xl border bg-fd-background shadow-sm overflow-hidden shrink-0 max-lg:fixed max-lg:inset-y-2 max-lg:right-2 max-lg:z-40 max-lg:shadow-2xl',
        className,
      )}
    >
      {/* Inspector Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b bg-fd-card/40 shrink-0">
        {selectedDevice ? (
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex items-center justify-center size-8 rounded-xl border bg-fd-secondary/60 text-fd-primary shrink-0">
              <Cpu className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold font-mono text-fd-foreground truncate">
                  {selectedDevice.label}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                    STATUS_BADGE[selectedDevice.status].className,
                  )}
                >
                  <span className={cn('size-1.5 rounded-full', STATUS_BADGE[selectedDevice.status].dot)} />
                  {STATUS_BADGE[selectedDevice.status].label}
                </span>
              </div>
              <p className="text-xs text-fd-muted-foreground truncate mt-0.5">
                {selectedDevice.role} · {selectedDevice.model ?? selectedDevice.tier}
              </p>
            </div>
          </div>
        ) : selectedLink ? (
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex items-center justify-center size-8 rounded-xl border bg-fd-secondary/60 text-fd-primary shrink-0">
              <Cable className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold font-mono text-fd-foreground truncate">
                  {selectedLink.from.device} ↔ {selectedLink.to.device}
                </h3>
              </div>
              <p className="text-xs text-fd-muted-foreground truncate mt-0.5">
                {selectedLink.speed} {selectedLink.mode.toUpperCase()} Link ·{' '}
                {selectedLink.protocol ?? selectedLink.vlan ?? 'L2/L3'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-8 rounded-xl border bg-fd-secondary/60 text-fd-muted-foreground">
              <Network className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-fd-foreground">Fabric Inspector</h3>
              <p className="text-xs text-fd-muted-foreground">Select any node or link on the stage</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setInspectorOpen(false)}
          title="Close inspector (Esc)"
          aria-label="Close inspector"
          className="inline-flex items-center justify-center size-7 rounded-lg text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors shrink-0"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Segmented Tabs Bar (when a device is selected) */}
      {selectedDevice && (
        <div
          role="tablist"
          className="flex items-center gap-0.5 mx-3 mt-3 p-1 rounded-xl border bg-fd-secondary/50 overflow-x-auto shrink-0"
        >
          {TABS.map((tab) => {
            const active = inspectorTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setInspectorTab(tab.id)}
                className={cn(
                  'flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  active
                    ? 'bg-fd-background text-fd-foreground shadow-xs border border-fd-border/60'
                    : 'text-fd-muted-foreground hover:text-fd-foreground',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Inspector Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 text-xs">
        {selectedDevice ? (
          <>
            {inspectorTab === 'overview' && (
              <div className="flex flex-col gap-4">
                {/* Identity & Addressing Grid */}
                <div className="rounded-xl border bg-fd-card/40 divide-y divide-fd-border/60">
                  {(
                    [
                      ['Hostname', selectedDevice.label, true],
                      ['Management IP', selectedDevice.ip ?? 'Unassigned', true],
                      ['Zone', zoneById.get(selectedDevice.zone)?.label ?? selectedDevice.zone, false],
                      ['Hierarchy Tier', selectedDevice.tier.toUpperCase(), true],
                      ['Hardware Model', selectedDevice.model ?? 'Generic Node', false],
                      ['OS Image', selectedDevice.os ?? 'N/A', true],
                      ...(selectedDevice.asn ? [['BGP ASN', `AS ${selectedDevice.asn}`, true] as const] : []),
                      ...(selectedDevice.serial ? [['Serial Number', selectedDevice.serial, true] as const] : []),
                      ...(selectedDevice.haPairWith
                        ? [['HA Redundancy Peer', selectedDevice.haPairWith, true] as const]
                        : []),
                    ] as const
                  ).map(([label, val, isMono]) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
                      <span className="text-fd-muted-foreground">{label}</span>
                      <span
                        className={cn(
                          'font-medium text-fd-foreground text-end truncate',
                          isMono && 'font-mono text-[11.5px]',
                        )}
                      >
                        {val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Quick Link Telemetry Summary */}
                <div className="rounded-xl border bg-fd-card/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-fd-foreground flex items-center gap-1.5">
                      <Activity className="size-3.5 text-fd-primary" />
                      Connected Fabric Links
                    </span>
                    <span className="font-mono text-[11px] text-fd-muted-foreground">
                      {(linksByDevice.get(selectedDevice.id) ?? []).length} links
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(linksByDevice.get(selectedDevice.id) ?? []).map((lnk) => {
                      const peerId =
                        lnk.from.device === selectedDevice.id ? lnk.to.device : lnk.from.device;
                      const localPort =
                        lnk.from.device === selectedDevice.id ? lnk.from.port : lnk.to.port;
                      const peerPort =
                        lnk.from.device === selectedDevice.id ? lnk.to.port : lnk.from.port;
                      return (
                        <button
                          key={lnk.id}
                          type="button"
                          onClick={() => selectLink(lnk.id)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-fd-background hover:bg-fd-accent transition-colors text-start"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={cn(
                                'size-2 rounded-full shrink-0',
                                STATUS_BADGE[lnk.status].dot,
                              )}
                            />
                            <span className="font-mono font-medium text-fd-foreground truncate">
                              {localPort}
                            </span>
                            <ArrowRight className="size-3 text-fd-muted-foreground shrink-0" />
                            <span className="font-mono text-fd-muted-foreground truncate">
                              {peerId}:{peerPort}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-fd-secondary font-mono text-[10px] text-fd-muted-foreground shrink-0">
                            {lnk.speed}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'interfaces' && (
              <div className="flex flex-col gap-2">
                {selectedDevice.interfaces.map((iface) => (
                  <div
                    key={iface.name}
                    className="rounded-xl border bg-fd-card/40 p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            STATUS_BADGE[iface.status].dot,
                          )}
                        />
                        <span className="font-mono font-semibold text-fd-foreground">
                          {iface.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {iface.mode && (
                          <span className="px-1.5 py-0.5 rounded border bg-fd-background font-mono uppercase text-[10px] text-fd-muted-foreground">
                            {iface.mode}
                          </span>
                        )}
                        {iface.speed && (
                          <span className="px-1.5 py-0.5 rounded bg-fd-primary/10 text-fd-primary font-mono text-[10px] font-semibold">
                            {iface.speed}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-fd-muted-foreground">
                      <div>
                        <span className="opacity-70">Address / VLAN: </span>
                        <span className="font-mono text-fd-foreground">
                          {iface.ip ?? (iface.vlan ? `VLAN ${iface.vlan}` : 'L2 Switchport')}
                        </span>
                      </div>
                      {iface.peerDevice && (
                        <div className="text-end truncate">
                          <span className="opacity-70">Peer: </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (deviceById.has(iface.peerDevice!)) {
                                focusDevice(iface.peerDevice!);
                              }
                            }}
                            className="font-mono text-fd-primary hover:underline"
                          >
                            {iface.peerDevice} ({iface.peerPort})
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectorTab === 'neighbors' && (
              <div className="flex flex-col gap-2">
                {Array.from(neighborsByDevice.get(selectedDevice.id) ?? []).map((peerId) => {
                  const peer = deviceById.get(peerId);
                  if (!peer) return null;
                  return (
                    <button
                      key={peer.id}
                      type="button"
                      onClick={() => focusDevice(peer.id)}
                      className="flex items-center justify-between p-3 rounded-xl border bg-fd-card/40 hover:bg-fd-accent transition-colors text-start"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Server className="size-4 text-fd-primary shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono font-semibold text-fd-foreground truncate">
                            {peer.label}
                          </span>
                          <span className="text-[11px] text-fd-muted-foreground truncate">
                            {peer.role} · {peer.ip ?? peer.tier}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0',
                          STATUS_BADGE[peer.status].className,
                        )}
                      >
                        <span className={cn('size-1.5 rounded-full', STATUS_BADGE[peer.status].dot)} />
                        {peer.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {inspectorTab === 'metadata' && (
              <div className="flex flex-col gap-2">
                {selectedDevice.customFields &&
                Object.keys(selectedDevice.customFields).length > 0 ? (
                  Object.entries(selectedDevice.customFields).map(([key, val]) => (
                    <div
                      key={key}
                      className="rounded-xl border bg-fd-card/40 p-3 flex flex-col gap-1"
                    >
                      <span className="text-[11px] font-medium text-fd-muted-foreground uppercase tracking-wider">
                        {key}
                      </span>
                      <span className="font-mono text-xs text-fd-foreground">{val}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-fd-muted-foreground py-6 text-center">
                    No custom metadata fields declared for this node.
                  </p>
                )}
              </div>
            )}

            {inspectorTab === 'config' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-fd-muted-foreground flex items-center gap-1.5">
                    <FileCode2 className="size-3.5" />
                    Device Configuration Stanza
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyConfig(
                        selectedDevice.configSnippet ??
                          `# ${selectedDevice.label}\nhostname ${selectedDevice.label}`,
                      )
                    }
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border bg-fd-secondary/60 hover:bg-fd-accent text-[11px] font-medium text-fd-foreground transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy CLI</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl border bg-fd-card/80 font-mono text-[11px] leading-relaxed text-fd-foreground overflow-x-auto">
                  <code>
                    {selectedDevice.configSnippet ??
                      `hostname ${selectedDevice.label}\n!\ninterface Loopback0\n ip address ${selectedDevice.ip ?? '10.255.0.1/32'}`}
                  </code>
                </pre>
              </div>
            )}
          </>
        ) : selectedLink ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-fd-card/40 divide-y divide-fd-border/60">
              {(
                [
                  ['Link ID', selectedLink.id, true],
                  ['Endpoint A', `${selectedLink.from.device} (${selectedLink.from.port})`, true],
                  ['Endpoint B', `${selectedLink.to.device} (${selectedLink.to.port})`, true],
                  ['Bandwidth Speed', selectedLink.speed, true],
                  ['Logical Mode', selectedLink.mode.toUpperCase(), true],
                  ['Encapsulation / Protocol', selectedLink.protocol ?? selectedLink.vlan ?? 'Native', true],
                  ['Operational State', STATUS_BADGE[selectedLink.status].label, false],
                ] as const
              ).map(([k, v, mono]) => (
                <div key={k} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-fd-muted-foreground">{k}</span>
                  <span className={cn('font-medium text-fd-foreground', mono && 'font-mono')}>
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => focusDevice(selectedLink.from.device)}
                className="p-2.5 rounded-xl border bg-fd-card/40 hover:bg-fd-accent text-start transition-colors"
              >
                <span className="text-[10px] text-fd-muted-foreground uppercase block">
                  Source Device
                </span>
                <span className="font-mono font-semibold text-fd-primary">
                  {selectedLink.from.device}
                </span>
              </button>
              <button
                type="button"
                onClick={() => focusDevice(selectedLink.to.device)}
                className="p-2.5 rounded-xl border bg-fd-card/40 hover:bg-fd-accent text-start transition-colors"
              >
                <span className="text-[10px] text-fd-muted-foreground uppercase block">
                  Target Device
                </span>
                <span className="font-mono font-semibold text-fd-primary">
                  {selectedLink.to.device}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-fd-muted-foreground leading-relaxed">
              Click any router, switch, firewall, or link on the topology canvas to inspect its
              interfaces, BGP peering state, optic levels, and CLI stanzas.
            </p>
            <div className="rounded-xl border bg-fd-card/40 p-3 flex flex-col gap-2">
              <span className="font-medium text-fd-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-fd-primary" />
                Quick Select Device
              </span>
              <div className="flex flex-col gap-1">
                {data.devices.slice(0, 5).map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => focusDevice(dev.id)}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-fd-accent text-start transition-colors"
                  >
                    <span className="font-mono font-medium text-fd-foreground">{dev.label}</span>
                    <span className="text-[11px] text-fd-muted-foreground">{dev.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspector Footer */}
      <div className="px-4 py-2.5 border-t bg-fd-card/30 flex items-center justify-between text-[11px] text-fd-muted-foreground shrink-0">
        <span>Marrow Inspector</span>
        <span className="font-mono">Press Esc to close</span>
      </div>
    </aside>
  );
}
