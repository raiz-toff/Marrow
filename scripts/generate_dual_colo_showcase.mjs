import fs from 'fs';
import YAML from 'yaml';

const topology = {
  marrow: 2,
  name: "Dual-Colocation Enterprise Showcase",
  description: "Curated active-active dual colocation network architecture spanning Ashburn DC-1 (US-East) and Santa Clara DC-2 (US-West) with 100G MACsec DCI, EVPN-VXLAN spine-leaf fabric, perimeter NGFW security, and replicated enterprise data tiers.",
  density: "standard",
  scale: 1.05,
  hero: "east-spine-01",
  author: "Enterprise Infrastructure & Cloud Architecture",
  revision: "v2.0",
  date: "2026-10-25",
  title_block: {
    title: "Dual-Colocation Enterprise Architecture",
    author: "Enterprise Architecture & NetOps",
    revision: "v2.0",
    date: "2026-10-25"
  },
  about: {
    Overview: "Executive showcase topology illustrating an enterprise active-active dual-colocation architecture across Equinix Ashburn (DC-1) and Equinix Santa Clara (DC-2).",
    "Fabric & Underlay": "- BGP unnumbered EVPN-VXLAN fabric with redundant spines and MLAG/vPC leaf pairs\n- 100Gbps non-blocking backplane with sub-microsecond latency\n- Anycast gateway routing across DC-1 and DC-2",
    "Security & Ingress": "- Perimeter Palo Alto PA-5450 HA clusters with active threat prevention\n- Unified F5 WAF & LTM ADC application delivery in dedicated DMZ\n- Strict Tier-0 jump bastions with hardware MFA",
    "Data Center Interconnect (DCI)": "- Dual diverse optical dark fiber paths with line-rate IEEE 802.1AE MACsec 256-bit encryption\n- Sub-35ms round-trip latency supporting synchronous storage mirroring and active database replication"
  },
  zones: [
    { id: "wan", name: "Global WAN & Carrier Edge", accent: "#64748b", note: "Tier-1 Carrier Transit & 100G Encrypted DCI Backbone" },
    { id: "wan-transit", name: "Carrier IP Transit", parent: "wan", accent: "#64748b", note: "Lumen & Telia Redundant BGP Peering" },
    { id: "wan-dci", name: "Inter-Colo 100G DCI Backbone", parent: "wan", accent: "#a855f7", note: "Diverse Dark Fiber Paths with Line-Rate MACsec" },

    // Ashburn DC-1
    { id: "dc-east", name: "Ashburn DC-1 (US-East)", accent: "#38bdf8", note: "Primary Production Hub (AS65100)" },
    { id: "east-edge", name: "Perimeter & WAN Edge", parent: "dc-east", accent: "#f43f5e", note: "Dual BGP Edge Routers & Active/Passive NGFW Cluster" },
    { id: "east-fabric", name: "EVPN-VXLAN Fabric", parent: "dc-east", accent: "#0284c7", note: "Nexus 9508 Spine Pair & 100G Leaf Pair" },
    { id: "east-services", name: "DMZ & Core Services", parent: "dc-east", accent: "#f59e0b", note: "F5 WAF/LB, Infoblox DNS/IPAM, Active Directory & Bastion" },
    { id: "east-workloads", name: "Compute & Data Tier", parent: "dc-east", accent: "#10b981", note: "ESXi Virtualization, Enterprise App Servers, PostgreSQL HA & Pure SAN" },

    // Santa Clara DC-2
    { id: "dc-west", name: "Santa Clara DC-2 (US-West)", accent: "#10b981", note: "Active Secondary & DR Hub (AS65200)" },
    { id: "west-edge", name: "Perimeter & WAN Edge", parent: "dc-west", accent: "#f43f5e", note: "Dual BGP Edge Routers & Active/Passive NGFW Cluster" },
    { id: "west-fabric", name: "EVPN-VXLAN Fabric", parent: "dc-west", accent: "#059669", note: "Nexus 9508 Spine Pair & 100G Leaf Pair" },
    { id: "west-services", name: "DMZ & Core Services", parent: "dc-west", accent: "#f59e0b", note: "F5 WAF/LB, Infoblox DNS/IPAM, Active Directory & Bastion" },
    { id: "west-workloads", name: "Compute & Data Tier", parent: "dc-west", accent: "#10b981", note: "ESXi Virtualization, Enterprise App Servers, PostgreSQL Replicas & Pure SAN" }
  ],
  devices: [],
  links: []
};

