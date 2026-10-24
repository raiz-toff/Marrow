export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export type DeviceStatus = 'up' | 'degraded' | 'down' | 'planned' | 'unknown';
export type LinkMode = 'access' | 'trunk' | 'routed' | 'peering' | 'tunnel' | 'stack';

export interface TopologyInterface {
  name: string;
  ip?: string;
  vlan?: string;
  speed?: string;
  mode?: LinkMode;
  status: DeviceStatus;
  peerDevice?: string;
  peerPort?: string;
}

export interface TopologyDevice {
  id: string;
  label: string;
  role: string;
  tier: 'edge' | 'core' | 'distribution' | 'access' | 'endpoint';
  zone: string;
  ip?: string;
  asn?: number;
  model?: string;
  os?: string;
  serial?: string;
  status: DeviceStatus;
  haPairWith?: string;
  x?: number;
  y?: number;
  interfaces: TopologyInterface[];
  customFields?: Record<string, string>;
  configSnippet?: string;
}

export interface TopologyLink {
  id: string;
  from: { device: string; port: string; ip?: string };
  to: { device: string; port: string; ip?: string };
  speed: '1G' | '10G' | '25G' | '40G' | '100G' | '400G';
  mode: LinkMode;
  status: DeviceStatus;
  protocol?: string;
  vlan?: string;
  flow?: boolean;
}

