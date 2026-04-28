import yaml
import sys
import os
import argparse
from typing import Dict, List, Set, Any, Optional

class SchemaValidator:
    def __init__(self, schema_path: str):
        self.schema_path = schema_path
        self.data = None
        self.errors = []
        self.warnings = []
        
        # Caches for referential integrity
        self.site_ids: Set[str] = set()
        self.node_ids: Set[str] = set()
        self.interface_ids: Set[str] = set() # Format: "node_id:interface_id"
        self.circuit_ids: Set[str] = set()
        self.group_ids: Set[str] = set()

    def log_error(self, message: str, context: str = ""):
        self.errors.append(f"[ERROR] {context}: {message}" if context else f"[ERROR] {message}")

    def log_warning(self, message: str, context: str = ""):
        self.warnings.append(f"[WARN]  {context}: {message}" if context else f"[WARN]  {message}")

    def load(self) -> bool:
        try:
            with open(self.schema_path, 'r') as f:
                self.data = yaml.safe_load(f)
            return True
        except Exception as e:
            self.log_error(f"Failed to load YAML: {e}")
            return False

    def validate_root_structure(self):
        if not self.data: return
        required_sections = ['metadata', 'nodes', 'links']
        
        for section in required_sections:
            if section not in self.data:
                self.log_error(f"Missing required root section: '{section}'")

    def validate_metadata(self):
        meta = self.data.get('metadata', {})
        if not meta: return
        
        required = ['schema_version', 'title', 'version', 'status']
        for field in required:
            if field not in meta:
                self.log_error(f"Metadata missing required field: '{field}'", "Metadata")
                
        if str(meta.get('schema_version', '1.0')) != '2.0':
            self.log_warning(f"Schema version is {meta.get('schema_version')}, expected 2.0", "Metadata")

    def validate_facilities(self):
        facilities = self.data.get('facilities', {})
        if not facilities: return

        sites = facilities.get('sites', [])
        for site in sites:
            sid = site.get('id')
            if not sid:
                self.log_error("Site missing 'id'", "Facilities")
                continue
            
            if sid in self.site_ids:
                self.log_error(f"Duplicate site ID: {sid}", "Facilities")
            self.site_ids.add(sid)
            
            if 'name' not in site:
                self.log_warning(f"Site {sid} missing 'name'", "Facilities")

    def validate_nodes(self):
        nodes = self.data.get('nodes', [])
        if not nodes:
            self.log_error("No nodes defined", "Nodes")
            return

        for i, node in enumerate(nodes):
            nid = node.get('id')
            if not nid:
                self.log_error(f"Node at index {i} missing 'id'", "Nodes")
                continue
                
            if nid in self.node_ids:
                self.log_error(f"Duplicate node ID: {nid}", "Nodes")
            self.node_ids.add(nid)

            required = ['role', 'hostname']
            for field in required:
                if field not in node:
                    self.log_error(f"Node '{nid}' missing '{field}'", "Nodes")

            if 'physical' in node:
                phys = node['physical']
                if 'rack_location' in phys:
                    loc = phys['rack_location']
                    site_ref = loc.get('site_id')
                    if site_ref and site_ref not in self.site_ids and self.site_ids:
                        self.log_error(f"Node '{nid}' references unknown site '{site_ref}'", "Nodes")

            interfaces = node.get('interfaces', [])
            for iface in interfaces:
                ifid = iface.get('id')
                if not ifid:
                    self.log_error(f"Node '{nid}' has interface without ID", "Nodes")
                    continue
                self.interface_ids.add(f"{nid}:{ifid}")

    def validate_wan_circuits(self):
        circuits = self.data.get('wan_circuits', [])
        for ckt in circuits:
            cid = ckt.get('id')
            if not cid:
                self.log_error("Circuit missing ID", "WAN")
                continue
            self.circuit_ids.add(cid)
            
            endpoints = ckt.get('endpoints', {})
            for side in ['a_side', 'z_side']:
                if side in endpoints:
                    ep = endpoints[side]
                    node_ref = ep.get('device_id')
                    if node_ref and node_ref not in self.node_ids:
                        self.log_error(f"Circuit '{cid}' {side} references unknown node '{node_ref}'", "WAN")

    def validate_links(self):
        links = self.data.get('links', [])
        for i, link in enumerate(links):
            lid = link.get('id', f"link_{i}")
            
            src = link.get('source', {})
            tgt = link.get('target', {})
            ltype = link.get('type')
            
            if ltype == 'wan_circuit':
                ref = link.get('circuit_ref')
                if not ref:
                     self.log_error(f"Link '{lid}' (wan_circuit) missing 'circuit_ref'", "Links")
                elif ref not in self.circuit_ids:
                    self.log_error(f"Link '{lid}' references unknown circuit '{ref}'", "Links")
                continue

            if not src or not tgt:
                self.log_error(f"Link '{lid}' missing source or target", "Links")
                continue

            src_node = src.get('node_id')
            if src_node and src_node not in self.node_ids:
                self.log_error(f"Link '{lid}' source node '{src_node}' not found", "Links")
            
            src_iface = src.get('interface_id')
            if src_node and src_iface:
                if f"{src_node}:{src_iface}" not in self.interface_ids:
                   self.log_warning(f"Link '{lid}' source interface '{src_iface}' not explicitly defined in node '{src_node}'", "Links")

            tgt_node = tgt.get('node_id')
            if tgt_node and tgt_node not in self.node_ids:
                self.log_error(f"Link '{lid}' target node '{tgt_node}' not found", "Links")

            tgt_iface = tgt.get('interface_id')
            if tgt_node and tgt_iface:
                if f"{tgt_node}:{tgt_iface}" not in self.interface_ids:
                   self.log_warning(f"Link '{lid}' target interface '{tgt_iface}' not explicitly defined in node '{tgt_node}'", "Links")

    def validate_groups(self):
        # Support both root-level groups (current) and decoration.groups (legacy/future)
        groups = self.data.get('groups', [])
        if not groups:
            deco = self.data.get('decoration', {})
            groups = deco.get('groups', [])
        
        valid_shapes = ['rect', 'hull', 'cloud', 'circle']
        
        for grp in groups:
            gid = grp.get('id', grp.get('name', 'unnamed'))
            
            # recursive shape check
            shape = grp.get('shape')
            if shape and shape not in valid_shapes:
                self.log_warning(f"Group '{gid}' has unknown shape '{shape}' (expected {valid_shapes})", "Groups")

            members = grp.get('nodes', []) # key is 'nodes' in plan.yaml
            for m in members:
                if m not in self.node_ids:
                    self.log_error(f"Group '{gid}' references unknown member '{m}'", "Groups")

    def validate_annotations(self):
        annotations = self.data.get('annotations', [])
        valid_positions = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']
        
        for i, ann in enumerate(annotations):
            # Check for Target + Position logic
            target = ann.get('target')
            position = ann.get('position')
            
            if target:
                if target not in self.node_ids:
                    self.log_error(f"Annotation {i} references unknown target '{target}'", "Annotations")
                
                if position and position not in valid_positions:
                    self.log_warning(f"Annotation {i} has unknown position '{position}'", "Annotations")
            
            # Check for legacy X/Y if no target is present (unless it's purely descriptive/global)
            if not target and 'x' not in ann and 'y' not in ann:
                 # It might be valid if it's just a general note, but usually needs coords. 
                 # We'll allow it but maybe warn if neither exists?
                 pass

    def run(self) -> bool:
        print(f"🔍 Validating {self.schema_path}...")
        
        if not self.load():
            return False

        self.validate_root_structure()
        self.validate_metadata()
        self.validate_facilities()
        self.validate_nodes()
        self.validate_wan_circuits()
        self.validate_links()
        self.validate_links()
        self.validate_groups()
        self.validate_annotations()

        print("\n" + "="*40)
        print("VALIDATION REPORT")
        print("="*40)
        
        if self.errors:
            print(f"\n❌ FOUND {len(self.errors)} ERRORS:")
            for e in self.errors:
                print(f"  {e}")
        else:
            print("\n✅ NO CRITICAL ERRORS FOUND")

        if self.warnings:
            print(f"\n⚠️  FOUND {len(self.warnings)} WARNINGS:")
            for w in self.warnings:
                print(f"  {w}")
        
        return len(self.errors) == 0
