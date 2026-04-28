from typing import List, Dict, Any

class GroupProcessor:
    @staticmethod
    def process_all(nodes: List[Dict[str, Any]], raw_groups: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Processes groups for all layout modes, calculating bounding boxes and 
        determining appropriate shapes (Rect vs Hull).
        """
        layouts = {
            'city': ('x', 'y'),
            'radial': ('radial_x', 'radial_y'),
            'campus': ('campus_x', 'campus_y')
        }
        
        processed = {}
        
        for mode, (x_key, y_key) in layouts.items():
            processed[mode] = GroupProcessor.process_layout_groups(nodes, raw_groups, mode, x_key, y_key)
            
        return processed

    @staticmethod
    def process_layout_groups(nodes: List[Dict[str, Any]], raw_groups: List[Dict[str, Any]], mode: str, x_key: str, y_key: str) -> List[Dict[str, Any]]:
        mode_groups = []
        
        for g in raw_groups:
            target_ids = g.get('nodes', [])
            group_nodes = [n for n in nodes if n['id'] in target_ids]
            
            if not group_nodes: continue
            
            # Extract coordinates for this specific layout mode
            # Fallback to 'x'/'y' (standard coords) if the specific layout coord is missing
            xs = [n.get(x_key, n.get('x', 0)) for n in group_nodes]
            ys = [n.get(y_key, n.get('y', 0)) for n in group_nodes]
            
            if not xs or not ys: continue

            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            padding = g.get('padding', 60)
            
            # Determine Shape based on Layout Mode
            # City -> Strict Rectangles (matches grid)
            # Campus/Radial -> Organic Hulls (matches clustering)
            default_shape = 'rect'
            if mode in ['campus', 'radial']:
                default_shape = 'hull'
            
            final_shape = g.get('shape', default_shape)
            
            # For City, force rect even if hull was requested (unless we really want to break the grid)
            if mode == 'city':
                final_shape = 'rect'

            mode_groups.append({
                "name": g.get('name', ''),
                "color": g.get('color', 'rgba(56, 189, 248, 0.1)'),
                "style": g.get('style', 'solid'),
                "shape": final_shape, 
                "x": min_x - padding,
                "y": min_y - padding,
                "w": (max_x - min_x) + (padding * 2),
                "h": (max_y - min_y) + (padding * 2),
                "nodes": g.get('nodes', [])
            })
            
        return mode_groups
