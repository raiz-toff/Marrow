"""
Hierarchical Tree Layout - Pre-calculated static hierarchical positioning

Features:
1. Proper level separation (vertical spacing between tiers)
2. Horizontal centering of parent nodes above their children
3. Subtree-aware spacing to prevent overlaps
4. HA pair detection for side-by-side placement
5. Support for both UD (up-down) and LR (left-right) directions
"""
import math
from engine.layouts.utils import normalize_layout


def identify_ha_pairs(nodes):
    """
    Identifies High Availability pairs (e.g., Core-A/Core-B, Dist-1/Dist-2).
    """
    pairs = []
    used = set()
    
    levels = {}
    for n in nodes:
        lvl = n.get('level', 3)
        if lvl not in levels:
            levels[lvl] = []
        levels[lvl].append(n)
    
    for lvl, level_nodes in levels.items():
        for i, n1 in enumerate(level_nodes):
            if n1['id'] in used:
                continue
            
            name1 = n1.get('label', n1['id']).lower()
            
            for j, n2 in enumerate(level_nodes):
                if i >= j or n2['id'] in used:
                    continue
                
                name2 = n2.get('label', n2['id']).lower()
                is_pair = False
                
                for suffix_a, suffix_b in [('-a', '-b'), ('1', '2'), ('-1', '-2'), 
                                            ('_a', '_b'), ('_1', '_2'), ('a', 'b')]:
                    if name1.endswith(suffix_a) and name2.endswith(suffix_b):
                        base1 = name1[:-len(suffix_a)]
                        base2 = name2[:-len(suffix_b)]
                        if base1 == base2:
                            is_pair = True
                            break
                
                if is_pair:
                    pairs.append((n1, n2))
                    used.add(n1['id'])
                    used.add(n2['id'])
                    break
    
    return pairs


def calculate_subtree_width(node_id, children_map, node_sizes, min_width=180):
    """
    Recursively calculate the width of a subtree rooted at node_id.
    """
    children = children_map.get(node_id, [])
    
    if not children:
        return node_sizes.get(node_id, min_width)
    
    total_width = 0
    for child in children:
        child_width = calculate_subtree_width(child['id'], children_map, node_sizes, min_width)
        node_sizes[child['id']] = child_width
        total_width += child_width
    
    # Add spacing between children
    total_width += (len(children) - 1) * 50
    
    return max(total_width, min_width)


def position_subtree(node, x_center, y, children_map, node_sizes, 
                     level_height=250, direction='UD', min_spacing=180, key_prefix='hierarchical'):
    """
    Recursively position a node and its subtree.
    
    Args:
        node: The current node
        x_center: X coordinate for this node
        y: Y coordinate for this node (current level)
        children_map: Dict mapping node_id -> list of children
        node_sizes: Dict mapping node_id -> subtree width
        level_height: Vertical gap between levels
        direction: 'UD' (up-down) or 'LR' (left-right)
        key_prefix: Prefix for position keys ('hierarchical' or 'flow')
    """
    key_x = f'{key_prefix}_x'
    key_y = f'{key_prefix}_y'
    
    if direction == 'LR':
        # For left-right, swap x and y semantics
        node[key_x] = y
        node[key_y] = x_center
    else:
        node[key_x] = x_center
        node[key_y] = y
    
    children = children_map.get(node['id'], [])
    if not children:
        return
    
    # Calculate total width needed for children
    total_width = sum(node_sizes.get(c['id'], min_spacing) for c in children)
    total_width += (len(children) - 1) * 50  # Gaps
    
    # Start position (left edge of children block, centered on parent)
    current_x = x_center - total_width / 2
    
    for child in children:
        child_width = node_sizes.get(child['id'], min_spacing)
        child_center = current_x + child_width / 2
        
        # Position child at next level
        child_y = y + level_height
        
        position_subtree(child, child_center, child_y, children_map, node_sizes,
                        level_height, direction, min_spacing, key_prefix)
        
        current_x += child_width + 50  # Move to next position


