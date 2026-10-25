'use client';

import { useState } from 'react';
import { MarrowEmbed } from '@marrow/ui';
import { Check, Copy, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
    label: 'Enterprise backbone',
    file: 'tiered.yaml',
    src: '/demo/tiered-embed.html',
    yaml: `marrow: 2
name: Enterprise Campus Backbone
description: Multi-tier spine-and-leaf campus fabric with HA firewalls, IPsec cloud tunnel, 802.1Q trunks, and LACP port-channels
theme: auto
hero: core-01
author: NetOps Architecture Team
revision: v3.2
date: "2026-10-24"

about:
  Architecture: |
    Dual-homed enterprise campus backbone providing resilient connectivity across access switching, stateful HA security inspection, and hybrid AWS DirectConnect/IPsec transit.
  Redundancy & Failover: |
    - **Edge NGFW**: Active/Standby stateful cluster with sub-second failover over dedicated HA sync.
    - **Campus Core**: Dual Catalyst 9500 multichassis LAG (40G DAC) running OSPF spine routing.
    - **Access Uplinks**: Cross-chassis 802.1Q 10G fiber trunks carrying VLANs 10, 20, 30, and 99.

devices:
  # ── Edge Tier ──
  - id: fw-01
    name: Perimeter Firewall 01
    icon: cisco/security/firewall
    tier: edge
    role: NGFW (Active)
    status: up
    mgmt_ip: 10.0.0.2
    ha_pair_with: fw-02
    note: Primary stateful firewall node · VRRP master
    custom_fields:
      Model: FortiGate 600F
      Firmware: FortiOS 7.4.4
      HA Role: Active (Priority 110)
      Throughput: 28 Gbps IPS
    sections:
      Active Policies: |
        | Rule | Service | Source | Destination | Action |
        | 10 | HTTPS | Any | DMZ-VIP:443 | Allow (IPS) |
        | 20 | IPsec | WAN | AWS-Transit | Encrypt |
        | 99 | Any | Any | Any | Deny |

  - id: fw-02
    name: Perimeter Firewall 02
    icon: cisco/security/firewall
    tier: edge
    role: NGFW (Standby)
    status: up
    mgmt_ip: 10.0.0.3
    ha_pair_with: fw-01
    note: Standby peer · config sync OK
    custom_fields:
      Model: FortiGate 600F
      Firmware: FortiOS 7.4.4
      HA Role: Standby (Priority 100)

  # ── Core Tier ──
  - id: core-01
    name: Core Switch 01
    icon: cisco/switches/layer-3-switch
    tier: core
    role: Campus Core Spine
    status: up
    mgmt_ip: 10.0.1.1
    ha_pair_with: core-02
    hero: true
    note: Hero spine · HSRP active for VLANs 10, 20, 30
    custom_fields:
      Model: Cisco Catalyst 9500-48Y4C
      Serial Number: FOC2619A01
      OS Version: IOS-XE 17.12.3
      Rack Location: Rack A02 · RU 36-37
      Switching Capacity: 3.2 Tbps
    interfaces:
      - name: Fo1/0/49
        description: VSL Multichassis LAG Member 1
        vlan: 1
      - name: Fo1/0/50
        description: VSL Multichassis LAG Member 2
        vlan: 1
      - name: Te1/0/1
        description: 802.1Q trunk uplink to Access 01
        vlan: 10
      - name: Te1/0/2
        description: 802.1Q trunk uplink to Access 02
        vlan: 10
    sections:
      OSPF Routing Table: |
        | Prefix | Next Hop | Cost | Area | Interface |
        | 10.0.10.0/24 | Direct | 1 | 0.0.0.0 | Vlan10 (Mgmt) |
        | 10.0.20.0/24 | Direct | 1 | 0.0.0.0 | Vlan20 (App) |
        | 10.0.30.0/24 | Direct | 1 | 0.0.0.0 | Vlan30 (Data) |
        | 10.200.0.0/16 | 10.0.0.2 | 10 | 0.0.0.0 | Te1/0/48 (FW) |

  - id: core-02
    name: Core Switch 02
    icon: cisco/switches/layer-3-switch
    tier: core
    role: Campus Core Spine
    status: up
    mgmt_ip: 10.0.1.2
    ha_pair_with: core-01
    custom_fields:
      Model: Cisco Catalyst 9500-48Y4C
      Serial Number: FOC2619A02
      OS Version: IOS-XE 17.12.3
      Rack Location: Rack A03 · RU 36-37

  # ── Access Tier ──
  - id: acc-01
    name: Access Stack 01
    icon: cisco/switches/workgroup-switch
    tier: access
    role: Access PoE+ Stack
    status: up
    mgmt_ip: 10.0.1.11
    custom_fields:
      Model: Cisco Catalyst 9300-48P (StackWise)
      PoE Budget: 1440 W (780 W consumed)
      Stack Members: 2
    sections:
      Port Utilization: |
        | Total Ports | Active Endpoints | PoE Delivering | Error/CRC |
        | 96 | 68 | 34 ports (540 W) | 0 |

  - id: acc-02
    name: Access Stack 02
    icon: cisco/switches/workgroup-switch
    tier: access
    role: Access PoE+ Stack
    status: up
    mgmt_ip: 10.0.1.12
    custom_fields:
      Model: Cisco Catalyst 9300-48P (StackWise)
      PoE Budget: 1440 W (520 W consumed)

  # ── Endpoints & Hybrid Cloud ──
  - id: aws-transit
    name: AWS Transit GW
    icon: affinity/tile/router-cloud
    tier: endpoint
    role: Hybrid Cloud Interconnect
    status: up
    mgmt_ip: 10.200.0.1
    custom_fields:
      Provider: AWS Cloud
      Region: us-east-1
      DirectConnect: dxcon-fg821
      Attached VPC: 10.200.0.0/16

  - id: srv-app
    name: App Cluster
    icon: cisco/datacenter/blade-server
    tier: endpoint
    role: Kubernetes Workers
    status: up
    mgmt_ip: 10.0.20.15
    custom_fields:
      Hardware: Dell PowerEdge R760
      Compute: 64 vCPU · 256 GB RAM
      Containers: 32 pods active

  - id: srv-db
    name: Database Primary
    icon: cisco/storage/relational-database
    tier: endpoint
    role: Postgres Primary
    status: degraded
    mgmt_ip: 10.0.30.20
    note: NVMe array rebuild in progress (84% complete)
    custom_fields:
      Engine: PostgreSQL 16.2
      IOPS: 45,000 IOPS
      Replication Lag: 0.4 ms

  - id: ap-corp
    name: Wi-Fi 6 AP
    icon: cisco/datacenter/wireless-access-point
    tier: endpoint
    role: Enterprise AP
    status: up
    mgmt_ip: 10.0.10.50
    custom_fields:
      Model: Catalyst 9130AX Series
      Radios: 2.4 GHz + 5 GHz (Dual 8x8)
      Clients: 47 connected

  - id: wks
    name: Engineering Pod
    icon: affinity/tile/laptop
    tier: endpoint
    role: Developer Laptops
    status: up

  - id: srv-backup
    name: Offsite DR Target
    icon: cisco/servers/file-server
    tier: endpoint
    role: Disaster Recovery
    status: planned
    note: Scheduled for Q4 deployment

links:
  # HA Sync between firewalls
  - { from: fw-01:ha1, to: fw-02:ha1, kind: dac, speed: 10G, label: ha-sync }

  # IPsec encrypted site-to-cloud VPN tunnel to AWS
  - { from: fw-01:tun10, to: aws-transit:ipsec0, kind: wan, speed: 1G, mode: tunnel, encap: ipsec, label: ipsec-vpn }
  - { from: fw-02:tun10, to: aws-transit:ipsec1, kind: wan, speed: 1G, mode: tunnel, encap: ipsec, status: planned, label: backup-vpn }

  # Routed uplinks from Firewalls to Core
  - { from: fw-01:port2, to: core-01:Te1/0/47, kind: fiber, speed: 10G, mode: routed, protocol: ospf }
  - { from: fw-02:port2, to: core-02:Te1/0/47, kind: fiber, speed: 10G, mode: routed, protocol: ospf }

  # 40G Port-Channel multichassis LAG between Core switches
  - { from: core-01:Fo1/0/49, to: core-02:Fo1/0/49, kind: dac, speed: 40G, lag: po1, lacp: active, mode: trunk, vlans: "10,20,30,99" }
  - { from: core-01:Fo1/0/50, to: core-02:Fo1/0/50, kind: dac, speed: 40G, lag: po1, lacp: active, mode: trunk, vlans: "10,20,30,99" }

  # 10G Cross-chassis 802.1Q Trunks from Core to Access with optical diagnostics
  - from: core-01:Te1/0/1
    to: acc-01:Te1/1/1
    kind: fiber
    speed: 10G
    mode: trunk
    vlans: "10,20,30,99"
    native_vlan: 1
    custom_fields:
      Transceiver: 10GBASE-SR SFP+
      Cable ID: OM4-MDF-01
    sections:
      Optical Diagnostics: |
        | Metric | Reading | Status |
        | Tx Power | -2.1 dBm | Normal |
        | Rx Power | -3.4 dBm | Normal |
        | Temperature | 38.4 °C | Normal |
  - { from: core-02:Te1/0/1, to: acc-01:Te1/1/2, kind: fiber, speed: 10G, mode: trunk, vlans: "10,20,30,99", native_vlan: 1 }
  - { from: core-01:Te1/0/2, to: acc-02:Te1/1/1, kind: fiber, speed: 10G, mode: trunk, vlans: "10,20,30,99", native_vlan: 1 }
  - { from: core-02:Te1/0/2, to: acc-02:Te1/1/2, kind: fiber, speed: 10G, mode: trunk, vlans: "10,20,30,99", native_vlan: 1 }

  # Access ports to Server Endpoints
  - { from: acc-01:Gi1/0/10, to: srv-app:eno1, kind: fiber, speed: 10G, mode: access, vlans: "20" }
  - { from: acc-01:Gi1/0/12, to: srv-db:eno1, kind: fiber, speed: 10G, mode: access, vlans: "30", status: degraded }

  # Access ports to Campus Users & AP
  - { from: acc-02:Gi1/0/1, to: ap-corp:eth0, speed: 2.5G, mode: trunk, vlans: "10,99", native_vlan: 10 }
  - { from: acc-02:Gi1/0/24, to: wks:eth0, speed: 1G, mode: access, vlans: "10" }
  - { from: acc-02:Gi1/0/48, to: srv-backup:eno1, kind: fiber, speed: 10G, status: planned, label: dr-replica }`,
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
  const [isYamlOpen, setIsYamlOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(active.yaml).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-fd-border/70 bg-fd-card shadow-lg transition-all">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border/70 bg-fd-card/70 px-3 py-2 backdrop-blur-xs">
        {/* Topology selection tabs */}
        <div role="tablist" aria-label="Example topologies" className="flex items-center gap-1">
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
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  selected
                    ? 'bg-fd-accent text-fd-foreground font-semibold shadow-2xs'
                    : 'text-fd-muted-foreground hover:bg-fd-accent/60 hover:text-fd-foreground'
                }`}
              >
                {ex.label}
              </button>
            );
          })}
        </div>

        {/* Interactive Actions & YAML Toggle */}
        <div className="flex items-center gap-2">
          {/* Subtle live indicator */}
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground mr-1 select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Click devices or cables to inspect
          </span>

          {/* Expandable YAML button */}
          <button
            type="button"
            onClick={() => setIsYamlOpen(!isYamlOpen)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              isYamlOpen
                ? 'border-fd-primary bg-fd-primary/10 text-fd-foreground shadow-2xs'
                : 'border-fd-border/70 bg-fd-background/80 text-fd-muted-foreground hover:border-fd-foreground/40 hover:text-fd-foreground'
            }`}
            title={isYamlOpen ? 'Collapse YAML panel' : 'Expand YAML panel'}
          >
            {isYamlOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
            <span>{isYamlOpen ? 'Hide YAML' : 'View YAML'}</span>
            <span className="font-mono text-[10px] text-fd-muted-foreground">({active.file})</span>
          </button>

          {/* Standalone Link */}
          <a
            href={active.src.replace('-embed.html', '.html')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center p-1.5 rounded-lg border border-fd-border/70 bg-fd-background/80 text-fd-muted-foreground hover:text-fd-foreground hover:border-fd-foreground/40 transition-all cursor-pointer"
            title="Open standalone full diagram in new tab"
          >
            <ExternalLink className="size-3.5" />
            <span className="sr-only">Open standalone</span>
          </a>
        </div>
      </div>

      {/* Main Content: Hero Diagram + Expandable YAML */}
      <div className="flex flex-col lg:flex-row min-h-[540px] sm:min-h-[620px] lg:min-h-[700px]">
        {/* Expandable YAML Drawer / Sidebar */}
        {isYamlOpen && (
          <div className="flex flex-col w-full lg:w-[320px] shrink-0 border-b lg:border-r lg:border-b-0 bg-fd-card/40 transition-all">
            <div className="flex items-center justify-between border-b border-fd-border/50 px-3.5 py-2 bg-fd-muted/20">
              <div className="flex items-center gap-1.5 font-mono text-xs text-fd-muted-foreground">
                <span className="font-semibold text-fd-foreground">{active.file}</span>
                <span>·</span>
                <span>{active.yaml.trim().split('\n').length} lines</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground transition-colors cursor-pointer"
                title="Copy YAML to clipboard"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="h-[280px] lg:h-full max-h-[700px] overflow-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-fd-foreground/90 select-text">
              <code>{active.yaml}</code>
            </pre>
          </div>
        )}

        {/* Hero Interactive Diagram (Dominant / Full-Width) */}
        <div className="relative min-w-0 flex-1 h-[540px] sm:h-[620px] lg:h-[700px] bg-fd-background">
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
