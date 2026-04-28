import os
import json
import yaml
import shutil
from jinja2 import Environment, FileSystemLoader

# Internal imports
from engine.utils.icons import get_icon_data
from engine.layouts.city import apply_city_layout
from engine.layouts.radial import apply_radial_layout
from engine.layouts.campus import apply_campus_layout
from engine.layouts.hierarchical import apply_hierarchical_layout, apply_flow_layout
from typing import Dict, Any, List, Optional
from engine.core.groups import GroupProcessor
from engine.ingestors.factory import IngestorFactory

# Constants for Animation Styles
ANIM_NONE = "none"
ANIM_PULSE = "pulse"      # Light traveling through fiber
ANIM_FLOW = "flow"        # Continuous dash-offset movement
ANIM_WAVE = "wave"        # For wireless/radio signals
ANIM_STUTTER = "stutter"  # For unstable/serial links

# ═══════════════════════════════════════════════════════════════════════════
# ROLE CATALOG - Semantic, Role-Based Fallback Styling
# ═══════════════════════════════════════════════════════════════════════════
# If a node has no custom icon, its style is determined by its 'role'.
# This is more flexible than relying on a numeric 'level'.
# ═══════════════════════════════════════════════════════════════════════════
ROLE_CATALOG = {
    # Hierarchical Roles (legacy level-based mapping)
    "core":           { "color": "#3b82f6", "shape": "diamond" },
    "distribution":   { "color": "#f472b6", "shape": "diamond" },
    "access":         { "color": "#94a3b8", "shape": "dot" },

    # Device-Specific Roles
    "router":         { "color": "#a855f7", "shape": "square" },
    "switch":         { "color": "#94a3b8", "shape": "dot" },
    "firewall":       { "color": "#ef4444", "shape": "triangle" },
    "server":         { "color": "#14b8a6", "shape": "box" },
    "host":           { "color": "#84cc16", "shape": "ellipse" },
    "desktop":        { "color": "#84cc16", "shape": "ellipse" },
    "laptop":         { "color": "#84cc16", "shape": "ellipse" },
    "phone":          { "color": "#6366f1", "shape": "circle" },
    "ap":             { "color": "#f59e0b", "shape": "star" },

    # Default fallback for unknown roles
    "default":        { "color": "#64748b", "shape": "dot" }
}


# ═══════════════════════════════════════════════════════════════════════════
# CABLE CATALOG - Visual Material Definitions
# ═══════════════════════════════════════════════════════════════════════════
CABLE_CATALOG = {
    "ethernet": {
        "color": "#94a3b8", "width": 2, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-ethernet"
    },
    "fiber": {
        "color": "#22d3ee", "width": 2, "dashes": False, "smooth": False, "glow": True, "style_class": "cable-fiber"
    },
    "smf": {
        "color": "#facc15", "width": 1.5, "dashes": False, "smooth": False, "glow": True, "style_class": "cable-smf"
    },
    "trunk": {
        "color": "#8b5cf6", "width": 4, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-trunk", "parallel": True
    },
    "serial": {
        "color": "#1e40af", "width": 2, "dashes": [10, 5, 2, 5], "smooth": False, "glow": False, "style_class": "cable-serial"
    },
    "console": {
        "color": "#06b6d4", "width": 1.5, "dashes": [2, 4], "smooth": False, "glow": False, "style_class": "cable-console"
    },
    "wireless": {
        "color": "rgba(168, 85, 247, 0.4)", "width": 3, "dashes": [2, 12], "smooth": False, "glow": False, "style_class": "cable-wireless"
    },
    "tunnel": {
        "color": "rgba(99, 102, 241, 0.25)", "width": 10, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-tunnel"
    },
    "power": {
        "color": "#fcd34d", "width": 5, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-power"
    },
    "crossover": {
        "color": "#ef4444", "width": 2.5, "dashes": [8, 8], "smooth": False, "glow": False, "style_class": "cable-crossover"
    },
    "coaxial": {
        "color": "#6b7280", "width": 3.5, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-coaxial"
    },
    "dac": {
        "color": "#f97316", "width": 3, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-dac"
    },
    "submarine": {
        "color": "#1e3a8a", "width": 8, "dashes": False, "smooth": False, "glow": False, "style_class": "cable-submarine"
    }
}