def apply_hierarchical_layout(nodes, edges=None, width=2000, height=2000, direction='UD', key_prefix='hierarchical'):
    """
    'Hierarchical Tree' Layout:
    - Pre-calculated static positions (no vis.js physics)
    - Subtree-aware spacing to prevent overlaps
    - HA pair detection for balanced placement
    - Supports both UD (up-down) and LR (left-right) directions
    
    Args:
        direction: 'UD' for top-down tree, 'LR' for left-right flow
        key_prefix: Prefix for position keys ('hierarchical' or 'flow')
    """
    if not nodes:
        return
    
    key_x = f'{key_prefix}_x'
    key_y = f'{key_prefix}_y'

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: BUILD HIERARCHY
    # ═══════════════════════════════════════════════════════════════════════════
    node_map = {n['id']: n for n in nodes}
    children_map = {n['id']: [] for n in nodes}
    
    root_nodes = []
    
    for n in nodes:
        pid = n.get('parent')
        if pid and pid in children_map:
            children_map[pid].append(n)
        elif not pid or pid not in node_map:
            root_nodes.append(n)
    
    # Sort children by their label for consistent ordering
    for nid in children_map:
        children_map[nid].sort(key=lambda x: x.get('label', x['id']))
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: IDENTIFY HA PAIRS
    # ═══════════════════════════════════════════════════════════════════════════
    ha_pairs = identify_ha_pairs(nodes)
    pair_map = {}  # node_id -> partner_id
    for n1, n2 in ha_pairs:
        pair_map[n1['id']] = n2['id']
        pair_map[n2['id']] = n1['id']
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: CALCULATE SUBTREE SIZES
    # ═══════════════════════════════════════════════════════════════════════════
    node_sizes = {}
    
    for root in root_nodes:
        root_width = calculate_subtree_width(root['id'], children_map, node_sizes)
        node_sizes[root['id']] = root_width
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: POSITION ROOT NODES
    # ═══════════════════════════════════════════════════════════════════════════
    level_height = 280 if direction == 'UD' else 350
    min_spacing = 200
    
    # Group roots and calculate total width
    total_root_width = sum(node_sizes.get(r['id'], min_spacing) for r in root_nodes)
    total_root_width += (len(root_nodes) - 1) * 100  # Gaps between root trees
    
    current_x = -total_root_width / 2
    y_start = 0
    
    # Handle HA pairs at root level
    positioned_roots = set()
    
    for root in root_nodes:
        if root['id'] in positioned_roots:
            continue
        
        root_width = node_sizes.get(root['id'], min_spacing)
        
        # Check if this root has an HA partner
        partner_id = pair_map.get(root['id'])
        if partner_id and partner_id in node_map:
            partner = node_map[partner_id]
            if partner in root_nodes and partner['id'] not in positioned_roots:
                # Place pair side-by-side with minimal gap
                partner_width = node_sizes.get(partner['id'], min_spacing)
                pair_total_width = root_width + partner_width + 80
                
                # Position first
                root_center = current_x + root_width / 2
                position_subtree(root, root_center, y_start, children_map, node_sizes,
                               level_height, direction, min_spacing, key_prefix)
                
                # Position partner
                partner_center = current_x + root_width + 80 + partner_width / 2
                position_subtree(partner, partner_center, y_start, children_map, node_sizes,
                               level_height, direction, min_spacing, key_prefix)
                
                positioned_roots.add(root['id'])
                positioned_roots.add(partner['id'])
                current_x += pair_total_width + 100
                continue
        
        # Single root
        root_center = current_x + root_width / 2
        position_subtree(root, root_center, y_start, children_map, node_sizes,
                        level_height, direction, min_spacing, key_prefix)
        
        positioned_roots.add(root['id'])
        current_x += root_width + 100
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 5: HANDLE ORPHAN NODES
    # ═══════════════════════════════════════════════════════════════════════════
    orphans = [n for n in nodes if key_x not in n]
    
    if orphans:
        # Place orphans at the bottom in a grid
        cols = math.ceil(math.sqrt(len(orphans)))
        
        # Find the lowest y position
        max_y = max((n.get(key_y, 0) for n in nodes if key_y in n), default=0)
        orphan_y = max_y + level_height
        
        for i, orphan in enumerate(orphans):
            col = i % cols
            row = i // cols
            orphan[key_x] = (col - cols/2) * min_spacing
            orphan[key_y] = orphan_y + row * min_spacing
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 6: NORMALIZE
    # ═══════════════════════════════════════════════════════════════════════════
    normalize_layout(nodes, key_x, key_y, 
                     max_width=width, max_height=height, padding=100)


def apply_flow_layout(nodes, edges=None, width=2000, height=2000):
    """
    'Flow' Layout - Left-to-Right hierarchical layout.
    Stores positions in 'flow_x' and 'flow_y'.
    """
    apply_hierarchical_layout(nodes, edges, width, height, direction='LR', key_prefix='flow')