function addDev(d) {
  topology.devices.push(d);
}
function addLink(l) {
  topology.links.push(l);
}

// -------------------------------------------------------------
// WAN & DCI Backbone (4 devices)
// -------------------------------------------------------------
addDev({
  id: "wan-lumen-pe",
  name: "Lumen Tier-1 Transit (AS3356)",
  icon: "cisco/routers/router",
  tier: "edge",
  zone: "wan-transit",
  role: "router",
  status: "up",
  mgmt_ip: "198.51.100.1",
  custom_fields: { Provider: "Lumen Technologies", Speed: "100 Gbps DIA", Protocol: "eBGP AS3356" }
});
addDev({
  id: "wan-telia-pe",
  name: "Arelion/Telia Transit (AS1299)",
  icon: "cisco/routers/router",
  tier: "edge",
  zone: "wan-transit",
  role: "router",
  status: "up",
  mgmt_ip: "198.51.100.5",
  custom_fields: { Provider: "Arelion / Telia", Speed: "100 Gbps DIA", Protocol: "eBGP AS1299" }
});

addDev({
  id: "dci-mux-east",
  name: "Ashburn DWDM Terminal",
  icon: "cisco/switches/layer-3-switch",
  tier: "edge",
  zone: "wan-dci",
  role: "switch",
  status: "up",
  mgmt_ip: "10.100.254.1",
  ha_pair_with: "dci-mux-west",
  custom_fields: { Hardware: "Ciena Waveserver 5", Capacity: "100 Gbps ZR+", Encryption: "MACsec IEEE 802.1AE" }
});
addDev({
  id: "dci-mux-west",
  name: "Santa Clara DWDM Terminal",
  icon: "cisco/switches/layer-3-switch",
  tier: "edge",
  zone: "wan-dci",
  role: "switch",
  status: "up",
  mgmt_ip: "10.200.254.1",
  ha_pair_with: "dci-mux-east",
  custom_fields: { Hardware: "Ciena Waveserver 5", Capacity: "100 Gbps ZR+", Encryption: "MACsec IEEE 802.1AE" }
});

addLink({
  from: "dci-mux-east:Line-1",
  to: "dci-mux-west:Line-1",
  kind: "fiber",
  speed: "100G",
  mode: "routed",
  protocol: "static",
  custom_fields: { Latency: "34.2 ms", Span: "Primary North Optical Path" }
});
addLink({
  from: "dci-mux-east:Line-2",
  to: "dci-mux-west:Line-2",
  kind: "fiber",
  speed: "100G",
  mode: "routed",
  protocol: "static",
  custom_fields: { Latency: "36.8 ms", Span: "Geodiverse South Optical Path" }
});