CABLE_ALIASES = {
    "copper": "ethernet", "utp": "ethernet", "cat5": "ethernet", "cat5e": "ethernet",
    "cat6": "ethernet", "cat6a": "ethernet", "cat7": "ethernet", "cat8": "ethernet",
    "rj45": "ethernet", "mmf": "fiber", "om3": "fiber", "om4": "fiber", "os1": "smf",
    "os2": "smf", "singlemode": "smf", "multimode": "fiber", "lacp": "trunk",
    "etherchannel": "trunk", "bond": "trunk", "aggregate": "trunk",
    "portchannel": "trunk", "po": "trunk", "rollover": "console", "mgmt": "console",
    "oob": "console", "wifi": "wireless", "radio": "wireless", "microwave": "wireless",
    "satellite": "wireless", "vpn": "tunnel", "gre": "tunnel", "ipsec": "tunnel",
    "vxlan": "tunnel", "overlay": "tunnel", "pdu": "power", "ac": "power",
    "dc": "power", "wan": "serial", "t1": "serial", "e1": "serial", "coax": "coaxial",
    "docsis": "coaxial", "twinax": "dac", "dac": "dac", "subsea": "submarine"
}



class NetworkCompiler:
    def __init__(self, title="Network Topology"):
        self.title = title
        self.description = ""
        self.project_url = "#"
        self.nodes = []
        self.edges = []
        self.node_ids = set()
        self.raw_groups = []
        self.annotations = []
        self.groups_data = {}
        self.config = {
            "engines": ["campus"], # Default if nothing specified
            "layouts": ["blueprint"] # Default if nothing specified
        }

    def get_cable_catalog(self):
        """Returns the main cable catalog."""
        return CABLE_CATALOG

    def load_source(self, path):
        """
        Smart loader that detects file type and uses the appropriate Ingestor.
        Supports: .yaml (Native), .drawio/.svg (Draw.io), .unl (Eve-NG), .yaml (CML)
        """
        # Try generic ingestors first
        try:
            ingestor = IngestorFactory.get_ingestor(path)
            print(f"🔌 Using ingestor: {ingestor.__class__.__name__} for {os.path.basename(path)}")
            plan = ingestor.ingest(path)
            self.load_from_dict(plan, source_path=path)
        except ValueError:
            # Fallback to standard YAML loader if no specific ingestor found
            # This maintains backward compatibility for standard "plan.yaml" files
            if path.endswith('.yaml') or path.endswith('.yml'):
                self.load_yaml(path)
            else:
                raise ValueError(f"No supported ingestor for file: {path}")

    def load_yaml(self, path):
        with open(path, 'r') as f:
            plan = yaml.safe_load(f)
        self.load_from_dict(plan, source_path=path)

    def load_from_dict(self, plan: Dict[str, Any], source_path: str = None):

            
        self.title = plan.get('title', 'Network Diagram')
        self.description = plan.get('description', '')
        self.project_url = plan.get('project_url', '#')
        
        # Load Config if present
        if 'config' in plan:
            cfg = plan['config']
            for key in ['engines', 'layouts', 'export_path', 'output_folder', 'output_filename']:
                if cfg.get(key):
                    self.config[key] = cfg[key]

        self.raw_groups = plan.get('groups', [])
        self.annotations = plan.get('annotations', [])
        
        for n in plan.get('nodes', []):
            if n['id'] in self.node_ids: continue
            self.node_ids.add(n['id'])
            
            # Support both 'icon' (with full path like Cisco/Switches/router) and 'type' (legacy)
            icon_path = n.get('icon') or n.get('type', 'router')
            icon = get_icon_data(icon_path)
            
            node = {
                "id": n['id'],
                "label": n.get('label', n['id']),
                "level": n.get('level', 1),
                "parent": n.get('parent'),
                "type": n.get('type', 'router'),
                "role": n.get('role', ''),
                "vendor": n.get('vendor', ''),
                "model": n.get('model', ''),
                "purpose": n.get('purpose', ''),
                "design_notes": n.get('design_notes', ''),
                "running_config": n.get('running_config', '')
            }
            if icon:
                node["shape"] = "image"
                node["image"] = icon
                node["size"] = 35  
            else:
                # NEW: Use Role-Based Styling first
                node_role = n.get('role', 'default').lower()
                
                # Find the most specific match (e.g., a role of "core-switch" will match "core")
                role_style = ROLE_CATALOG.get("default")
                for key, style in ROLE_CATALOG.items():
                    if key in node_role:
                        role_style = style
                        break # Take the first match
                
                if role_style and role_style != ROLE_CATALOG.get("default"):
                    node.update(role_style)
                else:
                    # Fallback to level-based styling for backward compatibility or when no role matches
                    lvl = n.get('level', 3) # Default to a neutral level (dot)
                    node["color"] = "#3b82f6" if lvl == 1 else "#f472b6" if lvl == 2 else "#94a3b8"
                    node["shape"] = "dot" if lvl > 2 else "diamond"
            
            self.nodes.append(node)

        def get_cable_style(cable_type):
            c = (cable_type or "ethernet").lower().strip()
            cable_key = CABLE_ALIASES.get(c, c)
            style = CABLE_CATALOG.get(cable_key, CABLE_CATALOG["ethernet"]).copy()
            style["label"] = ""
            return style
            
            # Resolve alias to catalog entry
            cable_key = CABLE_ALIASES.get(c, c)
            
            # Get style from catalog, default to ethernet if unknown
            style = CABLE_CATALOG.get(cable_key, CABLE_CATALOG["ethernet"]).copy()
            
            # Add the label field for compatibility
            style["label"] = ""
            
            return style

        # Aggregate links (Logical Bundling)
        logical_links = {}

        for l in plan.get('links', []):
            pair = tuple(sorted([l['from'], l['to']]))
            po_from = l.get('from_port', '').split('(')[0] if '(' in l.get('from_port', '') else None
            po_to = l.get('to_port', '').split('(')[0] if '(' in l.get('to_port', '') else None
            bundle_id = po_from if (po_from and po_from == po_to) else None
            
            link_key = (pair, bundle_id) if bundle_id else (pair, f"p-{l.get('from_port')}-{l.get('to_port')}")
            
            if link_key not in logical_links:
                # Cable type determines ALL visual properties - no style overrides allowed
                cable_type = l.get('cable', 'ethernet')
                
                logical_links[link_key] = {
                    "from": l['from'],
                    "to": l['to'],
                    "bundle": bundle_id,
                    "cable": cable_type,
                    "layer2": l.get('layer2', {}), # Capture L2 config (VLANs, modes)
                    "routing": l.get('routing', {}), # Capture L3 config (OSPF, etc)
                    "stp": l.get('stp', {}), # Capture STP state
                    "relation": l.get('relation', '') or l.get('mode', ''), # Support both keys
                    "width_override": l.get('width'),
                    "members": [],
                    "from_ip": l.get('from_ip'), # Add from_ip
                    "to_ip": l.get('to_ip'),       # Add to_ip
                    "smooth": l.get('smooth', True),
                    "wireless": l.get('wireless', False) or l.get('cable') in ['wifi', 'wireless', 'sat', 'microwave']
                }
            
            if l.get('from_port') or l.get('to_port'):
                logical_links[link_key]["members"].append({
                    "from": l.get('from_port', ''),
                    "to": l.get('to_port', ''),
                    "from_ip": l.get('from_ip'),  # Capture Interface IPs
                    "to_ip": l.get('to_ip')
                })

        for key, data in logical_links.items():
            # Get style from Cable Catalog (cable type is the ONLY input)
            c_style = get_cable_style(data["cable"])
            
            # Determine if this should render as parallel lines (LACP/EtherChannel)
            is_bundle = bool(data["bundle"])
            has_parallel_style = c_style.get("parallel", False)
            should_render_parallel = is_bundle or has_parallel_style
            
            edge = {
                "from": data["from"],
                "to": data["to"],
                "color": c_style["color"],
                "width": 4 if is_bundle else c_style["width"],
                "smooth": c_style["smooth"],  # Cable type determines smoothing
                "dashes": c_style["dashes"],  # Cable type determines dash pattern
                "cable_type": data["cable"],  # Pass cable type for CSS class
                "glow": c_style.get("glow", False),  # Pass glow property for SVG filter
                "parallel": should_render_parallel,  # Render as dual parallel lines
                "member_count": len(data["members"]) if is_bundle else 1  # Number of physical links
            }
            
            if data["bundle"]:
                edge["bundle_id"] = data["bundle"]
                edge["font"] = {"size": 0} 
                edge["from_port"] = data["bundle"]
                edge["to_port"] = data["bundle"]
            elif data["members"]:
                m = data["members"][0]
                edge["from_port"] = m.get("from", "")
                edge["to_port"] = m.get("to", "")

            title_parts = []
            
            # === HEADER ===
            if data["bundle"]:
                title_parts.append(f"ETHERCHANNEL: {data['bundle']}")
                title_parts.append(f"Type: {data['cable'].upper()} Bundle")
                title_parts.append(f"Members: {len(data['members'])}")
            else:
                title_parts.append(f"LINK: {data['cable'].upper()}")

            title_parts.append("-" * 25)

            # === ROUTING INFO ===
            rt = data.get("routing")
            if rt:
                if rt.get("protocol"):
                    proto_str = f"Routing: {rt['protocol'].upper()}"
                    if rt.get("area") is not None:
                        proto_str += f" Area {rt['area']}"
                    if rt.get("as_number"):
                        proto_str += f" AS {rt['as_number']}"
                    title_parts.append(proto_str)
                if rt.get("cost"):
                    title_parts.append(f"Cost: {rt['cost']}")
                if rt.get("network_type"):
                    title_parts.append(f"Type: {rt['network_type']}")
                title_parts.append("-" * 25)

            # === STP INFO ===
            stp = data.get("stp")
            if stp:
                if stp.get("vlan"):
                    title_parts.append(f"STP Instance: VLAN {stp['vlan']}")
                
                # Format: Root (Fwd) -> Desg (Fwd)
                from_role = stp.get('from_role', '?')
                from_state = stp.get('from_state', '')
                to_role = stp.get('to_role', '?')
                to_state = stp.get('to_state', '')
                
                left = f"{from_role}" + (f" ({from_state})" if from_state else "")
                right = f"{to_role}" + (f" ({to_state})" if to_state else "")
                title_parts.append(f"STP: {left} → {right}")
                title_parts.append("-" * 25)

            # === LAYER 2 INFO (VLANs) ===
            l2 = data.get("layer2")
            if l2:
                if l2.get("mode"):
                    title_parts.append(f"Mode: {l2['mode'].upper()}")
                if l2.get("vlan"):
                    title_parts.append(f"VLAN: {l2['vlan']}")
                if l2.get("native_vlan"):
                    title_parts.append(f"Native VLAN: {l2['native_vlan']}")
                if l2.get("allowed_vlans"):
                    title_parts.append(f"Allowed: {l2['allowed_vlans']}")
                title_parts.append("-" * 25)

            # === PHYSICAL MEMBERS / IPs ===
            if data["bundle"]:
                for m in data["members"]:
                    line = f"• {m['from']} ↔ {m['to']}"
                    if m.get('from_ip') or m.get('to_ip'):
                         line += f"\n  IP: {m.get('from_ip', 'N/A')} ↔ {m.get('to_ip', 'N/A')}"
                    title_parts.append(line)
            elif data["members"]:
                 # Single link
                 m = data["members"][0]
                 title_parts.append(f"Port: {m['from']} ↔ {m['to']}")
                 if m.get('from_ip') or m.get('to_ip'):
                     title_parts.append(f"IP:   {m.get('from_ip', '---')} ↔ {m.get('to_ip', '---')}")
                 cable_desc = f"{data['cable'].upper()}"
                 if data.get('category'): cable_desc += f" ({data['category'].upper()})"
                 title_parts.append(f"Cable: {cable_desc}")
                 if data["members"]:
                    m = data["members"][0]
                    from_port_full = m.get("from", "N/A")
                    to_port_full = m.get("to", "N/A")
                    
                    if data.get('from_ip'): from_port_full += f" ({data['from_ip']})"
                    if data.get('to_ip'): to_port_full += f" ({data['to_ip']})"
                    
                    title_parts.append(f"Link: {from_port_full} -> {to_port_full}")
            
            edge["title"] = "\n".join(title_parts)
            self.edges.append(edge)

        # Orphan Detection & Connectivity Analysis
        connected_ids = set()
        parent_ids = set()
        for edge in self.edges:
            connected_ids.add(edge['from'])
            connected_ids.add(edge['to'])
        
        for node in self.nodes:
            if node.get('parent'):
                parent_ids.add(node['parent'])

        for node in self.nodes:
            # A node is connected if it has a parent, has children, or has at least one link
            has_relations = node.get('parent') or node['id'] in connected_ids or node['id'] in parent_ids
            node['is_orphan'] = not has_relations
            if node['is_orphan']:
                print(f"⚠️ Warning: Node '{node['id']}' is an orphan (no parent, no children, no links)")

        # Apply Layouts (Passing edges for smarter grouping)
        apply_city_layout(self.nodes, edges=self.edges)
        apply_radial_layout(self.nodes, edges=self.edges)
        apply_campus_layout(self.nodes, edges=self.edges)
        apply_hierarchical_layout(self.nodes, edges=self.edges)
        apply_flow_layout(self.nodes, edges=self.edges)
        
        self.groups_data = self.process_groups()
        
        # Auto-Backup
        if source_path:
            self.backup_source_file(source_path)

    def process_groups(self):
        """Delegates group processing to the dedicated GroupProcessor."""
        return GroupProcessor.process_all(self.nodes, self.raw_groups)

    def backup_source_file(self, source_path):
        """Backs up the source YAML file."""
        target_name = self.config.get('output_filename', 'plan')
        if target_name.endswith('.html'): target_name = target_name.replace('.html', '')
        if target_name.endswith('.yaml'): target_name = target_name.replace('.yaml', '')
        
        backup_dir = "backups"
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, f"{target_name}.yaml")
        
        try:
            shutil.copy2(source_path, backup_path)
            print(f"💾 Source YAML backed up to: {backup_path}")
        except Exception as e:
            print(f"⚠️ Failed to backup YAML: {e}")

    def build(self, output_path=None):
        # Use templates directory as root for consistent include paths
        env = Environment(loader=FileSystemLoader('templates'))
        template = env.get_template('diagram.html')
        
        html = template.render(
            title=self.title,
            description=self.description,
            project_url=self.project_url,
            nodes=self.nodes,
            edges=self.edges,
            config=self.config,
            groups=self.groups_data,
            annotations=self.annotations
        )
        
        if not output_path:
            # Default to public/ for Astro projects
            BASE_DIR = self.config.get('output_folder') or "../../public/projects/network-map"
             
            if self.config.get('output_filename'):
                fname = self.config.get('output_filename')
                if not fname.endswith('.html'): fname += '.html'
                output_path = os.path.join(BASE_DIR, fname)
            elif self.config.get('export_path'):
                output_path = self.config.get('export_path')
            else:
                output_path = os.path.join(BASE_DIR, "index.html")
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(html)
        print(f"✅ Master Diagram built: {output_path}")
