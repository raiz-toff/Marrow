import fs from 'fs';
import YAML from 'yaml';

const topology = {
  marrow: 2,
  name: "Dual-Colocation Multi-Zone Enterprise Fabric",
  description: "208 devices across Ashburn DC-1 (US-East) and Santa Clara DC-2 (US-West) with 400G DCI, EVPN-VXLAN spine-leaf fabric, DMZ, Core Services, vSphere compute pods, Kubernetes clusters, and replicated storage.",
  density: "compact",
  scale: 0.95,
  hero: "east-spine-01",
  author: "Enterprise Infrastructure & Cloud Architecture",
  revision: "v1.0",
  date: "2026-10-25",
  title_block: {
    title: "Dual-Colocation Enterprise Network",
    author: "Enterprise Architecture & NetOps",
    revision: "v1.0",
    date: "2026-10-25"
  },
  about: {
    Overview: "Enterprise-grade active-active dual colocation network architecture spanning Equinix DC-1 (Ashburn, VA) and Equinix DC-2 (Santa Clara, CA). Connected via redundant 400Gbps MACsec-encrypted dark fiber DCI and diverse Tier-1 carrier transit.",
    "Fabric Architecture": "- Underlay: BGP unnumbered EVPN-VXLAN spine-leaf fabric operating at 100G/400G\n- Dual spine switches per facility paired with redundant MLAG/vPC leaf pairs\n- Dedicated leaf pairs partitioned by security enclave: DMZ, Core Services, Compute, Kubernetes, and Data Storage\n- Anycast default gateways for seamless multi-tenant workload mobility",
    "Security & Ingress": "- Edge perimeter inspection via Palo Alto PA-5450 active/passive NGFW clusters\n- Web Application Firewalls (WAF) and F5 BIG-IP LTM/GTM load balancers in dedicated DMZ pods\n- Dual dedicated Bastion/Jump hosts with strict hardware-token MFA and air-gapped OOB management island",
    "Disaster Recovery & Data Replication": "- Active-active application workloads across East and West compute tiers\n- Synchronous SAN replication for tier-0 block storage and asynchronous streaming replication for PostgreSQL, Redis, and Kafka brokers\n- Geo-redundant external DNS failover via Anycast GTM"
  },
  zones: [
    { id: "wan", name: "Global WAN & Carrier Transit", accent: "#64748b", note: "Multi-homed Tier-1 IP Transit & Low-Latency DCI" },
    { id: "wan-transit", name: "Carrier IP Transit & IX", parent: "wan", accent: "#64748b", note: "Lumen, Zayo, Telia DIA + Equinix IX Fabric" },
    { id: "wan-dci", name: "Inter-Colo 400G DCI Backbone", parent: "wan", accent: "#a855f7", note: "Dual 400G DWDM Optical Links with MACsec wire encryption" },

    // Ashburn DC-1
    { id: "colo-east", name: "Ashburn DC-1 (US-East)", accent: "#38bdf8", note: "Equinix Ashburn Campus — Primary Production Hub (AS65100)" },
    { id: "east-perimeter", name: "Perimeter & WAN Edge", parent: "colo-east", accent: "#f43f5e", note: "Edge BGP Routers, Perimeter NGFWs, and VPN Gateways" },
    { id: "east-fabric", name: "EVPN-VXLAN Network Fabric", parent: "colo-east", accent: "#0284c7", note: "Nexus 9508 Spines and 100G Leaf Switch Pairs" },
    { id: "east-dmz", name: "DMZ & Ingress Delivery", parent: "colo-east", accent: "#f59e0b", note: "WAF, F5 Load Balancers, and Reverse Proxies" },
    { id: "east-services", name: "Core Infrastructure Services", parent: "colo-east", accent: "#8b5cf6", note: "Infoblox DNS/DHCP, Active Directory, Identity, and Jump Hosts" },
    { id: "east-compute", name: "vSphere Compute Cluster", parent: "colo-east", accent: "#06b6d4", note: "ESXi Virtualization Pods & Core App Services" },
    { id: "east-k8s", name: "Production Kubernetes Pod", parent: "colo-east", accent: "#3b82f6", note: "K8s Control Planes, Ingress, and Microservice Worker Nodes" },
    { id: "east-data", name: "Data Persistence & Storage", parent: "colo-east", accent: "#10b981", note: "PostgreSQL Primary, Redis, Kafka, FC-SAN, and Object Store" },
    { id: "east-oob", name: "Out-of-Band Management & BMS", parent: "colo-east", accent: "#78716c", note: "Air-gapped Console Servers, Management Switches & Environmental Monitoring" },

    // Santa Clara DC-2
    { id: "colo-west", name: "Santa Clara DC-2 (US-West)", accent: "#10b981", note: "Equinix Silicon Valley Campus — Active Secondary & DR Hub (AS65200)" },
    { id: "west-perimeter", name: "Perimeter & WAN Edge", parent: "colo-west", accent: "#f43f5e", note: "Edge BGP Routers, Perimeter NGFWs, and VPN Gateways" },
    { id: "west-fabric", name: "EVPN-VXLAN Network Fabric", parent: "colo-west", accent: "#059669", note: "Nexus 9508 Spines and 100G Leaf Switch Pairs" },
    { id: "west-dmz", name: "DMZ & Ingress Delivery", parent: "colo-west", accent: "#f59e0b", note: "WAF, F5 Load Balancers, and Reverse Proxies" },
    { id: "west-services", name: "Core Infrastructure Services", parent: "colo-west", accent: "#8b5cf6", note: "Secondary DNS/DHCP, Domain Controllers, Jump Hosts, and Observability" },
    { id: "west-compute", name: "vSphere Compute Cluster", parent: "colo-west", accent: "#06b6d4", note: "ESXi Virtualization Pods & Core App Services" },
    { id: "west-k8s", name: "DR / Secondary Kubernetes Pod", parent: "colo-west", accent: "#3b82f6", note: "K8s Control Planes, Ingress, and Microservice Worker Nodes" },
    { id: "west-data", name: "Data Persistence & Replicas", parent: "colo-west", accent: "#10b981", note: "PostgreSQL Replicas, Redis, Kafka, FC-SAN, and Replicated Object Store" },
    { id: "west-oob", name: "Out-of-Band Management & BMS", parent: "colo-west", accent: "#78716c", note: "Air-gapped Console Servers, Management Switches & Environmental Monitoring" }
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
// 1. WAN & Carrier Transit
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
  id: "wan-zayo-pe",
  name: "Zayo Tier-1 Transit (AS6461)",
  icon: "cisco/routers/router",
  tier: "edge",
  zone: "wan-transit",
  role: "router",
  status: "up",
  mgmt_ip: "198.51.100.5",
  custom_fields: { Provider: "Zayo Group", Speed: "100 Gbps DIA", Protocol: "eBGP AS6461" }
});
addDev({
  id: "wan-telia-pe",
  name: "Telia Arelion Transit (AS1299)",
  icon: "cisco/routers/router",
  tier: "edge",
  zone: "wan-transit",
  role: "router",
  status: "up",
  mgmt_ip: "198.51.100.9",
  custom_fields: { Provider: "Arelion / Telia", Speed: "100 Gbps DIA", Protocol: "eBGP AS1299" }
});
addDev({
  id: "wan-equinix-ix",
  name: "Equinix Internet Exchange Fabric",
  icon: "cisco/switches/layer-3-switch",
  tier: "edge",
  zone: "wan-transit",
  role: "switch",
  status: "up",
  mgmt_ip: "198.51.100.13",
  custom_fields: { Facility: "Equinix IX", Speed: "2x 100 Gbps", Port: "Multi-lateral Peering" }
});