export interface TopologyZone {
  id: string;
  label: string;
  subtitle?: string;
  accent?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface TopologyData {
  title: string;
  subtitle?: string;
  version?: string;
  layoutArchetype?: string;
  rendererTier?: 'svg-hero' | 'canvas-scale';
  width?: number;
  height?: number;
  zones: TopologyZone[];
  devices: TopologyDevice[];
  links: TopologyLink[];
}

export interface TopologyViewSettings {
  labels: boolean;
  ports: boolean;
  motion: boolean;
  minimap: boolean;
  watermark: 'full' | 'minimal' | 'blueprint' | 'off';
}

/**
 * Authentic Marrow Topology Data matching `docs/demos/zoned.yaml` (Two Sites).
 * Used as default state for the outer shell, sidebar inventory, and telemetry inspector.
 */
export const DEFAULT_TOPOLOGY_DATA: TopologyData = {
  title: 'Two Sites',
  subtitle: 'HQ & Datacenter Interconnect — Zoned Mosaic',
  version: '2.0.0',
  layoutArchetype: 'zoned-mosaic',
  rendererTier: 'svg-hero',
  zones: [
    {
      id: 'hq',
      label: 'Headquarters',
      subtitle: 'Campus Distribution & WAN Edge',
      accent: '#7aa2ff',
    },
    {
      id: 'dc',
      label: 'Datacenter',
      subtitle: 'Core Fabric & Application Clusters',
      accent: '#4fc3a1',
    },
  ],
  devices: [
    {
      id: 'hq-core-01',
      label: 'HQ Core 1',
      role: 'Campus Core Switch',
      tier: 'core',
      zone: 'hq',
      ip: '10.10.1.1/24',
      asn: 65100,
      model: 'Cisco Catalyst 9500-48Y4C',
      os: 'Cisco IOS-XE 17.12.1',
      serial: 'FCZ2418B0XA',
      status: 'up',
      haPairWith: 'hq-core-02',
      interfaces: [
        {
          name: 'Te1/0/1',
          ip: '10.10.100.1/30',
          speed: '10G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'hq-fw',
          peerPort: 'eth1',
        },
        {
          name: 'Te1/0/2',
          speed: '40G',
          mode: 'trunk',
          status: 'up',
          vlan: '10,20,30,99',
          peerDevice: 'hq-core-02',
          peerPort: 'Te1/0/2',
        },
        {
          name: 'Gi1/0/1',
          speed: '10G',
          mode: 'trunk',
          status: 'up',
          vlan: '10,20,30',
          peerDevice: 'hq-acc-01',
          peerPort: 'Gi0/48',
        },
      ],
      customFields: {
        'Stack Mode': 'Cisco StackWise-Virtual (Active)',
        'Domain ID': '10',
        'Uptime': '142 days, 18 hours',
      },
      configSnippet: `interface TenGigabitEthernet1/0/1
 description UPLINK-TO-HQ-FIREWALL
 no switchport
 ip address 10.10.100.1 255.255.255.252
 ip ospf 1 area 0
!
interface Port-channel1
 description HA-INTER-CHASSIS-LINK
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99
!
router bgp 65100
 bgp router-id 10.10.1.1
 neighbor 10.10.100.2 remote-as 65100
 neighbor 10.10.100.2 activate`,
    },
    {
      id: 'hq-core-02',
      label: 'HQ Core 2',
      role: 'Campus Core Switch (Standby)',
      tier: 'core',
      zone: 'hq',
      ip: '10.10.1.2/24',
      asn: 65100,
      model: 'Cisco Catalyst 9500-48Y4C',
      os: 'Cisco IOS-XE 17.12.1',
      serial: 'FCZ2418B0XB',
      status: 'up',
      haPairWith: 'hq-core-01',
      interfaces: [
        {
          name: 'Te1/0/2',
          speed: '40G',
          mode: 'trunk',
          status: 'up',
          vlan: '10,20,30,99',
          peerDevice: 'hq-core-01',
          peerPort: 'Te1/0/2',
        },
      ],
      customFields: {
        'Stack Mode': 'Cisco StackWise-Virtual (Standby)',
        'Domain ID': '10',
        'Uptime': '142 days, 18 hours',
      },
      configSnippet: `interface Port-channel1
 description HA-INTER-CHASSIS-LINK
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,99`,
    },
    {
      id: 'hq-acc-01',
      label: 'HQ Access',
      role: 'Wiring Closet Switch',
      tier: 'access',
      zone: 'hq',
      ip: '10.10.10.5/24',
      model: 'Cisco Catalyst 9300-48P',
      os: 'Cisco IOS-XE 17.9.3',
      serial: 'FOC2319S83A',
      status: 'up',
      interfaces: [
        {
          name: 'Gi0/48',
          speed: '10G',
          mode: 'trunk',
          status: 'up',
          vlan: '10,20,30',
          peerDevice: 'hq-core-01',
          peerPort: 'Gi1/0/1',
        },
      ],
      customFields: {
        'PoE Budget': '740W (182W utilized)',
        'Active Clients': '42 endpoints',
      },
      configSnippet: `interface GigabitEthernet0/48
 description UPLINK-TO-HQ-CORE-01
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30`,
    },
    {
      id: 'hq-fw',
      label: 'HQ Firewall',
      role: 'Perimeter Next-Gen Firewall',
      tier: 'edge',
      zone: 'hq',
      ip: '198.51.100.1/30',
      model: 'Palo Alto PA-3220',
      os: 'PAN-OS 11.0.2',
      serial: '012901004918',
      status: 'up',
      interfaces: [
        {
          name: 'eth1',
          ip: '10.10.100.2/30',
          speed: '10G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'hq-core-01',
          peerPort: 'Te1/0/1',
        },
        {
          name: 'eth2',
          ip: '198.51.100.1/30',
          speed: '1G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'dc-rt',
          peerPort: 'Gi0/0',
        },
      ],
      customFields: {
        'Threat Prevention': 'Active / Zero-Day Inspection',
        'IPSec Tunnel': 'Phase 2 Established',
      },
      configSnippet: `set network interface ethernet ethernet1/1 layer3 ip 10.10.100.2/30
set network interface ethernet ethernet1/2 layer3 ip 198.51.100.1/30
set network tunnel ipsec SITE-TO-SITE-DC auto-key ike-crypto-profile IKE-AES256-SHA384`,
    },
    {
      id: 'dc-rt',
      label: 'DC Router',
      role: 'Datacenter Edge Router',
      tier: 'edge',
      zone: 'dc',
      ip: '198.51.100.2/30',
      asn: 65200,
      model: 'Cisco ASR 1001-HX',
      os: 'Cisco IOS-XE 17.9.4',
      serial: 'JAE2134001A',
      status: 'up',
      interfaces: [
        {
          name: 'Gi0/0',
          ip: '198.51.100.2/30',
          speed: '1G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'hq-fw',
          peerPort: 'eth2',
        },
        {
          name: 'Gi0/1',
          ip: '10.20.100.1/30',
          speed: '10G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'dc-sw',
          peerPort: 'Te1/0/1',
        },
      ],
      customFields: {
        'BGP Status': 'Established (HQ eBGP Peering)',
        'Throughput': '840 Mbps / Line Rate',
      },
      configSnippet: `interface GigabitEthernet0/0
 description WAN-INTERCONNECT-TO-HQ-FW
 ip address 198.51.100.2 255.255.255.252
!
interface GigabitEthernet0/1
 description CORE-INTERCONNECT-TO-DC-SW
 ip address 10.20.100.1 255.255.255.252`,
    },
    {
      id: 'dc-sw',
      label: 'DC Switch',
      role: 'Spine/Leaf Multilayer Switch',
      tier: 'core',
      zone: 'dc',
      ip: '10.20.1.1/24',
      asn: 65200,
      model: 'Arista 7050CX3-32S',
      os: 'Arista EOS 4.31.2F',
      serial: 'JPE1942001',
      status: 'up',
      interfaces: [
        {
          name: 'Te1/0/1',
          ip: '10.20.100.2/30',
          speed: '10G',
          mode: 'routed',
          status: 'up',
          peerDevice: 'dc-rt',
          peerPort: 'Gi0/1',
        },
        {
          name: 'Te1/0/2',
          speed: '25G',
          mode: 'access',
          status: 'up',
          vlan: '100',
          peerDevice: 'dc-srv-01',
          peerPort: 'eno1',
        },
        {
          name: 'Te1/0/3',
          speed: '25G',
          mode: 'access',
          status: 'up',
          vlan: '200',
          peerDevice: 'dc-srv-02',
          peerPort: 'eno1',
        },
      ],
      customFields: {
        'Fabric Role': 'Leaf Switch / VTEP',
        'Switching Capacity': '6.4 Tbps',
      },
      configSnippet: `interface Ethernet1/1
 description UPLINK-TO-DC-ROUTER
 no switchport
 ip address 10.20.100.2/30
!
interface Ethernet2/1
 description APP-CLUSTER-SRV-01
 switchport access vlan 100
!
interface Ethernet3/1
 description DATABASE-SRV-02
 switchport access vlan 200`,
    },
    {
      id: 'dc-srv-01',
      label: 'App Cluster',
      role: 'Kubernetes Worker Pool',
      tier: 'endpoint',
      zone: 'dc',
      ip: '10.20.10.11/24',
      model: 'Dell PowerEdge R760',
      os: 'Ubuntu 24.04 LTS (Kernel 6.8)',
      serial: '8X912F4',
      status: 'up',
      interfaces: [
        {
          name: 'eno1',
          ip: '10.20.10.11/24',
          speed: '25G',
          mode: 'access',
          status: 'up',
          vlan: '100',
          peerDevice: 'dc-sw',
          peerPort: 'Te1/0/2',
        },
      ],
      customFields: {
        'K8s Pods': '64 running',
        'Memory Usage': '68% of 512GB',
      },
      configSnippet: `network:
  version: 2
  ethernets:
    eno1:
      dhcp4: false
      addresses: [10.20.10.11/24]
      routes:
        - to: default
          via: 10.20.10.1`,
    },
    {
      id: 'dc-srv-02',
      label: 'Database',
      role: 'PostgreSQL HA Primary',
      tier: 'endpoint',
      zone: 'dc',
      ip: '10.20.10.12/24',
      model: 'Dell PowerEdge R760',
      os: 'Ubuntu 24.04 LTS (Kernel 6.8)',
      serial: '8X912F5',
      status: 'up',
      interfaces: [
        {
          name: 'eno1',
          ip: '10.20.10.12/24',
          speed: '25G',
          mode: 'access',
          status: 'up',
          vlan: '200',
          peerDevice: 'dc-sw',
          peerPort: 'Te1/0/3',
        },
      ],
      customFields: {
        'Replication': 'Synchronous Streaming to DR',
        'Database Engine': 'PostgreSQL 16.2',
        'Note': 'Primary — failover to DR nightly',
      },
      configSnippet: `network:
  version: 2
  ethernets:
    eno1:
      dhcp4: false
      addresses: [10.20.10.12/24]
      routes:
        - to: default
          via: 10.20.10.1`,
    },
  ],
  links: [
    {
      id: 'hq-fw--hq-core-01#1',
      from: { device: 'hq-fw', port: 'eth1', ip: '10.10.100.2/30' },
      to: { device: 'hq-core-01', port: 'Te1/0/1', ip: '10.10.100.1/30' },
      speed: '10G',
      mode: 'routed',
      status: 'up',
      protocol: 'OSPF Area 0',
    },
    {
      id: 'hq-core-01--hq-core-02#1',
      from: { device: 'hq-core-01', port: 'Te1/0/2' },
      to: { device: 'hq-core-02', port: 'Te1/0/2' },
      speed: '40G',
      mode: 'trunk',
      status: 'up',
      protocol: 'LACP (po1)',
      vlan: '10,20,30,99',
    },
    {
      id: 'hq-core-01--hq-acc-01#1',
      from: { device: 'hq-core-01', port: 'Gi1/0/1' },
      to: { device: 'hq-acc-01', port: 'Gi0/48' },
      speed: '10G',
      mode: 'trunk',
      status: 'up',
      vlan: '10,20,30',
    },
    {
      id: 'hq-fw--dc-rt#1',
      from: { device: 'hq-fw', port: 'eth2', ip: '198.51.100.1/30' },
      to: { device: 'dc-rt', port: 'Gi0/0', ip: '198.51.100.2/30' },
      speed: '1G',
      mode: 'tunnel',
      status: 'up',
      protocol: 'IPSec Site-to-Site',
    },
    {
      id: 'dc-rt--dc-sw#1',
      from: { device: 'dc-rt', port: 'Gi0/1', ip: '10.20.100.1/30' },
      to: { device: 'dc-sw', port: 'Te1/0/1', ip: '10.20.100.2/30' },
      speed: '10G',
      mode: 'routed',
      status: 'up',
      protocol: 'eBGP ASN 65200',
    },
    {
      id: 'dc-sw--dc-srv-01#1',
      from: { device: 'dc-sw', port: 'Te1/0/2' },
      to: { device: 'dc-srv-01', port: 'eno1', ip: '10.20.10.11/24' },
      speed: '25G',
      mode: 'access',
      status: 'up',
      vlan: '100',
    },
    {
      id: 'dc-sw--dc-srv-02#1',
      from: { device: 'dc-sw', port: 'Te1/0/3' },
      to: { device: 'dc-srv-02', port: 'eno1', ip: '10.20.10.12/24' },
      speed: '25G',
      mode: 'access',
      status: 'up',
      vlan: '200',
    },
  ],
};
