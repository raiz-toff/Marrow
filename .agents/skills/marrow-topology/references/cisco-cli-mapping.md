# Cisco IOS & Packet Tracer CLI → Marrow Topology Reference

Use this cheat sheet to translate Cisco IOS configuration commands (`show running-config`), discovery outputs (`show cdp neighbors detail`, `show lldp neighbors detail`), and packet capture evidence into Marrow topology YAML declarations.

---

## 1. Interface & Link Mode Mapping

| Cisco IOS CLI Command | Marrow YAML Link Attributes | Description |
|---|---|---|
| `switchport mode access`<br>`switchport access vlan 10` | `mode: access`<br>`vlans: "10"` | Standard single-VLAN access port |
| `switchport mode trunk`<br>`switchport trunk allowed vlan 10,20,30` | `mode: trunk`<br>`vlans: "10,20,30"` | 802.1Q VLAN trunk (double-rail stroke) |
| `switchport trunk native vlan 99` | `native_vlan: 99` | Native VLAN on trunk |
| `channel-group 1 mode active` (LACP)<br>`channel-group 1 mode on` (Static) | `lag: po1`<br>`lacp: active` (or `static`) | Bundled Port-Channel link |
| `no switchport`<br>`ip address 10.0.12.1 255.255.255.252` (/30 or /31) | `mode: routed` | Point-to-point routed inter-switch link |
| `router ospf 1`<br>`network 10.0.12.0 0.0.0.3 area 0` | `protocol: ospf` | Routed link carrying OSPF adjacency |
| `router bgp 65000`<br>`neighbor 10.0.12.2 remote-as 65001` | `mode: peering`<br>`protocol: ebgp`<br>`kind: wan` | External BGP peering link |
| `interface Tunnel0`<br>`tunnel mode ipsec ipv4` | `mode: tunnel`<br>`encap: ipsec` | Encapsulated VPN / tunnel link |
| `interface Tunnel1`<br>`tunnel mode gre multipoint` | `mode: tunnel`<br>`encap: gre` | GRE / DMVPN multipoint link |

---

## 2. Discovery Output Mapping (`show cdp / lldp`)

When parsing `show cdp neighbors detail` or `show lldp neighbors detail`:

```text
Device ID: core-sw-02.example.com
Entry address(es): 
  IP address: 10.0.0.2
Platform: cisco WS-C3850-24T,  Capabilities: Switch IGMP
Interface: GigabitEthernet1/0/24,  Port ID (outgoing port): GigabitEthernet1/0/24
```

Translates to:
```yaml
devices:
  - id: core-sw-02
    name: "Core Switch 2"
    role: switch
    icon: cisco/switches/layer-3-switch
    mgmt_ip: 10.0.0.2

links:
  - from: core-sw-01:Gi1/0/24
    to: core-sw-02:Gi1/0/24
    kind: fiber
    speed: 1G
```

---

## 3. Inferring Device Tiers from Config Evidence

| Evidence in Running Config | Inferred `tier:` | Standard Icon |
|---|---|---|
| BGP peerings, default route origin, high-density routed `/30` links, core chassis | `tier: core` | `cisco/switches/layer-3-switch`<br>`cisco/routers/router` |
| SVI VLAN interfaces (`interface Vlan10`), HSRP/VRRP (`standby 1 ip ...`), aggregation trunks | `tier: distribution` | `cisco/switches/workgroup-switch`<br>`cisco/switches/layer-3-switch` |
| 100% `switchport mode access` edge ports, Spanning Tree PortFast/BPDUGuard | `tier: access` | `cisco/switches/workgroup-switch` |
| ASA / Firepower configuration, `zone-member security`, `ip nat inside/outside` | Place inline or distribution | `cisco/security/firewall` |

---

## 4. Packet Capture Protocol Clues (Wireshark / PCAP)

| Observed Protocol / Frame | Extracted Topology Evidence |
|---|---|
| **CDP / LLDP** | Direct link between local MAC and remote Chassis ID / Port ID |
| **802.1Q EtherType (0x8100)** | Link is a `mode: trunk` carrying observed VLAN IDs |
| **STP BPDU Root Bridge** | Primary root switch indicates hierarchy center (`tier: core`) |
| **OSPF Hello (Proto 89)** | Subnet endpoints are adjacent routers (`mode: routed, protocol: ospf`) |
| **HSRP / VRRP (224.0.0.2 / 224.0.0.18)** | Device pair configured with `ha_pair_with: <peer-id>` |

---

## 5. Worked Translation Example

### Given Cisco IOS Snippet:
```text
hostname Dist-SW-01
!
interface Port-channel1
 description UPLINK-TO-CORE
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30
!
interface GigabitEthernet1/0/1
 channel-group 1 mode active
!
interface GigabitEthernet1/0/2
 channel-group 1 mode active
!
interface GigabitEthernet1/0/24
 description LINK-TO-ACC-01
 switchport mode trunk
 switchport trunk allowed vlan 10,20
```

### Emitted Marrow YAML:
```yaml
devices:
  - id: dist-sw-01
    name: "Dist Switch 01"
    role: switch
    tier: distribution
    icon: cisco/switches/layer-3-switch

links:
  - from: dist-sw-01:Gi1/0/1
    to: core-sw-01:Gi1/0/1
    lag: po1
    lacp: active
    mode: trunk
    vlans: "10,20,30"
  - from: dist-sw-01:Gi1/0/2
    to: core-sw-01:Gi1/0/2
    lag: po1
    lacp: active
    mode: trunk
    vlans: "10,20,30"
  - from: dist-sw-01:Gi1/0/24
    to: acc-sw-01:Gi0/1
    mode: trunk
    vlans: "10,20"
```