// DCI Optical Terminals
addDev({
  id: "dci-mux-east",
  name: "Ashburn DWDM Terminal (DCI-E)",
  icon: "cisco/switches/layer-3-switch",
  tier: "edge",
  zone: "wan-dci",
  role: "switch",
  status: "up",
  mgmt_ip: "10.100.254.1",
  ha_pair_with: "dci-mux-west",
  custom_fields: { Hardware: "Ciena Waveserver 5", Capacity: "400 Gbps ZR+", Encryption: "MACsec IEEE 802.1AE" }
});
addDev({
  id: "dci-mux-west",
  name: "Santa Clara DWDM Terminal (DCI-W)",
  icon: "cisco/switches/layer-3-switch",
  tier: "edge",
  zone: "wan-dci",
  role: "switch",
  status: "up",
  mgmt_ip: "10.200.254.1",
  ha_pair_with: "dci-mux-east",
  custom_fields: { Hardware: "Ciena Waveserver 5", Capacity: "400 Gbps ZR+", Encryption: "MACsec IEEE 802.1AE" }
});

addLink({
  from: "dci-mux-east:Line-1",
  to: "dci-mux-west:Line-1",
  kind: "fiber",
  speed: "400G",
  mode: "routed",
  protocol: "static",
  custom_fields: { Latency: "34.2 ms", Span: "Direct Dark Fiber North Route" }
});
addLink({
  from: "dci-mux-east:Line-2",
  to: "dci-mux-west:Line-2",
  kind: "fiber",
  speed: "400G",
  mode: "routed",
  protocol: "static",
  custom_fields: { Latency: "36.8 ms", Span: "Diverse Dark Fiber South Route" }
});