// -------------------------------------------------------------
// Helper to build a Colocation (~19 devices)
// -------------------------------------------------------------
function buildShowcaseColo(cfg) {
  const { code, name, ipSub, asNum, dciMux, peerTransit } = cfg;

  // 1. Edge & Perimeter (4 devices)
  addDev({
    id: `${code}-edge-01`,
    name: `${name} Edge Router 01`,
    icon: "cisco/routers/router",
    tier: "edge",
    zone: `${code === 'east' ? 'east' : 'west'}-edge`,
    role: "router",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.1`,
    ha_pair_with: `${code}-edge-02`,
    custom_fields: { Model: "Cisco ASR 9904", BGP_AS: asNum, Throughput: "400 Gbps" }
  });
  addDev({
    id: `${code}-edge-02`,
    name: `${name} Edge Router 02`,
    icon: "cisco/routers/router",
    tier: "edge",
    zone: `${code === 'east' ? 'east' : 'west'}-edge`,
    role: "router",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.2`,
    ha_pair_with: `${code}-edge-01`,
    custom_fields: { Model: "Cisco ASR 9904", BGP_AS: asNum, Throughput: "400 Gbps" }
  });

  addDev({
    id: `${code}-ngfw-01`,
    name: `${name} Perimeter NGFW 01 (Active)`,
    icon: "cisco/security/firewall",
    tier: "edge",
    zone: `${code === 'east' ? 'east' : 'west'}-edge`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.11`,
    ha_pair_with: `${code}-ngfw-02`,
    custom_fields: { Model: "Palo Alto PA-5450", State: "Active", Inspection: "Full Layer-7 SSL Decrypt" }
  });
  addDev({
    id: `${code}-ngfw-02`,
    name: `${name} Perimeter NGFW 02 (Standby)`,
    icon: "cisco/security/firewall",
    tier: "edge",
    zone: `${code === 'east' ? 'east' : 'west'}-edge`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.12`,
    ha_pair_with: `${code}-ngfw-01`,
    custom_fields: { Model: "Palo Alto PA-5450", State: "Standby", Inspection: "HA State Synchronization" }
  });

  // Edge Links
  addLink({ from: `${code}-edge-01:Te0/0/0`, to: `${peerTransit}:Eth1/1`, kind: "fiber", speed: "100G", mode: "peering", protocol: "ebgp" });
  addLink({ from: `${code}-edge-02:Te0/0/0`, to: `${dciMux}:Client-1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });
  addLink({ from: `${code}-edge-01:Te0/1/0`, to: `${code}-edge-02:Te0/1/0`, lag: `po-edge-${code}`, lacp: "active", kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });

  addLink({ from: `${code}-ngfw-01:Eth1/1`, to: `${code}-edge-01:Te0/2/0`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-02:Eth1/1`, to: `${code}-edge-02:Te0/2/0`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-01:HA1`, to: `${code}-ngfw-02:HA1`, kind: "dac", speed: "10G", mode: "access" });

  // 2. Fabric Spines & Leafs (4 devices)
  addDev({
    id: `${code}-spine-01`,
    name: `${name} EVPN Spine 01`,
    icon: "cisco/design/aci-spine-switch",
    tier: "core",
    zone: `${code === 'east' ? 'east' : 'west'}-fabric`,
    role: "core",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.1`,
    ha_pair_with: `${code}-spine-02`,
    custom_fields: { Model: "Cisco Nexus 9508 Chassis", Fabric_AS: asNum, Backplane: "100G Non-blocking" }
  });
  addDev({
    id: `${code}-spine-02`,
    name: `${name} EVPN Spine 02`,
    icon: "cisco/design/aci-spine-switch",
    tier: "core",
    zone: `${code === 'east' ? 'east' : 'west'}-fabric`,
    role: "core",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.2`,
    ha_pair_with: `${code}-spine-01`,
    custom_fields: { Model: "Cisco Nexus 9508 Chassis", Fabric_AS: asNum, Backplane: "100G Non-blocking" }
  });

  addDev({
    id: `${code}-leaf-01`,
    name: `${name} Server Leaf 01`,
    icon: "cisco/switches/layer-3-switch",
    tier: "distribution",
    zone: `${code === 'east' ? 'east' : 'west'}-fabric`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.11`,
    ha_pair_with: `${code}-leaf-02`,
    custom_fields: { Model: "Cisco Nexus 93180YC-FX3", Role: "Top-of-Rack vPC Pair" }
  });
  addDev({
    id: `${code}-leaf-02`,
    name: `${name} Server Leaf 02`,
    icon: "cisco/switches/layer-3-switch",
    tier: "distribution",
    zone: `${code === 'east' ? 'east' : 'west'}-fabric`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.12`,
    ha_pair_with: `${code}-leaf-01`,
    custom_fields: { Model: "Cisco Nexus 93180YC-FX3", Role: "Top-of-Rack vPC Pair" }
  });

  // Spine-Leaf Cross Links
  addLink({ from: `${code}-leaf-01:Eth1/49`, to: `${code}-spine-01:Eth1/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-leaf-01:Eth1/50`, to: `${code}-spine-02:Eth1/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-leaf-02:Eth1/49`, to: `${code}-spine-01:Eth2/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-leaf-02:Eth1/50`, to: `${code}-spine-02:Eth2/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });

  // vPC Peer link between Leafs
  addLink({ from: `${code}-leaf-01:Eth1/47`, to: `${code}-leaf-02:Eth1/47`, lag: `vpc-${code}-peer`, lacp: "active", kind: "dac", speed: "100G", mode: "trunk", vlans: "all" });

  // Connect NGFWs to Spines
  addLink({ from: `${code}-ngfw-01:Eth1/2`, to: `${code}-spine-01:Eth1/24`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-02:Eth1/2`, to: `${code}-spine-02:Eth1/24`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });

  // 3. DMZ & Services (4 devices)
  addDev({
    id: `${code}-waf-lb`,
    name: `${name} F5 WAF & ADC`,
    icon: "cisco/datacenter/load-balancer",
    tier: "access",
    zone: `${code === 'east' ? 'east' : 'west'}-services`,
    role: "load-balancer",
    status: "up",
    mgmt_ip: `10.${ipSub}.3.10`,
    custom_fields: { Model: "F5 BIG-IP i5800", Services: "Advanced WAF + TLS 1.3 Offload + GSLB" }
  });
  addDev({
    id: `${code}-dns`,
    name: `${name} Infoblox DNS/IPAM`,
    icon: "cisco/datacenter/dns-server",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.10`,
    custom_fields: { Product: "Infoblox Grid Appliance", Services: "Enterprise DNS / DHCP / IPAM" }
  });
  addDev({
    id: `${code}-dc`,
    name: `${name} AD Domain Controller`,
    icon: "cisco/servers/directory-server",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.20`,
    custom_fields: { OS: "Windows Server 2022", Role: "Active Directory, Kerberos, LDAP" }
  });
  addDev({
    id: `${code}-jump`,
    name: `${name} Bastion Jump Host`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-services`,
    role: "security",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.30`,
    custom_fields: { Auth: "Hardware YubiKey MFA", Protocols: "Hardened SSH & Guacamole Web RDP" }
  });

  // Services links to Leaf pair
  addLink({ from: `${code}-waf-lb:eth0`, to: `${code}-leaf-01:Eth1/1`, lag: `po-waf-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "30,31" });
  addLink({ from: `${code}-waf-lb:eth1`, to: `${code}-leaf-02:Eth1/1`, lag: `po-waf-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "30,31" });

  addLink({ from: `${code}-dns:eth0`, to: `${code}-leaf-01:Eth1/2`, kind: "dac", speed: "10G", mode: "access", vlans: "40" });
  addLink({ from: `${code}-dc:eth0`, to: `${code}-leaf-01:Eth1/3`, kind: "dac", speed: "10G", mode: "access", vlans: "40" });
  addLink({ from: `${code}-jump:eth0`, to: `${code}-leaf-02:Eth1/3`, kind: "dac", speed: "10G", mode: "access", vlans: "40" });

  // 4. Compute & Data Tier (7 devices)
  addDev({
    id: `${code}-esxi-01`,
    name: `${name} ESXi Compute Host 01`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.5.11`,
    ha_pair_with: `${code}-esxi-02`,
    custom_fields: { Model: "Dell PowerEdge R750", CPU: "2x 64-Core Xeon Platinum", RAM: "1024 GB", Hypervisor: "VMware ESXi 8.0U3" }
  });
  addDev({
    id: `${code}-esxi-02`,
    name: `${name} ESXi Compute Host 02`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.5.12`,
    ha_pair_with: `${code}-esxi-01`,
    custom_fields: { Model: "Dell PowerEdge R750", CPU: "2x 64-Core Xeon Platinum", RAM: "1024 GB", Hypervisor: "VMware ESXi 8.0U3" }
  });

  addDev({
    id: `${code}-app-01`,
    name: `${name} Enterprise ERP Service`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.5.21`,
    custom_fields: { Workload: "Core ERP & Financial Processing", Host: `${code}-esxi-01` }
  });
  addDev({
    id: `${code}-app-02`,
    name: `${name} API Gateway Microservice`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.5.22`,
    custom_fields: { Workload: "REST/GraphQL Ingress Cluster", Host: `${code}-esxi-02` }
  });

  addDev({
    id: `${code}-pg-01`,
    name: `${name} PostgreSQL ${code === 'east' ? 'Primary' : 'Replica 01'}`,
    icon: "cisco/storage/relational-database",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "database",
    status: "up",
    mgmt_ip: `10.${ipSub}.7.11`,
    ha_pair_with: `${code}-pg-02`,
    custom_fields: { Engine: "PostgreSQL 16.3 Patroni HA", Role: code === 'east' ? "Read/Write Primary" : "Read-Only Replica" }
  });
  addDev({
    id: `${code}-pg-02`,
    name: `${name} PostgreSQL ${code === 'east' ? 'Standby' : 'Replica 02'}`,
    icon: "cisco/storage/relational-database",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "database",
    status: "up",
    mgmt_ip: `10.${ipSub}.7.12`,
    ha_pair_with: `${code}-pg-01`,
    custom_fields: { Engine: "PostgreSQL 16.3 Patroni HA", Role: code === 'east' ? "Synchronous Standby" : "Read-Only Replica" }
  });

  addDev({
    id: `${code}-san-01`,
    name: `${name} Pure FlashArray All-Flash SAN`,
    icon: "cisco/storage/fc-storage",
    tier: "endpoint",
    zone: `${code === 'east' ? 'east' : 'west'}-workloads`,
    role: "storage",
    status: "up",
    mgmt_ip: `10.${ipSub}.7.40`,
    custom_fields: { Model: "Pure Storage FlashArray//X90", Protocol: "NVMe-oF RoCEv2", Usable: "450 TB" }
  });

  // Hypervisor Dual-Homed Uplinks to Leafs
  addLink({ from: `${code}-esxi-01:vmnic0`, to: `${code}-leaf-01:Eth1/10`, lag: `po-esxi01-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "50,60,80" });
  addLink({ from: `${code}-esxi-01:vmnic1`, to: `${code}-leaf-02:Eth1/10`, lag: `po-esxi01-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "50,60,80" });
  addLink({ from: `${code}-esxi-02:vmnic0`, to: `${code}-leaf-01:Eth1/11`, lag: `po-esxi02-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "50,60,80" });
  addLink({ from: `${code}-esxi-02:vmnic1`, to: `${code}-leaf-02:Eth1/11`, lag: `po-esxi02-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "50,60,80" });

  // Virtual App connections to ESXi vSwitches
  addLink({ from: `${code}-app-01:eth0`, to: `${code}-esxi-01:vSwitch0`, kind: "virtual", speed: "10G", mode: "access", vlans: "50" });
  addLink({ from: `${code}-app-02:eth0`, to: `${code}-esxi-02:vSwitch0`, kind: "virtual", speed: "10G", mode: "access", vlans: "60" });

  // Database Bonded Connections to Leafs
  addLink({ from: `${code}-pg-01:bond0`, to: `${code}-leaf-01:Eth1/20`, lag: `po-pg01-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });
  addLink({ from: `${code}-pg-01:bond1`, to: `${code}-leaf-02:Eth1/20`, lag: `po-pg01-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });
  addLink({ from: `${code}-pg-02:bond0`, to: `${code}-leaf-01:Eth1/21`, lag: `po-pg02-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });
  addLink({ from: `${code}-pg-02:bond1`, to: `${code}-leaf-02:Eth1/21`, lag: `po-pg02-${code}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });

  // SAN NVMe-oF Dual Connections
  addLink({ from: `${code}-san-01:CT0.FC1`, to: `${code}-leaf-01:Eth1/25`, kind: "fiber", speed: "100G", mode: "routed", custom_fields: { Fabric: "A-Side RoCEv2" } });
  addLink({ from: `${code}-san-01:CT1.FC1`, to: `${code}-leaf-02:Eth1/25`, kind: "fiber", speed: "100G", mode: "routed", custom_fields: { Fabric: "B-Side RoCEv2" } });
}

// Build Ashburn DC-1 (19 devices)
buildShowcaseColo({
  code: "east",
  name: "Ashburn",
  ipSub: "100",
  asNum: "65100",
  dciMux: "dci-mux-east",
  peerTransit: "wan-lumen-pe"
});

// Build Santa Clara DC-2 (19 devices)
buildShowcaseColo({
  code: "west",
  name: "Santa Clara",
  ipSub: "200",
  asNum: "65200",
  dciMux: "dci-mux-west",
  peerTransit: "wan-telia-pe"
});

// Cross-Colo Database & Storage Replication Links
addLink({
  from: "east-pg-01:repl",
  to: "west-pg-01:repl",
  kind: "fiber",
  speed: "40G",
  mode: "tunnel",
  encap: "ipsec",
  custom_fields: { Service: "PostgreSQL WAL Streaming Replication", SLA: "RPO < 3s, RTO < 30s" }
});
addLink({
  from: "east-san-01:repl0",
  to: "west-san-01:repl0",
  kind: "fiber",
  speed: "100G",
  mode: "tunnel",
  encap: "vxlan",
  custom_fields: { Service: "Pure Storage ActiveCluster Replication", Sync: "Zero Data Loss Synchronous Replication" }
});

console.log("Total devices generated:", topology.devices.length);
console.log("Total links generated:", topology.links.length);

fs.writeFileSync("input/dual-colo-showcase.yaml", YAML.stringify(topology));
console.log("Wrote input/dual-colo-showcase.yaml successfully!");
