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
  x: number;
  y: number;
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
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TopologyData {
  title: string;
  subtitle?: string;
  version?: string;
  layoutArchetype?: string;
  rendererTier?: 'svg-hero' | 'canvas-scale';
  width: number;
  height: number;
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

export const DEFAULT_TOPOLOGY_DATA: TopologyData = {
  title: 'US-East Production Core & Campus Fabric',
  subtitle: 'Dual-Core EVPN/VXLAN Spine-Leaf with Redundant WAN Edge & DMZ Perimeter',
  version: '2026.10.2',
  layoutArchetype: 'zoned-tiered',
  rendererTier: 'svg-hero',
  width: 1120,
  height: 680,
  zones: [
    {
      id: 'wan-edge',
      label: 'WAN & Peering Edge',
      subtitle: 'AS 65001 · External Transit',
      accent: '#f59e0b',
      x: 60,
      y: 40,
      width: 680,
      height: 155,
    },
    {
      id: 'dc-core',
      label: 'Core Switching Fabric',
      subtitle: 'EVPN VXLAN · Loopback0 10.255.0.0/24',
      accent: '#3b82f6',
      x: 60,
      y: 230,
      width: 680,
      height: 175,
    },
    {
      id: 'campus-access',
      label: 'Distribution & Access Pods',
      subtitle: 'VLANs 10, 20, 40, 100 · 802.1X',
      accent: '#10b981',
      x: 60,
      y: 440,
      width: 680,
      height: 195,
    },
    {
      id: 'dmz-sec',
      label: 'Security & DMZ Enclave',
      subtitle: 'Zero-Trust Inspection Zone',
      accent: '#8b5cf6',
      x: 780,
      y: 40,
      width: 280,
      height: 595,
    },
  ],
  devices: [
    {
      id: 'edge-rtr-01',
      label: 'edge-rtr-01',
      role: 'WAN Border Router',
      tier: 'edge',
      zone: 'wan-edge',
      ip: '198.51.100.1/30',
      asn: 65001,
      model: 'Cisco ASR 1002-HX',
      os: 'IOS-XE 17.12.03',
      serial: 'FXS2340Q1A9',
      status: 'up',
      haPairWith: 'edge-rtr-02',
      x: 240,
      y: 118,
      interfaces: [
        { name: 'Te0/0/0', ip: '203.0.113.2/30', speed: '10G', mode: 'peering', status: 'up', peerDevice: 'ISP-A', peerPort: 'et-0/0/1' },
        { name: 'Hu0/1/0', ip: '10.0.1.1/30', speed: '100G', mode: 'routed', status: 'up', peerDevice: 'core-sw-01', peerPort: 'Et1/1' },
        { name: 'Te0/0/2', ip: '10.0.12.1/30', speed: '10G', mode: 'routed', status: 'up', peerDevice: 'fw-dmz-01', peerPort: 'ethernet1/1' },
      ],
      customFields: {
        'BGP Peers': '4 Established (ISP-A, ISP-B, Core-01, Core-02)',
        'Optic Hu0/1/0': 'QSFP28-100G-SR4 (Rx: -2.1 dBm / Tx: -1.4 dBm)',
        'Rack Location': 'DC1-RowA-Rack02-U14',
        'Circuit ID': 'LUMEN-884920-NYC',
      },
      configSnippet: `router bgp 65001
 bgp router-id 10.255.0.1
 bgp log-neighbor-changes
 neighbor 10.0.1.2 remote-as 65001
 neighbor 10.0.1.2 description core-sw-01
 !
 address-family ipv4
  network 10.255.0.1 mask 255.255.255.255
  neighbor 10.0.1.2 activate
 exit-address-family`,
    },
    {
      id: 'edge-rtr-02',
      label: 'edge-rtr-02',
      role: 'WAN Border Router',
      tier: 'edge',
      zone: 'wan-edge',
      ip: '198.51.100.2/30',
      asn: 65001,
      model: 'Cisco ASR 1002-HX',
      os: 'IOS-XE 17.12.03',
      serial: 'FXS2340Q1B2',
      status: 'up',
      haPairWith: 'edge-rtr-01',
      x: 540,
      y: 118,
      interfaces: [
        { name: 'Te0/0/0', ip: '198.51.100.6/30', speed: '10G', mode: 'peering', status: 'up', peerDevice: 'ISP-B', peerPort: 'xe-0/1/0' },
        { name: 'Hu0/1/0', ip: '10.0.1.5/30', speed: '100G', mode: 'routed', status: 'up', peerDevice: 'core-sw-02', peerPort: 'Et1/1' },
        { name: 'Te0/0/2', ip: '10.0.12.5/30', speed: '10G', mode: 'tunnel', status: 'degraded', peerDevice: 'fw-dmz-01', peerPort: 'ethernet1/2' },
      ],
      customFields: {
        'BGP Peers': '3 Established, 1 Idle (DMZ IPSec backup)',
        'Optic Hu0/1/0': 'QSFP28-100G-SR4 (Rx: -2.4 dBm / Tx: -1.5 dBm)',
        'Rack Location': 'DC1-RowA-Rack03-U14',
        'Circuit ID': 'ZAYO-441092-IAD',
      },
      configSnippet: `router bgp 65001
 bgp router-id 10.255.0.2
 neighbor 10.0.1.6 remote-as 65001
 neighbor 10.0.1.6 description core-sw-02`,
    },
    {
      id: 'core-sw-01',
      label: 'core-sw-01',
      role: 'EVPN Spine Core',
      tier: 'core',
      zone: 'dc-core',
      ip: '10.255.0.11/32',
      asn: 65100,
      model: 'Arista 7050CX3-32S',
      os: 'EOS 4.31.2F',
      serial: 'JPE21190451',
      status: 'up',
      haPairWith: 'core-sw-02',
      x: 240,
      y: 318,
      interfaces: [
        { name: 'Et1/1', ip: '10.0.1.2/30', speed: '100G', mode: 'routed', status: 'up', peerDevice: 'edge-rtr-01', peerPort: 'Hu0/1/0' },
        { name: 'Et31/1', ip: '10.255.255.1/30', speed: '100G', mode: 'stack', status: 'up', peerDevice: 'core-sw-02', peerPort: 'Et31/1' },
        { name: 'Po10', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'up', peerDevice: 'dist-sw-01', peerPort: 'Po10' },
        { name: 'Po20', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'up', peerDevice: 'dist-sw-02', peerPort: 'Po10' },
      ],
      customFields: {
        'MLAG Domain': 'mlag-core-peer (Active / Primary)',
        'VXLAN VTEP': '10.255.0.11 (14 VNIs active)',
        'Optic Et1/1': '100GBASE-SR4 (Temp: 38.4°C)',
        'Rack Location': 'DC1-RowB-Rack01-U22',
      },
      configSnippet: `interface Port-Channel10
 description Downlink to dist-sw-01
 switchport mode trunk
 switchport trunk allowed vlan 10,20,40,100
 mlag 10
!
interface Vxlan1
 vxlan source-interface Loopback0
 vxlan udp-port 4789`,
    },
    {
      id: 'core-sw-02',
      label: 'core-sw-02',
      role: 'EVPN Spine Core',
      tier: 'core',
      zone: 'dc-core',
      ip: '10.255.0.12/32',
      asn: 65100,
      model: 'Arista 7050CX3-32S',
      os: 'EOS 4.31.2F',
      serial: 'JPE21190488',
      status: 'up',
      haPairWith: 'core-sw-01',
      x: 540,
      y: 318,
      interfaces: [
        { name: 'Et1/1', ip: '10.0.1.6/30', speed: '100G', mode: 'routed', status: 'up', peerDevice: 'edge-rtr-02', peerPort: 'Hu0/1/0' },
        { name: 'Et31/1', ip: '10.255.255.2/30', speed: '100G', mode: 'stack', status: 'up', peerDevice: 'core-sw-01', peerPort: 'Et31/1' },
        { name: 'Po20', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'up', peerDevice: 'dist-sw-02', peerPort: 'Po20' },
        { name: 'Et12/1', ip: '10.0.20.1/30', speed: '25G', mode: 'routed', status: 'up', peerDevice: 'fw-dmz-01', peerPort: 'ethernet1/3' },
      ],
      customFields: {
        'MLAG Domain': 'mlag-core-peer (Active / Secondary)',
        'VXLAN VTEP': '10.255.0.12 (14 VNIs active)',
        'Rack Location': 'DC1-RowB-Rack02-U22',
      },
      configSnippet: `mlag configuration
 domain-id mlag-core-peer
 local-interface Vlan4094
 peer-address 10.255.255.1
 peer-link Port-Channel1000`,
    },
    {
      id: 'dist-sw-01',
      label: 'dist-sw-01',
      role: 'Campus Pod A Leaf',
      tier: 'distribution',
      zone: 'campus-access',
      ip: '10.10.0.21/24',
      model: 'Catalyst 9300-48UXM',
      os: 'IOS-XE 17.09.04a',
      serial: 'FCW2248G09L',
      status: 'up',
      x: 190,
      y: 540,
      interfaces: [
        { name: 'Po10', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'up', peerDevice: 'core-sw-01', peerPort: 'Po10' },
        { name: 'Gi1/0/1-48', vlan: '10 (Corp), 20 (Voice)', speed: '1G', mode: 'access', status: 'up' },
      ],
      customFields: {
        'PoE Budget': '1140W Total / 420W Allocated (37%)',
        'Connected Endpoints': '42 Workstations, 6 Wi-Fi 6E APs',
        'STP Root': 'Primary Root for VLAN 10, 20',
      },
      configSnippet: `interface TwentyFiveGigE1/1/1
 description Uplink to core-sw-01
 channel-group 10 mode active`,
    },
    {
      id: 'dist-sw-02',
      label: 'dist-sw-02',
      role: 'Campus Pod B Leaf',
      tier: 'distribution',
      zone: 'campus-access',
      ip: '10.10.0.22/24',
      model: 'Catalyst 9300-48UXM',
      os: 'IOS-XE 17.09.04a',
      serial: 'FCW2248G09M',
      status: 'degraded',
      x: 420,
      y: 540,
      interfaces: [
        { name: 'Po10', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'up', peerDevice: 'core-sw-01', peerPort: 'Po20' },
        { name: 'Po20', vlan: '10,20,40,100', speed: '40G', mode: 'trunk', status: 'degraded', peerDevice: 'core-sw-02', peerPort: 'Po20' },
      ],
      customFields: {
        'Alert': 'SFP+ Rx Power Low (-14.8 dBm) on Te1/1/2 (Po20 member)',
        'PoE Budget': '1140W Total / 610W Allocated (53%)',
        'Connected Endpoints': '38 Workstations, 4 IP Cameras',
      },
      configSnippet: `! Alert: High CRC error rate detected on Te1/1/2
interface TenGigabitEthernet1/1/2
 description Uplink to core-sw-02 (Check fiber patch)`,
    },
    {
      id: 'acc-ap-cluster',
      label: 'wifi-pod-east',
      role: '802.11ax AP Cluster',
      tier: 'access',
      zone: 'campus-access',
      ip: '10.10.40.10/24',
      model: 'Catalyst 9130AXI (x12)',
      os: 'Capwap 17.09',
      status: 'up',
      x: 630,
      y: 540,
      interfaces: [
        { name: 'Mgig0', vlan: '40,100', speed: '10G', mode: 'trunk', status: 'up', peerDevice: 'dist-sw-02', peerPort: 'Te1/0/48' },
      ],
      customFields: {
        'SSIDs': 'Marrow-Corp (WPA3-Ent), Marrow-Guest (OWE)',
        'Active Clients': '184 wireless clients associated',
      },
    },
    {
      id: 'fw-dmz-01',
      label: 'fw-dmz-01',
      role: 'Next-Gen Perimeter FW',
      tier: 'edge',
      zone: 'dmz-sec',
      ip: '10.0.20.2/30',
      model: 'Palo Alto PA-5220',
      os: 'PAN-OS 11.1.2-h3',
      serial: '013201009482',
      status: 'up',
      x: 920,
      y: 230,
      interfaces: [
        { name: 'ethernet1/1', ip: '10.0.12.2/30', speed: '10G', mode: 'routed', status: 'up', peerDevice: 'edge-rtr-01', peerPort: 'Te0/0/2' },
        { name: 'ethernet1/2', ip: '10.0.12.6/30', speed: '10G', mode: 'tunnel', status: 'degraded', peerDevice: 'edge-rtr-02', peerPort: 'Te0/0/2' },
        { name: 'ethernet1/3', ip: '10.0.20.2/30', speed: '25G', mode: 'routed', status: 'up', peerDevice: 'core-sw-02', peerPort: 'Et12/1' },
        { name: 'ethernet1/8', ip: '172.16.10.1/24', speed: '10G', mode: 'routed', status: 'up', peerDevice: 'dmz-ingress-gw', peerPort: 'eth0' },
      ],
      customFields: {
        'Active Sessions': '48,210 / 4,000,000 (1.2%)',
        'Threat Prevention': 'App-ID + WildFire + URL Filtering Enabled',
        'Throughput': '4.8 Gbps inspect / 1.1 Mpps',
      },
      configSnippet: `set network interface ethernet ethernet1/3 layer3 ip 10.0.20.2/30
set zone DMZ-INGRESS network layer3 ethernet1/8
set security rules ALLOW-HTTPS-INGRESS from UNTRUST to DMZ-INGRESS application ssl action allow`,
    },
    {
      id: 'dmz-ingress-gw',
      label: 'dmz-ingress-gw',
      role: 'Envoy Ingress Cluster',
      tier: 'endpoint',
      zone: 'dmz-sec',
      ip: '172.16.10.10/24',
      model: 'Baremetal Envoy Proxy',
      os: 'Talos Linux 1.8',
      status: 'planned',
      x: 920,
      y: 480,
      interfaces: [
        { name: 'eth0', ip: '172.16.10.10/24', speed: '10G', mode: 'routed', status: 'planned', peerDevice: 'fw-dmz-01', peerPort: 'ethernet1/8' },
      ],
      customFields: {
        'Deployment': 'Scheduled Change Window CHG-2049',
        'TLS Termination': 'mTLS + Let’s Encrypt ACME v2',
      },
    },
  ],
  links: [
    {
      id: 'lnk-edge1-core1',
      from: { device: 'edge-rtr-01', port: 'Hu0/1/0', ip: '10.0.1.1' },
      to: { device: 'core-sw-01', port: 'Et1/1', ip: '10.0.1.2' },
      speed: '100G',
      mode: 'routed',
      status: 'up',
      protocol: 'eBGP',
      flow: true,
    },
    {
      id: 'lnk-edge2-core2',
      from: { device: 'edge-rtr-02', port: 'Hu0/1/0', ip: '10.0.1.5' },
      to: { device: 'core-sw-02', port: 'Et1/1', ip: '10.0.1.6' },
      speed: '100G',
      mode: 'routed',
      status: 'up',
      protocol: 'eBGP',
      flow: true,
    },
    {
      id: 'lnk-edge1-edge2',
      from: { device: 'edge-rtr-01', port: 'Te0/0/1' },
      to: { device: 'edge-rtr-02', port: 'Te0/0/1' },
      speed: '10G',
      mode: 'peering',
      status: 'up',
      protocol: 'iBGP BFD',
    },
    {
      id: 'lnk-core1-core2',
      from: { device: 'core-sw-01', port: 'Et31/1' },
      to: { device: 'core-sw-02', port: 'Et31/1' },
      speed: '100G',
      mode: 'stack',
      status: 'up',
      protocol: 'MLAG Peer',
      flow: true,
    },
    {
      id: 'lnk-core1-dist1',
      from: { device: 'core-sw-01', port: 'Po10' },
      to: { device: 'dist-sw-01', port: 'Po10' },
      speed: '40G',
      mode: 'trunk',
      status: 'up',
      vlan: 'VLAN 10,20,40',
      flow: true,
    },
    {
      id: 'lnk-core1-dist2',
      from: { device: 'core-sw-01', port: 'Po20' },
      to: { device: 'dist-sw-02', port: 'Po10' },
      speed: '40G',
      mode: 'trunk',
      status: 'up',
      vlan: 'VLAN 10,20,40',
    },
    {
      id: 'lnk-core2-dist2',
      from: { device: 'core-sw-02', port: 'Po20' },
      to: { device: 'dist-sw-02', port: 'Po20' },
      speed: '40G',
      mode: 'trunk',
      status: 'degraded',
      vlan: 'Low Rx -14.8dBm',
    },
    {
      id: 'lnk-dist2-ap',
      from: { device: 'dist-sw-02', port: 'Te1/0/48' },
      to: { device: 'acc-ap-cluster', port: 'Mgig0' },
      speed: '10G',
      mode: 'trunk',
      status: 'up',
      vlan: 'CAPWAP',
    },
    {
      id: 'lnk-edge1-fw',
      from: { device: 'edge-rtr-01', port: 'Te0/0/2' },
      to: { device: 'fw-dmz-01', port: 'eth1/1' },
      speed: '10G',
      mode: 'routed',
      status: 'up',
      protocol: 'OSPF Area 0',
    },
    {
      id: 'lnk-edge2-fw',
      from: { device: 'edge-rtr-02', port: 'Te0/0/2' },
      to: { device: 'fw-dmz-01', port: 'eth1/2' },
      speed: '10G',
      mode: 'tunnel',
      status: 'degraded',
      protocol: 'IPSec IKEv2',
    },
    {
      id: 'lnk-core2-fw',
      from: { device: 'core-sw-02', port: 'Et12/1' },
      to: { device: 'fw-dmz-01', port: 'eth1/3' },
      speed: '25G',
      mode: 'routed',
      status: 'up',
      protocol: 'PIM / BGP',
      flow: true,
    },
    {
      id: 'lnk-fw-dmzgw',
      from: { device: 'fw-dmz-01', port: 'eth1/8' },
      to: { device: 'dmz-ingress-gw', port: 'eth0' },
      speed: '10G',
      mode: 'routed',
      status: 'planned',
      protocol: 'mTLS Ingress',
    },
  ],
};
