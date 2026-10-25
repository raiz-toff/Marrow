'use client';

import { useState } from 'react';
import { MarrowEmbed } from '@marrow/ui';

interface Example {
  id: string;
  label: string;
  file: string;
  src: string;
  yaml: string;
}

// Verbatim copies of docs/demos/*.yaml — the exact files compiled into public/demo/.
const EXAMPLES: Example[] = [
  {
    id: 'tiered',
    label: 'Branch office',
    file: 'tiered.yaml',
    src: '/demo/tiered-embed.html',
    yaml: `marrow: 2
name: Branch Office
description: Every device declares a tier — layered top-down
theme: dark
hero: core-sw

devices:
  - id: edge-rt
    name: Edge Router
    icon: affinity/tile/router
    tier: edge
    role: WAN edge
    mgmt_ip: 192.0.2.1
  - id: fw
    name: Firewall
    icon: affinity/tile/firewall
    tier: edge
    mgmt_ip: 192.0.2.2
  - id: core-sw
    name: Core Switch
    icon: affinity/tile/switch-multilayer
    tier: core
    mgmt_ip: 10.0.0.1
    interfaces:
      - name: Te1/0/1
        description: uplink to firewall
        vlan: 10
  - id: acc-sw-01
    name: Access 1
    icon: affinity/tile/switch
    tier: access
  - id: acc-sw-02
    name: Access 2
    icon: affinity/tile/switch
    tier: access
  - id: srv
    name: File Server
    icon: affinity/tile/server
    tier: endpoint
    status: degraded
    note: Disk array rebuilding
  - id: wks
    name: Workstations
    icon: affinity/tile/laptop
    tier: endpoint

links:
  - { from: edge-rt:Gi0/0, to: fw:eth1, kind: wan, speed: 1G }
  - { from: fw:eth2, to: core-sw:Te1/0/1, kind: fiber, speed: 10G }
  - { from: core-sw:Gi1/0/1, to: acc-sw-01:Gi0/48, kind: fiber, speed: 10G }
  - { from: core-sw:Gi1/0/2, to: acc-sw-02:Gi0/48, kind: fiber, speed: 10G }
  - { from: acc-sw-01:Gi0/1, to: srv:eno1, speed: 1G, status: degraded }
  - { from: acc-sw-02:Gi0/1, to: wks:eth0, speed: 1G }`,
  },
  {
    id: 'trunks',
    label: 'VLAN trunks',
    file: 'trunk-vlans.yaml',
    src: '/demo/trunk-vlans-embed.html',
    yaml: `marrow: 2
name: Trunking & VLANs
description: 802.1Q trunks between distribution and access; VLAN access ports to hosts
theme: dark
hero: dist-01

devices:
  - { id: dist-01, name: Distribution, icon: cisco/switches/layer-3-switch, tier: distribution }
  - { id: acc-01, name: Access 1, icon: cisco/switches/workgroup-switch, tier: access }
  - { id: acc-02, name: Access 2, icon: cisco/switches/workgroup-switch, tier: access }
  - { id: pc-01, name: Finance PC, icon: cisco/endpoints/pc, tier: endpoint }
  - { id: pc-02, name: HR PC, icon: cisco/endpoints/pc, tier: endpoint }
  - { id: pc-03, name: Lab PC, icon: cisco/endpoints/pc, tier: endpoint }

links:
  # 802.1Q trunks (double rail + VLAN chip) carrying the same VLAN set
  - { from: dist-01:Gi1/0/1, to: acc-01:Gi0/48, kind: fiber, speed: 10G, mode: trunk, vlans: "10,20,30", native_vlan: 1 }
  - { from: dist-01:Gi1/0/2, to: acc-02:Gi0/48, kind: fiber, speed: 10G, mode: trunk, vlans: "10,20,30", native_vlan: 1 }
  # access ports (plain line + v<vlan> chip), one VLAN each
  - { from: acc-01:Gi0/1, to: pc-01:eth0, mode: access, vlans: "10" }
  - { from: acc-01:Gi0/2, to: pc-02:eth0, mode: access, vlans: "20" }
  - { from: acc-02:Gi0/1, to: pc-03:eth0, mode: access, vlans: "30" }`,
  },
  {
    id: 'hub',
    label: 'WAN hub',
    file: 'hub-spoke.yaml',
    src: '/demo/hub-spoke-embed.html',
    yaml: `marrow: 2
name: WAN Branches
description: One hub, spokes touching only the hub — a radial layout
theme: dark
hero: hub

devices:
  - id: hub
    name: WAN Hub
    icon: affinity/tile/router-cloud
    role: MPLS concentrator
    mgmt_ip: 10.255.0.1
  - id: br-lon
    name: London
    icon: affinity/tile/router
  - id: br-nyc
    name: New York
    icon: affinity/tile/router
  - id: br-sfo
    name: San Francisco
    icon: affinity/tile/router
  - id: br-ber
    name: Berlin
    icon: affinity/tile/router
    status: down
    note: Circuit outage — carrier ticket INC-4471
  - id: br-tyo
    name: Tokyo
    icon: affinity/tile/router
  - id: br-syd
    name: Sydney
    icon: affinity/tile/router
    status: planned

links:
  - { from: hub:Gi0/1, to: br-lon:Gi0/0, kind: wan, speed: 1G }
  - { from: hub:Gi0/2, to: br-nyc:Gi0/0, kind: wan, speed: 1G }
  - { from: hub:Gi0/3, to: br-sfo:Gi0/0, kind: wan, speed: 1G }
  - { from: hub:Gi0/4, to: br-ber:Gi0/0, kind: wan, speed: 1G, status: down }
  - { from: hub:Gi0/5, to: br-tyo:Gi0/0, kind: wan, speed: 100M }
  - { from: hub:Gi0/6, to: br-syd:Gi0/0, kind: wan, speed: 1G, status: planned }`,
  },
];

export function DemoExample() {
  const [active, setActive] = useState<Example>(EXAMPLES[0]!);

  return (
    <div className="overflow-hidden rounded-xl border bg-fd-card">
      <div role="tablist" aria-label="Example topologies" className="flex gap-1 border-b px-2">
        {EXAMPLES.map((ex) => {
          const selected = ex.id === active.id;
          return (
            <button
              key={ex.id}
              id={`example-tab-${ex.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(ex)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors ${
                selected
                  ? 'border-fd-primary text-fd-foreground'
                  : 'border-transparent text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-w-0 flex-col border-b lg:border-r lg:border-b-0">
          <p className="border-b px-4 py-2 font-mono text-xs text-fd-muted-foreground">
            {active.file}
          </p>
          <pre className="h-[320px] overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-fd-foreground/90 lg:h-[520px]">
            <code>{active.yaml}</code>
          </pre>
        </div>
        <div className="relative h-[420px] lg:h-[560px]">
          <MarrowEmbed
            key={active.src}
            src={active.src}
            title={`${active.label} diagram compiled by Marrow`}
            chrome="minimal"
            height="100%"
            className="h-full min-h-0 rounded-none border-0"
          />
        </div>
      </div>
    </div>
  );
}