// -------------------------------------------------------------
// Helper for Colocation Building
// -------------------------------------------------------------
function buildColo(cfg) {
  const { code, name, ipSub, asNum, dciMux, peerTransit, esxiCount, appCount, k8sWorkers, dbCount } = cfg;

  // 1. Edge Perimeter
  addDev({
    id: `${code}-edge-rt01`,
    name: `${name} Edge Router 01`,
    icon: "cisco/routers/router",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "router",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.1`,
    ha_pair_with: `${code}-edge-rt02`,
    custom_fields: { Model: "Cisco ASR 9904", BGP_AS: asNum, Throughput: "800 Gbps" }
  });
  addDev({
    id: `${code}-edge-rt02`,
    name: `${name} Edge Router 02`,
    icon: "cisco/routers/router",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "router",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.2`,
    ha_pair_with: `${code}-edge-rt01`,
    custom_fields: { Model: "Cisco ASR 9904", BGP_AS: asNum, Throughput: "800 Gbps" }
  });

  addDev({
    id: `${code}-ngfw-01`,
    name: `${name} Perimeter NGFW 01 (Active)`,
    icon: "cisco/security/firewall",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.11`,
    ha_pair_with: `${code}-ngfw-02`,
    custom_fields: { Model: "Palo Alto PA-5450", State: "Active", Inspection: "Threat & SSL Decrypt" }
  });
  addDev({
    id: `${code}-ngfw-02`,
    name: `${name} Perimeter NGFW 02 (Standby)`,
    icon: "cisco/security/firewall",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.12`,
    ha_pair_with: `${code}-ngfw-01`,
    custom_fields: { Model: "Palo Alto PA-5450", State: "Standby", Inspection: "State Sync HA" }
  });

  addDev({
    id: `${code}-vpn-01`,
    name: `${name} SSL-VPN Gateway 01`,
    icon: "cisco/capability/vpn-concentrator",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "security",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.21`,
    ha_pair_with: `${code}-vpn-02`,
    custom_fields: { Model: "Cisco Secure Client ASA 5585-X", Sessions: "5,000 Concurrent" }
  });
  addDev({
    id: `${code}-vpn-02`,
    name: `${name} SSL-VPN Gateway 02`,
    icon: "cisco/capability/vpn-concentrator",
    tier: "edge",
    zone: `${code}-perimeter`,
    role: "security",
    status: "up",
    mgmt_ip: `10.${ipSub}.1.22`,
    ha_pair_with: `${code}-vpn-01`,
    custom_fields: { Model: "Cisco Secure Client ASA 5585-X", Sessions: "5,000 Concurrent" }
  });

  // 2. Spines & Leafs
  addDev({
    id: `${code}-spine-01`,
    name: `${name} EVPN Spine 01`,
    icon: "cisco/design/aci-spine-switch",
    tier: "core",
    zone: `${code}-fabric`,
    role: "core",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.1`,
    ha_pair_with: `${code}-spine-02`,
    custom_fields: { Model: "Cisco Nexus 9508 Chassis", Fabric_AS: asNum, Backplane: "100/400G Non-blocking" }
  });
  addDev({
    id: `${code}-spine-02`,
    name: `${name} EVPN Spine 02`,
    icon: "cisco/design/aci-spine-switch",
    tier: "core",
    zone: `${code}-fabric`,
    role: "core",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.2`,
    ha_pair_with: `${code}-spine-01`,
    custom_fields: { Model: "Cisco Nexus 9508 Chassis", Fabric_AS: asNum, Backplane: "100/400G Non-blocking" }
  });

  addDev({
    id: `${code}-border-leaf01`,
    name: `${name} Border Leaf 01`,
    icon: "cisco/switches/layer-3-switch",
    tier: "distribution",
    zone: `${code}-fabric`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.11`,
    ha_pair_with: `${code}-border-leaf02`,
    custom_fields: { Model: "Cisco Nexus 9336C-FX2", Role: "DCI & WAN Hand-off" }
  });
  addDev({
    id: `${code}-border-leaf02`,
    name: `${name} Border Leaf 02`,
    icon: "cisco/switches/layer-3-switch",
    tier: "distribution",
    zone: `${code}-fabric`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.2.12`,
    ha_pair_with: `${code}-border-leaf01`,
    custom_fields: { Model: "Cisco Nexus 9336C-FX2", Role: "DCI & WAN Hand-off" }
  });

  const leafPairs = [
    { prefix: "dmz-leaf", name: "DMZ Leaf", ipStart: 21 },
    { prefix: "svc-leaf", name: "Core Svc Leaf", ipStart: 31 },
    { prefix: "comp-leaf", name: "Compute Leaf", ipStart: 41 },
    { prefix: "k8s-leaf", name: "K8s Leaf", ipStart: 51 },
    { prefix: "data-leaf", name: "Storage/DB Leaf", ipStart: 61 }
  ];

  for (const lp of leafPairs) {
    const sw1 = `${code}-${lp.prefix}01`;
    const sw2 = `${code}-${lp.prefix}02`;
    addDev({
      id: sw1,
      name: `${name} ${lp.name} 01`,
      icon: "cisco/switches/layer-3-switch",
      tier: "distribution",
      zone: `${code}-fabric`,
      role: "switch",
      status: "up",
      mgmt_ip: `10.${ipSub}.2.${lp.ipStart}`,
      ha_pair_with: sw2,
      custom_fields: { Model: "Cisco Nexus 93180YC-FX3", Uplinks: "100G EVPN-VXLAN", Downlinks: "10/25G MLAG" }
    });
    addDev({
      id: sw2,
      name: `${name} ${lp.name} 02`,
      icon: "cisco/switches/layer-3-switch",
      tier: "distribution",
      zone: `${code}-fabric`,
      role: "switch",
      status: "up",
      mgmt_ip: `10.${ipSub}.2.${lp.ipStart + 1}`,
      ha_pair_with: sw1,
      custom_fields: { Model: "Cisco Nexus 93180YC-FX3", Uplinks: "100G EVPN-VXLAN", Downlinks: "10/25G MLAG" }
    });

    addLink({ from: `${sw1}:Eth1/49`, to: `${code}-spine-01:Eth1/${lp.ipStart}`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
    addLink({ from: `${sw1}:Eth1/50`, to: `${code}-spine-02:Eth1/${lp.ipStart}`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
    addLink({ from: `${sw2}:Eth1/49`, to: `${code}-spine-01:Eth2/${lp.ipStart}`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
    addLink({ from: `${sw2}:Eth1/50`, to: `${code}-spine-02:Eth2/${lp.ipStart}`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });

    addLink({ from: `${sw1}:Eth1/47`, to: `${sw2}:Eth1/47`, lag: `vpc-${code}-${lp.prefix}`, lacp: "active", kind: "dac", speed: "100G", mode: "trunk", vlans: "all" });
    addLink({ from: `${sw1}:Eth1/48`, to: `${sw2}:Eth1/48`, lag: `vpc-${code}-${lp.prefix}`, lacp: "active", kind: "dac", speed: "100G", mode: "trunk", vlans: "all" });
  }

  addLink({ from: `${code}-border-leaf01:Eth1/49`, to: `${code}-spine-01:Eth1/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-border-leaf01:Eth1/50`, to: `${code}-spine-02:Eth1/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-border-leaf02:Eth1/49`, to: `${code}-spine-01:Eth2/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });
  addLink({ from: `${code}-border-leaf02:Eth1/50`, to: `${code}-spine-02:Eth2/1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });

  addLink({ from: `${code}-border-leaf01:Eth1/1`, to: `${dciMux}:Client-1`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });
  addLink({ from: `${code}-border-leaf02:Eth1/1`, to: `${dciMux}:Client-2`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });

  addLink({ from: `${code}-edge-rt01:Te0/0/0`, to: `${code}-border-leaf01:Eth1/2`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });
  addLink({ from: `${code}-edge-rt01:Te0/0/1`, to: `${code}-border-leaf02:Eth1/2`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });
  addLink({ from: `${code}-edge-rt02:Te0/0/0`, to: `${code}-border-leaf01:Eth1/3`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });
  addLink({ from: `${code}-edge-rt02:Te0/0/1`, to: `${code}-border-leaf02:Eth1/3`, kind: "fiber", speed: "100G", mode: "routed", protocol: "ebgp" });

  addLink({ from: `${code}-edge-rt01:Te0/1/0`, to: `${code}-edge-rt02:Te0/1/0`, lag: `po-edge-ibgp-${code}`, lacp: "active", kind: "fiber", speed: "100G", mode: "routed", protocol: "ibgp" });

  addLink({ from: `${code}-edge-rt01:Te0/2/0`, to: `${peerTransit[0]}:Eth1/1`, kind: "fiber", speed: "100G", mode: "peering", protocol: "ebgp" });
  addLink({ from: `${code}-edge-rt02:Te0/2/0`, to: `${peerTransit[1]}:Eth1/1`, kind: "fiber", speed: "100G", mode: "peering", protocol: "ebgp" });

  addLink({ from: `${code}-ngfw-01:Eth1/1`, to: `${code}-edge-rt01:Te0/3/0`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-02:Eth1/1`, to: `${code}-edge-rt02:Te0/3/0`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-01:Eth1/2`, to: `${code}-border-leaf01:Eth1/4`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-02:Eth1/2`, to: `${code}-border-leaf02:Eth1/4`, kind: "fiber", speed: "40G", mode: "routed", protocol: "ospf" });
  addLink({ from: `${code}-ngfw-01:HA1`, to: `${code}-ngfw-02:HA1`, kind: "dac", speed: "10G", mode: "access" });

  addLink({ from: `${code}-vpn-01:Eth1`, to: `${code}-border-leaf01:Eth1/5`, kind: "fiber", speed: "10G", mode: "trunk", vlans: "100,101" });
  addLink({ from: `${code}-vpn-02:Eth1`, to: `${code}-border-leaf02:Eth1/5`, kind: "fiber", speed: "10G", mode: "trunk", vlans: "100,101" });

  // 3. DMZ Services
  addDev({
    id: `${code}-waf-01`,
    name: `${name} WAF Cluster 01`,
    icon: "cisco/capability/web-application-firewall",
    tier: "access",
    zone: `${code}-dmz`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.3.11`,
    ha_pair_with: `${code}-waf-02`,
    custom_fields: { Product: "F5 Advanced WAF", Mode: "Active-Active Layer 7 Inspection" }
  });
  addDev({
    id: `${code}-waf-02`,
    name: `${name} WAF Cluster 02`,
    icon: "cisco/capability/web-application-firewall",
    tier: "access",
    zone: `${code}-dmz`,
    role: "firewall",
    status: "up",
    mgmt_ip: `10.${ipSub}.3.12`,
    ha_pair_with: `${code}-waf-01`,
    custom_fields: { Product: "F5 Advanced WAF", Mode: "Active-Active Layer 7 Inspection" }
  });

  addDev({
    id: `${code}-ext-lb01`,
    name: `${name} External ADC / LB 01`,
    icon: "cisco/datacenter/load-balancer",
    tier: "access",
    zone: `${code}-dmz`,
    role: "load-balancer",
    status: "up",
    mgmt_ip: `10.${ipSub}.3.21`,
    ha_pair_with: `${code}-ext-lb02`,
    custom_fields: { Model: "F5 BIG-IP i5800", Profile: "TLS 1.3 Offload & GSLB" }
  });
  addDev({
    id: `${code}-ext-lb02`,
    name: `${name} External ADC / LB 02`,
    icon: "cisco/datacenter/load-balancer",
    tier: "access",
    zone: `${code}-dmz`,
    role: "load-balancer",
    status: "up",
    mgmt_ip: `10.${ipSub}.3.22`,
    ha_pair_with: `${code}-ext-lb01`,
    custom_fields: { Model: "F5 BIG-IP i5800", Profile: "TLS 1.3 Offload & GSLB" }
  });

  for (let i = 1; i <= 4; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-rproxy-${pad}`,
      name: `${name} Edge Proxy ${pad}`,
      icon: "cisco/servers/host",
      tier: "endpoint",
      zone: `${code}-dmz`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.3.3${i}`,
      custom_fields: { Engine: "Envoy Proxy / NGINX Plus", Role: "Public Ingress Gateway" }
    });
    addLink({ from: `${code}-rproxy-${pad}:eth0`, to: `${code}-dmz-leaf01:Eth1/${i}`, lag: `po-rp-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "30" });
    addLink({ from: `${code}-rproxy-${pad}:eth1`, to: `${code}-dmz-leaf02:Eth1/${i}`, lag: `po-rp-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "30" });
  }

  addLink({ from: `${code}-waf-01:mgmt`, to: `${code}-dmz-leaf01:Eth1/10`, kind: "dac", speed: "25G", mode: "trunk", vlans: "30,31" });
  addLink({ from: `${code}-waf-02:mgmt`, to: `${code}-dmz-leaf02:Eth1/10`, kind: "dac", speed: "25G", mode: "trunk", vlans: "30,31" });
  addLink({ from: `${code}-ext-lb01:mgmt`, to: `${code}-dmz-leaf01:Eth1/11`, kind: "dac", speed: "25G", mode: "trunk", vlans: "30,32" });
  addLink({ from: `${code}-ext-lb02:mgmt`, to: `${code}-dmz-leaf02:Eth1/11`, kind: "dac", speed: "25G", mode: "trunk", vlans: "30,32" });

  // 4. Shared Services
  addDev({
    id: `${code}-dns-01`,
    name: `${name} Infoblox DNS/IPAM 01`,
    icon: "cisco/datacenter/dns-server",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.11`,
    ha_pair_with: `${code}-dns-02`,
    custom_fields: { Service: "Infoblox Grid Member", Role: "Authoritative Internal DNS & DHCP" }
  });
  addDev({
    id: `${code}-dns-02`,
    name: `${name} Infoblox DNS/IPAM 02`,
    icon: "cisco/datacenter/dns-server",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.12`,
    ha_pair_with: `${code}-dns-01`,
    custom_fields: { Service: "Infoblox Grid Member", Role: "Authoritative Internal DNS & DHCP" }
  });

  addDev({
    id: `${code}-ad-dc01`,
    name: `${name} AD Domain Controller 01`,
    icon: "cisco/servers/directory-server",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.21`,
    ha_pair_with: `${code}-ad-dc02`,
    custom_fields: { OS: "Windows Server 2022", Role: "Kerberos / LDAP / Active Directory" }
  });
  addDev({
    id: `${code}-ad-dc02`,
    name: `${name} AD Domain Controller 02`,
    icon: "cisco/servers/directory-server",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.22`,
    ha_pair_with: `${code}-ad-dc01`,
    custom_fields: { OS: "Windows Server 2022", Role: "Kerberos / LDAP / Active Directory" }
  });

  addDev({
    id: `${code}-jump-01`,
    name: `${name} Secure Bastion Jump 01`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "security",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.31`,
    ha_pair_with: `${code}-jump-02`,
    custom_fields: { Access: "Hardware MFA SSH & Guacamole Web RDP", Isolation: "Strict Tier-0 Gateway" }
  });
  addDev({
    id: `${code}-jump-02`,
    name: `${name} Secure Bastion Jump 02`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "security",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.32`,
    ha_pair_with: `${code}-jump-01`,
    custom_fields: { Access: "Hardware MFA SSH & Guacamole Web RDP", Isolation: "Strict Tier-0 Gateway" }
  });

  addDev({
    id: `${code}-ntp-01`,
    name: `${name} Microchip NTP/PTP Time Clock`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.41`,
    custom_fields: { Stratum: "Stratum 1 GPS Locked", Precision: "< 100 ns" }
  });
  addDev({
    id: `${code}-siem-01`,
    name: `${name} Splunk Heavy Forwarder & SIEM`,
    icon: "cisco/servers/host",
    tier: "endpoint",
    zone: `${code}-services`,
    role: "server",
    status: "up",
    mgmt_ip: `10.${ipSub}.4.51`,
    custom_fields: { Pipeline: "Syslog-NG + Kafka Stream to Core SOC", Retention: "30 Days Local" }
  });

  const svcDevs = [
    `${code}-dns-01`, `${code}-dns-02`,
    `${code}-ad-dc01`, `${code}-ad-dc02`,
    `${code}-jump-01`, `${code}-jump-02`,
    `${code}-ntp-01`, `${code}-siem-01`
  ];
  svcDevs.forEach((devId, idx) => {
    addLink({ from: `${devId}:eth0`, to: `${code}-svc-leaf01:Eth1/${idx + 1}`, kind: "dac", speed: "10G", mode: "access", vlans: "40" });
    addLink({ from: `${devId}:eth1`, to: `${code}-svc-leaf02:Eth1/${idx + 1}`, kind: "dac", speed: "10G", mode: "access", vlans: "40" });
  });

  // 5. Compute Pod
  for (let i = 1; i <= esxiCount; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-esxi-${pad}`,
      name: `${name} vSphere ESXi Node ${pad}`,
      icon: "cisco/servers/host",
      tier: "endpoint",
      zone: `${code}-compute`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.5.${10 + i}`,
      custom_fields: { Hardware: "Dell PowerEdge R750", CPU: "2x 64-Core Xeon Platinum", RAM: "1024 GB", Hypervisor: "VMware ESXi 8.0U3" }
    });
    addLink({ from: `${code}-esxi-${pad}:vmnic0`, to: `${code}-comp-leaf01:Eth1/${i}`, lag: `esxi-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "10,20,50,60" });
    addLink({ from: `${code}-esxi-${pad}:vmnic1`, to: `${code}-comp-leaf02:Eth1/${i}`, lag: `esxi-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "trunk", vlans: "10,20,50,60" });
  }

  for (let i = 1; i <= appCount; i++) {
    const pad = String(i).padStart(2, '0');
    const esxiHost = `${code}-esxi-${String(((i - 1) % esxiCount) + 1).padStart(2, '0')}`;
    addDev({
      id: `${code}-app-${pad}`,
      name: `${name} Core App Svc ${pad}`,
      icon: "cisco/servers/host",
      tier: "endpoint",
      zone: `${code}-compute`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.5.${50 + i}`,
      custom_fields: { Workload: i % 2 === 0 ? "Enterprise ERP & Billing" : "API Microservice Backend", Host_ESXi: esxiHost }
    });
    // Link VM guest vNIC to ESXi vSwitch port-group
    addLink({
      from: `${code}-app-${pad}:eth0`,
      to: `${esxiHost}:vSwitch0`,
      kind: "virtual",
      speed: "10G",
      mode: "access",
      vlans: i % 2 === 0 ? "50" : "60",
      custom_fields: { PortGroup: i % 2 === 0 ? "VLAN-50-ERP" : "VLAN-60-API" }
    });
  }

  // 6. Kubernetes Cluster
  for (let i = 1; i <= 3; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-k8s-cp${pad}`,
      name: `${name} K8s Control Plane ${pad}`,
      icon: "k8s/infrastructure-components/control-plane",
      tier: "endpoint",
      zone: `${code}-k8s`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.6.${10 + i}`,
      custom_fields: { Cluster: `${name} Production K8s`, Component: "etcd + kube-apiserver", Version: "v1.30.2" }
    });
    addLink({ from: `${code}-k8s-cp${pad}:eth0`, to: `${code}-k8s-leaf01:Eth1/${i}`, kind: "dac", speed: "25G", mode: "access", vlans: "70" });
    addLink({ from: `${code}-k8s-cp${pad}:eth1`, to: `${code}-k8s-leaf02:Eth1/${i}`, kind: "dac", speed: "25G", mode: "access", vlans: "70" });
  }

  for (let i = 1; i <= 2; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-k8s-ing${pad}`,
      name: `${name} K8s Ingress Controller ${pad}`,
      icon: "k8s/resources/ing",
      tier: "endpoint",
      zone: `${code}-k8s`,
      role: "load-balancer",
      status: "up",
      mgmt_ip: `10.${ipSub}.6.${20 + i}`,
      ha_pair_with: `${code}-k8s-ing${i === 1 ? '02' : '01'}`,
      custom_fields: { CNI: "Cilium eBPF BGP Anycast", Type: "Envoy Gateway Controller" }
    });
    addLink({ from: `${code}-k8s-ing${pad}:eth0`, to: `${code}-k8s-leaf01:Eth1/${3 + i}`, kind: "fiber", speed: "25G", mode: "routed", protocol: "ebgp" });
    addLink({ from: `${code}-k8s-ing${pad}:eth1`, to: `${code}-k8s-leaf02:Eth1/${3 + i}`, kind: "fiber", speed: "25G", mode: "routed", protocol: "ebgp" });
  }

  for (let i = 1; i <= k8sWorkers; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-k8s-w${pad}`,
      name: `${name} K8s Worker Node ${pad}`,
      icon: "k8s/infrastructure-components/node",
      tier: "endpoint",
      zone: `${code}-k8s`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.6.${30 + i}`,
      custom_fields: { Pod_CIDR: `10.244.${ipSub}.${i * 8}/29`, Workload_Type: i <= 4 ? "High-Compute Core Services" : "Stateless Microservices" }
    });
    addLink({ from: `${code}-k8s-w${pad}:eth0`, to: `${code}-k8s-leaf01:Eth1/${5 + i}`, lag: `k8s-w-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "70" });
    addLink({ from: `${code}-k8s-w${pad}:eth1`, to: `${code}-k8s-leaf02:Eth1/${5 + i}`, lag: `k8s-w-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "70" });
  }

  // 7. Databases & Storage
  for (let i = 1; i <= dbCount; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-pg-db${pad}`,
      name: `${name} PostgreSQL ${code === 'east' && i <= 2 ? 'Primary HA' : 'Streaming Node'} ${pad}`,
      icon: "cisco/storage/relational-database",
      tier: "endpoint",
      zone: `${code}-data`,
      role: "database",
      status: "up",
      mgmt_ip: `10.${ipSub}.7.${10 + i}`,
      custom_fields: { Engine: "PostgreSQL 16.3 Patroni HA", Storage: "NVMe Direct Attached", Shard: `Shard-${((i-1)%2)+1}` }
    });
    addLink({ from: `${code}-pg-db${pad}:bond0`, to: `${code}-data-leaf01:Eth1/${i}`, lag: `pg-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });
    addLink({ from: `${code}-pg-db${pad}:bond1`, to: `${code}-data-leaf02:Eth1/${i}`, lag: `pg-${code}-${pad}`, lacp: "active", kind: "fiber", speed: "25G", mode: "access", vlans: "80" });
  }

  for (let i = 1; i <= 3; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-redis-${pad}`,
      name: `${name} Redis Cluster Node ${pad}`,
      icon: "cisco/servers/host",
      tier: "endpoint",
      zone: `${code}-data`,
      role: "database",
      status: "up",
      mgmt_ip: `10.${ipSub}.7.${20 + i}`,
      custom_fields: { Cache: "Redis 7.2 Enterprise Cluster", Shards: "3 Master / 3 Replica" }
    });
    addLink({ from: `${code}-redis-${pad}:eth0`, to: `${code}-data-leaf01:Eth1/${4 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "80" });
    addLink({ from: `${code}-redis-${pad}:eth1`, to: `${code}-data-leaf02:Eth1/${4 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "80" });
  }

  for (let i = 1; i <= 3; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-kafka-${pad}`,
      name: `${name} Kafka Event Broker ${pad}`,
      icon: "cisco/servers/host",
      tier: "endpoint",
      zone: `${code}-data`,
      role: "server",
      status: "up",
      mgmt_ip: `10.${ipSub}.7.${30 + i}`,
      custom_fields: { Platform: "Apache Kafka KRaft", Partitions: "256", Replication_Factor: 3 }
    });
    addLink({ from: `${code}-kafka-${pad}:eth0`, to: `${code}-data-leaf01:Eth1/${7 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "80" });
    addLink({ from: `${code}-kafka-${pad}:eth1`, to: `${code}-data-leaf02:Eth1/${7 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "80" });
  }

  addDev({
    id: `${code}-san-array01`,
    name: `${name} All-Flash NVMe Array 01`,
    icon: "cisco/storage/fc-storage",
    tier: "endpoint",
    zone: `${code}-data`,
    role: "storage",
    status: "up",
    mgmt_ip: `10.${ipSub}.7.41`,
    ha_pair_with: `${code}-san-array02`,
    custom_fields: { Model: "Pure Storage FlashArray//X90", IOPS: "500,000 NVMe-oF", Usable: "550 TB" }
  });
  addDev({
    id: `${code}-san-array02`,
    name: `${name} All-Flash NVMe Array 02`,
    icon: "cisco/storage/fc-storage",
    tier: "endpoint",
    zone: `${code}-data`,
    role: "storage",
    status: "up",
    mgmt_ip: `10.${ipSub}.7.42`,
    ha_pair_with: `${code}-san-array01`,
    custom_fields: { Model: "Pure Storage FlashArray//X90", IOPS: "500,000 NVMe-oF", Usable: "550 TB" }
  });
  addLink({ from: `${code}-san-array01:CT0.FC1`, to: `${code}-data-leaf01:Eth1/11`, kind: "fiber", speed: "100G", mode: "routed" });
  addLink({ from: `${code}-san-array01:CT1.FC1`, to: `${code}-data-leaf02:Eth1/11`, kind: "fiber", speed: "100G", mode: "routed" });
  addLink({ from: `${code}-san-array02:CT0.FC1`, to: `${code}-data-leaf01:Eth1/12`, kind: "fiber", speed: "100G", mode: "routed" });
  addLink({ from: `${code}-san-array02:CT1.FC1`, to: `${code}-data-leaf02:Eth1/12`, kind: "fiber", speed: "100G", mode: "routed" });

  for (let i = 1; i <= 3; i++) {
    const pad = String(i).padStart(2, '0');
    addDev({
      id: `${code}-s3-obj${pad}`,
      name: `${name} Object Storage Node ${pad}`,
      icon: "cisco/servers/storage-server",
      tier: "endpoint",
      zone: `${code}-data`,
      role: "storage",
      status: "up",
      mgmt_ip: `10.${ipSub}.7.${50 + i}`,
      custom_fields: { Software: "MinIO Enterprise Object Store", Erasure_Code: "EC:4", Disk: "24x 18TB SAS HDD" }
    });
    addLink({ from: `${code}-s3-obj${pad}:eth0`, to: `${code}-data-leaf01:Eth1/${12 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "85" });
    addLink({ from: `${code}-s3-obj${pad}:eth1`, to: `${code}-data-leaf02:Eth1/${12 + i}`, kind: "dac", speed: "25G", mode: "access", vlans: "85" });
  }

  // 8. OOB & BMS
  addDev({
    id: `${code}-oob-term01`,
    name: `${name} Out-of-Band Console Terminal`,
    icon: "cisco/switches/workgroup-switch",
    tier: "access",
    zone: `${code}-oob`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.0.1`,
    custom_fields: { Hardware: "Opengear OM2248 Console Gateway", Ports: "48 Serial RS-232 + 4G LTE Backup" }
  });
  addLink({ from: `${code}-oob-term01:Eth0`, to: `${code}-oob-sw01:Gi1/0/48`, kind: "copper", speed: "1G", mode: "access", vlans: "99" });
  addDev({
    id: `${code}-oob-sw01`,
    name: `${name} Dedicated Mgmt Switch 01`,
    icon: "cisco/switches/workgroup-switch",
    tier: "access",
    zone: `${code}-oob`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.0.11`,
    ha_pair_with: `${code}-oob-sw02`,
    custom_fields: { Model: "Cisco Catalyst 9300L-48T", Dedicated: "Isolated Out-of-Band Management VLAN 99" }
  });
  addDev({
    id: `${code}-oob-sw02`,
    name: `${name} Dedicated Mgmt Switch 02`,
    icon: "cisco/switches/workgroup-switch",
    tier: "access",
    zone: `${code}-oob`,
    role: "switch",
    status: "up",
    mgmt_ip: `10.${ipSub}.0.12`,
    ha_pair_with: `${code}-oob-sw01`,
    custom_fields: { Model: "Cisco Catalyst 9300L-48T", Dedicated: "Isolated Out-of-Band Management VLAN 99" }
  });
  addLink({ from: `${code}-oob-sw01:Gi1/0/49`, to: `${code}-oob-sw02:Gi1/0/49`, lag: `po-oob-${code}`, lacp: "active", kind: "dac", speed: "10G", mode: "trunk", vlans: "99" });
}

// Build East: Ashburn DC-1 (103 devices)
buildColo({
  code: "east",
  name: "Ashburn",
  ipSub: "100",
  asNum: "65100",
  dciMux: "dci-mux-east",
  peerTransit: ["wan-lumen-pe", "wan-equinix-ix"],
  esxiCount: 14,
  appCount: 14,
  k8sWorkers: 12,
  dbCount: 4
});

// Build West: Santa Clara DC-2 (99 devices)
buildColo({
  code: "west",
  name: "Santa Clara",
  ipSub: "200",
  asNum: "65200",
  dciMux: "dci-mux-west",
  peerTransit: ["wan-zayo-pe", "wan-telia-pe"],
  esxiCount: 12,
  appCount: 12,
  k8sWorkers: 12,
  dbCount: 4
});

// Cross-Colo Database Replication Link
addLink({
  from: "east-pg-db01:repl",
  to: "west-pg-db01:repl",
  kind: "fiber",
  speed: "40G",
  mode: "tunnel",
  encap: "ipsec",
  custom_fields: { Stream: "WAL Streaming Replication", SLA: "RPO < 5s, RTO < 60s" }
});
addLink({
  from: "east-san-array01:rep0",
  to: "west-san-array01:rep0",
  kind: "fiber",
  speed: "100G",
  mode: "tunnel",
  encap: "vxlan",
  custom_fields: { Mode: "ActiveCluster Async SAN Mirroring" }
});

console.log("Total devices generated:", topology.devices.length);
console.log("Total links generated:", topology.links.length);

fs.writeFileSync("input/dual-colo-enterprise.yaml", YAML.stringify(topology));
console.log("Wrote input/dual-colo-enterprise.yaml successfully!");
