import os
import re
import zlib
import base64
import json
import xml.etree.ElementTree as ET
import html
from urllib.parse import unquote
from typing import Dict, Any, List, Optional
from engine.ingestors.base import BaseIngestor

class DrawIOIngestor(BaseIngestor):
    """
    Ingestor for Draw.io SVG files with embedded XML data.
    """

    # Simple mapping from Draw.io shapes/styles to internal roles/icons
    # This can be expanded or moved to a configuration file later
    STYLE_MAP = {
        "router": "router",
        "switch": "switch",
        "firewall": "firewall",
        "server": "server",
        "pc": "host",
        "laptop": "laptop",
        "phone": "phone",
        "cloud": "cloud",
        "storage": "storage"
    }

    @classmethod
    def can_handle(cls, file_path: str) -> bool:
        return file_path.lower().endswith('.svg') or file_path.lower().endswith('.drawio')

    def ingest(self, file_path: str) -> Dict[str, Any]:
        """
        Parses a Draw.io SVG/XML file and converts it to the topology format.
        """
        raw_xml = self._extract_xml_from_file(file_path)
        if not raw_xml:
            raise ValueError(f"Could not extract Draw.io data from {file_path}")

        return self._parse_mxgraph(raw_xml)

    def _extract_xml_from_file(self, file_path: str) -> Optional[str]:
        """
        Reads the file and attempts to extract the underlying mxGraphModel XML.
        Handles:
        1. Plain .drawio (XML) files
        2. SVG files with embedded compressed content
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Case 1: Direct XML (e.g. .drawio or .xml saved uncompressed)
        if '<mxGraphModel' in content or '<mxfile' in content:
            # If it's a full mxfile, we might need to extract the diagram part
            if '<mxfile' in content:
                try:
                    root = ET.fromstring(content)
                    # Handle multiple pages? Just take the first diagram for now.
                    diagram = root.find('diagram')
                    if diagram is not None:
                        return self._decode_diagram_data(diagram.text)
                except ET.ParseError:
                    pass
            
            # If it's already mxGraphModel or close enough
            if '<mxGraphModel' in content:
                return content

        # Case 2: SVG with embedded content attribute
        # <svg ... content="...">
        content_match = re.search(r'content="([^"]+)"', content)
        if content_match:
            return self._decode_diagram_data(content_match.group(1))
            
        # Case 3: Warnings embedded as comments? (older formats)
        
        return None

    def _decode_diagram_data(self, raw_data: str) -> str:
        """
        Decodes the Draw.io compressed data string.
        Flow: unquote -> base64 decode -> inflate (zlib -15) -> url decode (sometimes)
        """
        if not raw_data:
            return ""

        # Check if it's already uncompressed XML just escaped/quoted
        # 1. Try URL unquote
        try:
            unquoted = unquote(raw_data)
            if unquoted.strip().startswith('<mxfile') or unquoted.strip().startswith('<mxGraphModel'):
                return unquoted
        except:
            pass
            
        # 2. Try HTML unescape
        try:
            unescaped = html.unescape(raw_data)
            if unescaped.strip().startswith('<mxfile') or unescaped.strip().startswith('<mxGraphModel'):
                return unescaped
        except:
            pass
            
        try:
            # Clean up whitespace
            raw_data = raw_data.strip()
            
            # 3. Base64 Decode
            compressed = base64.b64decode(raw_data)
            
            # 4. Deflate (raw algorithm, no header, wbits=-15)
            # Draw.io usually uses raw deflate
            xml_str = zlib.decompress(compressed, -15).decode('utf-8')
            
            # 5. URL Decode key characters
            xml_str = unquote(xml_str)
            
            return xml_str
        except Exception as e:
            # print(f"Warning: Failed to decompress Draw.io data: {e}")
            # It might be plain text or different encoding, return raw if simple decode fails
            # But try to unescape it one last time just in case it was a direct failure
            try:
                return html.unescape(raw_data)
            except:
                return raw_data

    def _parse_mxgraph(self, xml_content: str) -> Dict[str, Any]:
        """
        Parses the mxGraphModel XML into nodes and links.
        """
        topology = {
            "nodes": [],
            "links": [],
            "groups": [],
            "meta": {"source": "drawio"}
        }
        
        try:
            root = ET.fromstring(xml_content)
            
            # Handle <mxfile> container
            if root.tag == 'mxfile':
                # Try to find a diagram node
                diagram = root.find('diagram')
                if diagram is not None:
                    # If diagram has text content, it might be compressed
                    if diagram.text and diagram.text.strip():
                        # Recursively decode the inner data
                        inner_xml = self._decode_diagram_data(diagram.text)
                        # Recursively call parse (or just re-root)
                        return self._parse_mxgraph(inner_xml)
                
                # If no diagram or empty, look for mxGraphModel directly under root?
                # Usually it's inside diagram. Let's try finding it anywhere.
            
            # Locate mxGraphModel
            if root.tag == 'mxGraphModel':
                model = root
            else:
                model = root.find('.//mxGraphModel')
            
            if model is None:
                # Last ditch effort: maybe the content IS the model but missing tag?
                # Unlikely. 
                pass

            if model is None:
                # It's possible the file is just an XML wrapper and we need to dig deeper
                raise ValueError("No mxGraphModel found in XML")
                
            root_cell = model.find('root')
            if root_cell is None:
                return topology

            # Temporary storage to map internal IDs to readable IDs
            id_map = {} 
            
            # Iteration 1: Identify Nodes (vertex=1)
            for cell in root_cell.findall('mxCell'):
                is_vertex = cell.get('vertex') == '1'
                is_edge = cell.get('edge') == '1'
                cell_id = cell.get('id')
                parent_id = cell.get('parent')
                value = cell.get('value', '')
                style = cell.get('style', '')

                # Skip default layers/parents (usually 0 and 1)
                if cell_id in ['0', '1']:
                    continue

                if is_vertex:
                    # Clean the label (remove HTML)
                    label = self._clean_html_label(value) if value else f"Node_{cell_id}"
                    
                    # Generate a clean ID
                    clean_id = self._generate_id(label, cell_id)
                    id_map[cell_id] = clean_id
                    
                    # Determine styling
                    role = self._parse_style_for_role(style)
                    
                    # Handle Grouping (if it has children, it's a group, but in Draw.io
                    # groups are also vertices. For now treat all vertices as potential nodes)
                    # We can refine this later by checking if other cells point to this as parent.
                    
                    # Geometry extraction (optional, but good for relative layout)
                    geo = cell.find('mxGeometry')
                    pos = {}
                    if geo is not None:
                        if geo.get('x'): pos['x'] = float(geo.get('x'))
                        if geo.get('y'): pos['y'] = float(geo.get('y'))
                    
                    node = {
                        "id": clean_id,
                        "label": label,
                        "role": role,
                        "meta": {"drawio_id": cell_id}
                    }
                    if pos:
                        node['x'] = pos.get('x', 0)
                        node['y'] = pos.get('y', 0)
                        
                    topology['nodes'].append(node)

            # Iteration 2: Identify Links (edge=1)
            for cell in root_cell.findall('mxCell'):
                if cell.get('edge') == '1':
                    source = cell.get('source')
                    target = cell.get('target')
                    
                    if source and target and source in id_map and target in id_map:
                        topology['links'].append({
                            "from": id_map[source],
                            "to": id_map[target],
                            "cable": "ethernet" # Default
                        })

        except ET.ParseError as e:
            print(f"XML Parsing Error: {e}")
            
        return topology

    def _clean_html_label(self, raw_label: str) -> str:
        """Removes HTML tags from labels."""
        clean = re.sub('<[^<]+?>', '', raw_label)
        return clean.strip() or "Unnamed"

    def _generate_id(self, label: str, original_id: str) -> str:
        """Generates a safe ID from a label."""
        if not label or label == "Unnamed":
            return f"NODE_{original_id}"
        
        # Upper case, replace spaces with underscores, remove special chars
        clean_id = label.upper()
        clean_id = re.sub(r'[^A-Z0-9_]', '_', clean_id)
        # Ensure it doesn't start with a number (optional but good practice)
        if clean_id[0].isdigit():
            clean_id = "N_" + clean_id
        return clean_id

    def _parse_style_for_role(self, style_str: str) -> str:
        """
        Analyze the style string to guess the device role.
        Example style: "shape=mxgraph.cisco.routers.router;fillColor=..."
        """
        style_str = style_str.lower()
        
        # Check against our map
        for key, role in self.STYLE_MAP.items():
            if key in style_str:
                return role
                
        # Heuristics
        if 'router' in style_str: return 'router'
        if 'switch' in style_str: return 'switch'
        if 'firewall' in style_str or 'asa' in style_str: return 'firewall'
        if 'server' in style_str: return 'server'
        
        return 'device'
