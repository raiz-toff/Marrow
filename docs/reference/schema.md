# Network Topology YAML Schema Guide

> **The Complete Reference for Creating Professional Network Diagrams**
> _Version 2.1 — Updated February 2026_

This comprehensive guide provides everything you need to create first-class network topology YAML files. Whether you're a network engineer documenting infrastructure, a student creating CCNA lab diagrams, or an AI model generating professional visualizations, this reference covers every field, option, and best practice.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Document Structure](#document-structure)
3. [Metadata Section](#metadata-section)
4. [Configuration Section](#configuration-section)
5. [Nodes Section](#nodes-section)
6. [Links Section](#links-section)
7. [Layer 2 Configuration](#layer-2-configuration)
8. [Layer 3 / Routing Configuration](#layer-3--routing-configuration)
9. [STP Configuration](#stp-configuration)
10. [Groups Section](#groups-section)
11. [Annotations Section](#annotations-section)
12. [Cable Types Reference](#cable-types-reference)
13. [LACP/Bundle Configuration](#lacpbundle-configuration)
14. [Icon Library](#icon-library)
15. [Layout Strategies](#layout-strategies)
16. [Running Configurations](#running-configurations)
17. [Best Practices](#best-practices)
18. [Complete Examples](#complete-examples)
19. [Troubleshooting](#troubleshooting)
20. [Quick Reference Card](#quick-reference-card)

## Quick Start

Here's a minimal working topology:

```yaml
title: "My First Network"
description: "Simple router-switch-host diagram"
project_url: "https://myportfolio.com/projects"

nodes:
 - id: ROUTER
  label: "Core Router"
  icon: Cisco/Routers/router

 - id: SWITCH
  label: "Access Switch"
  icon: Cisco/Switches/workgroup_switch

 - id: HOST
  label: "Workstation"
  icon: Cisco/ComputerAndPeripherals/pc

links:
 - from: ROUTER
  to: SWITCH
  cable: ethernet
  from_port: "Gi0/0"
  to_port: "Gi0/1"

 - from: SWITCH
  to: HOST
  cable: copper
  from_port: "Fa0/1"
  to_port: "eth0"
```

**Run the development server:**

```bash
python3 server.py
```

Then open `http://localhost:5000` in your browser.

## Document Structure

A complete topology file has these sections (in order):

```yaml
# METADATA — Document identification & project linking
title: "Network Name"
description: "Description of the network"
project_url: "https://example.com/project"

# CONFIGURATION — Build, layout, and export settings
config:
 engines: [campus, hierarchical]
 layouts: [realistic]
 output_filename: "my_network"

# NODES — Network devices and endpoints
nodes:
 - id: DEVICE_ID
  label: "Display Name"
  icon: Vendor/Category/icon_name
  # ... node properties

# LINKS — Physical and logical connections between devices
links:
 - from: DEVICE1
  to: DEVICE2
  cable: ethernet
  # ... link properties

# GROUPS — Visual groupings / zones (optional)
groups:
 - name: "VLAN 10 Zone"
  nodes: [DEVICE1, DEVICE2]
  color: "rgba(99, 102, 241, 0.1)"

# ANNOTATIONS — Labels, titles, and notes (optional)
annotations:
 - text: "NETWORK TITLE"
  x: 0
  y: -300
  style: h1
```

## Metadata Section

### Required Fields

| Field         | Type   | Description                       |
| :------------ | :----- | :-------------------------------- |
| `title`       | string | Name of the network/diagram       |
| `description` | string | Brief description of the topology |

### Optional Fields

| Field         | Type   | Default | Description                                             |
| :------------ | :----- | :------ | :------------------------------------------------------ |
| `project_url` | string | `"#"`   | Link for "Back to Project" button (shows button if set) |
| `author`      | string | —       | Creator of the diagram                                  |
| `version`     | string | —       | Version number (e.g., "2.1")                            |
| `date`        | string | —       | Creation/modification date (e.g., "2026-02-05")         |

### Example

```yaml
title: "Enterprise Campus Network"
description: "Three-tier architecture with redundant core, distribution, and access layers."
project_url: "https://rajkumarneupane.com/projects/campus-network"
author: "Network Team"
version: "2.1"
date: "2026-02-05"
```

> **Note:** When `project_url` is set to a valid URL (not `#`), a "Back to Project" button appears in the top-right corner of the diagram.

## Configuration Section

The `config` section controls how the diagram is built and rendered.

```yaml
config:
  engines:
    - campus # Campus-style layout with manual x/y positioning
    - hierarchical # Automatic tree layout based on levels
    - flow # Left-to-right flow for traffic diagrams
    - city # Multi-site WAN layouts
    - radial # Radial cluster layout
  layouts:
    - realistic # Uses high-fidelity vendor icons
    - blueprint # Technical blueprint style
  output_filename: "network_diagram"
```

### Engines

| Engine         | Description                                     | Visual Style                | Best For                        |
| :------------- | :---------------------------------------------- | :-------------------------- | :------------------------------ |
| `campus`       | Radial Core + High-Density Grid Pods            | Concentric Rings background | Multi-building campus networks  |
| `city`         | Structured Manhattan Grid / Site Blocks         | 400px Grid background       | Multi-site/WAN/Regional dist.   |
| `hierarchical` | Automatic tree layout based on `level`/`parent` | Top-down tree structure     | Clean org-chart style hierarchy |
| `flow`         | Left-to-right hierarchical flow                 | Left-to-right layout        | Process/Traffic flow diagrams   |
| `radial`       | Pure Concentric Cluster with Core at center     | Bullseye Rings background   | Star topology, hub-and-spoke    |

> **Note:** All engines calculate positions independently. The UI allows runtime switching between engines. You can specify multiple engines in the config to enable engine switching in the viewer.

### Layouts (Visual Styles)

| Layout      | Description                                     |
| :---------- | :---------------------------------------------- |
| `realistic` | Uses high-fidelity vendor icons (Cisco, etc.)   |
| `blueprint` | Technical blueprint style with geometric shapes |

### Config Examples

**Simple campus diagram:**

```yaml
config:
  engines: [campus]
  layouts: [realistic]
  output_filename: "campus_network"
```

**Multi-view diagram (switchable in UI):**

```yaml
config:
  engines: [campus, hierarchical, flow, radial]
  layouts: [realistic, blueprint]
  output_filename: "enterprise_net"
```

## Nodes Section

Nodes represent network devices, endpoints, and infrastructure components.

### Required Fields

| Field   | Type   | Description                               |
| :------ | :----- | :---------------------------------------- |
| `id`    | string | Unique identifier (UPPERCASE recommended) |
| `label` | string | Display name shown under the icon         |

### Optional Fields

| Field            | Type   | Default    | Description                                                                                                  |
| :--------------- | :----- | :--------- | :----------------------------------------------------------------------------------------------------------- |
| `icon`           | string | `"router"` | Icon path from the icon library                                                                              |
| `x`              | number | auto       | X position (campus/city layouts)                                                                             |
| `y`              | number | auto       | Y position (campus/city layouts)                                                                             |
| `level`          | number | 1          | Hierarchy level (1=top, 2, 3, etc.)                                                                          |
| `parent`         | string | —          | Parent node ID for hierarchy                                                                                 |
| `role`           | string | —          | Device role (core, distribution, access, router, switch, firewall, server, host, desktop, laptop, phone, ap) |
| `type`           | string | `"router"` | Legacy type field (use `icon` instead)                                                                       |
| `vendor`         | string | —          | Device vendor (e.g., "Cisco", "Arista")                                                                      |
| `model`          | string | —          | Device model (e.g., "Catalyst 9300")                                                                         |
| `platform`       | string | —          | Platform info                                                                                                |
| `ip`             | string | —          | Management IP address                                                                                        |
| `location`       | string | —          | Physical location                                                                                            |
| `purpose`        | string | —          | Device purpose/function                                                                                      |
| `notes`          | string | —          | Additional notes                                                                                             |
| `design_notes`   | string | —          | Design rationale (shown in inspector)                                                                        |
| `running_config` | string | —          | IOS/NX-OS configuration snippet                                                                              |
| `status`         | string | `"active"` | Device status (active, standby, offline)                                                                     |

> **Priority:** If `icon` is specified, it overrides the visual style. Otherwise, `role` determines styling. If neither is set, `level`-based fallback styling applies.

### Node ID Naming Conventions

Use **UPPERCASE** identifiers that are:

- **Descriptive:** `CORE_SW_01`, `DIST_A`, `FW_EXTERNAL`
- **Unique:** No duplicates allowed
- **Alphanumeric with underscores:** `[A-Z0-9_]+`

```yaml
# Good node IDs
- id: CORE_RTR_01
- id: DIST_SW_BUILDING_A
- id: AP_FLOOR_3_EAST

# Avoid these
- id: sw1 # Too short, not descriptive
- id: My Switch # Spaces not allowed
- id: 192.168.1.1 # Don't use IPs as IDs
```

### Icon Path Format

Icons use path format: `Vendor/Category/icon_name`

```yaml
# Routers
icon: Cisco/Routers/router
icon: Cisco/Routers/router_with_firewall
icon: Cisco/Routers/wireless_router

# Switches
icon: Cisco/Switches/workgroup_switch    # Access layer
icon: Cisco/Switches/layer_3_switch     # Distribution/Core
icon: Cisco/Switches/multilayer_switch

# Security
icon: Cisco/Security/firewall
icon: Cisco/Security/vpn_concentrator
icon: Cisco/Security/cisco_asa_5500

# Servers & Datacenter
icon: Cisco/Datacenter/server
icon: Cisco/Servers/file_server
icon: Cisco/Servers/application_server
icon: Cisco/Servers/database_server

# Endpoints
icon: Cisco/ComputerAndPeripherals/pc
icon: Cisco/ComputerAndPeripherals/laptop
icon: Cisco/ComputerAndPeripherals/printer

# Wireless
icon: Cisco/Wireless/access_point
icon: Cisco/Wireless/wireless_controller
```

### Position Coordinates (Campus/City Layout)

For `campus` and `city` engines, use x/y to place nodes:

```yaml
# Coordinate system: (0,0) is center
# Negative X = left, Positive X = right
# Negative Y = top,  Positive Y = bottom

nodes:
 - id: CORE
  label: "Core"
  x: 0 # Center horizontally
  y: -200 # Near top

 - id: DIST_LEFT
  label: "Dist Left"
  x: -300 # Left side
  y: 0 # Middle

 - id: DIST_RIGHT
  label: "Dist Right"
  x: 300 # Right side
  y: 0 # Middle
```

### Hierarchy Levels (Hierarchical Layout)

For `hierarchical` engine, use levels instead of coordinates:

```yaml
nodes:
 # Level 1 = Core (top of diagram)
 - id: CORE1
  label: "Core 1"
  level: 1

 # Level 2 = Distribution
 - id: DIST1
  label: "Distribution 1"
  level: 2
  parent: CORE1 # Links to parent in hierarchy

 # Level 3 = Access
 - id: ACCESS1
  label: "Access 1"
  level: 3
  parent: DIST1
```

### Role-Based Styling

If no icon is specified, the node's visual style is determined by its `role`:

| Role           | Color   | Shape    | Use For                |
| :------------- | :------ | :------- | :--------------------- |
| `core`         | #3b82f6 | diamond  | Core layer devices     |
| `distribution` | #f472b6 | diamond  | Distribution layer     |
| `access`       | #94a3b8 | dot      | Access layer switches  |
| `router`       | #a855f7 | square   | Routers                |
| `switch`       | #94a3b8 | dot      | Generic switches       |
| `firewall`     | #ef4444 | triangle | Firewalls/Security     |
| `server`       | #14b8a6 | box      | Servers                |
| `host`         | #84cc16 | ellipse  | Workstations/Endpoints |
| `desktop`      | #84cc16 | ellipse  | Desktop PCs            |
| `laptop`       | #84cc16 | ellipse  | Laptops                |
| `phone`        | #6366f1 | circle   | IP Phones              |
| `ap`           | #f59e0b | star     | Access Points          |
| _(default)_    | #64748b | dot      | Unknown/unrecognized   |

> **Note:** If the `role` is not recognized, the engine falls back to level-based styling or uses the default gray dot.

### Complete Node Examples

**Router with full metadata:**

```yaml
- id: CORE_RTR_01
 label: "Core Router 1"
 icon: Cisco/Routers/router
 x: 0
 y: -300
 level: 1
 role: core
 vendor: "Cisco"
 model: "ASR 9000"
 ip: "10.0.0.1"
 location: "DC1 - Row A - Rack 5"
 status: active
 purpose: "Primary BGP peering router"
 design_notes: |
  - HSRP Active for VLANs 10, 20, 30
  - BGP peering with ISP (AS 65000)
  - OSPF backbone router
 running_config: |
  interface GigabitEthernet0/0
   ip address 10.0.0.1 255.255.255.0
   ip ospf 1 area 0
  !
  router ospf 1
   router-id 10.0.0.1
```

**Access switch with parent:**

```yaml
- id: ACC_SW_FLOOR2
 label: "Floor 2 Switch"
 icon: Cisco/Switches/workgroup_switch
 x: -200
 y: 100
 level: 3
 parent: DIST_01
 role: access
 model: "Catalyst 9200"
 ip: "10.1.2.1"
 location: "Building A - Floor 2 - IDF"
```

## Links Section

Links define connections between nodes. These can be physical cables or logical connections.

### Required Fields

| Field  | Type   | Description         |
| :----- | :----- | :------------------ |
| `from` | string | Source node ID      |
| `to`   | string | Destination node ID |

### Optional Fields

| Field       | Type   | Default      | Description                              |
| :---------- | :----- | :----------- | :--------------------------------------- |
| `cable`     | string | `"ethernet"` | Cable type (see Cable Types Reference)   |
| `from_port` | string | —            | Source interface name                    |
| `to_port`   | string | —            | Destination interface name               |
| `from_ip`   | string | —            | IP address on source interface           |
| `to_ip`     | string | —            | IP address on destination interface      |
| `speed`     | string | —            | Link speed (e.g., "10G", "100G")         |
| `layer2`    | object | —            | L2 config: mode, vlan, native_vlan, etc. |
| `routing`   | object | —            | L3 config: protocol, area, cost, etc.    |
| `stp`       | object | —            | STP state: roles, states, vlan           |
| `notes`     | string | —            | Additional notes (shown in link tooltip) |

> **Note:** Port information is displayed in the link tooltip when hovering. IP addresses are shown alongside port information when specified.

### Basic Link Examples

**Simple Ethernet connection:**

```yaml
- from: SWITCH
 to: SERVER
 cable: ethernet
 from_port: "Gi0/1"
 to_port: "eth0"
```

**Fiber uplink with IP addresses:**

```yaml
- from: CORE
 to: DIST
 cable: fiber
 from_port: "Te0/0/1"
 to_port: "Te0/0/1"
 from_ip: "10.0.0.1"
 to_ip: "10.0.0.2"
```

**VPN tunnel overlay:**

```yaml
- from: BRANCH_FW
 to: HQ_FW
 cable: tunnel
 notes: "IPsec VPN - AES256-GCM"
```

**Wireless link:**

```yaml
- from: WLC
 to: AP_LOBBY
 cable: wireless
 notes: "802.11ax - Channel 36"
```

## Layer 2 Configuration

Add detailed VLAN and switchport information to links using the `layer2` object.

### Layer 2 Fields

| Field           | Type   | Description                             |
| :-------------- | :----- | :-------------------------------------- |
| `mode`          | string | `access`, `trunk`, `dynamic`            |
| `vlan`          | number | Access VLAN ID (for access ports)       |
| `native_vlan`   | number | Native VLAN for trunk ports             |
| `allowed_vlans` | string | Allowed VLANs on trunk (e.g., "1-4094") |

### Layer 2 Examples

**Access port on VLAN 10:**

```yaml
- from: SWITCH
 to: PC
 cable: ethernet
 from_port: "Fa0/1"
 to_port: "eth0"
 layer2:
  mode: access
  vlan: 10
```

**Trunk port with all VLANs:**

```yaml
- from: CORE_SW
 to: DIST_SW
 cable: trunk
 from_port: "Gi0/1"
 to_port: "Gi0/1"
 layer2:
  mode: trunk
  native_vlan: 99
  allowed_vlans: "10,20,30,99"
```

**Router-on-a-Stick (ROAS) trunk:**

```yaml
- from: ROUTER
 to: SWITCH
 cable: trunk
 from_port: "Gi0/0"
 to_port: "Et3/0"
 layer2:
  mode: trunk
  native_vlan: 1
  allowed_vlans: "10,20,30"
```

## Layer 3 / Routing Configuration

Add routing protocol information to links using the `routing` object.

### Routing Fields

| Field          | Type   | Description                         |
| :------------- | :----- | :---------------------------------- |
| `protocol`     | string | `ospf`, `eigrp`, `bgp`, `static`    |
| `area`         | number | OSPF area number                    |
| `as_number`    | number | BGP AS number or EIGRP AS           |
| `cost`         | number | Routing cost/metric                 |
| `network_type` | string | `point-to-point`, `broadcast`, etc. |

### Routing Examples

**OSPF backbone link:**

```yaml
- from: CORE1
 to: CORE2
 cable: fiber
 from_port: "Te0/1"
 to_port: "Te0/1"
 from_ip: "10.255.0.1"
 to_ip: "10.255.0.2"
 routing:
  protocol: ospf
  area: 0
  cost: 10
  network_type: "point-to-point"
```

**BGP peering:**

```yaml
- from: EDGE_RTR
 to: ISP_RTR
 cable: fiber
 from_ip: "203.0.113.1"
 to_ip: "203.0.113.2"
 routing:
  protocol: bgp
  as_number: 65001
```

**EIGRP neighbor:**

```yaml
- from: BRANCH_RTR
 to: HQ_RTR
 cable: serial
 from_port: "S0/0/0"
 to_port: "S0/0/1"
 routing:
  protocol: eigrp
  as_number: 100
```

## STP Configuration

Show Spanning Tree Protocol state on links using the `stp` object.

### STP Fields

| Field        | Type   | Description                                     |
| :----------- | :----- | :---------------------------------------------- |
| `vlan`       | number | VLAN instance for PVST+                         |
| `from_role`  | string | Role on source: `Root`, `Desg`, `Alt`, `Backup` |
| `from_state` | string | State on source: `Fwd`, `Blk`, `Lrn`            |
| `to_role`    | string | Role on destination                             |
| `to_state`   | string | State on destination                            |

### STP Examples

**Root port forwarding:**

```yaml
- from: DIST_SW
 to: CORE_SW
 cable: trunk
 from_port: "Gi0/1"
 to_port: "Gi0/1"
 stp:
  vlan: 10
  from_role: "Root"
  from_state: "Fwd"
  to_role: "Desg"
  to_state: "Fwd"
```

**Blocked alternate port:**

```yaml
- from: ACC_SW_1
 to: ACC_SW_2
 cable: ethernet
 from_port: "Fa0/24"
 to_port: "Fa0/24"
 stp:
  vlan: 10
  from_role: "Alt"
  from_state: "Blk"
  to_role: "Desg"
  to_state: "Fwd"
```

## Groups Section

Groups create visual containers around related nodes (VLANs, zones, tiers).

### Group Fields

| Field     | Type     | Required | Description                                              |
| :-------- | :------- | :------- | :------------------------------------------------------- |
| `name`    | string   | Yes      | Group label (shown in diagram)                           |
| `nodes`   | string[] | Yes      | List of node IDs in this group                           |
| `color`   | string   | No       | Fill color (rgba recommended for transparency)           |
| `shape`   | string   | No       | Shape type: `rect`, `hull`, `ellipse`, `circle`, `cloud` |
| `style`   | string   | No       | Border style: `solid` or `dashed`                        |
| `padding` | number   | No       | Padding around nodes (default: 60)                       |

> **Auto-Shape Selection:** If `shape` is not specified, the engine automatically selects based on the current layout:
>
> - **City Layout**: Forces `rect` (matches grid structure)
> - **Campus / Radial**: Group containers become organic **hulls** (`hull`) to reflect clustering.

### Color Format

Use rgba for transparency control:

```yaml
color: "rgba(99, 102, 241, 0.08)"  # Light indigo, 8% opacity
color: "rgba(239, 68, 68, 0.1)"   # Light red, 10% opacity
color: "rgba(16, 185, 129, 0.08)"  # Light green, 8% opacity
color: "rgba(245, 158, 11, 0.1)"   # Light amber, 10% opacity
```

### Color Presets by Purpose

| Purpose        | Recommended Color                     |
| :------------- | :------------------------------------ |
| Core Layer     | `rgba(239, 68, 68, 0.08)` (red)       |
| Distribution   | `rgba(139, 92, 246, 0.08)` (purple)   |
| Access Layer   | `rgba(16, 185, 129, 0.08)` (green)    |
| DMZ / Security | `rgba(245, 158, 11, 0.1)` (amber)     |
| Server Zone    | `rgba(14, 165, 233, 0.08)` (sky blue) |
| VLAN 10        | `rgba(30, 144, 255, 0.15)` (blue)     |
| VLAN 20        | `rgba(46, 139, 87, 0.15)` (green)     |
| VLAN 30        | `rgba(255, 69, 0, 0.15)` (orange-red) |
| Infrastructure | `rgba(148, 163, 184, 0.12)` (gray)    |

### Layout-Specific Behaviors

The visual engine automatically adapts link and group styles based on the active layout:

- **Straight Links**: All cables are rendered as high-fidelity **straight lines** with no curves. Use cable types like `tunnel` or `trunk` to see unique visual treatments (widths, parallel lines, etc.).
- **Adaptive Groups**:
- **City Layout**: All group containers become rigid **rectangles** (`rect`) to match the grid structure.
- **Campus / Radial**: Group containers become organic **hulls** (`hull`) to reflect clustering.

### Group Examples

**Three-tier architecture:**

```yaml
groups:
 - name: "Core Layer"
  nodes: ["CORE1", "CORE2"]
  color: "rgba(239, 68, 68, 0.08)"
  shape: rect

 - name: "Distribution Layer"
  nodes: ["DIST1", "DIST2", "DIST3"]
  color: "rgba(139, 92, 246, 0.08)"

 - name: "Access Layer"
  nodes: ["ACC1", "ACC2", "ACC3", "ACC4", "ACC5", "ACC6"]
  color: "rgba(16, 185, 129, 0.08)"
```

**VLAN segmentation:**

```yaml
groups:
 - name: "HR Dept (VLAN 10)"
  nodes: ["HR_PC1", "HR_PC2", "HR_PRINTER"]
  color: "rgba(30, 144, 255, 0.15)"
  style: dashed

 - name: "Sales Dept (VLAN 20)"
  nodes: ["SALES_PC1", "SALES_PC2", "SALES_PC3"]
  color: "rgba(46, 139, 87, 0.15)"
  style: dashed

 - name: "IT Dept (VLAN 30)"
  nodes: ["IT_PC1", "IT_SERVER", "IT_MGMT"]
  color: "rgba(255, 69, 0, 0.15)"
  style: dashed
```

## Annotations Section

Annotations add text labels, titles, and notes to the diagram.

### Annotation Fields

| Field      | Type   | Required | Description                                                        |
| :--------- | :----- | :------- | :----------------------------------------------------------------- | --- |
| `text`     | string | Yes      | The text content (supports multi-line with `                       | `)  |
| `target`   | string | Cond.    | Node ID to attach annotation to (makes annotation follow the node) |
| `position` | string | No       | Position relative to target node (see Position Values below)       |
| `x`        | number | Cond.    | X position (required if not using `target`)                        |
| `y`        | number | Cond.    | Y position (required if not using `target`)                        |
| `offset_x` | number | No       | X offset from target (legacy, use `position` instead)              |
| `offset_y` | number | No       | Y offset from target (legacy, use `position` instead)              |
| `style`    | string | No       | Style preset: `h1`, `h2`, `h3`, `note`, `label`, `tag`             |

### Position Values (for `target`-attached annotations)

| Value          | Description                       |
| :------------- | :-------------------------------- |
| `top`          | Centered above the target node    |
| `bottom`       | Centered below the target node    |
| `below`        | Alias for `bottom`                |
| `left`         | Centered to the left of the node  |
| `right`        | Centered to the right of the node |
| `top-left`     | Upper-left corner                 |
| `top-right`    | Upper-right corner                |
| `bottom-left`  | Lower-left corner                 |
| `bottom-right` | Lower-right corner                |
| `center`       | Centered on the node              |

### Style Presets

| Style   | Appearance             | Use For             |
| :------ | :--------------------- | :------------------ |
| `h1`    | Large, bold, uppercase | Main diagram titles |
| `h2`    | Medium, bold           | Section headers     |
| `h3`    | Small, semi-bold       | Sub-headers         |
| `note`  | Small, box background  | Explanatory notes   |
| `label` | Small, simple text     | Simple labels       |
| `tag`   | Pill-shaped badge      | Status tags         |

### Annotation Examples

**Main title (fixed position):**

```yaml
annotations:
 - text: "ENTERPRISE NETWORK TOPOLOGY"
  x: 0
  y: -500
  style: h1
```

**Note attached to a node:**

```yaml
- text: "ROAS Gateway\nSub-ifs: .10, .20, .30"
 target: "Router_Gateway"
 offset_x: 0
 offset_y: -80
```

**Configuration note:**

```yaml
- text: |
  Mgmt IP: 192.168.10.35
  VLAN 99 (Native)
  Trunk to Router
 target: "Managed_Switch"
 offset_x: 100
 offset_y: 0
 style: note
```

**Multi-line technical note:**

```yaml
- text: |
  ─────────────────
  OSPF Area 0
  BGP AS 65001
  10G Backbone Links
  HSRP Active/Standby
  ─────────────────
 x: -500
 y: -200
 style: note
```

## Cable Types Reference

### Complete Cable Catalog

| Cable Type  | Color   | Visual Style       | Use Case                    |
| :---------- | :------ | :----------------- | :-------------------------- |
| `ethernet`  | #94a3b8 | Solid smooth       | Standard copper LAN         |
| `fiber`     | #22d3ee | Rigid + cyan glow  | Multi-mode fiber links      |
| `smf`       | #facc15 | Thin yellow rigid  | Single-mode backbone        |
| `trunk`     | #8b5cf6 | Dual parallel      | LACP/EtherChannel bundles   |
| `serial`    | #1e40af | Dashed zigzag      | Legacy WAN T1/E1            |
| `console`   | #06b6d4 | Fine dotted        | OOB management (rollover)   |
| `wireless`  | #a855f7 | Sparse purple dots | WiFi/Radio/Satellite        |
| `tunnel`    | #6366f1 | Ghost tube (wide)  | VPN/GRE/IPsec/VXLAN overlay |
| `power`     | #fcd34d | Heavy amber block  | PDU/Electrical connections  |
| `crossover` | #ef4444 | Red striped dash   | Direct patch/Warning        |
| `coaxial`   | #6b7280 | Thick gray         | Coax/DOCSIS                 |
| `dac`       | #f97316 | Orange rigid       | Direct Attach Copper/Twinax |
| `submarine` | #1e3a8a | Very thick blue    | Subsea/Intercontinental     |

### Cable Aliases

Common terms automatically map to cable types:

| You Can Use (Alias)                                                       | Maps To     |
| :------------------------------------------------------------------------ | :---------- |
| `copper`, `utp`, `cat5`, `cat5e`, `cat6`, `cat6a`, `cat7`, `cat8`, `rj45` | `ethernet`  |
| `mmf`, `om3`, `om4`, `multimode`                                          | `fiber`     |
| `os1`, `os2`, `singlemode`                                                | `smf`       |
| `lacp`, `etherchannel`, `bond`, `aggregate`, `portchannel`, `po`          | `trunk`     |
| `wan`, `t1`, `e1`                                                         | `serial`    |
| `rollover`, `mgmt`, `oob`                                                 | `console`   |
| `wifi`, `radio`, `microwave`, `satellite`                                 | `wireless`  |
| `vpn`, `gre`, `ipsec`, `vxlan`, `overlay`                                 | `tunnel`    |
| `pdu`, `ac`, `dc`                                                         | `power`     |
| `coax`, `docsis`                                                          | `coaxial`   |
| `twinax`                                                                  | `dac`       |
| `subsea`                                                                  | `submarine` |

### Cable Usage Examples

```yaml
links:
  # Standard copper to endpoint
  - { from: SWITCH, to: PC, cable: cat6 }

  # 10G fiber uplink
  - { from: CORE, to: DIST, cable: fiber }

  # Long-haul single-mode
  - { from: DC_EAST, to: DC_WEST, cable: smf }

  # LACP bundle (shows as dual parallel lines)
  - { from: CORE1, to: CORE2, cable: trunk }

  # Site-to-site VPN
  - { from: BRANCH, to: HQ, cable: vpn }

  # Console/management
  - { from: ADMIN_PC, to: CORE_SW, cable: console }
```

## LACP/Bundle Configuration

Port-channels are automatically detected when multiple links share:

1. Same source and destination nodes
2. Matching port-channel identifiers in port names

### Port Naming Convention

Use format: `PoN (PhysicalInterface)` or `Port-ChannelN (Interface)`

```yaml
# 2-Member LACP Bundle
links:
 - from: CORE1
  to: CORE2
  from_port: "Po1 (Gi0/1)" # Bundle ID: Po1
  to_port: "Po1 (Gi0/1)"
  cable: trunk

 - from: CORE1
  to: CORE2
  from_port: "Po1 (Gi0/2)" # Same bundle ID: Po1
  to_port: "Po1 (Gi0/2)"
  cable: trunk
 # Result: Single logical link with dual parallel lines
```

### Vendor-Specific Formats

| Vendor  | Format                  | Example                |
| :------ | :---------------------- | :--------------------- |
| Cisco   | `Po<N> (<Int>)`         | `Po1 (Gi0/1)`          |
| Arista  | `Port-Channel<N> (<I>)` | `Port-Channel10 (Et1)` |
| Juniper | `ae<N> (<Int>)`         | `ae0 (ge-0/0/0)`       |
| Linux   | `bond<N>`               | `bond0`                |

### 4-Member Fiber Bundle Example

```yaml
links:
 - from: CORE
  to: DIST
  from_port: "Po10 (Te0/1)"
  to_port: "Po10 (Te0/1)"
  cable: fiber

 - from: CORE
  to: DIST
  from_port: "Po10 (Te0/2)"
  to_port: "Po10 (Te0/2)"
  cable: fiber

 - from: CORE
  to: DIST
  from_port: "Po10 (Te0/3)"
  to_port: "Po10 (Te0/3)"
  cable: fiber

 - from: CORE
  to: DIST
  from_port: "Po10 (Te0/4)"
  to_port: "Po10 (Te0/4)"
  cable: fiber
```

## Icon Library

### Cisco Icons (Primary)

**Routers:**

```yaml
Cisco/Routers/router
Cisco/Routers/router_with_firewall
Cisco/Routers/wireless_router
Cisco/Routers/atm_router
```

**Switches:**

```yaml
Cisco/Switches/workgroup_switch    # Access layer
Cisco/Switches/layer_3_switch     # Distribution/Core
Cisco/Switches/content_switch     # Load balancer
Cisco/Switches/atm_switch
Cisco/Switches/multilayer_switch
```

**Security:**

```yaml
Cisco/Security/firewall
Cisco/Security/vpn_concentrator
Cisco/Security/cisco_asa_5500
Cisco/Security/ids_ips
```

**Servers & Datacenter:**

```yaml
Cisco/Datacenter/server
Cisco/Servers/file_server
Cisco/Servers/application_server
Cisco/Servers/database_server
Cisco/Servers/web_server
Cisco/Servers/storage_server
```

**Wireless:**

```yaml
Cisco/Wireless/access_point
Cisco/Wireless/wireless_controller
Cisco/Wireless/mesh_ap
Cisco/Wireless/bridge
```

**Storage:**

```yaml
Cisco/Storage/storage_array
Cisco/Storage/tape_library
Cisco/Storage/san_fabric
```

**WAN/Cloud:**

```yaml
Cisco/WAN/cloud
Cisco/WAN/carrier_cloud
Cisco/WAN/internet
Cisco/WAN/frame_relay
```

**Endpoints:**

```yaml
Cisco/ComputerAndPeripherals/pc
Cisco/ComputerAndPeripherals/laptop
Cisco/ComputerAndPeripherals/printer
Cisco/ModemandPhones/ip_phone
Cisco/ModemandPhones/phone
```

## Layout Strategies

### Strategy 1: Three-Tier Hierarchy

```yaml
# Grid positioning for three-tier campus
nodes:
 # Core (Top center, Y = -300)
 - id: CORE1
  x: -150
  y: -300
  level: 1

 - id: CORE2
  x: 150
  y: -300
  level: 1

 # Distribution (Middle row, Y = 0)
 - id: DIST1
  x: -300
  y: 0
  level: 2

 - id: DIST2
  x: 0
  y: 0
  level: 2

 - id: DIST3
  x: 300
  y: 0
  level: 2

 # Access (Bottom rows, Y = 200+)
 - id: ACC1
  x: -400
  y: 200
  level: 3
```

### Strategy 2: Spine-Leaf Datacenter

```yaml
nodes:
  # Spines (Top row)
  - { id: SPINE1, x: -150, y: -200, level: 1 }
  - { id: SPINE2, x: 150, y: -200, level: 1 }

  # Leafs (Bottom row)
  - { id: LEAF1, x: -300, y: 100, level: 2 }
  - { id: LEAF2, x: -100, y: 100, level: 2 }
  - { id: LEAF3, x: 100, y: 100, level: 2 }
  - { id: LEAF4, x: 300, y: 100, level: 2 }

links:
  # Full mesh: Every spine to every leaf
  - { from: SPINE1, to: LEAF1, cable: fiber }
  - { from: SPINE1, to: LEAF2, cable: fiber }
  - { from: SPINE1, to: LEAF3, cable: fiber }
  - { from: SPINE1, to: LEAF4, cable: fiber }
  - { from: SPINE2, to: LEAF1, cable: fiber }
  - { from: SPINE2, to: LEAF2, cable: fiber }
  - { from: SPINE2, to: LEAF3, cable: fiber }
  - { from: SPINE2, to: LEAF4, cable: fiber }
```

### Strategy 3: WAN/Multi-Site Hub-and-Spoke

```yaml
nodes:
  # HQ at center
  - { id: HQ_FW, x: 0, y: 0, level: 1 }

  # Branch offices surrounding
  - { id: BRANCH_EAST, x: 400, y: 0, level: 2 }
  - { id: BRANCH_WEST, x: -400, y: 0, level: 2 }
  - { id: BRANCH_NORTH, x: 0, y: -300, level: 2 }
  - { id: BRANCH_SOUTH, x: 0, y: 300, level: 2 }

links:
  # Hub-and-spoke VPN tunnels
  - { from: HQ_FW, to: BRANCH_EAST, cable: tunnel }
  - { from: HQ_FW, to: BRANCH_WEST, cable: tunnel }
  - { from: HQ_FW, to: BRANCH_NORTH, cable: tunnel }
  - { from: HQ_FW, to: BRANCH_SOUTH, cable: tunnel }
```

### Position Guidelines (Smart Balancing)

The engine now includes a **Spring Balancer** that automatically optimizes your layout.

- You provide roughly correct positions (or none at all for auto-layout)
- The engine runs a physics simulation to equalize link lengths
- **Result:** No more "too short" or "too long" links—the diagram balances itself.

```yaml
# Recommended grid spacing (Starting Points):
# - Core devices: 300px apart
# - Layer spacing: 250px vertically
# - Access switches: 150-200px apart

# Example coordinate grid:
# x: -300  x: 0  x: 300
# y:-300  CORE1      CORE2
# y: 0   DIST1  DIST2  DIST3
# y: 250  ACC1   ACC2  ACC3 ACC4 ACC5
```

## Running Configurations

Add IOS/NX-OS configuration snippets to nodes using the `running_config` field.

```yaml
- id: Router_Gateway
 label: "Router1 (Gateway)"
 icon: "Cisco/Routers/router"
 running_config: |
  hostname Router1
  !
  interface GigabitEthernet0/0
   no ip address
   duplex auto
   speed auto
  !
  interface Gi0/0.10
   description VLAN 10 - HR Department
   encapsulation dot1Q 10
   ip address 192.168.10.1 255.255.255.0
  !
  interface Gi0/0.20
   description VLAN 20 - Sales Department
   encapsulation dot1Q 20
   ip address 192.168.20.1 255.255.255.0
  !
  interface Gi0/0.30
   description VLAN 30 - IT Department
   encapsulation dot1Q 30
   ip address 192.168.30.1 255.255.255.0
  !
  router ospf 1
   network 192.168.0.0 0.0.255.255 area 0

- id: Managed_Switch
 label: "Core Switch (L2)"
 icon: "Cisco/Switches/layer_3_switch"
 running_config: |
  hostname CoreSwitch
  !
  vlan 10
   name HR_DEPARTMENT
  vlan 20
   name SALES_DEPARTMENT
  vlan 30
   name IT_DEPARTMENT
  vlan 99
   name MANAGEMENT
  !
  interface Ethernet3/0
   description Trunk to Router
   switchport trunk encapsulation dot1q
   switchport mode trunk
   switchport trunk native vlan 99
   switchport trunk allowed vlan 10,20,30,99
  !
  interface Vlan99
   ip address 192.168.10.35 255.255.255.0
```

## Best Practices

### 1. Node IDs

**Do:**

```yaml
- id: CORE_SW_01 # Descriptive, uppercase, underscores
- id: FW_PERIMETER # Role-based naming
- id: DC1_SPINE_A # Location + role
```

**Don't:**

```yaml
- id: sw1 # Too short, lowercase
- id: my switch # Spaces not allowed
- id: 192.168.1.1 # Don't use IPs as IDs
```

### 2. Logical Ordering

Group entries logically in your YAML:

```yaml
# CORE LAYER
nodes:
  - id: CORE1
    # ...
  - id: CORE2
    # ...

  # DISTRIBUTION LAYER
  - id: DIST1
    # ...

  # ACCESS LAYER
  - id: ACC1
    # ...
```

### 3. Link Grouping

Group links by type or connection tier:

```yaml
links:
  # === Core Interconnects ===
  - { from: CORE1, to: CORE2, cable: trunk }
  - { from: CORE1, to: CORE2, cable: trunk } # LACP member 2

  # === Core to Distribution ===
  - { from: CORE1, to: DIST1, cable: fiber }
  - { from: CORE1, to: DIST2, cable: fiber }
  - { from: CORE2, to: DIST2, cable: fiber }
  - { from: CORE2, to: DIST3, cable: fiber }

  # === Distribution to Access ===
  - { from: DIST1, to: ACC1, cable: ethernet }
  - { from: DIST1, to: ACC2, cable: ethernet }
```

### 4. Comments

Use YAML comments liberally:

```yaml
# REDUNDANT CORE - HSRP Active/Standby
- id: CORE1
 label: "Core-1"
 # Primary core, HSRP active for VLANs 10, 30

- id: CORE2
 label: "Core-2"
 # Secondary core, HSRP standby, becomes active for VLANs 20
```

### 5. Validation Before Build

Always validate your YAML syntax:

```bash
# Python validation
python3 -c "import yaml; yaml.safe_load(open('input/plan.yaml'))"

# Or use the built-in validator endpoint
curl http://localhost:5000/validate_schema
```

## Complete Examples

### Example 1: Router-on-a-Stick (ROAS) with VLANs

```yaml
title: "Small Business ROAS Topology"
description: "Router-on-a-Stick architecture with VLAN segmentation"
project_url: "https://portfolio.example.com/projects/roas"

config:
 engines: [campus, hierarchical]
 layouts: [realistic]
 output_filename: "ROAS_Network"

nodes:
 # Gateway Router
 - id: Router_Gateway
  label: "Router1 (Gateway)"
  icon: "Cisco/Routers/router"
  level: 1
  running_config: |
   interface Gi0/0.10
    encapsulation dot1Q 10
    ip address 192.168.10.1 255.255.255.0

 # L2 Switch
 - id: Core_Switch
  label: "Core Switch (L2)"
  icon: "Cisco/Switches/layer_3_switch"
  level: 2
  parent: "Router_Gateway"

 # Endpoints
 - id: HR_PC
  label: "HR Workstation"
  icon: "Cisco/ComputerAndPeripherals/pc"
  level: 3
  parent: "Core_Switch"

 - id: Sales_PC
  label: "Sales Workstation"
  icon: "Cisco/ComputerAndPeripherals/pc"
  level: 3
  parent: "Core_Switch"

links:
 # Trunk uplink
 - from: "Router_Gateway"
  to: "Core_Switch"
  cable: "trunk"
  from_port: "Gi0/0"
  to_port: "Et3/0"
  layer2:
   mode: trunk
   native_vlan: 99
   allowed_vlans: "10,20,30"

 # Access ports
 - from: "Core_Switch"
  to: "HR_PC"
  cable: "cat6"
  from_port: "Fa0/1"
  layer2:
   mode: access
   vlan: 10

 - from: "Core_Switch"
  to: "Sales_PC"
  cable: "cat6"
  from_port: "Fa0/2"
  layer2:
   mode: access
   vlan: 20

groups:
 - name: "HR Dept (VLAN 10)"
  nodes: ["HR_PC"]
  color: "rgba(30, 144, 255, 0.15)"
  style: dashed

 - name: "Sales Dept (VLAN 20)"
  nodes: ["Sales_PC"]
  color: "rgba(46, 139, 87, 0.15)"
  style: dashed

annotations:
 - text: "ROAS Gateway\nSub-ifs: .10, .20, .30"
  target: "Router_Gateway"
  offset_y: -80
```

### Example 2: Enterprise Spine-Leaf with VXLAN

```yaml
title: "Datacenter Spine-Leaf Fabric"
description: "Modern spine-leaf with VXLAN/EVPN overlay"
project_url: "#"

config:
 engines: [campus, hierarchical]
 layouts: [realistic]
 output_filename: "dc_fabric"

nodes:
 # Spines
 - id: SPINE1
  label: "Spine-1"
  icon: Cisco/Switches/layer_3_switch
  x: -150
  y: -200
  level: 1

 - id: SPINE2
  label: "Spine-2"
  icon: Cisco/Switches/layer_3_switch
  x: 150
  y: -200
  level: 1

 # Leafs
 - id: LEAF1
  label: "Leaf-1"
  icon: Cisco/Switches/layer_3_switch
  x: -300
  y: 100
  level: 2

 - id: LEAF2
  label: "Leaf-2"
  icon: Cisco/Switches/layer_3_switch
  x: -100
  y: 100
  level: 2

 - id: LEAF3
  label: "Leaf-3"
  icon: Cisco/Switches/layer_3_switch
  x: 100
  y: 100
  level: 2

 - id: LEAF4
  label: "Leaf-4"
  icon: Cisco/Switches/layer_3_switch
  x: 300
  y: 100
  level: 2

links:
 # Full mesh underlay (Spine to all Leafs)
 - { from: SPINE1, to: LEAF1, cable: fiber }
 - { from: SPINE1, to: LEAF2, cable: fiber }
 - { from: SPINE1, to: LEAF3, cable: fiber }
 - { from: SPINE1, to: LEAF4, cable: fiber }
 - { from: SPINE2, to: LEAF1, cable: fiber }
 - { from: SPINE2, to: LEAF2, cable: fiber }
 - { from: SPINE2, to: LEAF3, cable: fiber }
 - { from: SPINE2, to: LEAF4, cable: fiber }

 # VXLAN overlay (visual representation)
 - from: LEAF1
  to: LEAF4
  cable: tunnel
  notes: "VXLAN VNI 10000"

groups:
 - name: "Spine Layer"
  nodes: ["SPINE1", "SPINE2"]
  color: "rgba(239, 68, 68, 0.08)"

 - name: "Leaf Layer"
  nodes: ["LEAF1", "LEAF2", "LEAF3", "LEAF4"]
  color: "rgba(16, 185, 129, 0.08)"

annotations:
 - text: "SPINE-LEAF FABRIC"
  x: 0
  y: -350
  style: h1

 - text: |
   100G Underlay
   VXLAN/EVPN Overlay
   BGP Routing
  x: 450
  y: -150
  style: note
```

## Troubleshooting

For detailed troubleshooting steps, common errors, and debug tips, please refer to the [Troubleshooting Guide](../guides/troubleshooting.md).

## Quick Reference Card

```yaml
# MINIMAL TOPOLOGY TEMPLATE

title: "Network Name"
description: "Description"
project_url: "https://example.com/project" # Shows back button

config:
 engines: [campus, hierarchical, city, radial, flow]
 layouts: [realistic, blueprint]
 output_filename: "my_network"

nodes:
 - id: DEVICE_ID # Unique, UPPERCASE
  label: "Display Name"
  icon: Cisco/Category/icon
  x: 0 # Position (campus/city layout)
  y: 0
  level: 1 # Hierarchy (1=top)
  parent: PARENT_ID # For hierarchical layout
  role: router # core|distribution|access|router|switch|firewall|server|host|ap|phone
  running_config: | # Optional IOS config
   hostname Device
   !

links:
 - from: SOURCE_ID
  to: DEST_ID
  cable: ethernet # ethernet|fiber|trunk|tunnel|wireless|serial|console|...
  from_port: "Gi0/1"
  to_port: "Gi0/1"
  from_ip: "10.0.0.1"
  to_ip: "10.0.0.2"
  notes: "Primary uplink" # Shown in tooltip
  layer2:
   mode: trunk
   native_vlan: 99
   allowed_vlans: "10,20,30"
  routing:
   protocol: ospf
   area: 0

groups:
 - name: "Group Name"
  nodes: ["ID1", "ID2"]
  color: "rgba(99, 102, 241, 0.08)"
  style: dashed
  # shape: rect|hull|ellipse (auto-selected if omitted)

annotations:
 - text: "TITLE"
  x: 0
  y: -300
  style: h1
 - text: "Note attached to node"
  target: "DEVICE_ID"
  position: top # top|bottom|left|right|top-left|top-right|center
  style: note
```

### Cable Quick Reference

| Cable      | Use Case            |
| :--------- | :------------------ |
| `ethernet` | Standard copper LAN |
| `cat6`     | CAT6 copper (alias) |
| `fiber`    | Multi-mode fiber    |
| `smf`      | Single-mode fiber   |
| `trunk`    | LACP/EtherChannel   |
| `tunnel`   | VPN/VXLAN overlay   |
| `wireless` | WiFi/Radio          |
| `console`  | Management/OOB      |
| `serial`   | Legacy WAN (T1/E1)  |
| `power`    | PDU/Electrical      |

## Version History

| Version | Date       | Changes                                                                                                   |
| :------ | :--------- | :-------------------------------------------------------------------------------------------------------- |
| 2.1     | 2026-02-06 | Added complete `role` values, `position` values, `hull` shape, `type` field, and clarified auto-behaviors |
| 2.0     | 2026-02-05 | Added L2/L3/STP config, project_url, examples                                                             |
| 1.5     | 2026-02-03 | Added cable catalog, LACP auto-detection                                                                  |
| 1.0     | 2026-01-15 | Initial release                                                                                           |
